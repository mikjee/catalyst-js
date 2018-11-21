## observe()

Looks for changes to existing or non-existing part of the store.

When called via a fragment, the observer will be un-registered when the fragment [dissolves](reference/fragments.md#dissolve).

#### Syntax

```javascript
catalyst.observe(obj)
```

or

```javascript
catalyst.observe(path)
```

or

```javascript
catalyst.observe.property1.property2.[..].propertyN()
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| pathOrObject | `string` or `object` | Required | An object reference or a string path (depends on syntax) that represents any part of the store. When `observe()` is called via a fragment, if the argument is not an object, the path is considered relative to the [fragmentPath](reference/fragments.md#fragmentPath). |
| fn | `function` | Required | Invoked when the observed part of the store changes. Do NOT update the store here. See [observer callback](#observer-callback). |
| children | `boolean` | Optional | If `true`, looks for changes to nested child properties. `false` by default. |
| deep | `boolean` | Optional | If `true`, looks for changes to the entire nested object tree. Overrides `children`. `false` by default. |
| init | `boolean` | Optional | If `true`, invokes the callback once immediately after successful registration. `true` by default. |

#### Return

If successful, a positive integer representing the ID, to be used when un-registering the observer. `false` if unsuccessful.

---

## Observer callback

Invoked when the observed part of the store changes.

!> Do **NOT** update the store in observer callbacks.

#### Syntax

```javascript
function (path, oldValue, origin, opPath, opOldValue) {...}
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| path | `string` | | The path of the changed part of the store, relative to the origin. |
| oldValue | `any` | | Value of the part of the store before the change. |
| origin | `object` | | The catalyst or the fragment object via which the observer was registered. |
| opPath | `string` | | The path to the top-level part of the store, relative to the base store, which was originally changed. Could be different from path for child and deep observers. |
| opOldValue | `any` | | Value of the top-level part of the store which was originally changed. |

#### Return

None.

---

## stopObserve()

Unregisters observe callback.

#### Syntax

```javascript
catalyst.stopObserve(id)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| id | `number` | Required | The ID that was returned on registering the callback. |

#### Return

`true` or `false` on whether the un-registration was successful.

---

## deferObservers()

Defers all observer callbacks until [resumeObservers()](#resumeObservers) is called. Can be called multiple times to stack up observer callbacks.

#### Syntax

```javascript
catalyst.deferObservers()
```

#### Parameters

None.

#### Return

None.

---

## resumeObservers()

Stops deferring observers and invokes deffered callbacks.

When used as part of multiple stacked `deferObservers()`, only callbacks deferred corresponding to the resumed level of the stack will be invoked. Needs to be called as many times as `deferObservers()` to completely stop deferring callbacks.

#### Syntax

```javascript
catalyst.resumeObservers(all);
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| all | `boolean` | Optional | If true, invokes callbacks from all stacked defers. `false` by default. |

#### Return

None.

---

## refresh()

Invokes all callbacks observing a given part of the store. Unaffected by `deferObservers()`.

#### Syntax

```javascript
catalyst.refresh(obj)
```

or

```javascript
catalyst.refresh(path)
```

or

```javascript
catalyst.refresh.property1.property2.[..].propertyN()
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| pathOrObject | `string` or `object` | Required | An object reference or a string path (depends on syntax) that represents any part of the store. When `refresh()` is called via a fragment, if the argument is not an object, the path is considered relative to the [fragmentPath](reference/fragments.md#fragmentPath). |

#### Return

None.

---

## isObserveDeferred

Number representing the count of deferred observervation stacks.

Setting this value to a number will invoke `deferObservers()` or `resumeObservers()` the difference number of times.

Otherwise, setting this value to a truthy or falsy will either call `deferObservers()` once, or call `resumeObservers()` with `all=true`.

#### Syntax

```javascript
catalyst.isObserveDeferred = true
```
