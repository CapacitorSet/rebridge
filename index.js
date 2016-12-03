"use strict";

const assert = require("assert");

// http://stackoverflow.com/a/18937118
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

	schema[path[len - 1]] = value;
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
							if (obj.tree.length > 0) nestedSet(rootValue, obj.tree, val);
							else rootValue = val;
							json = JSON.stringify(rootValue);
							module.exports.redis.hset("rebridge", rootKey, json, err => {
								if (err) return reject(err);
								resolve(val);
							});
						});
					});
				}
				if (key === "push") {
					throw new Error("Pushing to Rebridge objects is not yet supported.");
				}
				if (key === "push") {
					throw new Error("Popping from Rebridge objects is not yet supported.");
				}
				if (key === "slice") {
					throw new Error("Slicing Rebridge objects is not yet supported.");
				}
				if (key === "splice") {
					throw new Error("Splicing Rebridge objects is not yet supported.");
				}
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
				throw new Error("The `delete` operator isn't supported for Rebridge objects.");
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