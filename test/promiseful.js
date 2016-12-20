/* eslint-env mocha */

const assert = require("assert");
const redis = require("redis");
const client = redis.createClient();
const Rebridge = require("../index.js");

const db = new Rebridge(client);

describe("Promiseful mode", function() {
	describe("top level", function() {
		it("should not allow setting properties", () => assert.throws(() => db.hello = true));
		it("should not set", () => assert.throws(() => db.set("hello")));
		it(
			"should return undefined on unknown keys",
			() => db.unknown_key._promise
				.then(val => assert.equal(val, undefined))
		);
		it("should not allow the `in` operator", () => assert.throws(() => "hello" in db));
		it(
			"should support the .in promise",
			() => db.hello.set(true)
				.then(() => db.in("hello"))
				.then(val => assert.strictEqual(val, true))
		);
		it("should not allow the `delete` operator", () => assert.throws(() => delete db.hello));
		it(
			"should support the .delete promise",
			() => db.hello.set(true)
				.then(() => db.delete("hello"))
				.then(() => db.in("hello"))
				.then(val => assert.strictEqual(val, false))
		);
	});
	describe("second level", function() {
		it("should not allow setting properties", () => assert.throws(() => db.hello.world = true));
		it("should set hello.world", () => db.hello.set({}).then(() => db.hello.world.set({})));
		it("should set hello.world.foo", () => db.hello.world.foo.set({}));
		it("should set hello.world.foo.bar", () => db.hello.world.foo.bar.set(true));
		it(
			"should read hello correctly",
			() => db.hello._promise
				.then(val => assert.deepStrictEqual(val, {world: {foo: {bar: true}}}))
		);
		it(
			"should throw on subkeys of unknown keys",
			() => new Promise((resolve, reject) => db.unknown_key.unknown_key._promise.then(reject).catch(resolve))
		);
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
		it(
			"should respect forced properties",
			() => db.example.set({push: "foo bar"})
				.then(() => db.example.__prop_push._promise)
				.then(val => assert.strictEqual(val, "foo bar"))
		);
		it(
			"should respect forced functions",
			() => db.example.set("foo bar")
				.then(() => db.example.__func_toUpperCase())
				.then(val => assert.strictEqual(val, "FOO BAR"))
		);
	});
});

after(() => client.quit());