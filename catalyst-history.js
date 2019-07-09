
// TODO: unfinished business - complete this module!! - left for later on!
// TODO: add hooks for logs being created / updated / deleted
// TODO: add hooks for requesting backward or forward logs
// TODO: current historyindex position can be so far back that all the forward logs may not be present - same as all backward logs will not be present - add memory log limit of 100
// TODO: if past history is present, at least 1 must be loaded for the json distance logic to work properly!
class CatalystHistory {

	constructor(catalyst, path, history, historyIndex = 0) {

		// Prep
		this.catalyst = catalyst;
		this.history = history || [];
		this.path = path || [];
		this.diffTree = { children: {} };
		this.historyIndex = historyIndex;

		this.isLogEnding = false;	
		this.isRecording = true;	// TODO: Implement this!
		this.isBatching = false;	// TODO: implement this wholly!
		this.endLogTmr = false;

		// Ready our first recording
		// TODO: Dont use this function for readying the first entry, do it separately - note down distance from prev json log!
		this.endLog();

		// Install interceptor & observer on the path!
		this.interceptorId = catalyst.intercept(this.path, this.interceptor.bind(this), true, true);
		this.observerId = catalyst.observe(this.path, this.observer.bind(this), true, true);

		// All done
		// TODO: complete this !
		let internals = this;
		return {

			internals,

			undo: () => console.error("Not implemented!"),				// TODO: Implement this - can conditionally use the json available if jump is too far!
			redo: () => console.error("Not implemented!"),				// TODO: Implement this see ^

			history: {},
			current: 0

		};

	}

	interceptor(path, newValue, oldValue, next) {
		this.logChange(path, oldValue);
		return next(newValue);
	}

	observer() {
		if (!this.isBatching && !this.isLogEnding) {
			
			this.endLogTmr = setTimeout(() => {
				this.isLogEnding = false;
				if (!this.isBatching) this.endLog();
				
			});
			this.isLogEnding = true;

		}
	}

	// NOTE: This is a dumb function!
	timestamp() {

		let timestamp = Date.now();

		if (timestamp == this._timestamp) this._timestampCounter++;
		else {
			this._timestamp = timestamp;
			this._timestampCounter = 1;
		}

		return timestamp.toString() + (("00" + this._timestampCounter).slice(-3));

	}

	// NOTE: This is a dumb function!
	logChange(path, value, isRedo = false) {

		// Prep
		let current = this.diffTree;

		// Flag the given path
		let pre = path.some(prop => {

			if (!current.children[prop]) current.children[prop] = { children: {} };
			else if (current.children[prop].logged) return true;
			
			current = current.children[prop];

		});

		// Check if we had already recorded this or it's ancestor!
		if (pre) return;

		// Record in the given path
		current.logged = true;
		let oFlag = typeof value == "object";
		this.history[this.historyIndex][isRedo ? "re" : "un"].push({p: path, v: oFlag ? JSON.stringify(value) : value, o: oFlag});

	}

	// NOTE: This is a dumb function!
	// TODO: add logic to do json.strigify on the entire path every 100 logs
	// TODO: add field 'd' to denote distance from prev json!
	endLog() {

		// Add new history record
		this.history.push({ un: [], t: this.timestamp() });

		// Reset the diff tree
		this.diffTree = { children: {}};

	}


}