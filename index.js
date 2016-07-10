var deasync = require("deasync");

module.exports = function BaseJS(client, base = {}, parent, tree) {
	return new Proxy(
		base,
		{
			get: function(obj, key) {
				// Avoid all the weird mess with symbols.
				// After all, any key you can possibly read is a string.
				if (typeof key != typeof "a") return obj[key];
				// Forward the obvious cases
				if (key in obj) return obj[key];
				if (key == "inspect") return "thing";

				var value,
					done = false;

				if (!parent) {
					// Key is parent
					client.get(key, function(err, reply) {
						done = true;
						if (err) throw err;
						value = JSON.parse(reply);
					});
				}
				while (!done) deasync.runLoopOnce();
				try {
					return BaseJS(client, value, key, []);
				} catch(e) {
					return value;
				}
			},
			set: function(obj, key, val) {
				var value,
					done = false;
				if (!parent) {
					// Key is own parent.
					client.set(
						key,
						JSON.stringify(val),
						function(err) { done = true; }
					);
				} else {
					var data = client.get(parent, function(err, reply) {
						reply = JSON.parse(reply);
						reply[key] = val;
						client.set(
							parent,
							JSON.stringify(reply),
							function() { done = true; }
						)
					});
				}
				while (!done) deasync.runLoopOnce();
				return BaseJS(client, value, key, []);
			}
		}
	)
}