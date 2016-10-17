var Rebridge = require("./index.js");
var util = require("util");

var db = new Rebridge();

util.log("Setting hello");
db.hello = {};

util.log("Setting hello.world");
db.hello.world = {};

util.log("Setting hello.world.foo");
db.hello.world.foo = {};

util.log("Setting hello.world.foo.bar");
db.hello.world.foo.bar = true;

util.log("The next line should contain {foo: {bar: true}}.");
console.log(db.hello.world);

util.log("The next line should contain undefined.");
console.log(db.hello.fake_key);

util.log("The next line should contain [1, 2, 4].");
db.hello = [1, 2, 3, 4];
db.hello.splice(2, 1);
console.log(db.hello);

util.log("The next line should contain {}.");
db.example = {foo: "bar"};
delete db.example.foo;
console.log(db.example);