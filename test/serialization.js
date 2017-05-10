/* eslint-env mocha */

// Same as promiseful.js, but with YAML serialization

const yaml = require("js-yaml");

const assert = require("assert");
const redis = require("redis");
const client = redis.createClient();
const Rebridge = require("../index.js");

const chai = require("chai");
const spies = require("chai-spies");
chai.use(spies);
const serialize = chai.spy(yaml.dump);
const deserialize = chai.spy(yaml.load);

const db = new Rebridge(client, {
	serialize,
	deserialize
});

describe("Custom serialization", function() {
	it(
		"should call custom serializers",
		() => db.example.set(1).then(
			() => chai.expect(serialize).to.have.been.called()
		)
	);
	it(
		"should call custom deserializers",
		() => db.example._promise.then(
			() => chai.expect(deserialize).to.have.been.called()
		)
	);
	it(
		"should preserve values",
		() => db.example.set({foo: {bar: "baz"}})
			.then(() => db.example.foo.bar._promise)
			.then(val => assert.deepStrictEqual(val, "baz"))
	);
});

after(() => client.quit());