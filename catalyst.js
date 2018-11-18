"use strict";

export default class Catalyst {

	// ---------------------------
	// CONSTRUCTOR
	// ---------------------------

	/**
	* Creates a new state store.
	* @constructor
	* @param {Object} obj - The base object to create the store from.
	* @param {Object[]} history - Array of history steps, recent to oldest. Obtained by historyObservers.
	* @param {number} historyCurrent - The current state of the store relative to history steps. Most recent is 0.
	* @callback historyFeed - Function called when Catalyst runs out of undoable steps - to be fed older history.
	* @param {char} accessor - Character to be used as separation/ accessor in nested property paths.
	* @returns {Object} The state store.
	*/
	constructor(obj, history = [], historyCurrent = 0, historyFeed, accessor = ".") {

		// Check - cannot create store with array as base!
		let objType = typeof obj;
		if (objType != "undefined") {
			if (Array.isArray(obj)) throw "Expected object, got array.";
			else if (objType != "object") throw "Expected object, got value.";
		}

		// PREP
		// ----

		this.accessor = accessor;											// PUBLIC:
		this.resolveMode = false;											// PRIVATE:
		this.resolveContext = false;										// PRIVATE:
		this.preserveReferences = true;										// PUBLIC:
		this.preserveFragments = true;										// PUBLIC:

		// History - supports undo/redo, batched operations, aggregation!
		this.history = history;												// PRIVATE:
		this.historyFeed = historyFeed || ((required, target, timestamp) => false);	// PUBLIC:
		this.historyLogger = this.logChange.bind(this);						// PUBLIC:
		this.historyLimit = 0; 												// PUBLIC: NOTE: best way to auto-prune is to use a setInterval and call prune ? Since multiple ops can trigger multiple autoprune calls! // TODO: Auto-prune might malfunction after history is fed via feed!
		this.historyBatchModes = [];										// PRIVATE:
		this.historyDisabled = 0;											// PUBLIC:
		this.historyCurrent = historyCurrent;								// PUBLIC:
		this.historyBatched = 0;											// PUBLIC:
		this.historyObservers = {};											// PRIVATE:
		this.batchStarter = this.batch.bind(this);							// PRIVATE:
		this.batchStopper = this.stopBatch.bind(this);						// PRIVATE:
		this.prunePending = false;											// PRIVATE:

		// Fragments - creates top-level-like state-chunks that preserve the reference to the main chunk.
		this.fragmented = {};
		this.fragments = {};

		// Observer - does NOT support cascading changes to the store and can have side effects on history as they are called on undo-redo!
		this.observers = {};												// PRIVATE:
		this.observed = {prop: {}, child:{}, deep: {}};						// PRIVATE:
		this.observerNotifier = this.notifyObservers.bind(this);			// PRIVATE:
		this.observeAsync = true;											// PUBLIC: Whether observers are triggered asynchronously (via Promise microtask) !
		this.observeDeferred = 0;											// PUBLIC: Whether observations are batched together!
		this.observations = {												// PRIVATE:
			stacks: [],		// Array of maps
			paths: {}		// paths to stack index
		};

		// Interceptor - supports cascading changes to the store and are auto-batched to be atomic! They are not executed on undo/redo!
		this.interceptors = {};												// PRIVATE:
		this.intercepted = {prop: {}, child:{}, deep: {}};					// PRIVATE:
		this.interceptorNotifier = this.notifyInterceptors.bind(this);		// PRIVATE:
		this.setterLevel = 0;												// PRIVATE:
		this.setterBatched = false;											// PRIVATE:

		// STORE CREATION
		// ----

		// Proxify and create our store
		this.root = {};
		this.store = this.proxify(this.root, this, "", []);

		// Add the user provided object to the store - one prop at a time!
		this.stopRecord();
		for (var prop in obj) this.store[prop] = obj[prop];
		this.record();

		// CONTROLLER CREATION
		// ---

		// Prep catalyst controllers
		let getAccessor = () => this.accessor,

			getPreserveReferences = () => this.preserveReferences,
			setPreserveReferences = value => this.preserveReferences = value,

			getPreserveFragments = () => this.preserveFragments,
			setPreserveFragments = value => this.preserveFragments = value,

			getHistoryCurrent = () => this.historyCurrent,
			setHistoryCurrent = index => (index >= this.historyCurrent ? (index == this.historyCurrent ? false : this.undo(index - this.historyCurrent)) : this.redo(this.historyCurrent - index)),

			getHistoryLimit = () => this.historyLimit,
			setHistoryLimit = limit => { this.historyLimit = limit; this.prune(); },

			getHistory = () => this.history,

			getHistoryFeed = () => this.historyFeed,
			setHistoryFeed = fn => this.historyFeed = fn,

			getHistoryDisabled = () => this.historyDisabled,
			setHistoryDisabled = value => {
				if (typeof value == "number") {
					if (value < 0) value = 0;
					this.historyDisabled = value;
				}
				else if (value) this.historyDisabled = this.historyDisabled || 1;
				else this.historyDisabled = 0;
			},

			getHistoryBatched = () => this.historyBatched,
			setHistoryBatched = value => {
				if (typeof value == "number") {
					if (value > this.historyBatched) {
						if (this.historyBatched == 0) this.batch();
					}
					else if (value < this.historyBatched) {
						if (value < 0) value = 0;
						if (this.historyBatched > 0)
							while (this.historyBatched > value)
								this.stopBatch();
					}
				}
				else if (value) {
					if (!this.historyBatched) this.batch();
				}
				else {
					if (this.historyBatched)
						while (this.historyBatched > 0)
							this.stopBatch();
				}
			},

			getHistoryBatchModes = () => this.historyBatchModes,

			getObserveAsync = () => this.observeAsync,
			setObserveAsync = value => this.observeAsync = value,

			getObserveDeffered = () => this.observeDeferred,
			setObserveDeffered = value => {
				if (typeof value == "number") {
					if (value > this.observeDeffered) {
						if (this.observeDeffered == 0) this.deferObservers();
					}
					else if (value < this.observeDeffered) {
						if (value < 0) value = 0;
						if (this.observeDeffered > 0)
							while (this.observeDeffered > value)
								this.resumeObservers();
					}
				}
				else if (value) {
					if (!this.observeDeffered) this.deferObservers();
				}
				else {
					if (this.observeDeffered)
						while (this.observeDeffered > 0)
							this.resumeObservers();
				}
			},

			getStore = () => this.store,

			getIsFragment = function(pathOrObject) {
				if (typeof pathOrObject == "undefined") return 0;
				else if (typeof pathOrObject == "object") return this.isFragment(pathOrObject);
				else if (typeof pathOrObject == "string") return this.isFragment(pathOrObject);
				else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
			};

		// TODO: write parsable comments on functions and purpose of variables - also mark if they are to be used by user or internal only!
		// TODO: must have ability to add functions to the store! like ToJSON etc. Esp to areas not recorded ! - WONT work as it will stop recording due to use of JSON in history creation!
		// TODO: ObserveAsync is not working - always sync!

		// Access to controllers
		this.catalyst = {

			get accessor() { return getAccessor(); },

			get preserveReferences() { return getPreserveReferences(); },
			set preserveReferences(value) { setPreserveReferences(value); },

			get preserveFragments() { return getPreserveFragments(); },
			set preserveFragments(value) { setPreserveFragments(value); },

			record: this.record.bind(this),
			stopRecord: this.stopRecord.bind(this),

			batch: this.batch.bind(this),
			stopBatch: this.stopBatch.bind(this),

			undo: this.undo.bind(this),
			redo: this.redo.bind(this),
			commit: this.commit.bind(this),
			prune: this.prune.bind(this),

			observeHistory: this.observeHistory.bind(this),
			stopObserveHistory: this.stopObserveHistory.bind(this),

			get history() { return getHistory(); },

			get historyCurrent() { return getHistoryCurrent(); },
			set historyCurrent(index) { return setHistoryCurrent(index); },

			get historyLimit() { return getHistoryLimit(); },
			set historyLimit(limit) { setHistoryLimit(limit); },

			get historyFeed() { return getHistoryFeed(); },
			set historyFeed(fn) { setHistoryFeed(fn); },

			get isHistoryDisabled() { return getHistoryDisabled(); },
			set isHistoryDisabled(value) { setHistoryDisabled(value); },

			get isHistoryBatched() { return getHistoryBatched(); },
			set isHistoryBatched(value) { setHistoryBatched(value); },

			get historyBatchModes() { return getHistoryBatchModes(); },

			parse: this.parse.bind(this),
			path: this.path.bind(this),
			parent: this.parent.bind(this),
			fragment: this.metaProxify(this.fragment, this),
			isFragment: this.metaProxify(getIsFragment, this),
			get fragmentPath() { return ""; },
			augment: this.metaProxify(this.augment, this),

			observe: this.metaProxify(function (pathOrObject, fn, children = false, deep = false, init = true)
					{ return this.observe(pathOrObject, fn, children, deep, init, this.catalyst); }, this),
			stopObserve: this.stopObserve.bind(this),
			deferObservers: this.deferObservers.bind(this),
			resumeObservers: this.resumeObservers.bind(this),
			refresh: this.metaProxify(this.refresh, this),

			get isObserveAsync() { return getObserveAsync(); },
			set isObserveAsync(value) { setObserveAsync(value); },

			get isObserveDeferred() { return getObserveDeffered(); },
			set isObserveDeferred(value) { setObserveDeffered(value); },

			intercept: this.metaProxify(function (pathOrObject, fn, children = false, deep = false)
						{ return this.intercept(pathOrObject, fn, children, deep, this.catalyst); }, this),
			stopIntercept: this.stopIntercept.bind(this),

			get store() { return getStore(); }

		};

		// All done - Return the catalyst
		return this.catalyst;

	}

