const redis = require("redis");
const client = redis.createClient();
const Rebridge = require("./index.js");
const util = require("util");

let db = new Rebridge(client);

util.log("* Setting hello");
db.hello.set({})
.then(() => {
	util.log("* Set.");

	util.log("Setting hello.world");
	return db.hello.world.set({});
})
.then(() => {
	util.log("* Set.");

	util.log("Setting hello.world.foo");
	return db.hello.world.foo.set({});
})
.then(() => {
	util.log("* Set.");

	util.log("Setting hello.world.foo.bar");
	return db.hello.world.foo.bar.set(true);
})
.then(() => {
	util.log("* Set.");

	util.log("The next line should contain {foo: {bar: true}}.");
	return db.hello.world._promise;
})
.then(val => {
	console.log(val);

	util.log("The next line should contain undefined.");
	return db.hello.fake_key._promise;
})
.then(val => {
	console.log(val);

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
	console.log("---------");
	console.log("Experimental test (currently fails):");

	return db.example.replacements.set({
		0: {f: "f"},
		1: {f: "f"},
		2: {f: "f"},
		3: {f: "f"},
		4: {f: "f"}
	});
})
.then(() => {
	const index = "2";
	delete db.example.replacements[index];
})
.then(() => {
	console.log(db.example);
})
.catch(err => console.log(err));