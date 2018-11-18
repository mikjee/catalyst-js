## Watch for changes

Changes to parts of the store can be observed by registering observer callbacks. Callbacks receive the path and the old value of the property that was changed.

Observers are registered, most conveniently among other ways, by accessing the path of the property to be observed, on the `catalyst.observe` object.

```javascript
let catalyst = new Catalyst({a: {b: {c: "Me originally"}}});
let store = catalyst.store;

let id = catalyst.observe.a.b.c((path, oldValue) => console.log(path, oldValue));

store.a.b.c = "I changed";	// Invokes observer.
store.a.b.c = true;			// Invokes it again!
delete store.a;				// And again!
```

In the code above, to observe `a.b.c` we access it as a nested path on `catalyst.observe`, and call the last property in the path as a method, and pass to it our callback. In return we get an `id`, which can be used to un-register the observer, by calling `stopObserve(id)` to stop watching the property for changes.

!> Note that we are accessing the path on the `catalyst.observe` object, not `catalyst.store`.

When observing, you can choose to observe the child properties, including all deeply nested properties, if the path happens to be an object or an array. For a full list of ways to register an observer, see the [observers](observer/register.md) reference.

Now that we know how to look for changes, let us rewind them back, in the next lesson.
