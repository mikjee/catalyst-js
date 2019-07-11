"use strict";

// /" _  "\      /""\("     _   ") /""\    |"  |     |"  \/"  |/"       )("     _   ")
// (: ( \___)    /    \)__/  \\__/ /    \   ||  |      \   \  /(:   \___/  )__/  \\__/
// \/ \        /' /\  \  \\_ /   /' /\  \  |:  |       \\  \/  \___  \       \\_ /
// //  \ _    //  __'  \ |.  |  //  __'  \  \  |___    /   /    __/  \\      |.  |
// (:   _) \  /   /  \\  \\:  | /   /  \\  \( \_|:  \  /   /    /" \   :)     \:  |
// \_______)(___/    \___)\__|(___/    \___)\_______)|___/    (_______/       \__|

// Copyright (c) 2019 Soumik Chatterjee (github.com/badguppy) (soumik.chat@hotmail.com)
// MIT License

// ---------------------------
// DESIGNATOR
// ---------------------------

let designatorHOC = init => {

	if (init) {
		if (typeof init === "function") init = init();
		if (!Array.isArray(init)) throw new Error("Designator expects array or another designator for prepping, got " + typeof init + ".");
	}

	return new Proxy(

		path => {
			if (!path) return init || [];
			else {
				if (path === true) return designatorHOC(init ? init.slice() : []);
				else if (typeof path === "function") path = path();

				if (!Array.isArray(path)) throw new Error("Designator expects array or another designator for prepping, got " + typeof path + ".");
				return designatorHOC(init ? [...init, ...path] : path.slice());
			}
		},
		
		{
			get: (_, prop) => {

				let env = { path: init ? [...init, prop] : [prop] };

				let resolver = function (path) { 
					if (!path) return this.path;
					else {
						if (path === true) return designatorHOC(this.path.slice());
						else if (typeof path === "function") path = path();

						if (!Array.isArray(path)) throw new Error("Designator expects array or another designator for prepping, got " + typeof path + ".");
						return designatorHOC([...this.path, ...path]);
					}
				};
				
				let getter = function (_, prop, proxy) {
					this.path.push(prop);
					return proxy;
				};

				return new Proxy(
					resolver.bind(env),
					{ get: getter.bind(env) }
				);

			} 
		}

	);
}

let designator = designatorHOC();

// ---------------------------
// CATALYST
// ---------------------------

class Catalyst {

	// ---------------------------
	// CONSTRUCTOR
	// ---------------------------

	/**
	* Creates a new state store.
	* @constructor
	* @param {Object} obj - The base object to create the store from.
	* @returns {Object} The state store.
	*/

	// TODO: write parsable comments on functions and purpose of variables - also mark if they are to be used by user or internal only!
	// TODO: must have ability to add functions to the store! like ToJSON etc. Esp to areas not recorded !
	constructor(obj) {

		// Check - cannot create store with array as base!
		let objType = typeof obj;
		if (objType != "undefined") {
			if (Array.isArray(obj)) throw new Error("Expected object, got array.");
			else if (objType != "object") throw new Error("Expected object, got value.");
		}

		// PREP
		// ----

		this.resolveMode = false;											// PRIVATE:
		this.resolveContext = false;										// PRIVATE:
		this._uCounter = 0;													// PRIVATE:

		// Observer prep
		this.observerTree = this.createMetaRoot();							// PRIVATE:
		this.observers = {};												// PRIVATE:
		this.isObservationPromised = false;									// PRIVATE:
		this.observations = [];												// PRIVATE:
		this.detailedObservations = true;									// PUBLIC: cannot be changed once initialized!

		// Interceptor prep
		this.interceptorTree = this.createMetaRoot();						// PRIVATE:
		this.interceptors = {};												// PRIVATE:

		// STORE CREATION
		// ----

		// Proxify and create our store
		this.root = {};
		this.store = this.proxify(this.root, this, []);

		// Add the user provided object to the store - one prop at a time!
		for (var prop in obj) this.store[prop] = obj[prop];

		// CONTROLLER CREATION
		// ---

		// Get context
		let internals = this;

		// Access to controllers
		this.catalyst = {

			internals,
			get store() { return internals.store; },

			path: this.path.bind(this),
			parent: this.parent.bind(this),
			parse: this.parse.bind(this),

			observe: this.observe.bind(this),
			stopObserve: this.stopObserve.bind(this),

			intercept: this.intercept.bind(this),
			stopIntercept: this.stopIntercept.bind(this)			

		};

		// All done - Return the catalyst
		return this.catalyst;

	}