	// ---------------------------
	// HISTORY METHODS
	// ---------------------------

	timestamp() {

		let timestamp = Date.now();

		if (timestamp == this._timestamp) this._timestampCounter ++;
		else {
			this._timestamp = timestamp;
			this._timestampCounter = 1;
		}

		return timestamp.toString() + (("00" + this._timestampCounter).slice(-3));
	}

	/**
	* Resumes history recording. Stackable.
	*/
	record() {
		this.historyDisabled --;
		if (this.historyDisabled < 0) this.historyDisabled = 0;
	}

	/**
	* Stops history recording. Stackable. WARNING! Can cause side-effects in history recording.
	*/
	stopRecord() {
		this.historyDisabled ++;
	}

	/**
	* Starts combining multiple history records into a single atomic step. Stackable.
	* @param {boolean} aggregate - Combine updates to the same property into a single update.
	* @param {boolean} history - Preserve order of updates to different properties. Effective only when aggregate is true.
	*/
	batch(aggregate = false, preserveOrder = true) {

		// If this is the first batch switch, add a new history array to hold all the batched ops.
		if (!this.historyBatched) this.history.push({ timestamp: this.timestamp(), changelog: [] });

		// Turn on batch mode!
		this.historyBatched ++;
		this.historyBatchModes.push({aggregate, preserveOrder, count: 0, map: {}});

	}

	/**
	* Stops batching and marks the beginning of a new history step. Stackable.
	*/
	stopBatch() {

		// Notify flag
		let notify = false;

		// Prune Flag
		let prune = false;

		// Are we stopping an ongoing batch op recording?
		if (this.historyBatched > 0) {

			// Are we stopping a batch op that aggregates but does not preserves order ?
			if (this.historyBatchModes[this.historyBatched - 1].aggregate &&
				(!this.historyBatchModes[this.historyBatched - 1].preserveOrder)) {

				// Prep
				let map = this.historyBatchModes[this.historyBatched - 1].map;

				// Add the mapped changelogs to the array of changelogs
				for(var prop in map) this.history[this.history.length - 1].changelog.push(map[prop]);

			}

			// Remove active batch recording mode
			this.historyBatchModes.splice(-1, 1);

			// Have we just stopped all batch ops ? - meaning we have a valid history record!
			if (this.historyBatched == 1) {

				// Remove previous history if it has empty changelog!
				if (this.history[this.history.length - 1].changelog.length == 0) this.history.splice(-1, 1);

				// Send notification of completion of history
				else notify = true;

				// Signal auto prune
				prune = true;

			}

		}

		// Decrement counter
		this.historyBatched --;
		if (this.historyBatched < 0) this.historyBatched = 0;

		// Notify?
		if (notify) this.notifyHistoryObservers(this.history[this.history.length - 1], "add");

		// Prune?
		if (prune && this.historyLimit && !this.prunePending) {
			this.prunePending = true;
			Promise.resolve(true).then(() => this.prune());
		}

	}

