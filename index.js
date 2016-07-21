var deasync = require("deasync");

module.exports = function Rebridge(client) {
	if (!client) {
		var redis = require("redis");
		client = redis.createClient();
	}
	return _Rebridge(client);
};

function _Rebridge(client, base = {}, inTree = []) {
	// Yeah, that's a bit weird, but it works.
	// "inTree" is the list of ancestors, with the generating ancestor as the first
	// element and the immediate parent as the last.
	return new Proxy(
		base,
		{
			get: function(obj, key) {
				// Avoid all the weird mess with symbols.
				// After all, any key you can possibly read is a string.
				// Not sure this is needed tho.
				if (typeof key !== typeof "a") return obj[key];
				// Forward the obvious cases
				if (key in obj && !obj.hasOwnProperty(key)) return obj[key];
				if (key === "inspect") return "thing";

				// Array cloning
				var tree = inTree.slice(0);

				var value;
				var done = false;

				tree.push(key); // Add self to descendants

				if (tree.length === 1) {
					// Key is parent
					client.get(key, function(err, reply) {
						done = true;
						if (err) throw err;
						value = JSON.parse(reply);
					});
				} else {
					var parent = tree.shift();
					client.get(parent, function(err, reply) {
						done = true;
						if (err) throw err;
						value = JSON.parse(reply);
						value = tree.reduce(
							(x, d) => d in x ? x[d] : undefined,
							value
						);
						tree.unshift(parent); // Fix the array
					});
				}

				while (!done) deasync.runLoopOnce();
				if (value === undefined) return undefined;
				try {
					return _Rebridge(client, value, tree);
				} catch (e) {
					return value;
				}
			},
			set: function(obj, key, val) {
				// Array cloning
				var tree = inTree.slice(0);

				var value;
				var done = false;

				tree.push(key); // Add self to descendants

				if (tree.length === 1) {
					client.set(key, JSON.stringify(val), function(err) {
						done = true;
						if (err) throw err;
						value = val;
					});
				} else {
					var parent = tree.shift();
					client.get(parent, function(err, reply) {
						if (err) throw err;
						value = JSON.parse(reply);
						editTree(value, tree, val);
						client.set(
							parent,
							JSON.stringify(value),
							function(err) {
								done = true;
								if (err) throw err;
							}
						);
						tree.unshift(parent); // Fix the array
					});
				}
				while (!done) deasync.runLoopOnce();
				try {
					return _Rebridge(client, value, tree);
				} catch (e) {
					return value;
				}
			}
		}
	);
}

function editTree(tree, path, newValue) {
	if (path.length === 0) return newValue;
	let key = path.shift();
	if (tree[key])
		tree[key] = editTree(tree[key], path, newValue);
	else
		tree[key] = newValue;
	return tree;
}