	// ---------------------------
	// HELPER METHODS
	// ---------------------------

	createMetaRoot() {
		let metaRoot = { children: {}, symbol: Symbol(''), pathLength: 0 };
		metaRoot.parent = metaRoot;
		return metaRoot;
	}

	ensureMetaBranch(path, metaRoot, metaCreator) {

		let current = metaRoot;

		path.forEach((prop,i) => {
			if (!current.children[prop]) current.children[prop] = {	children: {}, parent: current, symbol: Symbol(prop), pathLength: i };
			current = current.children[prop];
		});

		if (!current.meta) current.meta = metaCreator(current, path.length > 0 ? path[path.length - 1] : "");
		return current;
	}

	getMetaBranch(path, metaRoot, getNearest = false) {

		let current = metaRoot;
		let nearest = metaRoot;

		let ret = path.some(prop => {
			if (!current.children[prop]) return true;
			else {
				current = current.children[prop];
				if (current.meta) nearest = current;
			}
		});

		if (ret) {
			if (getNearest) return nearest;
			else return false;
		}
		else return current;

	}

	shakeMetaBranch(path, metaRoot, flagger) {

		let current = metaRoot,
			branchPath = [];

		// Start at root and traverse down to the farthest possible branch
		path.some(prop => {

			 if (current.children[prop]) {
				 current = current.children[prop];
				 branchPath.push(prop);
			 }
			 else return true;

		});

		// Traverse upwards while deleting empty branches as long as possible
		while (current.parent != current) {

			if (flagger(current, branchPath[branchPath.length - 1])) {
				current = current.parent;
				delete current.children[branchPath.pop()];
			}
			else break;

		}

	}

	// ---------------------------
	// PROXY METHODS
	// ---------------------------

	parse(path) {

		// Qualify the path
		if (typeof path == "function") path = path();

		// Checks
		if (path === "" || path.length === 0) return this.store;
		
		// Traverse
		let current = this.store;
		if (path.some(prop => {
			if (current === undefined) return true;
			else current = current[prop];
		})) return undefined;
		else return current;

	}

	/**
	* Takes a part of the store and returns the path of the object relative to the base store.
	* @param {Object} obj - An object reference to any part of the store.
	* @returns {string} The path of the object relative to the base store.
	*/
	path(obj) {

		if (typeof obj != "object") throw new Error("Expected object, got " + (typeof obj) + ".");

		let context = this.resolve(obj, true);
		return context.path.slice();

	}

	/**
	* Takes a part of the store and returns the parent of that object in the store.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	* @returns {Object} An object reference to the parent of the given path or object.
	*/
	parent(pathOrObject) {

		// Designate?
		if (typeof pathOrObject == "function") pathOrObject = pathOrObject();

		// Process
		if (Array.isArray(pathOrObject))
			return pathOrObject.reduce((obj, prop, index) => (prop.length > 0 && index < pathOrObject.length - 1) ? obj && obj[prop] : obj, this.store);

		else if (typeof pathOrObject == "object")
			return this.parent(this.path(pathOrObject));

		else
			throw new Error("Expected array or object, got " + (typeof pathOrObject) + ".");
	}

	resolve(obj, getContext = false) {

		this.resolveMode = true;
		this.resolveContext = getContext;

		let resolved = obj.anything;

		this.resolveMode = false;
		this.resolveContext = false;

		return resolved;
	}

	proxify(target, self, path) {

		// Define context to be bound to.
		let context = {self, path};

		// Create the list of handlers
		let handlers = {
			get: self.handleGet.bind(context),
			set: self.handleSet.bind(context),
			deleteProperty: self.handleDelete.bind(context)
		};

		// Create & return the proxy
		return new Proxy(target, handlers);

	}

