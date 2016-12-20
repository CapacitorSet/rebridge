"use strict";

const assert = require("assert");
const deasync = require("deasync");
const Redlock = require("redlock");

let redis;
let redlock;
const lockTTL = 1000;
const namespace = "rebridge";

let deasynced;

function promisableGet(rootKey, permissive = false) {
	return new Promise(
		(resolve, reject) => redis.hget(namespace, rootKey, (err, json) => {
			if (err) {
				reject(err);
				return;
			}
			try {
				if (permissive && json === "undefined") return undefined;
				resolve(JSON.parse(json) || {});
			} catch (e) {
				reject(e);
			}
		})
	);
}

function promisableSet(key, val) {
	assert.notStrictEqual(typeof val, "undefined");
	let json = JSON.stringify(val);
	try {
		JSON.parse(json);
	} catch (e) {
		json = "{}";
	}
	return new Promise(
		(resolve, reject) => redis.hset(namespace, key, json, err => {
			if (err) return reject(err);
			resolve();
		})
	);
}

function promisableModify(rootKey, tree, fun) {
	// Yes, it's ugly, but it's needed to keep variables around
	return redlock.lock(rootKey, lockTTL)
		.then(lock => promisableGet(rootKey)
			.then(rootVal => nestedApply(rootVal, tree, fun))
			.then(({newObj, ret}) => promisableSet(rootKey, newObj)
				.then(() => lock.unlock())
				.then(() => ret)
		)
	);
}

// Abstracted version of http://stackoverflow.com/a/18937118.
// Note: this _does not work_ with nested set
function nestedApply(obj, path, fun) {
	if (path.length === 0) {
		const _ret = fun(obj);
		return {
			ret: _ret,
			newObj: obj
		};
	}
	// https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
	let newObj = obj;
	const last = path.pop();
	for (const elem of path) {
		if (!newObj[elem])
			newObj[elem] = {};
		newObj = newObj[elem];
	}
	const ret = fun(newObj[last]);
	return {
		ret,
		newObj
	};
}

function nestedSet(obj, path, value) {
	assert.notStrictEqual(typeof value, "undefined");
	let newObj = obj;
	const last = path.pop();
	for (const elem of path) {
		if (!newObj[elem])
			newObj[elem] = {};
		newObj = newObj[elem];
	}

	return (newObj[last] = value);
}

/* Gets a "root value" from Redis (i.e. one stored in a Redis hash),
 * deserializes it from JSON, and returns a promise.
 * Also contains a "tree" property, which is used when navigating the
 * deserialized object.
 */
function RedisWrapper(key) {
	return {
		_promise: new Promise(
			(resolve, reject) => redis.hget(
				"rebridge",
				key,
				(err, json) => {
					if (err) return reject(err);
					try {
						const val = JSON.parse(json);
						return resolve(val);
					} catch (e) {
						return reject(e);
					}
				}
			),
			[]
		),
		tree: []
	};
}

