class CatalystFragment {

	// TODO: add ability to create a fragment from another fragment as well!
	constructor(catalyst, pathsMap, dissolvePath, onDissolve) {

		// Prep
		this.catalyst = catalyst;
		this.isDissolved = false;
		this.dissolvePath = (typeof dissolvePath == "function") ? dissolvePath() : dissolvePath;
		this.onDissolve = onDissolve || (() => false);

		this.store = {};
		this.pathsMap = {};
		
		this.observers = {};
		this.interceptors = {};

		this.qualifiedPaths = [];					// PRIVATE:
		this.qPathIndexToPropsMap = [];				// PRIVATE:

		// Qualify the paths and install observers / interceptors!
		for (var prop in pathsMap) {

			// Check
			if (!pathsMap.hasOwnProperty(prop)) continue;
			
			// Prep
			let path = pathsMap[prop];
			let type = typeof path;

			// Qualify designator
			if (type == "function") path = path();
			else if (type == "object") path = this.catalyst.path(path);

			// Add to list
			this.pathsMap[prop] = path;

			// Add value store
			this.store[prop] = this.catalyst.path(path);

			// Add to internal map
			this.qualifiedPaths.push[path];
			this.qPathIndexToPropsMap.push[prop];

			// Default the dissolvePath to the first mapped path encountered, if it wasnt given!
			if (!this.dissolvePath) this.dissolvePath = path;

		}

		// Watch the paths to update changed values and refs
		this.refWatcherId = this.catalyst.observe(this.qualifiedPaths, this.refWatcher.bind(this));

		// Install dissolve path watcher
		this.dissolveWatcherId = this.catalyst.observe(this.dissolvePath, this.dissolveWatcher.bind(this));

		// Proxify the store instance to make sure the top level props cant be changed!
		this.proxifiedStore = new Proxy(this.store, { set: () => false });

		// All done!
		// TODO: finish this!
		let internals = this;
		this.fragment = {

			internals,

			get store() { return internals.proxifiedStore; },

			get pathsMap() { return internals.pathsMap; },
			get dissolvePath() { return internals.dissolvePath; },
			get isDissolved() { return internals.isDissolved; },

			addPath: pathsMap => false,				// TODO: finish this!
			removePath: prop => false,				// TODO: finish this!

			path: this.catalyst.path,
			parent: () => this.catalyst.parent,
			parse: () => false,						// TODO: implement this!

			observe: this.observe.bind(this),
			stopObserve: this.stopObserve.bind(this),
			
			intercept: this.intercept.bind(this),
			stopIntercept: this.stopIntercept.bind(this),

			dissolve: this.dissolve.bind(this)

		};
		return this.fragment;

	}

	// TODO: implement root observation - which will observe all mapped paths!
	observe(pathObjDs, fnId, shallow = false, deep = false) {

		// Qualify path(s)
		let paths = [];
		if (typeof pathObjDs == "function") paths.push(pathObjDs());
		else if (Array.isArray(pathObjDs)) {

			if (pathObjDs.length == 0) paths.push([]);
			else if (typeof pathObjDs[0] == "string") paths.push([pathObjDs]);
			else pathObjDs.forEach(path => {
				let type = typeof path;

				if (type == "function") paths.push(path());
				else if (Array.isArray(path)) paths.push(path); 	// Assuming it is an array of array of strings
				else if (type == "object") paths.push(path);
				else throw new Error("Expected designator(s), got some weird array.");
			});

		}
		else if (typeof pathObjDs == "object") paths.push(pathObjDs);
		else throw new Error("Expected designator(s), got " + (typeof pathObjDs) + ".");

		// Translate paths - this also checks for valid paths and that root level cannot be observed!
		let qPaths = paths
			.filter(path => {
				if (Array.isArray(path) || typeof path === "string") {
					if (path.length === 0) throw new Error("Cannot observe root of a fragment!");
					else if (!this.pathsMap[path[0]]) return false;
					else return true;
				}
				else return true;
			})
			.map(path => {
				if (Array.isArray(path)) this.absolutePath(path);
				else return path;
			});

		// Check qualified paths
		if (qPaths.length === 0) throw new Error("Observe requires at least 1 valid fragment path!");

		// Add adapter function to translate the paths to relative!
		// TODO: implement this??

		// Install the observer
		let id = this.catalyst.observe(qPaths, fnId, shallow, deep);

		// Add ONLY! Don't update true or false!
		if (typeof fnId == "function") this.observers[id] = true;

		// All done
		return id;

	}

	stopObserve(id) {
		delete this.observers[id];
		return this.catalyst.stopObserve(id);
	}

	// TODO: not properly implemented was sleepy!!!!!
	intercept(pathObjDs, fn, shallow = false, deep = false) {

		// Prep path and determine if multiple paths have been given
		let path;
		if (typeof pathObjDs == "function") path = pathObjDs();
		else if (Array.isArray(pathObjDs)) {
			if (pathObjDs.length == 0) throw new Error("Cannot intercept root of a fragment!");
			else path = pathObjDs;
		}
		else if (typeof pathObjDs == "object") path = pathObjDs;
		else throw new Error("Expected designator(s), got " + (typeof pathObjDs) + ".");

		// Find absolute
		let qPath = this.absolutePath(path);

		// Install the observer
		let id = this.catalyst.intercept(qPath, fn, shallow, deep);

		// Add to list
		this.observers[id] = true;

		// All done
		return id;

	}

	stopIntercept(id) {
		delete this.interceptors[id];
		return this.catalyst.stopIntercept(id);
	}

	dissolve() {

		// Check!
		if (this.isDissolved) return false;

		// Call onDissolve and cancel dissolution if it returns true
		if (this.onDissolve(this.fragment) === true) return false;

		// Stop observers and interceptors installed through this fragment!
		for(var id in this.observers) 
			if (this.observers.hasOwnProperty(id)) this.stopObserve(id);

		for (var id in this.interceptors)
			if (this.interceptors.hasOwnProperty(id)) this.stopIntercept(id);	

		// Stop our observers
		this.catalyst.stopObserve(this.refWatcherId);
		this.catalyst.stopObserve(this.dissolveWatcherId);

		// Dissolve
		this.isDissolved = true;

		// Done
		return true;

	}

	dissolveWatcher() {

		// Trigger dissolution if path is falsy!
		if (!this.catalyst.parse(this.dissolvePath)) this.dissolve();

	}

	refWatcher(paths) {

		// Update the refs/values of the paths that have changed!
		paths.forEach((_, i) => {

			// Check if changed!
			// NOTE: Helps in diffing if detailedObservers flag is set to true in catalyst!
			if (!paths[i]) return;

			// Update
			let prop = this.qPathIndexToPropsMap[i];
			let path = this.qualifiedPaths[i];
			this.store[prop] = this.catalyst.parse(path);

		});

	}

	// TODO: implement this!
	relativePath(path) {

	}

	absolutePath(path) {

		// Qualify
		let type = typeof path;
		if (type === "function") path = path();
		else if (type === "string") path = [path];

		// Check invalid translations
		if (path.length === 0) throw new Error("Invalid path - cannot translate root of a fragment!");
		else if (!this.pathsMap[path[0]]) throw new Error("Invalid path - '" + this.pathsMap[path] + "' is a not a part of the fragment!");

		// Translate
		return [
			...this.pathsMap[path[0]],
			...path.slice(1)
		];		

	}

}