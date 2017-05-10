Rebridge
========

[![npm](https://img.shields.io/npm/v/rebridge.svg?maxAge=2592000)](https://www.npmjs.com/package/rebridge)
[![Build Status](https://travis-ci.org/CapacitorSet/rebridge.svg?branch=master)](https://travis-ci.org/CapacitorSet/rebridge)

Rebridge is a transparent Javascript-Redis bridge. You can use it to create JavaScript objects that are *automatically* synchronized to a Redis database.

## Install

```
npm install rebridge
```

## Usage

### Synchronous, non-blocking usage

```js
const Rebridge = require("rebridge");
const redis = require("redis");

const client = redis.createClient();
const db = new Rebridge(client, {
    mode: "deasync"
});

db.users = [];
db.users.push({
    username: "johndoe",
    email: "johndoe@domain.com"
});
db.users.push({
    username: "foobar",
    email: "foobar@domain.com"
});
db.users.push({
    username: "CapacitorSet",
    email: "CapacitorSet@users.noreply.github.com"
});
console.log("Users:", db.users._value); // Prints the list of users
const [me] = db.users.filter(user => user.username === "CapacitorSet");
console.log("Me:", me); // Prints [{username: "CapacitorSet", email: "..."}]
client.quit();
```

### Asynchronous usage

```js
const Rebridge = require("rebridge");
const redis = require("redis");

const client = redis.createClient();
const db = new Rebridge(client);

db.users.set([])
    .then(() => Promise.all([
        db.users.push({
            username: "johndoe",
            email: "johndoe@domain.com"
        }),
        db.users.push({
            username: "foobar",
            email: "foobar@domain.com"
        }),
        db.users.push({
            username: "CapacitorSet",
            email: "CapacitorSet@users.noreply.github.com"
        })
    ]))
    .then(() => db.users._promise)
    .then(arr => console.log("Users:", arr)) // Prints the list of users
    .then(() => db.users.filter(user => user.username === "CapacitorSet"))
    .then(([me]) => console.log("Me:", me)) // Prints [{username: "CapacitorSet", email: "..."}]
    .then(() => client.quit())
    .catch(err => console.log("An error occurred:", err));
```

## Requirements

Rebridge uses ES6 Proxy objects, so it requires at least Node 6.

## Limitations

* By default, Rebridge objects can't contain functions, circular references, and in general everything for which `x === JSON.parse(JSON.stringify(x))` doesn't hold true. However, you can use a custom serialization function (see below).

* Obviously, you cannot write directly to `db` (i.e. you can't do `var db = Rebridge(); db = {"name": "foo"}`).

## Custom serialization

By default, Rebridge serializes to JSON, but you can pass a custom serialization function. For instance, if you wanted to serialize to YAML, you would do something like this:

```js
const yaml = require("js-yaml");
const db = new Rebridge(client, {
    serialize: yaml.dump,
    deserialize: yaml.load
});
```

## How it works

`Rebridge()` returns an ES6 Proxy object around `{}`. When you try to read one of its properties, the getter intercepts the call, retrieves and deserializes the result from the database, and returns that instead; the same happens when you write to it.

The Proxy will forward the native methods and properties transparently, so that the objects it returns should behave the same as native objects; if this is not the case, file an issue on GitHub.

First-level objects (eg. `db.foo`) correspond to keys in the Redis database; they are serialized using JSON. When requesting deeper objects (eg. `db.foo.bar.baz`), the first-level object (`db.foo`) is deserialized to a native object, which is then accessed in the standard way.
