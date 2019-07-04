"use strict";

// /" _  "\      /""\("     _   ") /""\    |"  |     |"  \/"  |/"       )("     _   ")
// (: ( \___)    /    \)__/  \\__/ /    \   ||  |      \   \  /(:   \___/  )__/  \\__/
// \/ \        /' /\  \  \\_ /   /' /\  \  |:  |       \\  \/  \___  \       \\_ /
// //  \ _    //  __'  \ |.  |  //  __'  \  \  |___    /   /    __/  \\      |.  |
// (:   _) \  /   /  \\  \\:  | /   /  \\  \( \_|:  \  /   /    /" \   :)     \:  |
// \_______)(___/    \___)\__|(___/    \___)\_______)|___/    (_______/       \__|

// Copyright (c) 2019 Soumik Chatterjee (github.com/badguppy) (soumik.chat@hotmail.com)
// MIT License

// TODO: add ability to prep the designator
let designator = new Proxy(
	() => [],
	{
		get: (_, prop) => {

			let env = { path: [prop] };
			let resolver = function() { return this.path; };
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
	constructor(obj) {

		// Check - cannot create store with array as base!
		let objType = typeof obj;
		if (objType != "undefined") {
			if (Array.isArray(obj)) throw new Error("Expected object, got array.");
			else if (objType != "object") throw new Error("Expected object, got value.");
		}

		// PREP
		// ----

		this.accessor = ".";												// PUBLIC:
		this.isBypassed = false;											// PUBLIC:
		this.resolveMode = false;											// PRIVATE:
		this.resolveContext = false;										// PRIVATE:
		this.preserveReferences = true;										// PUBLIC: TODO: should prolly be false always to trigger react update - reference should be broken all along from bottom to the highest possible level of change to force update at that heirarchy of component?
		this.preserveFragments = true;										// PUBLIC:

		// Fragments - creates top-level-like state-chunks that preserve the reference to the main chunk.
		this.fragmented = {};
		this.fragments = {};

		// Observer - does NOT support cascading changes to the store.
		this.observerTree = this.createMetaRoot();							// PRIVATE:
		this.observers = {};												// PRIVATE:
		this.isObservationPromised = false;									// PRIVATE:
		this.observations = [];												// PRIVATE:
		this.detailedObservations = true;									// PUBLIC: cannot be changed once initialized!

		// Interceptor - supports cascading changes to the store and are auto-batched to be atomic! They are not executed on undo/redo!
		this.interceptorTree = this.createMetaRoot();						// PRIVATE:
		this.interceptors = {};												// PRIVATE:
		this.setterLevel = 0;												// PRIVATE:
		this.setterBatched = false;											// PRIVATE:

		// STORE CREATION
		// ----

		// Proxify and create our store
		this.root = {};
		this.store = this.proxify(this.root, this, []);

		// Add the user provided object to the store - one prop at a time!
		for (var prop in obj) this.store[prop] = obj[prop];

		// CONTROLLER CREATION
		// ---

		// Prep catalyst controllers
		let getIsBypassed = () => this.isBypassed,
			setIsBypassed = value => this.isBypassed = value,

			getPreserveReferences = () => this.preserveReferences,
			setPreserveReferences = value => this.preserveReferences = value,

			/*getPreserveFragments = () => this.preserveFragments,
			setPreserveFragments = value => this.preserveFragments = value,*/

			getStore = () => this.store

			/*getIsFragment = function(pathOrObject) {
				if (typeof pathOrObject == "undefined") return 0;
				else if (typeof pathOrObject == "object") return this.isFragment(pathOrObject);
				else if (typeof pathOrObject == "string") return this.isFragment(pathOrObject);
				else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
			}*/;

		// TODO: write parsable comments on functions and purpose of variables - also mark if they are to be used by user or internal only!
		// TODO: must have ability to add functions to the store! like ToJSON etc. Esp to areas not recorded !

		// Get context
		let internals = this;

		// Access to controllers
		this.catalyst = {

			internals,

			get isBypassed() { return getIsBypassed(); },
			set isBypassed(value) { setIsBypassed(value); },

			get preserveReferences() { return getPreserveReferences(); },
			set preserveReferences(value) { setPreserveReferences(value); },

			/*get preserveFragments() { return getPreserveFragments(); },
			set preserveFragments(value) { setPreserveFragments(value); },*/

			bypass: (function (fn) {
				this.isBypassed = true;
				let result = fn();
				this.isBypassed = false;
				return result;
			}).bind(this),

			parse: this.parse.bind(this),
			path: this.path.bind(this),
			parent: this.parent.bind(this),
			/*fragment: this.metaProxify(this.fragment, this),
			isFragment: this.metaProxify(getIsFragment, this),
			get fragmentPath() { return ""; },
			augment: this.metaProxify(this.augment, this),*/

			observe: this.metaProxify(function (pathOrObject, fn, children = false, deep = false, init = true)
					{ return this.observe(pathOrObject, fn, children, deep, init, this.catalyst); }, this),
			stopObserve: this.stopObserve.bind(this),

			intercept: this.metaProxify(function (pathOrObject, fn, children = false, deep = false)
						{ return this.intercept(pathOrObject, fn, children, deep, this.catalyst); }, this),
			stopIntercept: this.stopIntercept.bind(this),

			get store() { return getStore(); }

		};

		// All done - Return the catalyst
		return this.catalyst;

	}

	// ---------------------------
	// HELPER METHODS
	// ---------------------------

	createMetaRoot() {
		let metaRoot = { children: {}, pathLength: 0 };
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
	// FRAGMENTATION METHODS
	// ---------------------------

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
		else throw new Error("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Sanitize propertypath
		if (!path.length) return 0;
		if (path[0] != this.accessor) path = this.accessor + path;

		// Return if fragment
		return (typeof this.fragmented[path] == "object") ? Object.keys(this.fragmented[path]).length : 0;

	}

	/**
	* Creates a new fragment, which freezes reference and allows relative access to the given part of the state.
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any object/array part of the store.
	* @param {dissolveCB} onDissolve - Invoked when the fragment is dissolved. Can be used for external clean-up. Do NOT update the store here!
	* @returns {Object} A new fragment object.
	*/
	fragment(pathOrObject, onDissolve) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw new Error("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Sanitize propertypath
		if (!path.length) throw new Error("Path is an empty string.");
		if (path[0] != this.accessor) path = this.accessor + path;

		// Check if path exists and is an object
		let store = this.parse(path);
		if (typeof store != "object") throw new Error("Path must represent an existing valid part of the store.");

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
		let observe = function(pathOrObject, fn, children = false, deep = false, init = false) {
			if (typeof pathOrObject == "undefined") internal.observers.push(this.observe(path, fn, children, deep, init, fragment));
			else if (typeof pathOrObject == "object") internal.observers.push(this.observe(pathOrObject, fn, children, deep, init, fragment));
			else if (typeof pathOrObject == "string") internal.observers.push(this.observe(normalize(pathOrObject), fn, children, deep, init, fragment));
			else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");

			return internal.observers[internal.observers.length - 1];
		};

		let refresh = function(pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.refresh(path);
			else if (typeof pathOrObject == "object") return this.refresh(pathOrObject);
			else if (typeof pathOrObject == "string") return this.refresh(normalize(pathOrObject));
			else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let intercept = function(pathOrObject, fn, children = false, deep = false) {
			if (typeof pathOrObject == "undefined") internal.interceptors.push(this.intercept(path, fn, children, deep, fragment));
			else if (typeof pathOrObject == "object") internal.interceptors.push(this.intercept(pathOrObject, fn, children, deep, fragment));
			else if (typeof pathOrObject == "string") internal.interceptors.push(this.intercept(normalize(pathOrObject), fn, children, deep, fragment));
			else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");

			return internal.interceptors[internal.interceptors.length - 1];
		};

		let isFragment = function(pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.isFragment(path);
			else if (typeof pathOrObject == "object") return this.isFragment(pathOrObject);
			else if (typeof pathOrObject == "string") return this.isFragment(normalize(pathOrObject));
			else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let parent = function(pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.parent(path);
			else if (typeof pathOrObject == "object") return this.parent(pathOrObject);
			else if (typeof pathOrObject == "string") return this.parent(normalize(pathOrObject));
			else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let parse = function(_path) { return this.parse(normalize(_path)); };

		let fragmentFn = function(pathOrObject, _onDissolve) {
			if (typeof pathOrObject == "undefined") return this.fragment(path, _onDissolve);
			else if (typeof pathOrObject == "object") return this.fragment(pathOrObject, _onDissolve);
			else if (typeof pathOrObject == "string") return this.fragment(normalize(pathOrObject), _onDissolve);
			else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		};

		let augment = function (pathOrObject) {
			if (typeof pathOrObject == "undefined") return this.augment(path);
			else if (typeof pathOrObject == "object") return this.augment(pathOrObject);
			else if (typeof pathOrObject == "string") return this.augment(normalize(pathOrObject));
			else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
		}

		let stopObserve = function (id) {
			if (!internal.observers[id]) return false;
			else return this.stopObserve(id);
		};

		let stopIntercept = function (id) {
			if (!internal.interceptors[id]) return false;
			else return this.stopIntercept(id);
		};

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
		fragment.stopIntercept = stopIntercept.bind(this);
		fragment.stopObserve = stopObserve.bind(this);

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
		else throw new Error("Expected string or object, got " + (typeof pathOrObject) + ".");

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

	/**
	* Parses a nested property path string, and returns the part of the store that it represents.
	* @param {string} path - The path containing the properties, separated by the accessor character.
	* @returns {*} The part of the store represented by the path.
	*/
	parse(path) {

		// Designate ?
		if (typeof path == "function") path = path();

		// Sanitize propertypath
		if (!Array.isArray(path)) throw new Error("Expected array, got " + (typeof path) + ".");

		// Get the final value, if can..
		return path.reduce((obj, prop) => {
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

			// Fragmentation check
			// TODO: fix this!
			let isFragment = false;
			// TODO: is fragment should be retreivable from proxy context as object must exist to be a fragment!
			/*if (_isOldObj) {
				if (typeof this.fragmented[_path] == "object") {
					if (Object.keys(this.fragmented[_path]).length > 0) isFragment = true;
				}
			}*/

			// Preserve ref check
			let preserveRef = this.preserveReferences || isFragment;

			// Preserve fragments ?
			/*if (isFragment && (!_isObj || (_isObj && (_isArr != _isOldArr)))) {
				if (this.preserveFragments) return _oldValue;
				else this.augment(_path);
			}*/

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

			// Diff helper
			// TODO: uses double equals instead of triple equals - add test case for objects deep change!
			let diff = (n, o, r, k) => {
				if (n === o) {
					if (!preserveRef) r[k] = o;
					return false;
				}
				return true;
			};

			// Define object/array key processor
			let processKey = key => {

				// Prep	values
				let newVal = _isObj ? _value[key] : undefined;
				let oldVal = _isOldObj ? _oldValue[key] : undefined;
				let isOldValObj = typeof oldVal == "object";

				// Diff
				if (!diff(newVal, oldVal, root, key)) return;

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
				if (_iBranch) {
					if (_iBranch.meta) {
						if (_iBranch.meta.top.size > 0) {
							let iResult = this.notifyInterceptors(__path, newVal, oldVal, _iBranch, false);
							newVal = iResult.value;
							if (!diff(newVal, oldVal, root, key)) return;
						}
					}
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

		// Check if this is an isolated non-state disconnected reference OR if we are bypassing and setting the props direct
		if (this.passthrough || this.self.isBypassed) {
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
			oFlag = oBranch.pathLength == path.length,
			iResult = {};

		// Fire interceptors
		iResult = self.notifyInterceptors(path, value, oldValue, undefined, true);
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
	* @param {Object|string} pathOrObject - An object reference or a string path that represents any part of the store.
	* @param {observeCB} fn - Invoked when the observed part of the store changes. Do NOT update the store here.
	* @param {boolean} children - If true, looks for changes to nested child properties.
	* @param {boolean} deep - If true, looks for changes to the entire nested object tree. Overrides children to true.
	* @param {boolean} init - Invokes the callback once immediately after successful registration.
	* @returns {Object} An ID that can be used to unregister the observer.
	*/
	observe(pathObjDs, fnId, shallow = false, deep = false, origin) {

		// Prep
		let paths = [], pre, id;

		// Retreive pre if ID is given
		if (typeof fnId != "function") {
			id = fnId;
			pre = this.observers[id];
			origin = pre.origin;

			if (!pre) throw new Error("Cannot add path(s) to pre-installed observer due to invalid ID!");
		}

		// Else generate ID and set origin
		else {
			this._uCounter = (this._uCounter || 1) + 1;
			id = this._uCounter;
			origin = origin || this.catalyst;
		}

		// Prep path and determine if multiple paths have been given
		if (typeof pathObjDs == "function") paths.push(pathObjDs());
		else if (Array.isArray(pathObjDs)) {

			if (pathObjDs.length == 0) paths.push([]);
			else if (typeof pathObjDs[0] == "string") paths.push(pathObjDs);
			else pathObjDs.forEach(path => {
				let type = typeof path;

				if (type == "function") paths.push(path());
				else if (Array.isArray(path)) paths.push(path); 										// Assuming it is an array of array of strings
				else if (type == "object") paths.push(this.path(path));
				else throw new Error("Expected designator(s), got some weird array.");
			});

		}

		// TODO: there is going to be an issue with object ? the path extracted from the object context will be the full path - can it interfere with fragment?
		else if (typeof pathObjDs == "object") paths.push(this.path(pathObjDs));
		else throw new Error("Expected designator(s), got " + (typeof pathObjDs) + ".");

		// Set the observer
		if (!pre) this.observers[id] = {paths, fn: fnId, origin, symbolsMap: {}};
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
		// TODO: path enqueued here should be fragment path ???
		let processObservation = (observerId, observation, branch) => {

			// Prep
			let observer = this.observers[observerId];
			let coveredObserver;

			// Are we encountering this observer for the first time?
			if (!observersCovered.has(observerId)) {

				// Create a detailed object?
				if (this.detailedObservations) coveredObserver = {
						fn: observer.fn,
						origin: observer.origin,
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
			if (this.observers[obsId]) processedObs.fn(processedObs.paths, processedObs.origin);
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
	* @param {boolean} children - If true, intercepts changes to nested child properties.
	* @param {boolean} deep - If true, intercepts changes to the entire nested object tree. Overrides children to true.
	* @returns {Object} An ID that can be used to unregister the interceptor.
	*/
	intercept(pathObjDs, fn, shallow = false, deep = false, origin) {

		// Prep
		let path, id;

		// Generate ID and set origin
		this._uCounter = (this._uCounter || 1) + 1;
		id = this._uCounter;
		origin = origin || this.catalyst;

		// Prep path and determine if multiple paths have been given
		if (typeof pathObjDs == "function") path = pathObjDs();
		else if (Array.isArray(pathObjDs)) {
			if (pathObjDs.length == 0) path = [];
			else path = pathObjDs;
		}

		// TODO: there is going to be an issue with object ? the path extracted from the object context will be the full path - can it interfere with fragment?
		else if (typeof pathObjDs == "object") path = this.path(pathObjDs);
		else throw new Error("Expected designator(s), got " + (typeof pathObjDs) + ".");

		// Set the observer
		this.interceptors[id] = { path, fn, origin };

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
	notifyInterceptors(path, newVal, oldVal, branch, dig = true, requireDiff = true) {

		// Prep
		let escapeFlag = false;

		// Helper
		let notify = (isEnabled, id) => {

			if (!isEnabled) return;

			let interceptor = this.interceptors[id];
			if (!interceptor) return;

			newVal = interceptor.fn(
				path,
				newVal,
				interceptor.origin
			);

			if (newVal === oldVal && requireDiff) escapeFlag = true;

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
  * @callback dissolveCB
  */

  /**
  * @callback observeCB
  * @param {string} path - The path of the changed part of the store, relative to the origin.
  * @param {*} oldValue - Value of the part of the store before the change.
  * @param {Object} origin - Catalyst or the fragment via which the observer callback was registered.
  * @param {string} opPath - The path to the top-level part of the store, relative to the base store, which was originally changed. Could be different from path for child and deep observers.
  * @param {*} opOldValue - Value of the top-level part of the store which was originally changed.
  */

  /**
  * @callback interceptCB
  * @param {string} path - The path of the changed part of the store, relative to the origin.
  * @param {*} newValue - Value of the part of the store before the change.
  * @param {Object} origin - Catalyst or the fragment via which the observer callback was registered.
  * @param {string} opPath - The path to the top-level part of the store, relative to the base store, which was originally changed. Could be different from path for child and deep observers.
  * @param {*} opOldValue - Value of the top-level part of the store which was originally changed.
  */
