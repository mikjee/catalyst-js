## Watch for changes

Changes to parts of the store can be observed by registering observer callbacks. Callbacks receive the path and the old value of the property that was changed.

Observers are registered, most conveniently among other ways, by accessing the path of the property to be observed, on the `catalyst.observe` object.

```javascript
let id = catalyst.observe.a.b.c((path, oldValue) => console.log(path, oldValue));

store.a.b.c = "I changed";	// Invokes observer.
store.a.b.c = true;			// Invokes it again!
delete store.a;				// And again!
```

In the code above, to observe `a.b.c` we access it as a nested path on `catalyst.observe`, and call the last property in the path as a method, and pass to it our callback. In return we get an `id`, which can be used to un-register the observer.

```javascript
catalyst.stopObserve(id);
```

## Observation depth

You can choose to observe the child properties, including all deeply nested properties, if the path happens to be an object or an array.

```javascript
let observeChild = true;
let observeDeep = true;

let id = catalyst.observe.a.b.c((path, oldValue) => console.log(path, oldValue), observeChild, observeDeep);

store.a.b.c = {};			// Top level
store.a.b.c.d = {};			// Child
store.a.b.c.d.e = {};		// Deep
store.a.b.c.d.e.f = {} 		// Deep
```

?> For a full list of ways to register an observer, see the [observers](reference/observers.md#observe) reference.

!> Do **NOT** apply cascading changes to the store in the observer callback. We will see how to do that later in the lessons.

Now that we know how to look for changes, let us rewind them back, in the next lesson.
