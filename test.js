var Rebridge = require("./index.js"),
	util = require("util");

var db = Rebridge();

util.log("Setting hello");
db.hello = {};

util.log("Setting hello.world");
db.hello.world = {};

util.log("Setting hello.world.foo");
db.hello.world.foo = {};

util.log("Setting hello.world.foo.bar");
db.hello.world.foo.bar = true;

util.log("The next line should contain {foo: {bar: true}}.")
console.log(db.hello.world);

util.log("The next line should contain undefined.");
console.log(db.hello.fake_key);