	logChange(str) {

		// Are we recording
		if (!!this.historyDisabled) return false;

		// Commit redo steps!
		this.commit();

		// Record normally
		if (!this.historyBatched) {
			this.history.push({ timestamp: this.timestamp(), changelog: [str] });
			this.notifyHistoryObservers(this.history[this.history.length - 1], "add");
			if (this.historyLimit && !this.prunePending) {
				this.prunePending = true;
				Promise.resolve(true).then(() => this.prune());
			}
		}

		// Record Batched
		else {

			// Aggregation needed?
			if (this.historyBatchModes[this.historyBatched - 1].aggregate) {

				// Preserve order
				if (this.historyBatchModes[this.historyBatched - 1].preserveOrder) {

					// Prep
					let tol = this.history[this.history.length - 1].changelog.length;

					// Check if we are the first, both all-batched-wise and current-batchmode-wise
					if ((tol > 0) && (this.historyBatchModes[this.historyBatched - 1].count > 0)) {

						// Split into prop and value
						let newProp = str.slice(0, str.indexOf("=")),
							lastProp = this.history[this.history.length - 1].changelog[tol - 1]
								.slice(0, this.history[this.history.length - 1].changelog[tol - 1].indexOf("="));

						// Check if last prop is as same as current - add new changelog if not!
						if (newProp != lastProp) {
							this.history[this.history.length - 1].changelog.push(str);
							this.historyBatchModes[this.historyBatched - 1].count ++;
						}

						// Same prop - replace last changelog only if nothing has happened on it before - to represent the oldest undo state!
						//else this.history[this.history.length - 1].changelog[tol - 1] = str; // WARNING! this is erroneous as undo op should be the initial state before the history begins !

					}

					// We are the first  - direct add!
					else {
						this.history[this.history.length - 1].changelog.push(str);
						this.historyBatchModes[this.historyBatched - 1].count ++;
					}

				}

				// No order - Compress more
				else {

					// Prep
					let prop = str.slice(0, str.indexOf("="));

					// Add the op only if nothing has happened on it before - to represent the oldest undo state!
					if (typeof this.historyBatchModes[this.historyBatched - 1].map[prop] == "undefined")
						this.historyBatchModes[this.historyBatched - 1].map[prop] = str;
					//this.historyBatchModes[this.historyBatched - 1].map[prop] = str; // WARNING! this is erroneous as undo op should be the initial state before the history begins !

				}

			}

			// No aggregation - Add to changelog directly
			else this.history[this.history.length - 1].changelog.push(str);

		}

		// All done
		return true;

	}

	/**
	* Restores store to previously recorded state. Does not invoke interceptors. Will dissolve fragments and break references where necessary.
	* @param {number} steps - The number of history records to undo.
	* @param {boolean} defer - If true, notifies observers AFTER undoing the given number of steps. If false, notifies observers WHILE undoing.
	* @returns {number} The number of steps that were successfully undone.
	*/
	undo(steps = 1, defer = true) {

		// Prep
		let historyTarget = this.historyCurrent + steps;
		let stepsCount = 0;
		let timestamp = null;

		// Initial timestamp
		if (this.history.length == this.historyCurrent) {
			if (this.history.length > 0) timestamp = this.history[0].timestamp;
			else timestamp = this.timestamp();
		}
		else timestamp = this.history[this.history.length - this.historyCurrent - 1].timestamp;

		// Install blank logger - don't mess up the history!
		this.historyLogger = () => false;

		// Install blank intercept notifier
		this.interceptorNotifier = (_, __, ___, newValue) => newValue;

		// Install blank batch ops starter & stopper
		this.batchStarter = () => false;
		this.batchStopper = () => false;

		// Nullify fragment preservation
		let preserveFragments = this.preserveFragments;
		this.preserveFragments = false;

		// Start observe defer mode
		if (defer) this.deferObservers();

		// Undo 'step' number of history, one changelog at a time each.
		while (this.historyCurrent < historyTarget) {

			// Check if we have the next history
			if (this.history.length - this.historyCurrent == 0) {

				// Request history feed
				let feed = typeof this.historyFeed == "function" ? this.historyFeed(this.historyCurrent + 1, historyTarget, timestamp) : false;

				// Check if we got anything
				if (!feed) break;

				// Add the feed to our history
				this.history.unshift(...feed);

			}

			// Obtain the next history
			let history = this.history[this.history.length - this.historyCurrent - 1];

			// Create future - for redo
			if (!history.oplog) history.oplog = [];

			// Loop through the changelog
			for (var changeIndex = history.changelog.length - 1; changeIndex >= 0; changeIndex --) {

				// Prep
				let change = history.changelog[changeIndex];

				// Parse
				let sepIndex = change.indexOf("=");
				let prop = change.slice(0, sepIndex);
				let value = change.slice(sepIndex + 1);

				// More prep
				let pointer = this.store;
				let levels = prop.split(this.accessor);
				levels.shift();

				// Traverse
				for (var levelIndex = 0; levelIndex < levels.length - 1; levelIndex ++) pointer = pointer[levels[levelIndex]];

				// Install custom log utility
				if (history.oplog.length < history.changelog.length - changeIndex) this.historyLogger = historyStr => {
					history.oplog.unshift(historyStr) || true;
					this.historyLogger = () => false;
					return true;
				}

				// Execute op
				if (!value.length) delete pointer[levels[levels.length - 1]];
				else pointer[levels[levels.length - 1]] = JSON.parse(value);

			}

			// Update timestamp
			timestamp = history.timestamp;

			// Move to next step
			stepsCount ++;
			this.historyCurrent ++;

			// Notify
			this.notifyHistoryObservers(history, "update");

		}

		// Stop Observe defer mode
		if (defer) this.resumeObservers();

		// Restore fragment preservation
		this.preserveFragments = preserveFragments;

		// Restore batch Ops starter and stopper
		this.batchStarter = this.batch.bind(this);
		this.batchStopper = this.stopBatch.bind(this);

		// Restore intercept notifier
		this.interceptorNotifier = this.notifyInterceptors.bind(this);

		// Restore log utility to default
		this.historyLogger = this.logChange.bind(this);

		// All done - return the number of successful undone steps
		return stepsCount;

	}

	/**
	* Restores store to previously updated state. Does not invoke interceptors. Will dissolve fragments and break references where necessary.
	* @param {number} steps - The number of history records to redo.
	* @param {boolean} defer - If true, notifies observers AFTER redoing the given number of steps. If false, notifies observers WHILE redoing.
	* @returns {number} The number of steps that were successfully redone.
	*/
	redo(steps = 1, defer = true) {

		// Sanity Check
		if (this.historyCurrent == 0) return 0;

		// Prep
		let historyTarget = this.historyCurrent - steps;
		let stepsCount = 0;

		// Validity reset
		historyTarget = historyTarget < 0 ? 0 : historyTarget;

		// Install blank logger - don't mess up the history!
		this.historyLogger = () => false;

		// Install blank intercept notifier
		this.interceptorNotifier = (_, __, ___, newValue) => newValue;

		// Install blank batch ops starter & stopper
		this.batchStarter = () => false;
		this.batchStopper = () => false;

		// Nullify fragment preservation
		let preserveFragments = this.preserveFragments;
		this.preserveFragments = false;

		// Start observe defer mode
		if (defer) this.deferObservers();

		// Undo 'step' number of history, one changelog at a time each.
		while (this.historyCurrent > historyTarget) {

			// Obtain the current history
			let history = this.history[this.history.length - this.historyCurrent];

			// Loop through the oplog
			for (var opIndex = 0; opIndex < history.oplog.length; opIndex ++) {

				// Prep
				let op = history.oplog[opIndex];

				// Parse
				let sepIndex = op.indexOf("=");
				let prop = op.slice(0, sepIndex);
				let value = op.slice(sepIndex + 1);

				// More prep
				let pointer = this.store;
				let levels = prop.split(this.accessor);
				levels.shift();

				// Traverse
				for (var levelIndex = 0; levelIndex < levels.length - 1; levelIndex ++) pointer = pointer[levels[levelIndex]];

				// Execute op
				if (!value.length) delete pointer[levels[levels.length - 1]];
				else pointer[levels[levels.length - 1]] = JSON.parse(value);

			}

			// Delete the oplog - save memory
			delete history.oplog;

			// Move to next step
			stepsCount ++;
			this.historyCurrent --;

			// Notify
			this.notifyHistoryObservers(history, "update");

		}

		// Stop observe defer mode
		if (defer) this.resumeObservers();

		// Restore fragment preservation
		this.preserveFragments = preserveFragments;

		// Restore batch Ops starter and stopper
		this.batchStarter = this.batch.bind(this);
		this.batchStopper = this.stopBatch.bind(this);

		// Restore intercept notifier
		this.interceptorNotifier = this.notifyInterceptors.bind(this);

		// Restore log utility to default
		this.historyLogger = this.logChange.bind(this);

		// All done - return the number of successful undone steps
		return stepsCount;

	}

