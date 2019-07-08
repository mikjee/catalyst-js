
class CatalystHistory {

	constructor(catalyst, paths = [[]], history = [[]], current = 0) {

		// Prep
		this.catalyst = catalyst;
		this.history = history;
		this.paths = paths;
		this.diffTree = { children: {}};
		this.current = current;

		// Install interceptor
		// TODO: maintain a list of interceptors relative to the paths!
		paths.forEach(ds => catalyst.intercept(ds, (path, newValue, oldValue, next) => {

			this.logChange(path, oldValue);
			return next(newValue);

		}, true, true));

		// Install observer
		catalyst.observe([], () => {
			
			// TODO: execute this on a new macrotask (settimeout?), make way for other observers to be executed first!
			// TODO: add switch to bypass this and continue recording to the same log!
			this.endLog();

		}, true, true);

		// All done
		// TODO: complete this !
		let internals = this;
		return {

			internals,

			undo: () => false,
			redo: () => false,

			history: {},
			current: 0

		};

	}

	logChange(path, value) {

		// Prep
		let current = this.diffTree;

		// Flag the given path for recording
		let pre = path.some(prop => {

			if (!current.children[prop]) current.children[prop] = { children: {} };
			else if (current.children[prop].logged) return true;
			
			current = current.children[prop];

		});

		// Check if we had already recorded this or it's ancestor!
		if (pre) return;

		// Record in the given path
		// TODO: the saved object needs to include pre-generated uniquely identifiable timestamp!
		current.logged = true;
		let oFlag = typeof value == "object";
		this.history[this.current].push({path, value: oFlag ? JSON.stringify(value) : value, oFlag});

	}

	endLog() {

		// Add new history record
		this.history.push([]);

		// Reset the diff tree
		this.diffTree = { children: {}};

	}


}