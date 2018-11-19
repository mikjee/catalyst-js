## Create a store

To create a store, we instantiate the Catalyst class. All functionality is exposed via the class instance.

```javascript
let catalyst = new Catalyst();
```

You can also pass in an object to the Catalyst constructor, to instantiate the store with a default state.

```javascript
let obj = {a: {b: {c: "Hello world!"}}};
let catalyst = new Catalyst(obj);
```

?> For the full list of arguments that can be passed, see the [constructor](basic/constructor.md) reference.

## Access the store

The store is available via `catalyst.store` object. It behaves similar to a normal Javascript object, and you can make changes to it.

```javascript
catalyst.store.a.b.c = "Awesome!";
console.log(catalyst.store.a.b.c);
```

You cannot change the top level store object `catalyst.store`, but you can set properties to it, like other objects, arrays, values. For a full list of supported types, see the [types](basic/types.md) reference.

For ease, you can simply obtain a reference to the store object, like so.

```javascript
let store = catalyst.store;
store.a.b.c = "Simple!";
console.log(store.a.b.c);
```

You can now mutate the store however you like, add or remove properties of the supported types - which brings us to observing the changes.

On to the next lesson!