	/**
	* Destroys redoable steps from after current state. Also automatically called if updates are made to the store when current state is not the most recent.
	*/
	commit() {

		if (this.historyCurrent > 0) {
			for (var count = 0; count < this.historyCurrent; count ++)
				this.notifyHistoryObservers(this.history.pop(), "delete");
			this.historyCurrent = 0;
		}

	}

	/**
	* Removes undoable steps from memory, for optimization purposes.
	* @param {number} keep - The number of history records to keep, starting from most recent. If keep is less than currentHistory, currentHistory will be used instead.
	* @returns {Object[]} The history records that were removed from memory.
	*/
	prune(keep) {

		// Mark prune pending as over !
		if (!keep) this.prunePending = false;

		// Prep
		keep = keep || this.historyLimit;

		// Check sanity
		if (!keep) return [];

		// Reset to currentHistory
		keep = keep > this.historyCurrent ? keep : historyCurrent;

		// Prep
		let target = this.history.length - keep;

		// Check if prune is needed
		if (target <= 0) return [];

		// Prune
		return this.history.splice(0, target);

	}

	/**
	* Registers a callback to be invoked when a history record is created/updated/deleted.
	* @callback fn - The function to be used as the callback.
	* @returns {number} An ID that can be used to unregister the callback.
	*/
	observeHistory(fn) {
		let id = this.timestamp();
		this.historyObservers[id] = fn;
		return id;
	}

	/**
	* Unregisters observeHistory callback.
	* @param {number} id - The ID that was returned on registering the callback.
	* @returns {boolean} Whether the callback was successfully unregistered.
	*/
	stopObserveHistory(id) {
		if (this.historyObservers.hasOwnProperty(id)) {
			delete this.historyObservers[id];
			return true;
		}
		return false;
	}

	notifyHistoryObservers(history, notificationType) {
		Object.values(this.historyObservers).forEach(fn => {
			if (this.observeAsync) Promise.resolve().then(() => fn(notificationType, history, this.store));
			else fn(notificationType, history, this.store);
		});
	}

	// ---------------------------
	// FRAGMENTATION METHODS
	// ---------------------------

	/**
	* Parses a nested property path string, and returns the part of the store that it represents.
	* @param {string} path - The path containing the properties, separated by the accessor character.
	* @returns {*} The part of the store represented by the path.
	*/
	parse(path) {

		// Sanitize propertypath
		if (!path.length) throw "Path is an empty string.";

		// Prep levels
		let levels = path.split(this.accessor);
		if (path[0] == this.accessor) levels.shift();

		// Get the final value, if can..
		return levels.reduce((obj, prop) => {
			if (typeof obj == "undefined") return obj;
			if (prop.length == 0) return obj;
			return obj[prop];
		}, this.store);

	}

	/**
	* Takes a part of the store and returns the path of the object relative to the base store.
	* @param {Object} obj - An object reference to any part of the store.
	* @returns {string} The path of the object relative to the base store.
	*/
	path(obj) {
		if (typeof obj != "object") throw ("Expected object, got " + (typeof obj) + ".");

		let context = this.resolve(obj, true);
		path = context.path;
		return path;
	}

	/**
	* Takes a part of the store and returns the parent of that object in the store.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	* @returns {Object} An object reference to the parent of the given path or object.
	*/
	parent(pathOrObject) {
		if (typeof pathOrObject == "string") {

			if (pathOrObject.length == 0) throw "Path is an empty string.";

			let levels = pathOrObject.split(this.accessor);
			if (pathOrObject[0] == this.accessor) levels.shift();
			levels.pop();

			return levels.reduce((obj, prop) => prop.length > 0 ? obj && obj[prop] : obj, this.store);
		}

		else if (typeof pathOrObject == "object") {
			let path = this.resolve(pathOrObject, true).path;
			return this.parent(path);
		}

		else throw ("Expected string or object, got " + (typeof pathOrObject) + ".");
	}

	/**
	* Takes a part of the store and returns if that part has any fragments.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	* @returns {number} The number of fragments.
	*/
	isFragment(pathOrObject) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw ("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Sanitize propertypath
		if (!path.length) return 0;
		if (path[0] != this.accessor) path = this.accessor + path;

		// Return if fragment
		return (typeof this.fragmented[path] == "object") ? Object.keys(this.fragmented[path]).length : 0;

	}

