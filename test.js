var BaseJS = require("./index.js"),
	redis = require("redis"),
	client = redis.createClient();

var db = BaseJS(client);

db.hello = {e:'z'};
db.hello.world = [1, ["we lollo"], 3];

db.hello.test = "e";

console.log(db.hello.world);