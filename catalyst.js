export default class Catalyst {

	// ---------------------------
	// CONSTRUCTOR
	// ---------------------------

	constructor(obj, history = [], historyCurrent = 0, historyFeed) {

		// PREP
		// ----

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

		// Interceptor - supports cascading changes to the store and are auto-batched to be atomic! They are not executed on undo/redo!
		this.interceptors = {};												// PRIVATE:
		this.intercepted = {prop: {}, child:{}, deep: {}};					// PRIVATE:
		this.interceptorNotifier = this.notifyinterceptors.bind(this);		// PRIVATE:
		this.setterLevel = 0;												// PRIVATE:
		this.setterBatched = false;											// PRIVATE:

		// Observer - does NOT support cascading changes to the store and can have side effects on history as they are called on undo-redo!
		this.observers = {};												// PRIVATE:
		this.observed = {prop: {}, child:{}, deep: {}};						// PRIVATE:
		this.observerNotifier = this.notifyObservers.bind(this);			// PRIVATE:
		this.observeAsync = true;											// PUBLIC: Whether observers are triggered asynchronously (via Promise microtask) !
		this.observeDeferred = 0;											// PUBLIC: Whether observations are batched together!
		this.observations = {												// PRIVATE:
			stacks: [],		// Array of maps
			exprs: {}		// exprs to stack index
		};

		// STORE CREATION
		// ----

		// Proxify and create our store
		this.root = {};
		this.store = this.proxify(this.root, this, "", []);
		// TODO: add __proto__ methods here ! 

		// Add the user provided object to the store - one prop at a time!
		this.stopRecord();
		for (var prop in obj) this.store[prop] = obj[prop];
		this.record();

		// CONTROLLER CREATION
		// ---

		// Prep catalyst controllers
		let getHistoryCurrent = () => this.historyCurrent,
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

			getStore = () => this.store;

		// TODO: write parsable comments on functions and purpose of variables - also mark if they are to be used by user or internal only!
		// TODO: must have ability to add functions to the store! like ToJSON etc. Esp to areas not recorded ! - WONT work as it will stop recording due to use of JSON in history creation!
		// TODO: add optimization for arrays...better observation for array elements?
		// TODO: use setPrototype on root level object to give access to controller on every level? !!!!!!!!! must do!!!
		// TODO: ObserveAsync is not working - always sync!

		// Access to controllers
		let catalyst = {

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
			
			observe: this.observe.bind(this),
			stopObserve: this.stopObserve.bind(this),
			deferObservers: this.deferObservers.bind(this),
			resumeObservers: this.resumeObservers.bind(this),

			get isObserveAsync() { return getObserveAsync(); },
			set isObserveAsync(value) { setObserveAsync(value); },

			get isObserveDeferred() { return getObserveDeffered(); },
			set isObserveDeferred(value) { setObserveDeffered(value); },

			intercept: this.intercept.bind(this),
			stopIntercept: this.stopIntercept.bind(this),

			get store() { return getStore(); }

		};

		// All done - Return the catalyst
		return catalyst;

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

	record() {
		this.historyDisabled --;
		if (this.historyDisabled < 0) this.historyDisabled = 0;
	}

	stopRecord() {
		this.historyDisabled ++;
	}

	batch(aggregate = false, preserveOrder = true) {

		// If this is the first batch switch, add a new history array to hold all the batched ops.
		if (!this.historyBatched) this.history.push({ timestamp: this.timestamp(), changelog: [] });

		// Turn on batch mode!
		this.historyBatched ++;
		this.historyBatchModes.push({aggregate, preserveOrder, count: 0, map: {}});

	}

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
				let levels = prop.split(".");
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

		// Restore batch Ops starter and stopper
		this.batchStarter = this.batch.bind(this);
		this.batchStopper = this.stopBatch.bind(this);

		// Restore intercept notifier
		this.interceptorNotifier = this.notifyinterceptors.bind(this);

		// Restore log utility to default
		this.historyLogger = this.logChange.bind(this);

		// All done - return the number of successful undone steps		
		return stepsCount;

	}

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
				let levels = prop.split(".");
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

		// Restore batch Ops starter and stopper
		this.batchStarter = this.batch.bind(this);
		this.batchStopper = this.stopBatch.bind(this);

		// Restore intercept notifier
		this.interceptorNotifier = this.notifyinterceptors.bind(this);

		// Restore log utility to default
		this.historyLogger = this.logChange.bind(this);

		// All done - return the number of successful undone steps		
		return stepsCount;

	}

	commit() {
		
		if (this.historyCurrent > 0) {
			for (var count = 0; count < this.historyCurrent; count ++) 
				this.notifyHistoryObservers(this.history.pop(), "delete");
			this.historyCurrent = 0;
		}

	}
	
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

	observeHistory(fn) {
		let id = this.timestamp();
		this.historyObservers[id] = fn;
		return id;
	}

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
	// PROXY METHODS
	// ---------------------------

	proxify(target, self, expr, exprs) {

		// Create the list of handlers
		let handlers = {
			set: self.handleSet.bind({self, expr, exprs}),
			deleteProperty: self.handleDelete.bind({self, expr, exprs})
		};

		// Create & return the proxy
		return new Proxy(target, handlers);

	}

	deepProxify(_value, _oldValue, _expr, _exprs, value, oldValue, expr, observations) {
		
		// Diff check
		if (_value == _oldValue) return _oldValue;
		
		// Prep
		let _isObj = typeof _value == "object";
		let _isOldObj = typeof _oldValue == "object";
		
		// No objects involved!
		if (!_isOldObj && !_isObj) return _value;
		
		// Involves objects
		else {

			// Prep
			let _isArr = _isObj && (typeof _value.push == "function"); // TODO: add array optimizations, check for length property ??
			let root = _isArr ? [] : {};

			// Define object/array key processor
			let processKey = key => {

				// Prep	values
				let newVal = typeof _value == "object" ? _value[key] : undefined;
				let oldVal = typeof _oldValue == "object" ? _oldValue[key] : undefined;

				// Diff check
				if (newVal == oldVal) {
					root[key] = oldVal;
					return;
				}

				// Prep expr
				let __expr = _expr + "." + key;
				let __exprs = _exprs.slice();
				__exprs.push(_expr);

				// Intercept!
				newVal = this.interceptorNotifier(__expr, undefined, undefined, newVal, oldVal, expr, value, oldValue, true, true);

				// No diff - it remains oldValue!
				if (newVal == oldVal) {
					root[key] = oldVal;
					return;
				}

				// Diff exists
				else {

					// newValue is object, this property wont get deleted but updated - must recursively proxify this!
					if (typeof newVal == "object") root[key] = this.deepProxify(newVal, oldVal, __expr, __exprs, value, oldValue, expr, observations);
					
					// newVal is undefined - this subtree is to be deleted
					else if (typeof newVal == "undefined") {

						// if oldVal was an object, must recurse into subtrees to get unanimity!
						if (typeof oldVal == "object") {
							let remnant = this.deepProxify(undefined, oldVal, __expr, __exprs, value, oldValue, expr, observations);
							if (typeof remnant != "undefined") root[key] = remnant;
						}

					}

					// newValue is value, this property wont get deleted but updated.
					else {

						// if oldVal was an object, must recurse into subtrees to get unanimity!
						if (typeof oldVal == "object") {
							let remnant = this.deepProxify(undefined, oldVal, __expr, __exprs, value, oldValue, expr, observations);
							if (typeof remnant == "undefined") root[key] = newVal;
							else root[key] = remnant;
						}

						// Oldval was a value, straight assign new value!
						else root[key] = newVal;

					}

					// Note observation
					observations.push({expr: __expr, exprc: _expr, exprs: _exprs, oldVal: oldVal, propOnly: true});

				}

			};

			// Each new/existing property (loop over newValue)
			if (_isObj) {
				for(var key in _value) processKey(key);
			}

			// Each new/existing property (loop over newValue)
			if (_isOldObj) {
				for(var key in _oldValue) {
					if (_isObj) {
						if (typeof _value[key] == "undefined") processKey(key);
					}						
					else processKey(key);
				}
			}

			// anything->object will always return object!
			if (_isObj) return this.proxify(root, this, _expr, _exprs);

			// object->value can return value or object!
			else {
				if (Object.keys(root).length > 0) return this.proxify(root, this, _expr, _exprs);
				else return _value;
			}
			
		}

	}

	handleSet(target, prop, value, proxy) {

		// Check diff
		if (target[prop] == value) return true;
		
		// Prep
		let self = this.self;
		let expr = this.expr + "." + prop;
		let exprs = this.exprs.slice();
		exprs.push(expr);

		let oldValue = target[prop];
		let oldType = typeof oldValue;
		let observations = [];

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
		try { value = self.interceptorNotifier(expr, this.expr, this.exprs, value, oldValue, expr, value, oldValue); }
		catch (e) {
			console.error("Discard update (" + expr + ") - encountered error!", e);
			exitRoutine();
			return false;
		}

		// Check diff again
		if (value == oldValue) {
			exitRoutine();
			return true;
		}

		// Set the new value - recursively if an object!
		try {
			 
			let result = self.deepProxify(value, oldValue, expr, exprs, value, oldValue, expr, observations); 

			if (result == oldValue) {
				exitRoutine();
				return true;
			}
			else if (typeof result == "undefined") delete target[prop];
			else target[prop] = result;

		} 
		catch(e) { 
			console.error("Discard update (" + expr + ") - encountered error!", e);
			exitRoutine();
			return false;
		}

		// Record History
		if (!self.historyDisabled) {
			let historyStr = expr + "=";
			if (oldType != "undefined") historyStr = historyStr + JSON.stringify(oldValue);
			self.historyLogger(historyStr);
		}

		// Stop batched interception?
		exitRoutine();

		// Add top-level observation
		observations.push({ expr: expr, exprc: this.expr, exprs: this.exprs, oldVal: oldValue, propOnly: false });

		// Fire observers
		let fn = () => observations.forEach(obs => self.observerNotifier(obs.expr, obs.exprc, obs.exprs, obs.oldVal, expr, oldValue, obs.propOnly));
		if (this.observeAsync) Promise.resolve().then(fn);
		else fn();

		// All done
		return true;

	}

	handleDelete(target, prop, proxy) {

		// Redirect to Set handler
		return (this.self.handleSet.bind(this))(target, prop, undefined, proxy);		

	}

	// ---------------------------
	// OBSERVER METHODS
	// ---------------------------

	observe(expr, fn, children = false, deep = false, init = true) {

		// Sanitize propertypath
		if (!expr.length) return false;
		if (expr[0] != ".") expr = "." + expr;

		// Create ID
		this._obsCounter = (this._obsCounter || 1) + 1;
		let id = this._obsCounter;	

		// Helper
		let addObserver = (_expr, type) => {
			if (!this.observed[type][_expr]) this.observed[type][_expr] = new Map();			
			this.observed[type][_expr].set(id, true);
		};

		// Map observer id to path & object
		this.observers[id] = {expr, fn, children: children || deep, deep};

		// Observe prop
		addObserver(expr, "prop");

		// Observe children
		if (children || deep) addObserver(expr, "child");

		// Observe deep
		if (deep) {

			let _expr = "";
			let levels = expr.split(".");
			levels.shift();
			
			for (var count = 0; count < levels.length; count ++) {
				_expr = _expr + "." + levels[count];
				addObserver(_expr, "deep");
			}

		}

		// Fire the observer once to initialize?
		if (init) {
			let obsFn = () => fn(expr, undefined, expr, undefined);
			if (this.observeAsync) Promise.resolve(true).then(obsFn);
			else obsFn();
		}
		
		// Done
		return id;
	}

	stopObserve(id) {

		if (this.observers.hasOwnProperty(id)) {
			
			// Retreive
			let prop = this.observers[id].expr;
			
			// Delete props, child observation Maps
			this.observed["prop"][prop].delete(id);
			if (this.observed["child"][prop])	
				if (this.observed["child"][prop].has(id)) 
					this.observed["child"][prop].delete(id);

			// Delete deep observers
			let _expr = "";
			let levels = prop.split(".");
			levels.shift();
			for (var count = 0; count < levels.length; count ++) {
				_expr = _expr + "." + levels[count];
				
				if (this.observed["deep"][_expr])
					if (this.observed["deep"][_expr].has(id)) 
						this.observed["deep"][_expr].delete(id);
			}

			// Delete the actual thing
			delete this.observers[id];

			// All done
			return true;
		}

		// If not found
		return false;

	}

	notifyObservers(expr, exprc, exprs, oldVal, expr_, oldVal_, propOnly = false, overrideDefer = false) {

		// Are we deferining ? - If yes then save this to the topmost deferred stack!
		if ((this.observeDeferred > 0) && !overrideDefer) {

			// If the expr already exists in an observation, update that observation! NOTE: propOnly minimizes the scope of the observers selected, hence it is AND-ed!
			let stackIndex = this.observations.exprs[expr];
			if (typeof stackIndex != "undefined") {
				
				// get the old obs
				let obs = this.observations.stacks[stackIndex].get(expr);
				
				// Delete the old ops from it's stack
				this.observations.stacks[stackIndex].delete(expr)

				// Update the expr to point to the current stack!
				this.observations.exprs[expr] = this.observeDeferred - 1;

				// Put the new ops in the current stack!
				this.observations.stacks[this.observeDeferred - 1].set(expr, {
					expr, 
					exprc, 
					exprs,
					oldVal: obs.oldVal, 
					expr_,
					oldVal_, 
					propOnly: obs.propOnly && propOnly
				});
				
			}

			// Expr is not already observed!
			else {

				// Add new expr pointing to the current stack!
				this.observations.exprs[expr] = this.observeDeferred - 1;

				// Add the observation to the current stack	
				this.observations.stacks[this.observeDeferred - 1].set(expr, {expr, exprc, exprs, oldVal, expr_, oldVal_, propOnly});

			}

		}

		// Not deferring or defer overriden!
		else {

			// Notify Observers - Prop
			if (this.observed["prop"][expr]) 
				for (var id of this.observed["prop"][expr].keys()) 
					this.observers[id].fn(expr, oldVal, expr_, oldVal_);

			// Notify child and deep observers?
			if (!propOnly) {

				// Notify Observers - Child
				if (this.observed["child"][exprc]) 
					for (var id of this.observed["child"][exprc].keys()) 
						this.observers[id].fn(expr, oldVal, expr_, oldVal_);

				// Notify Observers - Deep
				for (var count = exprs.length - 2; count >= 0; count --)
					if (this.observed["deep"][exprs[count]])
						for (var id of this.observed["deep"][exprs[count]].keys()) 
							this.observers[id].fn(expr, oldVal, expr_, oldVal_);

			}

		}

	}

	deferObservers() {

		// Create new stack!
		this.observations.stacks.push(new Map());

		// Increase count
		this.observeDeferred ++;

	}

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
					delete this.observations.exprs[obs.expr];
					this.observerNotifier(
						obs.expr, 
						obs.exprc, 
						obs.exprs, 
						obs.oldVal, 
						obs.expr_, 
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

	// ---------------------------
	// INTERCEPTOR METHODS
	// ---------------------------

	intercept(expr, fn, children = false, deep = false) {

		// Sanitize propertypath
		if (!expr.length) return false;
		if (expr[0] != ".") expr = "." + expr;

		// Create ID
		this._iceptCounter = (this._iceptCounter || 1) + 1;
		let id = this._iceptCounter;	

		// Helper
		let addinterceptor = (_expr, type) => {
			if (!this.intercepted[type][_expr]) this.intercepted[type][_expr] = new Map();			
			this.intercepted[type][_expr].set(id, true);
		};

		// Map observer id to path & object
		this.interceptors[id] = {expr, fn, children: children || deep, deep};

		// Observe prop
		addinterceptor(expr, "prop");

		// Observe children
		if (children || deep) addinterceptor(expr, "child");

		// Observe deep
		if (deep) {

			let _expr = "";
			let levels = expr.split(".");
			levels.shift();
			
			for (var count = 0; count < levels.length; count ++) {
				_expr = _expr + "." + levels[count];
				addinterceptor(_expr, "deep");
			}

		}
		
		// Done
		return id;
	}

	stopIntercept(id) {

		if (this.interceptors.hasOwnProperty(id)) {
			
			// Retreive
			let prop = this.interceptors[id].expr;
			
			// Delete props, child observation Maps
			this.intercepted["prop"][prop].delete(id);
			if (this.intercepted["child"][prop])	
				if (this.intercepted["child"][prop].has(id)) 
					this.intercepted["child"][prop].delete(id);

			// Delete deep observers
			let _expr = "";
			let levels = prop.split(".");
			levels.shift();
			for (var count = 0; count < levels.length; count ++) {
				_expr = _expr + "." + levels[count];

				if (this.intercepted["deep"][_expr])
					if (this.intercepted["deep"][_expr].has(id)) 
						this.intercepted["deep"][_expr].delete(id);
			}

			// Delete the actual thing
			delete this.interceptors[id];

			// All done
			return true;
		}

		// If not found
		return false;

	}

	notifyinterceptors(expr, exprc, exprs, newVal, oldVal, expr_, newVal_, oldVal_, propOnly = false, requireDiff = true) {

		// Do we execute parent and grand-parent interceptors ??
		if (!propOnly) {

			// Fire interceptors - deep			
			for(var count = 0; count < exprs.length - 1; count++) {
				if ( this.intercepted["deep"][exprs[count]]) {			
					for (var id of this.intercepted["deep"][exprs[count]].keys()) {
						newVal = this.interceptors[id].fn(expr, newVal, oldVal, expr_, newVal_, oldVal_);
						
						if (requireDiff) {
							if (newVal == oldVal) return newVal;
						}
					}
				}
			}

			// Fire interceptors - child
			if (this.intercepted["child"][exprc]) {
				for (var id of this.intercepted["child"][exprc].keys()) {
					newVal = this.interceptors[id].fn(expr, newVal, oldVal, expr_, newVal_, oldVal_);
					
					if (requireDiff) {
						if (newVal == oldVal) return newVal;
					}
				}
			}

		}

		// Fire interceptor - prop
		if (this.intercepted["prop"][expr]) {
			for (var id of this.intercepted["prop"][expr].keys()) {
				newVal = this.interceptors[id].fn(expr, newVal, oldVal, expr_, newVal_, oldVal_);
				
				if (requireDiff) {
					if (newVal == oldVal) return newVal;
				}
			}
		}

		// All done
		return newVal;

	}

};
