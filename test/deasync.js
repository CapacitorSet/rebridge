/* eslint-env mocha */

const assert = require("assert");
const redis = require("redis");
const client = redis.createClient();
const Rebridge = require("../index.js");

const db = new Rebridge(client, {
	lock: true,
	clients: [client],
	mode: "deasync"
});

describe("Deasync mode", function() {
	describe("top level", function() {
		it("should allow setting properties", () => {
			db.hello = {};
			// assert(db.hello == {});
		});
		it("should return undefined on unknown keys", () => {
			assert.equal(db.unknown_key._value, undefined);
		});
		it("should allow the `in` operator", () => {
			assert.equal("hello" in db, true);
		});
		it("should allow the `delete` operator", () => {
			delete db.hello;
			assert.equal("hello" in db, false);
		});
	});
	describe("second level", function() {
		it("should set hello.world", function() {
			db.hello = {};
			db.hello.world = {};
		});
		it("should set hello.world.foo", () => {
			db.hello.world.foo = {};
		});
		it("should set hello.world.foo.bar", () => {
			db.hello.world.foo.bar = true;
		});
		it("should read hello correctly", () => {
			assert.deepStrictEqual(db.hello._value, {world: {foo: {bar: true}}});
		});
		it("should throw on subkeys of unknown keys", () => {
			assert.throws(() => db.unknown_key.unknown_key._value);
		});
		it("should implement the `delete` operator", () => {
			db.example = {
				1: 'one',
				2: 'two',
				3: 'three',
				4: 'four'
			};
			delete db.example[3];
			assert.deepStrictEqual(db.example._value, {1: 'one', 2: 'two', 4: 'four'});
		});
		it("should implement the `in` operator", () => {
			db.example = {
				1: 'one',
				2: 'two',
				3: 'three',
				4: 'four'
			};
			assert.strictEqual(3 in db.example, true);
		});
		it("should implement `push`", () => {
			db.example = [1, 2, 3];
			db.example.push(4);
			assert.deepStrictEqual(db.example._value, [1, 2, 3, 4]);
		});
		it("should implement `pop`", () => {
			db.example = [1, 2, 3, 4];
			assert.strictEqual(db.example.pop(), 4);
			assert.deepStrictEqual(db.example._value, [1, 2, 3]);
		});
		it("should implement `slice`", () => {
			db.example = [1, 2, 3, 4];
			assert.deepStrictEqual(db.example.slice(1, 3), [2, 3]);
		});
		it("should implement `splice`", () => {
			db.example = ["foo", "bar", "baz", "test"];
			assert.deepStrictEqual(db.example.splice(1, 2), ["bar", "baz"]);
			assert.deepStrictEqual(db.example._value, ["foo", "test"]);
		});
		it("should respect forced properties", () => {
			db.example = {push: "foo bar"};
			assert.strictEqual(db.example.__prop_push._value, "foo bar");
		});
		it("should respect forced functions", () => {
			db.example = "foo bar";
			assert.strictEqual(db.example.__func_toUpperCase(), "FOO BAR");
		});
	});
});

after(() => client.quit());