function ProxiedWrapper(promise, rootKey) {
	return new Proxy(
		promise,
		{
			get: (obj, key) => {
				// _promise property
				if (key === "_promise") {
					return obj._promise.then(value => {
						while (obj.tree.length > 0) {
							const curKey = obj.tree.shift();
							value = value[curKey];
						}
						return value;
					});
				}
				// Standard stuff
				if (typeof key === "symbol" || key === "inspect" || key in obj)
					return obj[key];
				// .set special Promise
				if (key === "set") {
					return val => promisableGet(rootKey, true)
						.then(rootValue => {
							let ret;
							if (obj.tree.length > 0) {
								ret = nestedSet(rootValue, obj.tree, val);
							} else {
								ret = (rootValue = val);
							}
							return promisableSet(rootKey, rootValue).then(() => ret);
						});
				}
				// .delete special Promise
				if (key === "delete")
					return prop => promisableModify(rootKey, obj.tree, item => delete item[prop]
					);
				// .in special Promise
				if (key === "in")
					return prop => promisableModify(rootKey, obj.tree, item => prop in item);

				const forceFunc = /^__func_/.test(key);
				const forceProp = /^__prop_/.test(key);
				/*
				This is complex, but rather elegant.
				If the user is calling an Array method (eg. push), it returns a promise.
				This promise walks the `rootKey` object using `obj.tree` as a path, and
				applies the given function passing the same arguments.

						| Eg. if `key` is `"push"` and `rootKey` is
						|
						|     {
					|         a: {
					|             b: {
					|                 c: [1]
					|             }
					|         }
					|     }
					|
					| and `obj.tree` is `["a", "b", "c"]`, it will return a function
					| that navigates the object until `a.b.c` (i.e. `[1]`), and will
					| call
					|
					|     item => item["push"].apply(item, arguments)
					|
					| on that. So, when the function is actually executed (eg.
					| `db.foo.a.b.c.push(10)`), it will call `item => item.push(10)`.
				 */
				if (forceFunc || (!forceProp && key in Array.prototype)) {
					if (forceFunc)
						key = key.replace(/^__func_/i, "");
					return function() {
						return promisableModify(rootKey, obj.tree, item => item[key].apply(item, arguments));
					};
				}
				if (forceProp)
					key = key.replace(/^__prop_/i, "");
				obj.tree.push(key);
				return new ProxiedWrapper(obj, rootKey);
			},
			set: (obj, prop, val) => {
				if (!deasynced)
					throw new Error("Can't assign values to Rebridge objects, use the .set() Promise instead");
				let done = false;
				let err;
				promisableGet(rootKey, true)
					.then(rootValue => {
						if (obj.tree.length > 0) {
							nestedSet(rootValue, obj.tree, val);
						} else {
							rootValue = val;
						}
						return promisableSet(rootKey, rootValue);
					})
					.then(r => {
						done = true
					})
					.catch(e => {
						done = true;
						err = e;
					});
				deasync.loopWhile(() => !done);
				if (err) throw err;
				return true;
			},
			has: () => {
				throw new Error("The `in` operator isn't supported for Rebridge objects, use the .in() Promise instead.");
			},
			deleteProperty: () => {
				throw new Error("The `delete` operator isn't supported for Rebridge objects, use the .delete() Promsie instead");
			}
		}
	);
}

// Catches "reads" of db.foo, and returns a wrapper around the deserialized value from Redis.
class Rebridge {
	constructor(client, {lock, clients, mode} = {
		lock: true,
		clients: [client],
		mode: "promise"
	}) {
		deasynced = mode == "deasync";
		redis = client;
		if (lock)
			redlock = new Redlock(clients);
		else // Use a dummy lock
			redlock = {
				lock: () => Promise.resolve({
					unlock: () => Promise.resolve()
				})
			};
		return new Proxy({}, {
			get: (obj, key) => {
				if (key in obj) {
					return obj[key];
				}
				assert.deepEqual(typeof key, "string");
				if (key === "set")
					throw new Error("You can't call .set on the root object. Syntax: db.foo.set(bar)");
				if (key === "in")
					return key => new Promise(
						(resolve, reject) => redis.hexists(
							namespace,
							key,
							(err, val) => {
								if (err) return reject(err);
								resolve(val === 1);
							}
						)
					);
				if (key === "delete")
					return key => new Promise(
						(resolve, reject) => redis.hdel(
							namespace,
							key,
							err => {
								if (err) return reject(err);
								resolve(true);
							}
						)
					);
				return new ProxiedWrapper(new RedisWrapper(key), key);
			},
			set: (target, prop, val) => {
				if (!deasynced)
					throw new Error("Can't assign values to Rebridge objects, use the .set() Promise instead");
				let done = false;
				let err = null;
				redis.hset(namespace, prop, JSON.stringify(val), e => {
					done = true;
					err = e;
				});
				deasync.loopWhile(() => !done);
				if (err) throw err;
			},
			has: () => {
				throw new Error("The `in` operator isn't supported for Rebridge objects, use the .in() Promise instead");
			},
			deleteProperty: () => {
				throw new Error("The `delete` operator isn't supported for Rebridge objects, use the .delete() Promise isntead");
			}
		});
	}
}

module.exports = Rebridge;