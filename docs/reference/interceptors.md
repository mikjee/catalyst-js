## intercept()

Intercepts (or validates) changes to an existing (or non-existing) part of the store. Think middleware.

Supports cascading updates to the store. Can be chained together by registering multiple interceptors to the same part of the store.

When called via a fragment, the interceptor will be un-registered when the fragment [dissolves](reference/fragments.md#dissolve).

#### Syntax

```javascript
catalyst.intercept(obj)
```

or

```javascript
catalyst.intercept(path)
```

or

```javascript
catalyst.intercept.property1.property2.[..].propertyN()
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| obj | `string` | Required | An object reference or a string path (depends on syntax) that represents any part of the store. When `intercept()` is called via a fragment, if the argument is not an object, the path is considered relative to the [fragmentPath](reference/fragments.md#fragmentPath). |
| fn | `function` | Required | Invoked when the intercepted part of the store changes. See [interceptor callback](#interceptor-callback). |
| children | `boolean` | Optional | If `true`, intercepts changes to nested child properties. `false` by default. |
| deep | `boolean` | Optional | If `true`, intercepts changes to the entire nested object tree. Overrides `children`. `false` by default. |

#### Return


If successful, a positive integer representing the ID, to be used when un-registering the interceptor. `false` if unsuccessful.

---

## Interceptor callback

Invoked when the intercepted part of the store changes.

Updates to store done inside the callback (cascaded changes) will be [batched](reference/history.md#batch) together as a single atomic history step. If [isHistoryBatched](reference/history.md#isHistoryBatched) is truthy (meaning already ongoing batching), this will be combined with the ongoing batching, but in a non-aggregated manner.

#### Syntax

```javascript
function (path, newValue, origin, opPath, opNewValue) {...}
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| path | `string` | | The path of the property marked for change, relative to the origin. |
| newValue | `any` | | New intended value of the property. `undefined` indicates deletion. |
| origin | `object` | | The catalyst or the fragment object via which the interceptor was registered. |
| opPath | `string` | | The path to the top-most part of the store, relative to the base store, which is being changed. Could be different from `path` for child and deep interceptors. |
| opNewValue | `any` | | New intended value of the top-most part of the store which is being changed. |

#### Return

Catalyst expects the callback to return the new intended value of the property marked for change.

If the return is same (reference compare) as the current value, the change will be aborted and no history will be recorded.

If the return is `undefined`, the property will be marked for deletion.

If the return is `undefined`, and the property is an object-type, it's nested properties interceptors will also be notified recursively for deletion.

If the `newValue` is `undefined`, and a non-undefined is returned, this property, as well as any parent property that had been marked for deletion, will not be deleted, so as to preserve this property and it's new non-undefined value. Any sibling properties, however, will still get deleted, unless intercepted.

Returns will be passed onto the next chained interceptor, in case multiple interceptors are listening to the same property, in the order of their registration.

---

## stopIntercept()

Unregisters interceptor.

#### Syntax

```javascript
catalyst.stopIntercept(id)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| id | `number` | Required | The ID that was returned on registering the callback. |

#### Return

`true` or `false` on whether the un-registration was successful.
