"use strict";

const assert = require("assert");

function promisableModify(rootKey, tree, fun) {
	return new Promise((resolve, reject) => {
		module.exports.redis.hget("rebridge", rootKey, (err, json) => {
			if (err) return reject(err);
			let rootValue = JSON.parse(json) || {};
			if (rootValue === null) rootValue = {};
			const ret = nestedApply(rootValue, tree, fun);
			const newJson = JSON.stringify(rootValue);
			module.exports.redis.hset("rebridge", rootKey, newJson, err => {
				if (err) return reject(err);
				resolve(ret);
			});
		});
	});
}

// Abstracted version of http://stackoverflow.com/a/18937118.
// Note: this _does not work_ with nested set
function nestedApply(obj, path, fun) {
	if (path.length === 0) return fun(obj);
	// https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
	let schema = obj;
	const len = path.length;
	for (let i = 0; i < len - 1; i++) {
		const elem = path[i];
		if (!schema[elem]) schema[elem] = {};
		schema = schema[elem];
	}
	return fun(schema[path[len - 1]]);
}

function nestedSet(obj, path, value) {
	assert.notStrictEqual(typeof value, "undefined");
	let schema = obj; // a moving reference to internal objects within obj
	const len = path.length;
	// This can _not_ be refactored to for..of
	for (let i = 0; i < len - 1; i++) {
		const elem = path[i];
		if (!schema[elem]) schema[elem] = {};
		schema = schema[elem];
	}

	return (schema[path[len - 1]] = value);
}

/* Gets a "root value" from Redis (i.e. one stored in a Redis hash),
 * deserializes it from JSON, and returns a promise.
 * Also contains a "tree" property, which is used when navigating the
 * deserialized object.
 */
function RedisWrapper(key) {
	return {
		_promise: new Promise(
			(resolve, reject) => module.exports.redis.hget(
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
				if (typeof key === "symbol" || key === "inspect" || key in obj) {
					const ret = obj[key];
					if (key === "_promise") {
						return ret.then(value => {
							while (obj.tree.length > 0) {
								const curKey = obj.tree.shift();
								value = value[curKey];
							}
							return value;
						});
					}
					return ret;
				}
				if (key === "set") {
					return val => new Promise((resolve, reject) => {
						module.exports.redis.hget("rebridge", rootKey, (err, json) => {
							if (err) return reject(err);
							let rootValue = JSON.parse(json);
							if (rootValue === null) rootValue = {};
							const ret = (obj.tree.length > 0) ?
								nestedSet(rootValue, obj.tree, val) :
								(rootValue = val);
							const newJson = JSON.stringify(rootValue);
							module.exports.redis.hset("rebridge", rootKey, newJson, err => {
								if (err) return reject(err);
								resolve(ret);
							});
						});
					});
				}
				if (key === "delete") {
					return prop => promisableModify(rootKey, obj.tree, item => delete item[prop]);
				}
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
				if (key in Array.prototype)
					return function() {
						return promisableModify(rootKey, obj.tree, item => item[key].apply(item, arguments));
					};
				obj.tree.push(key);
				return new ProxiedWrapper(obj, rootKey);
			},
			set: () => {
				throw new Error("Can't assign values to Rebridge objects, use the .set() Promise instead");
			},
			has: () => {
				throw new Error("The `in` operator isn't supported for Rebridge objects.");
			},
			deleteProperty: () => {
				throw new Error("The `delete` operator isn't supported for Rebridge objects, use the .delete() Promsie instead");
			}
		}
	);
}

// Catches "reads" of db.foo, and returns a wrapper around the deserialized value from Redis.
class Rebridge {
	constructor(client) {
		module.exports.redis = client;
		return new Proxy({}, {
			get: (obj, key) => {
				if (key in obj) {
					return obj[key];
				}
				assert.deepEqual(typeof key, "string");
				if (key === "set") {
					throw new Error("You can't call .set on the root object. Syntax: db.foo.set(bar)");
				}
				return new ProxiedWrapper(new RedisWrapper(key), key);
			},
			set: () => {
				throw new Error("Can't assign values to Rebridge objects, use the .set() Promise instead");
			},
			has: () => {
				throw new Error("The `in` operator isn't supported for Rebridge objects.");
			},
			deleteProperty: () => {
				throw new Error("The `delete` operator isn't supported for Rebridge objects.");
			}
		});
	}
}

module.exports = Rebridge;