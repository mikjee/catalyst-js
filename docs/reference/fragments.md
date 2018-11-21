## fragment()

Creates a new fragment, freezes reference and allows relative access to the given part of the state.

!> The path on which the fragment is created needs to be a valid existing part of the store at the time of creation. While the fragment exists, that path will not change it's reference or get deleted. See [preserveFragments](#preserveFragments).

If a fragment is created from another fragment object, the two fragments have no shared relation or heirarchy, and will act as independant fragments overall, regardless of their paths.

#### Syntax

```javascript
catalyst.fragment(obj, onDissolve)
```

or

```javascript
catalyst.fragment(path, onDissolve)
```

or

```javascript
catalyst.fragment.property1.property2.[..].propertyN(onDissolve)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| pathOrObject | `string` or `object` | Required | An object reference or a string path (depends on syntax) that represents any object/array part of the store. The path needs to be a **valid, existing** part of the store. When `fragment()` is called via a fragment object, if the argument is not an object, the path is considered relative to the [fragmentPath](reference/fragments.md#fragmentPath). |
| onDIssolve | `function` | Optional | Invoked when the fragment is dissolved. Can be used for external clean-up. Do **NOT** update the store here! |

#### Return

A new fragment object.

The following methods of the returned object will take in path relative to the [fragmentPath](#fragmentPath). If no path is passed to these methods while invoking them on the fragment, the `fragmentPath` would be automatically used as the path.
 - [observe()](reference/observers.md#observe)
 - [intercept()](reference/interceptors.md#intercept)
 - [isFragment()](#isFragment)
 - fragment()
 - [augment()](#augment)
 - [refresh()](reference/observers.md#refresh)
 - [parse()](reference/store.md#parse)
 - [parent()](reference/store.md#parent)

!> Observers and interceptors registered via the fragment object will be un-registered automatically when the fragment is dissolved.

The object also exposes the [dissolve()](#dissolve) method, which is to be used to dissolve the fragment.

!> `undo()` or `redo()` operations will automatically dissolve any fragments whose reference needs to be destroyed, for example if an object is transitioning to a value, or is being deleted, while going backward or forward in history.

---

## dissolve()

Dissolves a fragment, invokes it's `onDissolve` callback, and unfreezes it's reference if no other fragments exist on the same property path.

!> Do **NOT** make updates to the store in the `onDissolve` callback.

#### Syntax

```javascript
fragment.dissolve()
```

#### Parameters

None.

#### Return

None.

---

## augment()

Dissolves all fragments on a given path or part of the state.

!> Does **NOT** dissolve any 'nested' or 'child' fragments, as fragments have no heirarchy.

#### Syntax

```javascript
fragment.augment(obj)
```

or

```javascript
fragment.augment(path)
```

or

```javascript
fragment.augment.property1.property2.[..].propertyN()
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| pathOrObject | `string` or `object` | Required | An object reference or a string path (depends on syntax) that represents any object/array part of the store. When `augment()` is called via a fragment object, if the argument is not an object, the path is considered relative to the [fragmentPath](reference/fragments.md#fragmentPath). |

#### Return

None.

---

## fragmentPath

The full path of the fragment relative to the base store. The path of the base store is an empty string.

#### Syntax

```javascript
fragment.fragmentPath
```

---

## isFragment()

Returns the number of fragments on the given path or store object. Can be used in a truthy or falsy sense.

#### Syntax

```javascript
catalyst.isFragment(obj)
```

or

```javascript
catalyst.isFragment(path)
```

or

```javascript
catalyst.isFragment.property1.property2.[..].propertyN()
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| pathOrObject | `string` or `object` | Required | An object reference or a string path (depends on syntax) that represents any object/array part of the store. When `isFragment()` is called via a fragment object, if the argument is not an object, the path is considered relative to the [fragmentPath](reference/fragments.md#fragmentPath). |

#### Return

Number of fragments of the given path.
