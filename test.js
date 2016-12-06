/* eslint-env mocha */

const assert = require("assert");
const redis = require("redis");
const client = redis.createClient();
const Rebridge = require("./index.js");

const db = new Rebridge(client);

describe("set", function() {
	it("should set hello", () => db.hello.set({}));
	it("should set hello.world", () => db.hello.world.set({}));
	it("should set hello.world.foo", () => db.hello.world.foo.set({}));
	it("should set hello.world.foo.bar", () => db.hello.world.foo.bar.set(true));
	it(
		"should read hello correctly",
		() => db.hello._promise
			.then(val => assert.deepStrictEqual(val, {world: {foo: {bar: true}}}))
	);
	it("should return undefined on unknown keys", () => db.hello.unknown_key._promise.then(val => assert.equal(val, undefined)));
	it(
		"should implement the `delete` operator",
		() => db.example.set({
			1: 'one',
			2: 'two',
			3: 'three',
			4: 'four'
		})
		.then(() => db.example.delete(3))
		.then(() => db.example._promise)
		.then(val => assert.deepStrictEqual(val, {1: 'one', 2: 'two', 4: 'four'}))
	);
	it(
		"should implement the `in` operator",
		() => db.example.set({
			1: 'one',
			2: 'two',
			3: 'three',
			4: 'four'
		})
		.then(() => db.example.in(3))
		.then(val => assert.strictEqual(val, true))
	);
	it(
		"should implement `push`",
		() => db.example.set([1, 2, 3])
		.then(() => db.example.push(4))
		.then(() => db.example._promise)
		.then(val => assert.deepStrictEqual(val, [1, 2, 3, 4]))
	);
	it(
		"should implement `pop`",
		() => db.example.set([1, 2, 3, 4])
		.then(() => db.example.pop())
		.then(val => assert.strictEqual(val, 4))
		.then(() => db.example._promise)
		.then(val => assert.deepStrictEqual(val, [1, 2, 3]))
	);
	it(
		"should implement `slice`",
		() => db.example.set([1, 2, 3, 4])
		.then(() => db.example.slice(1, 3))
		.then(val => assert.deepStrictEqual(val, [2, 3]))
	);
	it(
		"should implement `splice`",
		() => db.example.set(["foo", "bar", "baz", "test"])
		.then(() => db.example.splice(1, 2))
		.then(val => assert.deepStrictEqual(val, ["bar", "baz"]))
		.then(() => db.example._promise)
		.then(val => assert.deepStrictEqual(val, ["foo", "test"]))
	);
	after(() => client.quit());
});

/*	util.log("The next line should contain [1, 2, 4].");
	return db.hello.set([1, 2, 3, 4]);
})
.then(() => {
	db.hello.splice(2, 1);
	return db.hello._promise;
})
.then(() => {

	util.log("The next line should contain {}.");
	return db.example.set({foo: "bar"});
})
.then(() => {
	delete db.example.foo;
	return db.example._promise;
})
.then(() => {
*/