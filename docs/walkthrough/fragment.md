## Separate concerns

One easy way of distributing the state to different components / entities is to obtain a reference to any part of the store object and pass it to the entity. Catalyst [preserves references](reference/store.md#preserveReferences) by default, so any update to the parent of the `ref` will reflect in the `ref` as well.

```javascript
store.a = {b: {c: true}};
let ref = store.a.b;

ref.c = false;
console.log(store.a.b.c);	// Prints false

store.a = {b: {c: 1}};
console.log(ref.c);			// Prints 1.
```

However a pitfall arises when the parent is set to a value-type, or gets deleted. In such a case, the `ref` is no longer a part of the store and (and will never be, despite undoing), and will stop recording changes, firing observers or interceptors, to prevent side-effects.

```javascript
store.a = {b: {c: true}};
let ref = store.a.b;

delete store.a;				// Oopsie !
ref.c = false;				// Ref is now a normal JS object, not part of catalyst.
```

## Fragments

To deal with the above issue, as well as provide a relative reference to the store, fragments come to our aid. A fragment can be created from any **existing** object or array portion of the store.

```javascript
store.a = {b: {c: true}};
let fragment = catalyst.fragment.a.b();

console.log(fragment.store);	// Prints {c: true}

store.a = {b: {c: 1}};			// Valid.
console.log(fragment.store.c);	// Prints 1.

delete store.a;					// Has no effect!
```

Apart from freezing the references leading to the fragmented portion of the store, fragments also expose `observe()`, `intercept()` and other methods that can be used **relative** to the fragmented path.

?> For the full specs of methods exposed by fragment, see the [fragments](reference/fragments.md#fragment) reference.

## Dissolving fragments

A fragment is dissolved by calling the `fragment.dissolve()` method. Doing so un-freezes the references and un-registeres any observers etc installed through the fragment. Additionally a callback can be provided to the `catalyst.fragment()` method, which is invoked upon dissolution of the fragment, and can be used to clean up any resources outside of the store.

```javascript
store.a = {b: {c: true}};
let fragment = catalyst.fragment.a.b(() => console.log('I be gone!'));

fragment.dissolve(); 	// Prints 'I be gone!'
```

!> Fragments will be auto-dissolved while undoing or redoing!

Fragments are not nested and they do not have any heirarchy except to the base catalyst object. Multiple fragments can be installed on the same path, irrespective of one another. To dissolve all fragments of a path, use `catalyst.augment()`.

Now that you have the big picture of what Catalyst is all about, time to dig in to the implementation details - with React.