	/**
	* Creates a new fragment, which freezes reference and allows relative access to the given part of the state.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any object/array part of the store.
	* @callback onDissolve - Invoked when the fragment is dissolved. Can be used for external clean-up. Do NOT update the store here!
	* @returns {Object} A new fragment object.
	*/
	fragment(pathOrObject, onDissolve) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw ("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Sanitize propertypath
		if (!path.length) throw "Path is an empty string.";
		if (path[0] != this.accessor) path = this.accessor + path;

		// Check if path exists and is an object
		let store = this.parse(path);
		if (typeof store != "object") throw "Path must represent an existing valid part of the store.";

		// Create ID
		this._fragCounter = (this._fragCounter || 1) + 1;
		let id = this._fragCounter;

		// Populate new fragment
		let internal = { observers: [], interceptors: [] };
		let fragment = {

			catalyst: this.catalyst,

			stopObserve: this.stopObserve.bind(this),
			stopIntercept: this.stopIntercept.bind(this),

			get store() { return store; },
			get fragmentPath() { return path; },
			get fragmentId() { return id; }

		};

		// Helper
		let normalize = _path => {
			if (_path.length > 0) return path + (_path[0] == "." ? "" : ".") + _path;
			else return path;
		};

		// Dissolver
		let dissolve = function() {

			// Check
			if (!this.fragments.hasOwnProperty(id)) return false;

			// Dissolution callback
			if (typeof onDissolve == "function") onDissolve(fragment);

			// Stop observers and interceptors installed through this fragment
			internal.observers.forEach(id => this.stopObserve(id));
			internal.interceptors.forEach(id => this.stopIntercept(id));

			// Delete fragment methods
			delete fragment.catalyst;
			delete fragment.stopObserve;
			delete fragment.stopIntercept;

			delete fragment.parent;
			delete fragment.parse;
			delete fragment.isFragment;
			delete fragment.fragment;
			delete fragment.dissolve;
			delete fragment.augment;
			delete fragment.observe;
			delete fragment.refresh;
			delete fragment.intercept;

			// Uninstall the fragment
			delete this.fragmented[path][id];
			delete this.fragments[id];

			// Delete fragment properties
			internal = undefined;
			store = undefined;
			path = undefined;
			id = undefined;
			onDissolve = undefined;

			// All done
			return true;

		};

		// Prep methods that use relative paths
		let observe = function(pathOrObject, fn, children = false, deep = false, init = true) {
			if (typeof pathOrObject == "undefined") internal.observers.push(this.observe(path, fn, children, deep, init, fragment));
			else if (typeof pathOrObject == "object") internal.observers.push(this.observe(pathOrObject, fn, children, deep, init, fragment));
			else if (typeof pathOrObject == "string") internal.observers.push(this.observe(normalize(pathOrObject), fn, children, deep, init, fragment));
			else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");

			return internal.observers[internal.observers.length - 1];
		};

		let refresh = function(pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.refresh(path);
			else if (typeof pathOrObject == "object") return this.refresh(pathOrObject);
			else if (typeof pathOrObject == "string") return this.refresh(normalize(pathOrObject));
			else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let intercept = function(pathOrObject, fn, children = false, deep = false) {
			if (typeof pathOrObject == "undefined") internal.interceptors.push(this.intercept(path, fn, children, deep, fragment));
			else if (typeof pathOrObject == "object") internal.interceptors.push(this.intercept(pathOrObject, fn, children, deep, fragment));
			else if (typeof pathOrObject == "string") internal.interceptors.push(this.intercept(normalize(pathOrObject), fn, children, deep, fragment));
			else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");

			return internal.interceptors[internal.interceptors.length - 1];
		};

		let isFragment = function(pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.isFragment(path);
			else if (typeof pathOrObject == "object") return this.isFragment(pathOrObject);
			else if (typeof pathOrObject == "string") return this.isFragment(normalize(pathOrObject));
			else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let parent = function(pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.parent(path);
			else if (typeof pathOrObject == "object") return this.parent(pathOrObject);
			else if (typeof pathOrObject == "string") return this.parent(normalize(pathOrObject));
			else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let parse = function(_path) { return this.parse(normalize(_path)); };

		let fragmentFn = function(pathOrObject, _onDissolve) {
			if (typeof pathOrObject == "undefined") return this.fragment(path, _onDissolve);
			else if (typeof pathOrObject == "object") return this.fragment(pathOrObject, _onDissolve);
			else if (typeof pathOrObject == "string") return this.fragment(normalize(pathOrObject), _onDissolve);
			else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let augment = function (pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.augment(path);
			else if (typeof pathOrObject == "object") return this.augment(pathOrObject);
			else if (typeof pathOrObject == "string") return this.augment(normalize(pathOrObject));
			else throw ("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		}

		// Assign the methods that use relative paths
		fragment.isFragment = this.metaProxify(isFragment, this);
		fragment.parent = parent.bind(this);
		fragment.parse = parse.bind(this);
		fragment.fragment = this.metaProxify(fragmentFn, this);
		fragment.dissolve = dissolve.bind(this);
		fragment.augment = this.metaProxify(augment, this);
		fragment.observe = this.metaProxify(observe, this);
		fragment.refresh = this.metaProxify(refresh, this);
		fragment.intercept = this.metaProxify(intercept, this);

		// Install the fragment
		this.fragments[id] = fragment;
		if (!this.fragmented[path]) this.fragmented[path] = {};
		this.fragmented[path][id] = true;

		// All done
		return fragment;

	}

	/**
	* Takes a part of the store and dissolves all it's fragments, unfreezing the references. Also automatically called when necessary upon undo/redo.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any object/array part of the store.
	*/
	augment(pathOrObject) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw ("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Sanity
		if (typeof path != "string") return false;
		if (path.length == 0) return false;

		// Is this path fragmented ?
		if (typeof this.fragmented[path] != "object") return false;

		// Do we have a positive number of fragments ?
		let ids = Object.keys(this.fragmented[path]);
		if (ids.length == 0) return false;

		// Dissolve each fragment!
		ids.forEach(id => this.fragments[id].dissolve());

		// All done - calling dissolve will take care of removing the keys from fragments and fragmented object
		return true;

	}

	// ---------------------------
	// PROXY METHODS
	// ---------------------------

	resolve(obj, getContext = false) {

		this.resolveMode = true;
		this.resolveContext = getContext;

		let resolved = obj.anything;

		this.resolveMode = false;
		this.resolveContext = false;

		return resolved;
	}

	// TODO: use resolveContext and decorators to create an alternative to metaProxify
	metaProxify(targetFn, self) {

		let adapterFn = function () {
			return targetFn.apply(self, [this.path, ...arguments]);
		};

		let getter = function (target, prop, proxy) {
			let env = { path: this.path + self.accessor + prop };
			return new Proxy(adapterFn.bind(env), { get: getter.bind(env) });
		};

		return new Proxy(targetFn.bind(self), { get: getter.bind({path: ""}) });

	}

	proxify(target, self, path, paths) {

		// Define context to be bound to.
		let context = {self, path, paths};

		// Create the list of handlers
		let handlers = {
			get: self.handleGet.bind(context),
			set: self.handleSet.bind(context),
			deleteProperty: self.handleDelete.bind(context)
		};

		// Create & return the proxy
		return new Proxy(target, handlers);

	}

	deepProxify(_value, _oldValue, _path, _paths, value, oldValue, path, misc, obsOldValue) {

		// Diff check
		if (_value == _oldValue) return _oldValue;

		// Prep
		let _isObj = typeof _value == "object";
		let _isOldObj = typeof _oldValue == "object";

		// No objects involved!
		if (!_isOldObj && !_isObj) {
			misc.changes ++;
			return _value;
		}

		// Involves objects
		else {

			// Array-type check
			let _isArr = Array.isArray(_value);
			let _isOldArr = Array.isArray(_oldValue);

			// Fragmentation check
			let isFragment = false;
			if (_isOldObj) {
				if (typeof this.fragmented[_path] == "object") {
					if (Object.keys(this.fragmented[_path]).length > 0) isFragment = true;
				}
			}

			// Preserve ref check
			let preserveRef = this.preserveReferences || isFragment;

			// Preserve fragments ?
			if (isFragment && (!_isObj || (_isObj && (_isArr != _isOldArr)))) {
				if (this.preserveFragments) return _oldValue;
				else this.augment(_path);
			}

			// Prep Root - either the underlying target of object oldVal, or a new object if oldVal wasnt an object!
			let root;
			let preserve = _root => preserveRef ? this.resolve(_oldValue) : _root;

			if (_isOldArr && _isArr) root = preserve([]); 			// a->a
			else if (_isOldArr && _isObj) root = {}; 				// a->o
			else if (_isObj && _isArr) root = []; 					// o->a
			else if (_isOldObj && _isObj) root = preserve({}); 		// o->o
			else if (_isOldArr) root = preserve([]);				// a->v
			else if (_isArr) root = [];								// v->a
			else if (_isOldObj) root = preserve({}); 				// o->v
			else if (_isObj) root = {}; 							// v->o

			let isRootArr = Array.isArray(root);

			// Prep deletion optimization - defers/avoids actually deleting the keys until until/unless necessary
			let deferDeletes = _isOldObj && !_isObj;
			let deletes = [];

			let deferDelete = key => {
				if (preserveRef) {
					if (!deferDeletes) delete root[key];
					else deletes.push(key);
				}
				misc.changes ++;
			};

			let executeDeletes = () => {
				if (!deferDeletes) return;
				else deferDeletes = false;
				deletes.forEach(key => delete root[key]);
				deletes = [];
			};

			// Define object/array key processor
			let processKey = key => {

				// Prep	values
				let newVal = _isObj ? _value[key] : undefined;
				let oldVal = _isOldObj ? _oldValue[key] : undefined;
				let isOldValObj = typeof oldVal == "object";
				let obsOldVal = _isOldObj ? obsOldValue[key] : undefined;

				// Diff
				if (newVal == oldVal) {
					if (!preserveRef) root[key] = oldVal;
					return;
				}

				// Prep path - optionally optimize by retreiving from context if oldValue is an object.
				let __path, __paths;
				if (_isOldObj && isOldValObj) {
					let context = this.resolve(oldVal, true);
					__path = context.path;
					__paths = context.paths;
				}
				else {
					__path = _path + this.accessor + key;
					__paths = _paths.slice();
					__paths.push(_path);
				}

				// Intercept!
				newVal = this.interceptorNotifier(__path, undefined, undefined, newVal, oldVal, path, value, true, true);

				// Diff again!
				if (newVal == oldVal) {
					if (!preserveRef) root[key] = oldVal;
					return;
				}

				// Diff exists
				else {

					// newValue is object, this property wont get deleted but updated - must recursively proxify this!
					if (typeof newVal == "object") {
						root[key] = this.deepProxify(newVal, oldVal, __path, __paths, value, oldValue, path, misc, obsOldVal);
						if (!isOldValObj) misc.changes ++;
						executeDeletes();
					}

					// newVal is undefined - this subtree is to be deleted
					else if (typeof newVal == "undefined") {

						// if oldVal was an object, must recurse into subtrees to get unanimity!
						if (isOldValObj) {
							let remnant = this.deepProxify(undefined, oldVal, __path, __paths, value, oldValue, path, misc, obsOldVal);

							if (typeof remnant != "undefined") {
								root[key] = remnant;
								executeDeletes();
							}
							else deferDelete(key);
						}

						// Oldval was a value, Delete it!
						else deferDelete(key);

					}

					// newValue is value, this property wont get deleted but updated.
					else {

						// if oldVal was an object, must recurse into subtrees to get unanimity!
						if (isOldValObj) {
							let remnant = this.deepProxify(undefined, oldVal, __path, __paths, value, oldValue, path, misc, obsOldVal);

							if (typeof remnant != "undefined") root[key] = remnant;
							else {
								root[key] = newVal;
								misc.changes ++;
							}
						}

						// Oldval was a value, straight assign new value!
						else {
							root[key] = newVal;
							misc.changes ++;
						}

						// Stop deferring deletes
						executeDeletes();

					}

					// Note observation
					// TODO: can paths fill in for pathc ? everywhere? Is pathc at all required anywhere? is it not part of oaths ??
					misc.observations.push({path: __path, oldVal: obsOldVal, propOnly: true});

				}

			};

			// Hold all the keys
			let keys = {};

			// Each new/old property (loop over newValue & oldValue)
			if (_isOldObj) for(var key in _oldValue) keys[key] = true;
			if (_isObj) for(var key in _value) keys[key] = true;

			// Process each key
			for (var key in keys) processKey(key);

			// Helper - Disconnects old object so that any ops on it do not trigger side effects !
			let disconnect = () => {
				let context = this.resolve(_oldValue, true);
				context.passthrough = true;
			};

			// Helper - proxifies root if oldValue was not an object (root is a new object)
			let proxifyOldValue = () => {

				// Fix root array length - trim empty items from the end of the array !!!
				if (isRootArr && _isArr && _isOldArr && preserveRef) {
					let h = 0;
					root.forEach((_,i) => h = (i > h) ? i : h);
					root.length = h + 1;
				}

				// Return old or new !
				if (_isOldObj && (_isOldArr == _isArr) && preserveRef) return _oldValue;
				else {
					if (_isOldObj) disconnect();
					return this.proxify(root, this, _path, _paths);
				}

			};

			// anything->object will always return object!
			if (_isObj) return proxifyOldValue();

			// object->value can return value or object!
			else {
				if (Object.keys(root).length - deletes.length > 0) return proxifyOldValue();
				else {
					if (typeof _value != "object" && _isOldObj) disconnect();
					return _value;
				}
			}

		}

	}

	handleSet(target, prop, value, proxy) {

		// TODO: test setting part of store to another part of same store !

		// Check if this is an isolated non-state disconnected reference!
		if (this.passthrough == true) {
			target[prop] = value;
			return true;
		}

		// Check diff
		if (target[prop] == value) return true;

		// Prep
		let self = this.self;
		let historyStr;
		let obsOldValue;

		let oldValue = target[prop];
		let oldType = typeof oldValue;
		let misc = {
			observations: [],
			changes: 0
		};

		// Prep path - optionally optimize by retreiving from context if oldValue is an object.
		let path, paths;
		if (oldType == "object") {
			let context = self.resolve(oldValue, true);
			path = context.path;
			paths = context.paths;
		}
		else {
			path = this.path + self.accessor + prop;
			paths = this.paths.slice();
			paths.push(this.path);
		}

		// Cascading changes via intercepters must be batched!
		self.setterLevel ++;
		if (self.setterLevel == 2) {
			if (!self.setterBatched) {
				self.batchStarter();
				self.setterBatched = true;
			}
		}

		// Prep - exit routine - called when this function finishes and clean up is needed!
		let exitRoutine = () => {
			self.setterLevel --;
			if (self.setterLevel == 0) {
				if (self.setterBatched) {
					self.batchStopper();
					self.setterBatched = false;
				}
			}
		};

		// Fire interceptors
		try { value = self.interceptorNotifier(path, this.path, this.paths, value, oldValue, path, value); }
		catch (e) {
			console.error("Discard update (" + path + ") - encountered error!", e);
			exitRoutine();
			return false;
		}

		// Check diff again
		if (value == oldValue) {
			exitRoutine();
			return true;
		}

		// Set the new value!
		try {

			// Prep old JSON string - if we are gonna record history OR we are doing o -> o
			let oldJSON;
			if ((oldType == "object") || (!self.historyDisabled)) oldJSON = JSON.stringify(oldValue);

			// Prep history string - moved here as o->o does not create new object, and hence old state would be missed !
			if (!self.historyDisabled) {
				historyStr = path + "=";
				if (oldType != "undefined") historyStr = historyStr + oldJSON;
			}

			// Note obsOldValue
			if (oldType == "object") obsOldValue = JSON.parse(oldJSON);
			else obsOldValue = oldValue;

			// Deep proxify
			let result = self.deepProxify(value, oldValue, path, paths, value, oldValue, path, misc, obsOldValue);

			// Has anything been updated?
			if (result == oldValue) {

				// In case of o -> o, we check hasChanged, if no changes are found we exit.
				if (typeof result == "object") {
					if (misc.changes == 0) {
						exitRoutine();
						return true;
					}
					else {}
				}

				// for everything else, it means nothing changed!
				else {
					exitRoutine();
					return true;
				}

			}
			else if (typeof result == "undefined") delete target[prop];
			else target[prop] = result;

		}
		catch(e) {
			console.error("Discard update (" + path + ") - encountered error!", e);
			exitRoutine();
			return false;
		}

		// Record History
		if (!self.historyDisabled) self.historyLogger(historyStr);

		// Stop batched interception?
		exitRoutine();

		// Add top-level observation
		misc.observations.push({ path: path, pathc: this.path, paths: this.paths, oldVal: obsOldValue, propOnly: false });

		// Fire observers
		let fn = () => misc.observations.forEach(obs => self.observerNotifier(obs.path, obs.pathc, obs.paths, obs.oldVal, path, obsOldValue, obs.propOnly));
		if (this.observeAsync) Promise.resolve().then(fn);
		else fn();

		// All done
		return true;

	}

	handleDelete(target, prop, proxy) {

		// Redirect to Set handler
		return (this.self.handleSet.bind(this))(target, prop, undefined, proxy);

	}

	handleGet(target, prop) {
		if (!this.self.resolveMode) return target[prop];
		else {
			if (this.self.resolveContext) return this;
			else return target;
		}
	}

	// ---------------------------
	// OBSERVER METHODS
	// ---------------------------

	/**
	* Looks for changes to existing or non-existing part of the store.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	* @callback fn - Invoked when the observed part of the store changes. Do NOT update the store here.
	* @param {boolean} children - If true, looks for changes to nested child properties.
	* @param {boolean} deep - If true, looks for changes to the entire nested object tree. Overrides children to true.
	* @param {boolean} init - Invokes the callback once immediately after successful registration.
	* @returns {Object} An ID that can be used to unregister the observer.
	*/
	observe(pathOrObject, fn, children = false, deep = false, init = true, origin) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw ("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Sanitize propertypath
		if (!path.length) return false;
		if (path[0] != this.accessor) path = this.accessor + path;

		// Prep origin
		origin = origin || this.catalyst;

		// Create ID
		this._obsCounter = (this._obsCounter || 1) + 1;
		let id = this._obsCounter;

		// Helper
		let addObserver = (_path, type) => {
			if (!this.observed[type][_path]) this.observed[type][_path] = new Map();
			this.observed[type][_path].set(id, true);
		};

		// Map observer id to path & object
		this.observers[id] = {path, fn, children: children || deep, deep, origin};

		// Observe prop
		addObserver(path, "prop");

		// Observe children
		if (children || deep) addObserver(path, "child");

		// Observe deep
		if (deep) addObserver(path, "deep");

		// Fire the observer once to initialize?
		if (init) {
			let obsFn = () => fn(path.substr(origin.fragmentPath.length), undefined, path, undefined);
			if (this.observeAsync) Promise.resolve(true).then(obsFn);
			else obsFn();
		}

		// Done
		return id;
	}

	/**
	* Unregisters observe callback.
	* @param {number} id - The ID that was returned on registering the callback.
	* @returns {boolean} Whether the callback was successfully unregistered.
	*/
	stopObserve(id) {

		if (this.observers.hasOwnProperty(id)) {

			// Retreive
			let prop = this.observers[id].path;

			// Delete props, child observation Maps
			this.observed["prop"][prop].delete(id);
			if (this.observed["child"][prop])
				if (this.observed["child"][prop].has(id))
					this.observed["child"][prop].delete(id);

			// Delete deep observers
			let _path = "";
			let levels = prop.split(this.accessor);
			levels.shift();
			for (var count = 0; count < levels.length; count ++) {
				_path = _path + this.accessor + levels[count];

				if (this.observed["deep"][_path])
					if (this.observed["deep"][_path].has(id))
						this.observed["deep"][_path].delete(id);
			}

			// Delete the actual thing
			delete this.observers[id];

			// All done
			return true;
		}

		// If not found
		return false;

	}

	notifyObservers(path, pathc, paths, oldVal, path_, oldVal_, propOnly = false, overrideDefer = false) {

		// Are we deferining ? - If yes then save this to the topmost deferred stack!
		if ((this.observeDeferred > 0) && !overrideDefer) {

			// If the path already exists in an observation, update that observation! NOTE: propOnly minimizes the scope of the observers selected, hence it is AND-ed!
			let stackIndex = this.observations.paths[path];
			if (typeof stackIndex != "undefined") {

				// get the old obs
				let obs = this.observations.stacks[stackIndex].get(path);

				// Delete the old ops from it's stack
				this.observations.stacks[stackIndex].delete(path)

				// Update the path to point to the current stack!
				this.observations.paths[path] = this.observeDeferred - 1;

				// Put the new ops in the current stack!
				this.observations.stacks[this.observeDeferred - 1].set(path, {
					path,
					pathc,
					paths,
					oldVal: obs.oldVal,
					path_,
					oldVal_,
					propOnly: obs.propOnly && propOnly
				});

			}

			// Path is not already observed!
			else {

				// Add new path pointing to the current stack!
				this.observations.paths[path] = this.observeDeferred - 1;

				// Add the observation to the current stack
				this.observations.stacks[this.observeDeferred - 1].set(path, {path, pathc, paths, oldVal, path_, oldVal_, propOnly});

			}

		}

		// Not deferring or defer overriden!
		else {

			// Helper
			let notify = id => {

				let observer = this.observers[id];
				observer.fn(
					path.substr(observer.origin.fragmentPath.length),
					oldVal,
					observer.origin,
					path_,
					oldVal_
				);

			};

			// Notify Observers - Prop
			if (this.observed["prop"][path])
				for (var id of this.observed["prop"][path].keys())
					notify(id);

			// Notify child and deep observers?
			if (!propOnly) {

				// Notify Observers - Child
				if (this.observed["child"][pathc])
					for (var id of this.observed["child"][pathc].keys())
						notify(id);

				// Notify Observers - Deep
				for (var count = paths.length - 1; count >= 0; count --)
					if (this.observed["deep"][paths[count]])
						for (var id of this.observed["deep"][paths[count]].keys())
							notify(id);

			}

		}

	}

	/**
	* Defers all observer callbacks. Stackable.
	*/
	deferObservers() {

		// Create new stack!
		this.observations.stacks.push(new Map());

		// Increase count
		this.observeDeferred ++;

	}

	/**
	* Stops deferring observers and invokes deffered callbacks. Stackable.
	* @param {boolean} all - If true, invokes callbacks from all stacked defers.
	*/
	resumeObservers(all = false) {

		// Check
		if (this.observeDeferred == 0) return;

		// Decrement
		this.observeDeferred --;

		// Fire observations - in order of addition!
		let fn = () => {

			// Prep
			let arr = [];
			let stackIndex = all ? 0 : this.observeDeferred;

			// For each stack
			while (stackIndex <= this.observeDeferred) {

				// Publish
				this.observations.stacks[stackIndex].forEach(obs => {
					delete this.observations.paths[obs.path];
					this.observerNotifier(
						obs.path,
						obs.pathc,
						obs.paths,
						obs.oldVal,
						obs.path_,
						obs.oldVal_,
						obs.propOnly,
						true
					);
				});

				// Update
				stackIndex ++;

			}

			// Update stack
			if (all) this.observations.stacks = [];
			else this.observations.stacks.pop();

		};

		// Async or sync?
		if (this.observeAsync) Promise.resolve().then(fn);
		else fn();

	}

	/**
	* Invokes all callbacks observing a given part of the store.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	*/
	refresh(pathOrObject) {

		// Declare path and it's variants
		let path, pathc, paths;

		// Sanitize and try extract the path variants
		if (typeof pathOrObject == "string") {

			if (pathOrObject.length == 0) throw "Path is an empty string";
			if (pathOrObject[0] != this.accessor) pathOrObject = this.accessor + pathOrObject;

			let obj = this.parse(pathOrObject);
			if (typeof obj == "object") return this.refresh(obj);

			path = pathOrObject;

			let levels = pathOrObject.split(this.accessor);
			if (pathOrObject[0] == this.accessor) levels.shift();

			levels.pop();
			pathc = this.accessor + levels.join(this.accessor);

			levels.pop();
			let _levels = [];
			levels = levels.forEach((level, index) => {
				_levels.push((index == 0 ? "" : _levels[index - 1]) + this.accessor + level);
			});
			paths = _levels;

		}

		else if (typeof pathOrObject == "object") {
			let context = this.resolve(pathOrObject, true);
			let context2 = this.resolve(this.parent(pathOrObject), true);

			path = context.path;
			pathc = context2.path;
			paths = context2.paths;
		}

		else throw ("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Invoke all observers for the path
		this.observerNotifier(path, pathc, paths, undefined, path, undefined, false, true);

	}

	// ---------------------------
	// INTERCEPTOR METHODS
	// ---------------------------

	/**
	* Intercepts (or validates) changes to an existing or non-existing part of the store. Similar to a middleware. Supports cascading updates to store.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	* @callback fn - Invoked when the given part of the store changes. Cascaded updates to other parts of the store are batched as single atomic history record.
	* @param {boolean} children - If true, intercepts changes to nested child properties.
	* @param {boolean} deep - If true, intercepts changes to the entire nested object tree. Overrides children to true.
	* @returns {Object} An ID that can be used to unregister the interceptor.
	*/
	intercept(pathOrObject, fn, children = false, deep = false, origin) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw ("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Sanitize propertypath
		if (!path.length) return false;
		if (path[0] != this.accessor) path = this.accessor + path;

		// Prep origin
		origin = origin || this.catalyst;

		// Create ID
		this._iceptCounter = (this._iceptCounter || 1) + 1;
		let id = this._iceptCounter;

		// Helper
		let addInterceptor = (_path, type) => {
			if (!this.intercepted[type][_path]) this.intercepted[type][_path] = new Map();
			this.intercepted[type][_path].set(id, true);
		};

		// Map interceptor id to path & object
		this.interceptors[id] = {path, fn, children: children || deep, deep, origin};

		// Intercept prop
		addInterceptor(path, "prop");

		// Intercept children
		if (children || deep) addInterceptor(path, "child");

		// Intercept deep
		if (deep) addInterceptor(path, "deep");

		// Done
		return id;
	}

	/**
	* Unregisters intercept callback.
	* @param {number} id - The ID that was returned on registering the callback.
	* @returns {boolean} Whether the callback was successfully unregistered.
	*/
	stopIntercept(id) {

		if (this.interceptors.hasOwnProperty(id)) {

			// Retreive
			let prop = this.interceptors[id].path;

			// Delete props, child interception Maps
			this.intercepted["prop"][prop].delete(id);
			if (this.intercepted["child"][prop])
				if (this.intercepted["child"][prop].has(id))
					this.intercepted["child"][prop].delete(id);

			// Delete deep interceptors
			let _path = "";
			let levels = prop.split(this.accessor);
			levels.shift();
			for (var count = 0; count < levels.length; count ++) {
				_path = _path + this.accessor + levels[count];

				if (this.intercepted["deep"][_path])
					if (this.intercepted["deep"][_path].has(id))
						this.intercepted["deep"][_path].delete(id);
			}

			// Delete the actual thing
			delete this.interceptors[id];

			// All done
			return true;
		}

		// If not found
		return false;

	}

	notifyInterceptors(path, pathc, paths, newVal, oldVal, path_, newVal_, propOnly = false, requireDiff = true) {

		// Helper
		let notify = id => {

			let interceptor = this.interceptors[id];
			return interceptor.fn(
				path.substr(interceptor.origin.fragmentPath.length),
				newVal,
				interceptor.origin,
				path_,
				newVal_
			);

		};

		// Do we execute parent and grand-parent interceptors ??
		if (!propOnly) {

			// Fire interceptors - deep
			for(var count = 0; count <= paths.length - 1; count++) {
				if ( this.intercepted["deep"][paths[count]]) {
					for (var id of this.intercepted["deep"][paths[count]].keys()) {
						newVal = notify(id);
						if ((requireDiff) && (newVal == oldVal)) return newVal;
					}
				}
			}

			// Fire interceptors - child
			if (this.intercepted["child"][pathc]) {
				for (var id of this.intercepted["child"][pathc].keys()) {
					newVal = notify(id);
					if ((requireDiff) && (newVal == oldVal)) return newVal;
				}
			}

		}

		// Fire interceptor - prop
		if (this.intercepted["prop"][path]) {
			for (var id of this.intercepted["prop"][path].keys()) {
				newVal = notify(id);
				if ((requireDiff) && (newVal == oldVal)) return newVal;
			}
		}

		// All done
		return newVal;

	}

};
