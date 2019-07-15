export default class Fragment {

	// TODO: add ability to create a fragment from another fragment as well - WARNING! Chaining path translations can slow things down!!
	constructor(catalyst, pathsMap, dissolvePath, onDissolve) {

		// Prep
		this.catalyst = catalyst;					// PRIVATE:
		this.isDissolved = false;					// PUBLIC:
		this.dissolvePath = (typeof dissolvePath == "function") ? dissolvePath() : dissolvePath; // PRIVATE:
		this.onDissolve = onDissolve || (() => false);	// PRIVATE:

		this.store = {};							// PUBLIC:
		this.pathsMap = {};							// PUBLIC:
		
		this.observers = {};						// PRIVATE:
		this.interceptors = {};						// PRIVATE:

		this.qualifiedPaths = [];					// PRIVATE:
		this.qPathIndexToPropsMap = [];				// PRIVATE:
		this.qualifiedTree = {};					// PRIVATE:

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

			// Try to add to tree - used for relative path conversion!
			let current = this.qualifiedTree;
			if (path.some((pathProp, i) => {
				if (i == path.length - 1) return false;
				else if (!current[pathProp]) {
					current[pathProp] = {};
					current = current[pathProp];
				}
				else {
					current = current[pathProp];
					if (typeof current !== 'object') return true;
					// TODO: if any qualified paths are there further deep into the tree already qualified, they must be deleted as well - finish this!
				}
			})) throw new Error("Can't map parent and child paths in the same fragment!");
			current[path[path.length - 1]] = prop;

			// Add to list
			this.pathsMap[prop] = path;

			// Add value to store
			this.store[prop] = this.catalyst.parse(path);

			// Add to internal map
			this.qualifiedPaths.push(path);
			this.qPathIndexToPropsMap.push(prop);

			// Default the dissolvePath to the first mapped path encountered, if it wasnt given!
			if (!this.dissolvePath) this.dissolvePath = path;

		}

		// Watch the paths to update changed values and refs
		this.refWatcherId = this.catalyst.observe(this.qualifiedPaths, this.refWatcher.bind(this));

		// Install dissolve path watcher
		this.dissolveWatcherId = this.catalyst.observe(this.dissolvePath, this.dissolveWatcher.bind(this));

		// Proxify the store instance to make sure the top level props cant be changed!
		this.proxifiedStore = new Proxy(this.store, { set: () => console.error("Cannot change value of top level prop of a fragment!") });

		// All done!
		let internals = this;
		this.fragment = {

			internals,

			get store() { return internals.proxifiedStore; },
			get isDissolved() { return internals.isDissolved; },

			addPath: pathsMap => console.error("Not implemented!"),			// TODO: implement this!
			removePath: prop => console.error("Not implemented!"),			// TODO: implement this!

			path: obj => this.relativePath(this.catalyst.path(obj)),		// TODO: Implement relativePath method 
			parent: this.catalyst.parent,
			parse: path => this.catalyst.parse(this.absolutePath(path)),

			observe: this.observe.bind(this),
			stopObserve: this.stopObserve.bind(this),
			
			intercept: this.intercept.bind(this),
			stopIntercept: this.stopIntercept.bind(this),

			dissolve: this.dissolve.bind(this)

		};
		return this.fragment;

	}

	// TODO: FLAW - cant observe or intercept anything outside of a fragment through the fragment - due to path translation!
	observe(pathObjDs, fnId, shallow = false, deep = false, transformPaths = false) {

		// Qualify path(s)
		let paths = [];
		if (typeof pathObjDs == "function") paths.push(pathObjDs());
		else if (Array.isArray(pathObjDs)) {

			if (pathObjDs.length == 0) paths = this.qualifiedPaths;	// Obs all mapped paths!
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
					if (path.length === 0) throw new Error("Cannot observe root of a fragment along with it's children with the same observer!");
					else if (!this.pathsMap[path[0]]) throw new Error("Fragment observation requires fragment root or valid fragment path(s)!");
					else return true;
				}
				else return true;
			})
			.map(path => {
				if (Array.isArray(path)) return this.absolutePath(path);
				else return path;
			});

		// Check qualified paths
		if (qPaths.length === 0) throw new Error("Observe requires at least 1 valid fragment path!");

		// Add adapter function to translate the paths to relative!
		let transformedFnId = ((typeof fnId == "function") && transformPaths) ? 
			(fullPaths, ...args) => fnId(fullPaths.map(p => this.relativePath(p)), ...args) :
			fnId;

		// Install the observer
		let id = this.catalyst.observe(qPaths, transformedFnId, shallow, deep);

		// Add ONLY! Don't update true or false!
		if (typeof fnId == "function") this.observers[id] = true;

		// All done
		return id;

	}

	stopObserve(id) {
		delete this.observers[id];
		return this.catalyst.stopObserve(id);
	}

	intercept(pathObjDs, fn, shallow = false, deep = false) {

		// Prep path
		let path;
		if (typeof pathObjDs == "function") {
			path = pathObjDs();
			if (path.length == 0) throw new Error("Cannot intercept root of a fragment!");
		}
		else if (Array.isArray(pathObjDs)) {
			if (pathObjDs.length == 0) throw new Error("Cannot intercept root of a fragment!");
			else path = pathObjDs;
		}
		else if (typeof pathObjDs == "object") path = pathObjDs;
		else if (typeof pathObjDs == "string") {
			if (pathObjDs.length == 0) throw new Error("Cannot intercept root of a fragment!");
			else path = [pathObjDs];
		}
		else throw new Error("Expected designator(s), got " + (typeof pathObjDs) + ".");

		// Convert to absolute path
		path = this.absolutePath(path);
		if (!path) throw new Error("Fragment interception requires a valid fragment path!");

		// Add adapter function to translate the paths to relative!
		let transformedFn = (fullPath, ...args) => fn(this.relativePath(fullPath), ...args);

		// Install the interceptor
		let id = this.catalyst.intercept(path, transformedFn, shallow, deep);

		// Add to list
		this.interceptors[id] = true;

		// All done
		return id;

	}

	stopIntercept(id) {
		delete this.interceptors[id];
		return this.catalyst.stopIntercept(id);
	}

	dissolve() {

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
		this.fragment = { isDissolved: true };

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

	relativePath(path) {		
		let current = this.qualifiedTree,
			depth = 0;

		path.some(prop => {
			current = current[prop];
			depth ++;
			if (typeof current !== 'object') return true;
		});

		let transformedPath = path.slice();
		transformedPath.splice(0, depth, current);
		return transformedPath;
	}

	absolutePath(path) {

		// Check invalid translations
		if (path.length === 0) throw new Error("Invalid path - cannot translate root of a fragment!");

		// Obtain mappedPath
		let mappedPath = this.pathsMap[path[0]];

		// Translate
		if (!mappedPath) return false;
		else return [
			...mappedPath,
			...path.slice(1)
		];		

	}

}