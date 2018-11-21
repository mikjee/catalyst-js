## Validate changes

While observers allow you to react to committed changes, interceptors allow you to validate the changes. Interceptors act similar to a middleware, changing or mutating the intended new value, or even preventing a change. They are registered similar to observers, but by accessing the property path on the `catalyst.intercept` object, like so.

```javascript
let nextEven = n => (n % 2 == 0) ? n : (n + 1);

let id = catalyst.intercept.a.b.c((path, newValue) => nextEven(newValue));

store.a = {b: {c: 1}};
console.log(store.a.b.c);	// Prints 2.

store.a.b.c = 4;
console.log(store.a.b.c);	// Prints 4.

store.a.b.c = 5;
console.log(store.a.b.c);	// Prints 6.
```

Interceptor callback is passed the property path and the new intended value of the property. Similar to observers, they can intercept the child or deeply nested child properties too.

?> See all ways of registering an interceptor in the [intercept](reference/interceptors.md#intercept) reference.

However, unlike observers, interceptors are expected to return a value. The value returned is treated as the effective new value for the changed property. If the value returned by an interceptor is undefined, the property will be deleted.

Interceptors can be chained together and are invoked in the order in which they are registered. Each interceptor in the chain is passed the returned value from the previous.

Interceptors are un-registered using the `stopIntercept()` method, that takes the `id` of the installed interceptor.

## Cascade changes

Interceptor callbacks can make changes to the store directly. Such changes will be automatically batched into a single history step.

```javascript
let together = n => store.b = n;
catalyst.intercept.a((path, newValue) => { together(newValue); return newValue; });

store.a = 1;
console.log(store.a, store.b);		// Prints 1,1

store.a = 2;
console.log(store.a, store.b);		// Prints 2,2

catalyst.undo();
console.log(store.a, store.b);		// Prints 1,1

catalyst.redo();
console.log(store.a, store.b);		// Prints 2,2
```

Due to their position as being eligible for making cascading changes, interceptors are **NOT** invoked when undoing or redoing history. Interceptors are to be regarded as more of a draft whereas observers are the publication, and history only deals with published and accepted changes, not drafts or validations.

Now that the basics are learnt, let us see the best practises when sharing the state with multiple entities or components.
