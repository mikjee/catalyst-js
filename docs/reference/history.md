## record()

Resumes recording history. Recording is on by default.

If recording was stopped using multiple calls to [stopRecord()](#stopRecord), equivalent number of calls will be required to resume the history recording.

#### Syntax

```javascript
catalyst.record()
```

#### Parameters

None.

#### Return

None.

---

## stopRecord()

Stops history recording. Can be stacked by calling multiple number of times.

!> Beware of side-effects! Stopping recording, making updates to the store and then resuming recording will make the updated part of the store unaccounted for in the history.

#### Syntax

```javascript
catalyst.stopRecord()
```

#### Parameters

None.

#### Return

None.

---

## history

An array of objects representing each step in the history.

Can be fed during initialization of the store (see [constructor](reference/store.md#constructor)), or later on by using the [historyFeed](#historyFeed) callback.

This should be serialized and saved, along with the `store` and [historyCurrent](#historyCurrent), to acheive a persistent undoable history for your app's user-interactions.

Changes done to the store, or navigating through history updates this array and invokes the [history observer](#observeHistory) callback.

#### Syntax

```javascript
catalyst.history
```

#### Structure

Each history step consists of the following properties.
 - `timestamp`: An unique timestamp that can be used when saving or loading history from the backend. Synonymous to high-resolution UNIX time, with an added incremental counter for uniqueness per record.
 - `changelog`: Array of operations to be executed on `undo()`.
 - `oplog`: Array of operations to be executed on `redo()`. Created on-the-fly upon `undo()`.

---

## isHistoryDisabled

Number of `stopRecord()` calls that are on the stack. Can be used as truthy or falsy.

Setting this to `0` or `false` will resume recording. Setting this to `true` or any number will stack up `stopRecord()` calls of equivalent number.

#### Syntax

```javascript
catalyst.isHistoryDisabled = false;
```

---

## undo()

Restores store to previously recorded state.

Invokes observers. Does not invoke interceptors. Invokes [historyFeed](#historyFeed) callback if number of steps to be undone are more than number of steps present in the `ctalyst.history` array.

!> Undoing will dissolve [fragments](reference/fragments.md#augment) and break references where a property path is changing from an object-type to value type or `undefined`.

#### Syntax

```javascript
catalyst.undo(steps, defer)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| steps | `number` | Optional | The number of history records to undo. Each record is consider a single atomic entity regardless of how many operations it has (see [batching](#batch)). `1` by default. |
| defer | `boolean` | Optional | If true, notifies observers AFTER undoing the given number of steps. If false, notifies observers WHILE undoing (see [deferObservers()](reference/observers.md#deferObservers)). `true` by default. |

#### Return

The number of steps that were successfully undone.

---

## redo()

Restores store to previously updated state.

Invokes observers. Does not invoke interceptors. Does **NOT** invoke `historyFeed` callback.

!> Redoing will dissolve [fragments](reference/fragments.md#augment) and break references where a property path is changing from an object-type to value type or `undefined`.

#### Syntax

```javascript
catalyst.redo(steps, defer)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| steps | `number` | Optional | The number of history records to redo. Each record is consider a single atomic entity regardless of how many operations it has (see [batching](#batch)). `1` by default. |
| defer | `boolean` | Optional | If true, notifies observers AFTER redoing the given number of steps. If false, notifies observers WHILE redoing (see [deferObservers()](reference/observers.md#deferObservers)). `true` by default. |

#### Return

The number of steps that were successfully re-done.

---

## historyCurrent

A number that represents the current positional index/state of the store in history. `0` represents the most recent state. Any positive number indicates that those many steps have been undone. `undo()` and  `redo()` calls update this number.

Setting this number manually will invoke a number of `undo()` or `redo()` calls to restore the store to that absolute index in history.

!> Undoing or redoing will dissolve [fragments](reference/fragments.md#augment) and break references where a property path is changing from an object-type to value type or `undefined`.

#### Syntax

```javascript
catalyst.historyCurrent = 0
```

---

## historyFeed

A callback that is invoked when the number of history steps to be undone is greater than the number of history steps available in the `history` array (Catalyst has run out steps to undo).

#### Syntax

```javascript
function (required, target, timestamp) {...}
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| required | `number` |  | The index of the first history record required, relative to the most recent history record. |
| target | `number` |  | The index of the last history record required, as part of multi-undo operation. |
| timestamp | `string` |  | The unique timestamp of the oldest history record currently available to Catalyst, that has been undone. |

#### Return

Catalyst expects callback to return an array of history steps from right before the oldest step undone (based on `timestamp`).

If no more records exist, return falsy.

---

## commit()

Destroys redoable steps later (more recent) than `currentHistory` index.

Also automatically called if updates are made to the store when current state is not the most recent.

#### Syntax

```javascript
catalyst.commit()
```

#### Parameters

None.

#### Return

None.

---

## prune()

Evicts undoable steps from memory, for memory optimization purposes.

#### Syntax

```javascript
catalyst.prune(keep)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| keep | `number` | Optional | The number of history records to keep, starting from most recent. If `keep` is less than `currentHistory`, `currentHistory` will be used instead. Defaults to [historyLimit](#historyLimit). |

#### Return

An array of `history` records that were removed from memory.

---

## historyLimit

A number that defines the maximum number of undoable steps (starting from the most recent) to keep in memory.

Triggers [prune()](#prune) when the number is crossed.

#### Syntax

```javascript
catalyst.historyLimit = 200;
```

---


## batch()

Starts bundling changes made to the store henceforth into a single atomic history step.

Can be called multiple times to stack up. Each stacked call will have it's own way of bundling the change ops (see below). When stacked, requires an equivalent number of calls to [stopBatch()](#stopBatch) to effectively stop batching.

#### Syntax

```javascript
catalyst.batch(aggregate, preserveOrder)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| obj | `boolean` | Optional | If `true, `combines updates to the same property into a single update. `false` by default. |
| obj | `boolean` | Optional | If `true` and `aggregate=true`, preserve order of updates to different properties.`false` by default. |

#### Return

None.

---

## stopBatch()

Stops batching, for the most recent stacked [batch()](#batch) call. Marks the beginning of a new history record if the stack is empty.

#### Syntax

```javascript
catalyst.stopBatch()
```

#### Parameters

None.

#### Return

None.

---

## isHistoryBatched

The number of stacked `batch()` calls. Can be used as truthy or falsy.

Setting this number manually will invoke a number of `batch()` or `stopBatch()` calls, to make the stack size equal to this value.

Setting this value to truthy or falsy will start one, or cancel all `batch()` calls on the stack.

#### Syntax

```javascript
isHistoryBatched = false
```

---

## historyBatchModes

An array of objects repsenting the batch modes started started by calls to `batch()`. This represents the batching stack, with the last item in the array being the currently effective batch mode.

!> Do **NOT** modify this array or it's nested properties.

#### Syntax

```javascript
catalyst.historyBatchModes
```

---

## observeHistory()

Registers a callback to be invoked when history records are created, updated or deleted. Useful for serializing the application's user interaction history.

#### Syntax

```javascript
catalyst.observeHistory(fn)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| fn | `function` | Required | The function to be used as the callback. See [history observer](#historyObserverCallback). |

#### Return

If successful, a positive integer representing the ID, to be used when un-registering the observer. `false` if unsuccessful.

!> This ID **CANNOT** be used with `stopObserve()`, but [stopObserveHistory()](#stopObserveHistory).

---

## stopObserveHistory()

Unregisters observeHistory callback.

#### Syntax

```javascript
catalyst.stopObserveHistory(id)
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| id | `number` | Required | The ID that was returned on registering the callback. |

#### Return

`true` or `false` on whether the un-registration was successful.

---

## History observer callback

A callback that is invoked when history records are added, updated or deleted.

#### Syntax

```javascript
function (type, historyRecord, store) {...}
```

#### Parameters

| Param | Type |     | Description |
|  ---  | ---  | --- |     ---     |
| type | `string` | | Operation type to be performed by backend. One of `"add"` / `"delete"` / `"update"`. This represent the operation to be performed on the backend on the given `historyRecord` object, with respect to storing it in a DB. |
| historyRecord | `object` | | The history record that is the subject of the change. Supports `JSON.stringify()`. Contains an unique `timestamp` field. See [history](#history). |
| store | `object` | | The Catalyst base store. Supports `JSON.stringify()`. To be serialized and persisted along with the `historyRecord` and `catalyst.historyIndex`. |

#### Return

None.