	deepProxify(_value, _oldValue, _path, misc, oBranch, iBranch) {

		// Diff check
		if (_value === _oldValue) return _oldValue;

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

			// Prep Root - either the underlying target of object oldVal, or a new object if oldVal wasnt an object!
			let root;
			if (_isOldArr && _isArr) root = this.resolve(_oldValue); 			// a->a
			else if (_isOldArr && _isObj) root = {}; 							// a->o
			else if (_isObj && _isArr) root = []; 								// o->a
			else if (_isOldObj && _isObj) root = this.resolve(_oldValue); 		// o->o
			else if (_isOldArr) root = this.resolve(_oldValue);					// a->v
			else if (_isArr) root = [];											// v->a
			else if (_isOldObj) root = this.resolve(_oldValue); 				// o->v
			else if (_isObj) root = {}; 										// v->o

			let isRootArr = Array.isArray(root);

			// Prep deletion optimization - defers/avoids actually deleting the keys until until/unless necessary
			// TODO: easy diffing??? - count change in number of misc.changes variable
			let deferDeletes = _isOldObj && !_isObj;
			let deletes = [];

			let deferDelete = key => {
				if (!deferDeletes) delete root[key];
				else deletes.push(key);
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

				// Diff
				if (newVal === oldVal) return;

				// Prep path - optionally optimize by retreiving from context if oldValue is an object.
				let __path;
				if (_isOldObj && isOldValObj) __path = this.path(oldVal);
				else {
					__path = _path.slice();
					__path.push(key);
				}

				// Retrieve observer and interceptor branch - if we have the respective parent branches
				let _oBranch, _iBranch;
				if (oBranch) _oBranch = oBranch.children[key];
				if (iBranch) _iBranch = iBranch.children[key];

				// Intercept!
				if (_iBranch && _iBranch.meta && _iBranch.meta.top.size > 0) {
					let iResult = this.notifyInterceptors(__path, newVal, oldVal, _iBranch, false);
					newVal = iResult.value;
					if (newVal === oldVal) return;
				}

				// Diff exists
				else {

					// newValue is object, this property wont get deleted but updated - must recursively proxify this!
					if (typeof newVal == "object") {
						root[key] = this.deepProxify(newVal, oldVal, __path, misc, _oBranch, _iBranch);
						if (!isOldValObj) misc.changes ++;
						executeDeletes();
					}

					// newVal is undefined - this subtree is to be deleted
					else if (typeof newVal == "undefined") {

						// if oldVal was an object, must recurse into subtrees to get unanimity!
						if (isOldValObj) {
							let remnant = this.deepProxify(undefined, oldVal, __path, misc, _oBranch, _iBranch);

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
							let remnant = this.deepProxify(undefined, oldVal, __path, misc, _oBranch, _iBranch);

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

					// Add observation
					// TODO: add optimization for array observation? - reshuffle / add / delete etc..
					if (_oBranch) {
						if (_oBranch.meta) {
							if (_oBranch.meta.top.size > 0)
								misc.observations.push({ path: __path, branch: _oBranch, bubble: false });
						}
					}

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
				context.isDisconnected = true;
			};

			// Helper - proxifies root if oldValue was not an object (root is a new object)
			let proxifyOldValue = () => {

				// Fix root array length - trim empty items from the end of the array !!!
				if (isRootArr && _isArr && _isOldArr) {
					let h = 0;
					root.forEach((_,i) => h = (i > h) ? i : h);
					root.length = h + 1;
				}

				// Return old or new !
				if (_isOldObj && (_isOldArr == _isArr)) return _oldValue;
				else {
					if (_isOldObj) disconnect();
					return this.proxify(root, this, _path);
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

	handleSet(target, prop, value) {

		// Check if this is an isolated non-state disconnected reference
		if (this.isDisconnected) {
			if (typeof value === 'undefined') delete target[prop];
			else target[prop] = value;
			return true;
		}

		// Check diff
		if (target[prop] === value) return true;

		// Prep
		let self = this.self;
		let oldValue = target[prop];
		let oldType = typeof oldValue;
		let misc = {
			observations: [],
			changes: 0
		};

		// Prep path - optionally optimize by retreiving from context if oldValue is an object.
		// TODO: resolve is much slower than vanilla get - compare getter proxy speed vs array push/slice speed
		let path;
		if (oldType == "object") path = self.path(oldValue);
		else {
			path = this.path.slice();
			path.push(prop);
		}

		// Retreive observer & interceptor branch
		let oBranch = self.getMetaBranch(path, self.observerTree, true),
			oFlag = oBranch.pathLength == path.length;

		// Fire interceptors
		let iResult = self.notifyInterceptors(path, value, oldValue, undefined, true);
		value = iResult.value;

		// Check diff again
		if (value === oldValue) return true;

		// Deep proxify
		let result = self.deepProxify(value, oldValue, path, misc, oFlag ? oBranch : false, iResult.branch);

		// Has anything been updated?
		if (result === oldValue) {

			// For o -> o, check number of changes, if none then exit.
			if (typeof result == "object") {
				if (misc.changes == 0) return true; 
				// Else is not required - as it means changes have happened inside the object but not at this top level !
			}

			// Nothing changed!
			else return true;

		}
		else if (typeof result == "undefined") delete target[prop];
		else target[prop] = result;

		// Add top-level observation & enqueue all child observations
		if (oBranch.meta) {
			misc.observations.push({ path: path, branch: oBranch, haveExactBranch: oFlag, bubble: true });
			self.enqueueObservations(misc.observations);
		}

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
	* @param {Object|Array|Function} pathOrObject - An object reference or designator that represents any part of the store.
	* @param {observeCB} fnId - Invoked when the observed part of the store changes. Do NOT update the store here.
	* @param {boolean} shallow - If true, looks for changes to nested child properties.
	* @param {boolean} deep - If true, looks for changes to the entire nested object tree. Overrides children to true.
	* @returns {Object} An ID that can be used to unregister the observer.
	*/
	observe(pathObjDs, fnId, shallow = false, deep = false) {

		// Prep
		let paths = [], pre, id;

		// Retreive pre if ID is given
		if (typeof fnId != "function") {
			id = fnId;
			pre = this.observers[id];

			if (!pre) throw new Error("Cannot add path(s) to pre-installed observer due to invalid ID!");
		}

		// Else generate ID
		else {
			this._uCounter ++;
			id = this._uCounter;
		}

		// Prep path and determine if multiple paths have been given
		if (typeof pathObjDs == "function") paths.push(pathObjDs());
		else if (Array.isArray(pathObjDs)) {

			if (pathObjDs.length == 0) paths.push([]);
			else if (typeof pathObjDs[0] == "string") paths.push(pathObjDs);
			else pathObjDs.forEach(path => {
				let type = typeof path;

				if (type == "function") paths.push(path());
				else if (Array.isArray(path)) paths.push(path); // Assuming it is an array of array of strings
				else if (type == "object") paths.push(this.path(path));
				else throw new Error("Expected designator(s), got some weird array.");
			});

		}
		else if (typeof pathObjDs == "object") paths.push(this.path(pathObjDs));
		else throw new Error("Expected designator(s), got " + (typeof pathObjDs) + ".");

		// Set the observer
		if (!pre) this.observers[id] = {paths, fn: fnId, symbolsMap: {}};
		else pre.paths.push(...paths);

		// Add each path to the tree
		paths.forEach((path, i) => {

			// Create tree branch
			let branch = this.ensureMetaBranch(path, this.observerTree, () => { return {
				top: new Map(),
				shallow: new Map(),
				deep: new Map(),
				count: 0
			}; });

			// Map the branch path to the array index of the path in the observer definition (used for path-respective diff)
			if (this.detailedObservations) this.observers[id].symbolsMap[branch.symbol] = (this.observers[id].paths.length - paths.length) + i;

			// Add leaf to branch
			branch.meta.top.set(id, true);
			if (shallow || deep) branch.meta.shallow.set(id, true);
			if (deep) branch.meta.deep.set(id, true);

			// Increment counter for branch
			branch.meta.count ++;

		});

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
			let obs = this.observers[id];

			// Delete leafs
			obs.paths.forEach(path => {
				let branch = getMetaBranch(path, this.observerTree);

				branch.meta.top.delete(id);
				branch.meta.shallow.delete(id);
				branch.meta.deep.delete(id);

				branch.meta.count --;
			});

			// Delete branches
			obs.paths.forEach(path => this.shakeMetaBranch(path, this.observerTree, branch => branch.meta.count < 1));

			// Delete the actual thing
			delete this.observers[id];

			// All done
			return true;
		}

		// If not found
		return false;

	}

	enqueueObservations(observations) {
		this.observations.push(...observations);

		if (!this.isObservationPromised) {
			this.isObservationPromised = true;
			Promise.resolve().then(this.notifyObservers.bind(this));
		}
	}

	notifyObservers() {

		// Set promise to false
		this.isObservationPromised = false;

		// Prep
		let topSymbolsCovered = {}, shallowSymbolsCovered = {}, deepSymbolsCovered = {};
		let observersCovered = new Map();

		// Observer processor
		let processObservation = (observerId, observation, branch) => {

			// Prep
			let observer = this.observers[observerId];
			let coveredObserver;

			// Are we encountering this observer for the first time?
			if (!observersCovered.has(observerId)) {

				// Create a detailed object?
				if (this.detailedObservations) coveredObserver = {
						fn: observer.fn,
						paths: new Array(observer.paths.length)
					};
				else coveredObserver = observer;

				// Add the observer covered to our list
				observersCovered.set(observerId, coveredObserver);

			}

			// Add observation details?
			if (this.detailedObservations) {
				coveredObserver = coveredObserver || observersCovered.get(observerId);
				let symbolIndex = observer.symbolsMap[branch.symbol];
				coveredObserver.paths[symbolIndex] = observation.path;
			}

		};

		// Go through each observation in order and process them (batch the diffs)
		this.observations.forEach(observation => {

			// Prep
			let haveExactBranch = observation.haveExactBranch;
			let branch = observation.branch;

			// Fire each top level observer
			if (haveExactBranch) {
				if (!topSymbolsCovered.hasOwnProperty(branch.symbol)) {
					topSymbolsCovered[branch.symbol] = true;
					branch.meta.top.forEach((isEnabled, observerId) => isEnabled ? processObservation(observerId, observation, branch) : undefined);
				}
			}
			
			// Bubble up?
			if (observation.bubble) {

				// If we have an exact branch, we would have triggered its top level handler already! - move to parent!
				if (haveExactBranch) {
					if (branch.parent == branch) return; 
					else branch = branch.parent;
				}

				// Fire each shallow observer
				if (branch.pathLength == observation.path.length - 1) {
					
					if (branch.meta) {
						if (!shallowSymbolsCovered.hasOwnProperty(branch.symbol)) {
							shallowSymbolsCovered[branch.symbol] = true;
							branch.meta.shallow.forEach((isEnabled, observerId) => isEnabled ? 
								processObservation(observerId, observation, branch) : 
								undefined
							);
						}
					}

					// Go up to deep levels
					branch = branch.parent;
				}

				// Traverse upwards and fire each deep observers
				while (true) {
					if (branch.meta) {
						if (!deepSymbolsCovered.hasOwnProperty(branch.symbol)) {
							deepSymbolsCovered[branch.symbol] = true;
							branch.meta.deep.forEach((isEnabled, observerId) => isEnabled ? 
								processObservation(observerId, observation, branch) : 
								undefined
							);
						}
					}

					if (branch.parent == branch) break;
					else branch = branch.parent;
				}

			}

		});

		// Triger every handler in order
		observersCovered.forEach((processedObs, obsId) => {
			if (this.observers[obsId]) processedObs.fn(processedObs.paths);
		});

		// All done - empty the queue
		this.observations = [];
	}

	// ---------------------------
	// INTERCEPTOR METHODS
	// ---------------------------

	/**
	* Intercepts (or validates) changes to an existing or non-existing part of the store. Similar to a middleware. Supports cascading updates to store.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	* @param {interceptCB} fn - Invoked when the given part of the store changes. Cascaded updates to other parts of the store are batched as single atomic history record.
	* @param {boolean} shallow - If true, intercepts changes to nested child properties.
	* @param {boolean} deep - If true, intercepts changes to the entire nested object tree. Overrides children to true.
	* @returns {Object} An ID that can be used to unregister the interceptor.
	*/
	intercept(pathObjDs, fn, shallow = false, deep = false) {

		// Prep
		let path, id;

		// Generate ID
		this._uCounter ++;
		id = this._uCounter;

		// Prep path and determine if multiple paths have been given
		if (typeof pathObjDs == "function") path = pathObjDs();
		else if (Array.isArray(pathObjDs)) {
			if (pathObjDs.length == 0) path = [];
			else path = pathObjDs;
		}
		else if (typeof pathObjDs == "object") path = this.path(pathObjDs);
		else throw new Error("Expected designator(s), got " + (typeof pathObjDs) + ".");

		// Set the observer
		this.interceptors[id] = { path, fn };

		// Create tree branch
		let branch = this.ensureMetaBranch(path, this.interceptorTree, () => {
			return {
				top: new Map(),
				shallow: new Map(),
				deep: new Map(),
				count: 0
			};
		});

		// Add leaf to branch
		branch.meta.top.set(id, true);
		if (shallow || deep) branch.meta.shallow.set(id, true);
		if (deep) branch.meta.deep.set(id, true);

		// Increment counter for branch
		branch.meta.count++;		

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
			let interceptor = this.interceptors[id];

			// Delete leaf
			let branch = getMetaBranch(interceptor.path, this.interceptorTree);

			branch.meta.top.delete(id);
			branch.meta.shallow.delete(id);
			branch.meta.deep.delete(id);

			branch.meta.count--;

			// Delete branch
			this.shakeMetaBranch(interceptor.path, this.interceptorTree, branch => branch.meta.count < 1);

			// Delete the actual thing
			delete this.interceptors[id];

			// All done
			return true;
		}

		// If not found
		return false;

	}

	// TODO: how to escape interceptor chain? - for example for making a catalyst-readonly plugin (solved) - how to escape without returning oldval???
	notifyInterceptors(path, newVal, oldVal, branch, dig = true) {

		// Prep
		let escapeFlag = false;

		// Next chain creator
		// TODO: implement this !!!
		let next = val => val;

		// Helper
		let notify = (isEnabled, id) => {

			if (!isEnabled) return;

			let interceptor = this.interceptors[id];
			if (!interceptor) return;

			newVal = interceptor.fn(
				path,
				newVal,
				oldVal,
				next
			);

			if (newVal === oldVal) escapeFlag = true;

		};

		// More helper
		let done = () => {
			return {
				value: newVal,
				branch
			};
		};

		// Do we dig towards the specified branch from the root ?
		if (dig) {

			// Prep
			let current = this.interceptorTree;
			branch = undefined;

			// Deep - Dig till we reach shallow level
			while(current.pathLength < path.length - 1) {
				
				// Trigger deep interceptors
				if (current.meta) current.meta.deep.forEach((isEnabled, id) => escapeFlag ? false : notify(isEnabled, id));
				
				if (escapeFlag) return done();

				// Dig
				let nextProp = path[current.pathLength];
				current = current.children[nextProp];
				
				// Path ended before reaching shallow level
				if (!current) return done();				

			}

			// Shallow
			if (current.meta && (current.pathLength === path.length - 1)) {
				current.meta.shallow.forEach((isEnabled, id) => escapeFlag ? false : notify(isEnabled, id));
				if (escapeFlag) return done();
			}

			// Reset branch
			if (current.pathLength === path.length - 1) {
				branch = current.children[path[current.pathLength]];
				if (!branch) return done();
			}

		}

		// Top
		if (branch.meta) branch.meta.top.forEach((isEnabled, id) => escapeFlag ? false : notify(isEnabled, id));

		// All done
		return done();

	}

};

/*export {
	designator,
	Catalyst
};*/

  /**
  * @callback observeCB
  * @param {string} path - The path of the changed part of the store.
  * @param {*} oldValue - Value of the part of the store before the change.
  * @param {string} opPath - The path to the top-level part of the store, relative to the base store, which was originally changed. Could be different from path for child and deep observers.
  * @param {*} opOldValue - Value of the top-level part of the store which was originally changed.
  */

  /**
  * @callback interceptCB
  * @param {string} path - The path of the changed part of the store.
  * @param {*} newValue - Value of the part of the store before the change.
  * @param {string} opPath - The path to the top-level part of the store, relative to the base store, which was originally changed. Could be different from path for child and deep observers.
  * @param {*} opOldValue - Value of the top-level part of the store which was originally changed.
  */
