"use strict";

// /" _  "\      /""\("     _   ") /""\    |"  |     |"  \/"  |/"       )("     _   ")
// (: ( \___)    /    \)__/  \\__/ /    \   ||  |      \   \  /(:   \___/  )__/  \\__/
// \/ \        /' /\  \  \\_ /   /' /\  \  |:  |       \\  \/  \___  \       \\_ /
// //  \ _    //  __'  \ |.  |  //  __'  \  \  |___    /   /    __/  \\      |.  |
// (:   _) \  /   /  \\  \\:  | /   /  \\  \( \_|:  \  /   /    /" \   :)     \:  |
// \_______)(___/    \___)\__|(___/    \___)\_______)|___/    (_______/       \__|

// Copyright (c) 2019 Soumik Chatterjee (github.com/badguppy) (soumik.chat@hotmail.com)
// MIT License

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

		this.accessor = ".";											// PUBLIC:
		this.isBypassed = false;											// PUBLIC:
		this.resolveMode = false;											// PRIVATE:
		this.resolveContext = false;										// PRIVATE:
		this.preserveReferences = true;										// PUBLIC:
		this.preserveFragments = true;										// PUBLIC:

		// Fragments - creates top-level-like state-chunks that preserve the reference to the main chunk.
		this.fragmented = {};
		this.fragments = {};

		// Observer - does NOT support cascading changes to the store.
		this.observedTree = { observers: { top: {}, shallow: {}, deep: {} }, children: {} };
		this.observers = {};												// PRIVATE:
		this.observed = {prop: {}, child:{}, deep: {}};						// PRIVATE:
		this.observerNotifier = this.notifyObservers.bind(this);			// PRIVATE:
		this.observeAsync = false;											// PUBLIC: Whether observers are triggered asynchronously (via Promise microtask) !
		this.observeDeferred = 0;											// PUBLIC: Whether observations are batched together!
		this.observations = {												// PRIVATE:
			stacks: [],		// Array of maps
			paths: {}		// paths to stack index
		};

		// Interceptor - supports cascading changes to the store and are auto-batched to be atomic! They are not executed on undo/redo!
		this.interceptedTree = { interceptors: { top: {}, shallow: {}, deep: {} }, children: {} };
		this.interceptors = {};												// PRIVATE:
		this.intercepted = {prop: {}, child:{}, deep: {}};					// PRIVATE:
		this.interceptorNotifier = this.notifyInterceptors.bind(this);		// PRIVATE:
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
		let getAccessor = () => this.accessor,

			getIsBypassed = () => this.isBypassed,
			setIsBypassed = value => this.isBypassed = value,

			getPreserveReferences = () => this.preserveReferences,
			setPreserveReferences = value => this.preserveReferences = value,

			getPreserveFragments = () => this.preserveFragments,
			setPreserveFragments = value => this.preserveFragments = value,

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

			getIsConcealed = () => this.isConcealed,
			setIsConcealed = value => this.isConcealed = value,

			getStore = () => this.store,

			getIsFragment = function(pathOrObject) {
				if (typeof pathOrObject == "undefined") return 0;
				else if (typeof pathOrObject == "object") return this.isFragment(pathOrObject);
				else if (typeof pathOrObject == "string") return this.isFragment(pathOrObject);
				else throw new Error("Expected string, object or undefined, got" + (typeof pathOrObject) + ".");
			};

		// TODO: write parsable comments on functions and purpose of variables - also mark if they are to be used by user or internal only!
		// TODO: must have ability to add functions to the store! like ToJSON etc. Esp to areas not recorded !
		// TODO: ObserveAsync is not working - always sync!

		// Access to controllers
		this.catalyst = {

			get accessor() { return getAccessor(); },

			get isBypassed() { return getIsBypassed(); },
			set isBypassed(value) { setIsBypassed(value); },

			get preserveReferences() { return getPreserveReferences(); },
			set preserveReferences(value) { setPreserveReferences(value); },

			get preserveFragments() { return getPreserveFragments(); },
			set preserveFragments(value) { setPreserveFragments(value); },

			bypass: (function (fn) {
				this.isBypassed = true;
				let result = fn();
				this.isBypassed = false;
				return result;
			}).bind(this),

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
			curtain: (function (fn, async) {
				this.deferObservers();
				let result = fn();

				let oldAsync = this.observeAsync;
				if (async === true) this.observeAsync = true;
				else if (async === false) this.observeAsync = false;
				this.resumeObservers();
				this.observeAsync = oldAsync;

				return result;
			}).bind(this),
			conceal: (function (fn) {
				this.isConcealed = true;
				let result = fn();
				this.isConcealed = false;
				return result;
			}).bind(this),

			get isObserveAsync() { return getObserveAsync(); },
			set isObserveAsync(value) { setObserveAsync(value); },

			get isObserveDeferred() { return getObserveDeffered(); },
			set isObserveDeferred(value) { setObserveDeffered(value); },

			get isConcealed() { return getIsConcealed(); },
			set isConcealed(value) { setIsConcealed(value); },

			intercept: this.metaProxify(function (pathOrObject, fn, children = false, deep = false)
						{ return this.intercept(pathOrObject, fn, children, deep, this.catalyst); }, this),
			stopIntercept: this.stopIntercept.bind(this),

			get store() { return getStore(); }

		};

		// All done - Return the catalyst
		return this.catalyst;

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
		if (Array.isArray(pathOrObject)) {
			if (pathOrObject.length == 0) throw new Error("Parent of root store cannot exist.");
			return pathOrObject.reduce((obj, prop, index) => (prop.length > 0 && index < pathOrObject.length - 1) ? obj && obj[prop] : obj, this.store);
		}

		else if (typeof pathOrObject == "object") {
			let path = this.resolve(pathOrObject, true).path;
			return this.parent(path);
		}

		else throw new Error("Expected array or object, got " + (typeof pathOrObject) + ".");
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

	deepProxify(_value, _oldValue, _path, value, oldValue, path, misc, obsOldValue) {

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
				let __path;
				if (_isOldObj && isOldValObj) __path = this.path(oldVal);
				else {
					__path = _path.slice();
					__path.push(key);
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
						root[key] = this.deepProxify(newVal, oldVal, __path, value, oldValue, path, misc, obsOldVal);
						if (!isOldValObj) misc.changes ++;
						executeDeletes();
					}

					// newVal is undefined - this subtree is to be deleted
					else if (typeof newVal == "undefined") {

						// if oldVal was an object, must recurse into subtrees to get unanimity!
						if (isOldValObj) {
							let remnant = this.deepProxify(undefined, oldVal, __path, value, oldValue, path, misc, obsOldVal);

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
							let remnant = this.deepProxify(undefined, oldVal, __path, value, oldValue, path, misc, obsOldVal);

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

	handleSet(target, prop, value, proxy) {

		// Check if this is an isolated non-state disconnected reference OR if we are bypassing and setting the props direct
		if (this.passthrough || this.self.isBypassed) {
			if (typeof value === 'undefined') delete target[prop];
			else target[prop] = value;

			return true;
		}

		// Check diff
		if (target[prop] == value) return true;

		// Prep
		let self = this.self;
		let obsOldValue;

		let oldValue = target[prop];
		let oldType = typeof oldValue;
		let misc = {
			observations: [],
			changes: 0
		};

		// Prep path - optionally optimize by retreiving from context if oldValue is an object.
		let path;
		if (oldType == "object") path = self.path(oldValue);
		else {
			path = this.path.slice();
			path.push(prop);
		}

		// Fire interceptors
		try { /*value = self.interceptorNotifier(path, this.path, this.paths, value, oldValue, path, value);*/ }
		catch (e) {
			console.error("Discard update (" + path + ") - encountered error!", e);
			return false;
		}

		// Check diff again
		if (value == oldValue) return true;

		// Set the new value!
		try {

			// Prep old JSON string - if we are doing o -> o
			let oldJSON;
			if (oldType == "object") oldJSON = JSON.stringify(oldValue);

			// Note obsOldValue
			if (oldType == "object") obsOldValue = JSON.parse(oldJSON);
			else obsOldValue = oldValue;

			// Deep proxify
			let result = self.deepProxify(value, oldValue, path, value, oldValue, path, misc, obsOldValue);

			// Has anything been updated?
			if (result == oldValue) {

				// In case of o -> o, we check hasChanged, if no changes are found we exit.
				if (typeof result == "object") {
					if (misc.changes == 0) return true;
				}

				// for everything else, it means nothing changed!
				else return true;

			}
			else if (typeof result == "undefined") delete target[prop];
			else target[prop] = result;

		}
		catch(e) {
			console.error("Discard update (" + path + ") - encountered error!", e);
			return false;
		}

		// Add top-level observation
		//misc.observations.push({ path: path, pathc: this.path, paths: this.paths, oldVal: obsOldValue, propOnly: false });

		// Fire observers
		//misc.observations.forEach(obs => self.observerNotifier(obs.path, obs.pathc, obs.paths, obs.oldVal, path, obsOldValue, obs.propOnly));

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
	observe(pathOrObject, fn, children = false, deep = false, init = false, origin) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw new Error("Expected string or object, got " + (typeof pathOrObject) + ".");

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

		if (this.isConcealed) return;

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
					pathc: pathc || obs.pathc,
					paths: paths || obs.paths,
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
				let actual = () => observer.fn(
					path.substr(observer.origin.fragmentPath.length),
					oldVal,
					observer.origin,
					path_,
					oldVal_
				);

				if (this.observeAsync) Promise.resolve(true).then(() => actual());
				else actual();

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

			if (pathOrObject.length == 0) throw new Error("Path is an empty string");
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

		else throw new Error("Expected string or object, got " + (typeof pathOrObject) + ".");

		// Invoke all observers for the path
		this.observerNotifier(path, pathc, paths, undefined, path, undefined, false, true);

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
	intercept(pathOrObject, fn, children = false, deep = false, origin) {

		// Prep path
		let path;
		if (typeof pathOrObject == "object") path = this.path(pathOrObject);
		else if (typeof pathOrObject == "string") path = pathOrObject;
		else throw new Error("Expected string or object, got " + (typeof pathOrObject) + ".");

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

export {
	designator,
	Catalyst
};

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
