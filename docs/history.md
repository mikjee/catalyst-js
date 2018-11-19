## Undo

Catalyst records changes to the store by serializing the old value of the changed property. These changes can be played back to restore the store to a previous state by calling the `undo()` method.

```javascript
store.a = 0;
store.a = 1;
store.a = 2;
store.a = 3;

catalyst.undo();
console.log(store.a);	// Prints 2

catalyst.undo(2);		// Undo 2 steps
console.log(store.a);	// Prints 0.

catalyst.undo();		// Undo to before existence.
console.log(store.a);	// Prints undefined.
```

Undoing (or redoing) invokes observers as the changes are played back. Since observers can exist even if a property is non-existant, any registered observers will be valid regardless of the store's position in history.

!> Do **NOT** apply cascading changes to the store in observer callbacks. This will have side effects on the history.

When Catalyst runs out of history steps to undo, it can invoke a callback to feed it history from before what has been undone already.

?> See the [observeHistory](history/observeHistory.md) and [historyFeed](history/historyFeed.md) reference for how to save and load hsitory steps on-demand from your backend server. 

## Redo

A `redo()` operation is very similar to an `undo()` operation except, obviously, in the other direction. If a change is made to the store after undoing, `redo()` operation will be disabled and the current operation would be marked as the most recent change.

## Batch

If multiple changes need to the grouped together to be a single atomic history step, use the `batch()` & `stopBatch()` method.

```javascript
store.a = 1;			// Initial

catalyst.batch();		// Starts batching mode
store.a = 2;
store.a = 3;
store.a = 4;
catalyst.stopBatch();	// Stops batching mode

catalyst.undo();
console.log(store.a);	// Prints 1.

catalyst.redo();
console.log(store.a); 	// Prints 4.
```

Batch operations can be very useful in debouncing multiple consecutive updates to the store, and treating them as singular - like a click-n-drag to draw operation on MS Paint.

?> For a full list of possibilities with batching, see the [batch](history/batch.md) reference.

Now, let us learn how to prevent changes from happening, and validate them.
