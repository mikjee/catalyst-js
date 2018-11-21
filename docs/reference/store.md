## Constructor

Creates a new Catalyst store.

#### Syntax

```javascript
new Catalyst(obj, history, historyCurrent, historyFeed, accessor)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| obj | `object` | Optional | Base object to create the store from. **CANNOT** be an array. |
| history | `array` | Optional | Array of history steps, recent to oldest. [More info](reference/history#history) |
| historyCurrent | `number` | Optional | The current state of the store relative to history steps. Most recent is 0. [More info](reference/history#historyCurrent) |
| historyFeed | `function` | Optional | A callback function to be invoked when undo runs out of steps. [More info](reference/history#historyFeed) |
| accessor | `string` | Optional |  Character to be used as separation / accessor in nested property paths. Defaults to ".". [More info](reference/store#accessor) |

#### Return

A new Catalyst object providing access to all functionality - `store`, observation, interception, history and fragmentation.

---

## store

Proxified object representing the state. This object cannot be changed, but only have the properties (keys) modified.

#### Syntax

```javascript
catalyst.store
```

---

## accessor

Character being used as separation / accessor in nested property paths. Used internally, as well as when using the string-based property paths to register observers etc.

!> This is set using the [constructor](#constructor), and should not be changed in the lifeime of the app, and the serialized history.

#### Syntax

```javascript
catalyst.accessor
```

---

## parse()

Parses a nested property path string, and returns the part of the store that it represents.

#### Syntax

```javascript
catalyst.parse(path)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| path | `string` | Required | The path containing the properties, separated by the accessor character. |

#### Return

The part of the store represented by the path.

---

## path()

Takes a part of the store and returns the path of the object relative to the base store.

#### Syntax

```javascript
catalyst.path(obj)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| obj | `object` | Required | An object reference to any part of the store. |

#### Return

The string-based path of the object relative to the base store.

---

## parent()

Takes a part of the store and returns the parent of that object in the store.

#### Syntax

```javascript
catalyst.parent(obj)
```

or

```javascript
catalyst.parent(path)
```

or

```javascript
catalyst.parent.property1.property2.[...].propertyN()
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| pathOrObject | `string` or `object` | Required | An object reference or a string path (depends on syntax) that represents any part of the store. |

#### Return

An object reference to the parent of the given path or object.

---

## preserveReferences

If `true`, mutates objects in the store instead of creating new ones, upon object assignment.
If `false`, creates new references on every object assignment.
Defaults to `true`.

Setting this to `false` can have side-effects on references that are not [fragments](reference/fragments.md). This setting does not effect affect fragments reference behavior. See [preserveFragments](reference/fragments#preserveFragments).

#### Syntax

```javascript
catalyst.preserveReferences = true
```
