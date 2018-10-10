// Import
import Catalyst from "./index";

// Prep
let catalyst, store;

// Setup
beforeEach(() => { 
	catalyst = new Catalyst();
	store = catalyst.store;
});

afterEach(() => { 
	catalyst = undefined; 
	store = undefined;
});

// TODO: add tests for arrays!
// TODO: add tests for functions!

// --------------------------------------------
// BASIC
// --------------------------------------------

describe("Basic", () => {

	test('new(undef)', () => {
		expect(typeof catalyst.store).toBe("object");
	});

	test('new(o)', () => {
		let obj1 = {a:true};
		let catalyst2 = new Catalyst(obj1);
		store = catalyst2.store;
		expect(store).toMatchObject(obj1);
		
		let obj2 = {a:{b:{c:true}}};
		catalyst2 = new Catalyst(obj2);
		store = catalyst2.store;
		expect(store).toMatchObject(obj2);
		
		catalyst2 = undefined;
	});

	test('undef->v', () => {
		store.a = true;
		expect(store).toHaveProperty("a", true);
	});

	test('undef->o', () => {
		let obj1 = {b:true};
		store.a = obj1;
		expect(store.a).toMatchObject(obj1);

		let obj2 = {l:{c:{d:true}}};
		store.z = obj2;
		expect(store.z).toMatchObject(obj2);

		let obj3 = {};
		store.x = obj3;
		expect(store.x).toMatchObject(obj3);
	});

	test('v->undef', () => {
		store.a = true;
		store.a = undefined;
		expect(store.a).toBeUndefined();
	});

	test('o->undef', () => {
		store.a = {b:true};
		store.a = undefined;
		expect(store.a).toBeUndefined();
	});

	test('undef->undef', () => {
		delete store.b;
		expect(store.b).toBeUndefined();

		store.b = undefined;
		expect(store.b).toBeUndefined();
	});	

	test('delete v', () => {
		store.a = true;
		delete store.a;
		expect(store.a).toBeUndefined();
	});

	test('delete o', () => {
		store.a = {b:true};
		delete store.a;
		expect(store.a).toBeUndefined();
	});

	test('delete undef', () => {
		delete store.a;
		expect(store.a).toBeUndefined();
	});

	test('v->v', () => {
		store.a = 1;
		store.a = 2;
		expect(store.a).toBe(2);
	});

	test('v->o', () => {
		let obj1 = {b:true};
		store.a = 1;
		store.a = obj1;
		expect(store.a).toMatchObject(obj1);

		let obj2 = {c:{d:{e:true}}};
		store.z = 2;
		store.z = obj2;
		expect(store.z).toMatchObject(obj2);
	});

	test('o->v', () => {
		store.a = {b:true};
		store.a = 2;
		expect(store.a).toBe(2);

		store.z = {c:{d: {e:true}, f: "hmm"}};
		store.z = 4;
		expect(store.z).toBe(4);
	});

	test('o->o', () => {
		let obj1 = {b:true}, obj2 = {c:true}, obj3 = {d:{e:{f:true, g: 12}, h: 13}}, obj4 = {k:true};
		store.a = obj1;

		store.a = obj2;
		expect(store.a).toMatchObject(obj2);
		expect(store.a).not.toMatchObject(obj1);
		expect(store.a).not.toHaveProperty("b", true);

		store.a = obj3;
		expect(store.a).toMatchObject(obj3);
		expect(store.a).not.toMatchObject(obj2);
		expect(store.a).not.toHaveProperty("c", true);

		store.a = obj4;
		expect(store.a).toMatchObject(obj4);
		expect(store.a).not.toMatchObject(obj3);
		expect(store.a).not.toHaveProperty("d.e.f", true);
		expect(store.a).not.toHaveProperty("d.e.g", 12);
		expect(store.a).not.toHaveProperty("d.h", 13);		
	});

});

// --------------------------------------------
// HISTORY
// --------------------------------------------

describe("History", () => {

	test('basic recording', () => {
		expect(catalyst.history).toHaveLength(0);

		store.a = true;
		expect(catalyst.history).toHaveLength(1);

		store.a = 12;
		expect(catalyst.history).toHaveLength(2);

		store.b = true;
		expect(catalyst.history).toHaveLength(3);

		store.c = {};
		expect(catalyst.history).toHaveLength(4);

		store.c = {d:true};
		expect(catalyst.history).toHaveLength(5);

		delete store.c;
		expect(catalyst.history).toHaveLength(6);

		store.a = undefined;
		expect(catalyst.history).toHaveLength(7);
	});

	test('default -> stopRecord() -> record()', () => {
		catalyst.stopRecord();
		store.a = true;
		store.b = [];
		store.a = {b:true};
		expect(catalyst.history).toHaveLength(0);

		catalyst.record();
		store.a = {};
		expect(catalyst.history).toHaveLength(1);
	});

	test('undo()', () => {
		store.a = true;
		store.a = 12;
		catalyst.undo();
		expect(store.a).toBe(true);

		catalyst.undo();
		expect(store.a).toBeUndefined();
	});

	test('undo() -> redo()', () => {
		store.a = true;
		store.a = 12;
		catalyst.undo(2);
		expect(store.a).toBeUndefined();	

		catalyst.redo();
		expect(store.a).toBe(true);

		catalyst.redo();
		expect(store.a).toBe(12);

		catalyst.undo(2);
		catalyst.redo(2);
		expect(store.a).toBe(12);
	});

	test('auto commit()', ()=> {
		store.a = true;		
		catalyst.undo();
		store.a = 15;
		expect(catalyst.history).toHaveLength(1);
		expect(catalyst.historyCurrent).toBe(0);

		let redoMock = jest.fn(catalyst.redo);
		redoMock();
		expect(redoMock).toHaveReturnedWith(0);

		catalyst.undo();
		catalyst.redo();
		expect(store).toHaveProperty("a", 15);
	});

	test('manual commit()', () => {
		store.a = "hmm";
		store.a = true;
		catalyst.undo();
		catalyst.commit();
		expect(catalyst.history).toHaveLength(1);
		expect(catalyst.historyCurrent).toBe(0);

		let redoMock = jest.fn(catalyst.redo);
		redoMock();
		expect(redoMock).toHaveReturnedWith(0);

		catalyst.undo();
		catalyst.redo();
		expect(store).toHaveProperty("a", "hmm");
	});
	
	test('auto prune()', done => {
		catalyst.historyLimit = 5;

		store.a = 1;
		store.a = 2;
		store.a = 3;
		store.a = 4;
		store.a = 5;
		store.a = 6;
		store.a = 7;
		
		setTimeout(() => {
			expect(catalyst.history).toHaveLength(5);
			
			catalyst.undo(7);
			expect(store.a).toBe(2);
			expect(catalyst.historyCurrent).toBe(5);

			catalyst.redo(5);
			expect(store.a).toBe(7);
			expect(catalyst.historyCurrent).toBe(0);

			done();
		}, 100);

	});

	test('manual prune()', () => {
		store.a = 1;
		store.a = 2;
		store.a = 3;
		store.a = 4;
		store.a = 5;
		store.a = 6;
		store.a = 7;
		catalyst.prune(5);
		expect(catalyst.history).toHaveLength(5);
		
		catalyst.undo(7);
		expect(store.a).toBe(2);
		expect(catalyst.historyCurrent).toBe(5);

		catalyst.redo(5);
		expect(store.a).toBe(7);
		expect(catalyst.historyCurrent).toBe(0);
	});

	test('historyFeed', () => {
		let feed =jest.fn();
		catalyst.historyFeed = feed;
		catalyst.undo();
		expect(feed).toHaveBeenCalled();
	});

	test('historyCurrent based undo() / redo()', () => {
		store.a = true;
		store.a = 12;

		catalyst.historyCurrent = 1;
		expect(catalyst.historyCurrent).toBe(1);
		expect(store).toHaveProperty("a", true);

		catalyst.historyCurrent = 2;
		expect(catalyst.historyCurrent).toBe(2);
		expect(store).not.toHaveProperty("a");

		catalyst.historyCurrent = 0;
		expect(catalyst.historyCurrent).toBe(0);
		expect(store).toHaveProperty("a", 12);
	});

	test('batch()', () => {
		catalyst.batch();
		store.a = 1;
		store.a = 2;
		store.b = 1;
		store.b = 2;
		catalyst.stopBatch();

		store.a = 3;
		store.a = 4;
		store.c = 1;
		store.c = 2;

		catalyst.batch();
		store.a = 5;
		store.b = 3;
		store.c = 3;
		catalyst.stopBatch();

		catalyst.batch(); 
		catalyst.stopBatch(); // Empty history should not exist

		expect(catalyst.history).toHaveLength(6);

		catalyst.historyCurrent = 1;
		expect(store).toHaveProperty("a", 4);
		expect(store).toHaveProperty("b", 2);
		expect(store).toHaveProperty("c", 2);

		catalyst.historyCurrent = 2;
		expect(store).toHaveProperty("a", 4);
		expect(store).toHaveProperty("b", 2);
		expect(store).toHaveProperty("c", 1);

		catalyst.historyCurrent = 3;
		expect(store).toHaveProperty("a", 4);
		expect(store).toHaveProperty("b", 2);
		expect(store).not.toHaveProperty("c");

		catalyst.historyCurrent = 4;
		expect(store).toHaveProperty("a", 3);
		expect(store).toHaveProperty("b", 2);

		catalyst.historyCurrent = 5;
		expect(store).toHaveProperty("a", 2);
		expect(store).toHaveProperty("b", 2);
		
	});

	test('batch(aggregate)', () => {
		catalyst.batch(true);
		for(var count = 0; count < 10; count ++) store.a = count;
		catalyst.stopBatch();

		expect(catalyst.history).toHaveLength(1);
		expect(catalyst.history[0].changelog).toHaveLength(1);
	});

	test('batch(aggregate + preserveOrder)', () => {
		catalyst.batch(true, true);
		for(var count = 0; count < 10; count ++) store.a = count;
		for(var count = 0; count < 10; count ++) store.b = count;
		for(var count = 0; count < 10; count ++) store.a = count;
		for(var count = 0; count < 10; count ++) store.b = count;
		catalyst.stopBatch();
		
		expect(catalyst.history).toHaveLength(1);
		expect(catalyst.history[0].changelog).toHaveLength(4);
	});

	test('nested batch()', () => {
		catalyst.batch();
		store.a = {};
		store.a.b = {};
		store.a.b.p = true;
		store.a.b.p = {};
		catalyst.stopBatch();

		store.a.b.c = {};
		store.a.b.c.d = {};
		store.a.b.c.d.e = {};

		catalyst.batch(true, true);
		store.a.b.c.d.e.f = {};
		store.a.b.c.d.e.f.g = {};
		store.a.b.c.d.e.f.g.h = {};
		store.a.b.c.d.e.f.g.h.i = {};
		store.a.b.c.d.e.f.g.h.i.j = {};
		store.a.b.c.d.e.f.g.h.i.j.k = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l = {};

		catalyst.batch(true, false);
		store.a.b.c.d.e.f.g.h.i.j.k.l.m = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.n = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.x = true;
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.y = false;
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.x = "hmm";
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.x = 33;
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.y = "oky";
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.x = "okx";
		catalyst.stopBatch();

		catalyst.stopBatch();

		catalyst.batch(true, false);
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.z = true;
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.k = true;
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.z = false;
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.k = false;
		catalyst.stopBatch();

		store.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s = {};
		store.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t = {};

		let orig = JSON.stringify(store);
		for (var count = 0; count < 8; count ++) {
			catalyst.undo(count + 1, false);
			catalyst.redo(count + 1, false);
			let mod = JSON.stringify(store);
			expect(mod).toBe(orig);
		}
	});

	test('observeHistory()', done => {
		let hObs = jest.fn(type => types.push(type));
		let obs = catalyst.observeHistory(hObs);
		let types = [];

		store.a = true;
		catalyst.undo();
		catalyst.commit();

		catalyst.batch();
		store.a = 1;
		store.a = 2;
		catalyst.stopBatch();

		setTimeout(() => {
			expect(hObs).toHaveBeenCalledTimes(4);

			expect(types[0]).toBe("add");
			expect(types[1]).toBe("update");
			expect(types[2]).toBe("delete");
			expect(types[0]).toBe("add");

			done();
		}, 100);		
	});

});

// --------------------------------------------
// OBSERVERS
// --------------------------------------------

describe("Observer", () => {

	test("observe() + stopObserve()", done => {
		let obs = jest.fn();
		let id = catalyst.observe(".a", obs, false, false, false);

		store.a = true;
		store.a = {};
		store.a = {b:true};
		store.a.b = 12;
		store.a = 1;
		store.a = undefined;
		store.a = {};
		delete store.a;

		catalyst.stopObserve(id);

		store.a = true;

		setTimeout(() => {
			expect(obs).toHaveBeenCalledTimes(7);

			expect(obs).toHaveBeenNthCalledWith(1, ".a", undefined, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(2, ".a", true, ".a", true);
			expect(obs).toHaveBeenNthCalledWith(3, ".a", {}, ".a", {});
			expect(obs).toHaveBeenNthCalledWith(4, ".a", {b:12}, ".a", {b:12});
			expect(obs).toHaveBeenNthCalledWith(5, ".a", 1, ".a", 1);
			expect(obs).toHaveBeenNthCalledWith(6, ".a", undefined, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(7, ".a", {}, ".a", {});

			done();
		}, 100);


	});

	test("observe(child)", done => {
		let obs = jest.fn();
		catalyst.observe(".a", obs, true, false, false);

		store.a = true;
		store.a = {};
		store.a = {b:{c:true}};
		store.a.b.c = 10;
		store.a.b = 12;
		store.a = 1;
		store.a = undefined;
		store.a = {};
		delete store.a;

		setTimeout(() => {
			expect(obs).toHaveBeenCalledTimes(8);

			expect(obs).toHaveBeenNthCalledWith(1, ".a", undefined, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(2, ".a", true, ".a", true);
			expect(obs).toHaveBeenNthCalledWith(3, ".a", {}, ".a", {});
			expect(obs).toHaveBeenNthCalledWith(4, ".a.b", {c:10}, ".a.b", {c:10});
			expect(obs).toHaveBeenNthCalledWith(5, ".a", {b:12}, ".a", {b:12});
			expect(obs).toHaveBeenNthCalledWith(6, ".a", 1, ".a", 1);
			expect(obs).toHaveBeenNthCalledWith(7, ".a", undefined, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(8, ".a", {}, ".a", {});

			done();
		}, 100);

	});

	test("observe(deep)", done => {
		let obs = jest.fn();
		catalyst.observe(".a", obs, true, true, false);

		store.a = true;
		store.a = {};
		store.a = {b:{c:true}};
		store.a.b.c = 10;
		store.a.b = 12;
		store.a = 1;
		store.a = undefined;
		store.a = {};
		delete store.a;

		setTimeout(() => {
			expect(obs).toHaveBeenCalledTimes(9);

			expect(obs).toHaveBeenNthCalledWith(1, ".a", undefined, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(2, ".a", true, ".a", true);
			expect(obs).toHaveBeenNthCalledWith(3, ".a", {}, ".a", {});
			expect(obs).toHaveBeenNthCalledWith(4, ".a.b.c", true, ".a.b.c", true);
			expect(obs).toHaveBeenNthCalledWith(5, ".a.b", {c:10}, ".a.b", {c:10});
			expect(obs).toHaveBeenNthCalledWith(6, ".a", {b:12}, ".a", {b:12});
			expect(obs).toHaveBeenNthCalledWith(7, ".a", 1, ".a", 1);
			expect(obs).toHaveBeenNthCalledWith(8, ".a", undefined, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(9, ".a", {}, ".a", {});

			done();
		}, 100);

	});

	test("multiple observe()", done => {

		let obs1 = jest.fn(), obs2 = jest.fn();
		catalyst.observe(".a", obs1, true, true, false);
		catalyst.observe(".a.b", obs2, false, false, false);

		store.a = true;
		store.a = {};
		store.a = {b:{c:true}};
		store.a.b.c = 10;
		store.a.b = 12;
		store.a = 1;
		store.a = undefined;
		store.a = {};
		delete store.a;

		setTimeout(() => {
			expect(obs1).toHaveBeenCalledTimes(9);

			expect(obs1).toHaveBeenNthCalledWith(1, ".a", undefined, ".a", undefined);
			expect(obs1).toHaveBeenNthCalledWith(2, ".a", true, ".a", true);
			expect(obs1).toHaveBeenNthCalledWith(3, ".a", {}, ".a", {});
			expect(obs1).toHaveBeenNthCalledWith(4, ".a.b.c", true, ".a.b.c", true);
			expect(obs1).toHaveBeenNthCalledWith(5, ".a.b", {c:10}, ".a.b", {c:10});
			expect(obs1).toHaveBeenNthCalledWith(6, ".a", {b:12}, ".a", {b:12});
			expect(obs1).toHaveBeenNthCalledWith(7, ".a", 1, ".a", 1);
			expect(obs1).toHaveBeenNthCalledWith(8, ".a", undefined, ".a", undefined);
			expect(obs1).toHaveBeenNthCalledWith(9, ".a", {}, ".a", {});

			expect(obs2).toHaveBeenCalledTimes(3);

			expect(obs2).toHaveBeenNthCalledWith(1, ".a.b", undefined, ".a", {});
			expect(obs2).toHaveBeenNthCalledWith(2, ".a.b", {c:10}, ".a.b", {c:10});
			expect(obs2).toHaveBeenNthCalledWith(3, ".a.b", 12, ".a", {b:12});

			done();
		}, 100);

	});

	// TODO: this is not working !
	test("observeAsync", () => {
		catalyst.isObserveAsync = false;

		let obs = jest.fn();
		catalyst.observe(".a", obs, false, false, false);
		store.a = true;

		expect(obs).toHaveBeenCalled();
	});

	test("deferObservers() + resumeObservers()", done => {
		let obs = jest.fn();
		catalyst.observe(".a", obs, false, false, false);
	
		catalyst.deferObservers();
		store.a = true;
		expect(obs).not.toHaveBeenCalled();

		catalyst.resumeObservers();
		setTimeout(() => {
			expect(obs).toHaveBeenCalled();
			done();
		}, 100);
	});

	test("nested deferObservers() + resumeObservers()", done => {

		let arr = [];
		let obs = jest.fn(() => arr.push(true));
		catalyst.observe(".a", obs, false, false, false);
		catalyst.observe(".b", obs, false, false, false);
	
		catalyst.deferObservers();
		store.a = 1;
		store.b = 3;
		expect(obs).not.toHaveBeenCalled();

		catalyst.deferObservers();
		store.a = 2
		expect(obs).not.toHaveBeenCalled();

		catalyst.resumeObservers();

		setTimeout(() => {

			expect(obs).toHaveBeenCalledTimes(1);
			expect(arr).toHaveLength(1);
			catalyst.resumeObservers();

			setTimeout(() => {

				expect(obs).toHaveBeenCalledTimes(2);
				expect(arr).toHaveLength(2);

				done();
			}, 100);

		}, 100);

	});

	test("observe() + undo() + redo()", done => {

		let obs = jest.fn();
		catalyst.observe(".a", obs, false, false, false);

		store.a = 1;
		store.a = 2;
		store.a = 3;
		catalyst.undo(2);
		
		setTimeout(() => {
			expect(obs).toHaveBeenCalledTimes(4);
			
			catalyst.redo();
			setTimeout(() => {
				expect(obs).toHaveBeenCalledTimes(5);
				done();
			}, 100);
		}, 100);

	});

});

// --------------------------------------------
// INTERCEPTORS
// --------------------------------------------

describe("Interceptor", () =>{

	test("intercept() + stopIntercept()", () => {
		let icept = jest.fn((expr, newValue, oldValue) => newValue);
		let id = catalyst.intercept(".a", icept, false, false);

		store.a = true;
		expect(icept).toHaveBeenCalledWith(".a", true, undefined, ".a", true, undefined);
		expect(store).toHaveProperty("a", true);

		catalyst.stopIntercept(id);
		store.a = "nope";
		expect(icept).toHaveBeenCalledTimes(1);
	});

	test("intercepted -> oldValue", () => {
		let icept = jest.fn((expr, newValue, oldValue) => oldValue);
		let id = catalyst.intercept(".a", icept, false, false);

		store.a = true;
		expect(icept).toHaveBeenCalledWith(".a", true, undefined, ".a", true, undefined);
		expect(store.a).toBeUndefined();
	});

	test("intercept(child)", () => {
		let icept = jest.fn((expr, newValue, oldValue) => newValue);
		let id = catalyst.intercept(".a", icept, true, false);

		let obj = {b:{c:true}};
		store.a = obj;
		expect(icept).toHaveBeenCalledWith(".a", obj, undefined, ".a", obj, undefined);
		expect(store.a).toMatchObject(obj);

		store.a.b.c = false;
		expect(icept).toHaveBeenCalledTimes(1);

		store.a.b = "ok";
		expect(icept).toHaveBeenCalledWith(".a.b", "ok", {c:false}, ".a.b", "ok", {c:false});
		expect(store.a).toHaveProperty("b", "ok");

		store.a = 1;
		expect(icept).toHaveBeenCalledWith(".a", 1, {b:"ok"}, ".a", 1, {b:"ok"});
		expect(store).toHaveProperty("a", 1);
	});

	test("intercept(deep)", () => {
		let icept = jest.fn((expr, newValue, oldValue) => newValue);
		let id = catalyst.intercept(".a", icept, true, true);

		let obj = {b:{c:true}};
		store.a = obj;
		expect(icept).toHaveBeenCalledWith(".a", obj, undefined, ".a", obj, undefined);
		expect(store.a).toMatchObject(obj);

		store.a.b.c = false;
		expect(icept).toHaveBeenCalledWith(".a.b.c", false, true, ".a.b.c", false, true);
		expect(store.a.b.c).toBe(false);

		store.a.b = "ok";
		expect(icept).toHaveBeenCalledWith(".a.b", "ok", {c:false}, ".a.b", "ok", {c:false});
		expect(store.a).toHaveProperty("b", "ok");

		store.a = 1;
		expect(icept).toHaveBeenCalledWith(".a", 1, {b:"ok"}, ".a", 1, {b:"ok"});
		expect(store).toHaveProperty("a", 1);
	});

	test("intercept o <=> v", () => {
		let iceptv = jest.fn((expr, newValue, oldValue) => "mod");
		let icepto = jest.fn((expr, newValue, oldValue) => { return {b:12}; });
		let icept = jest.fn((expr, newValue, oldValue) => newValue);
		catalyst.intercept(".a.b", icept, false, false);

		let ido = catalyst.intercept(".a", icepto, true, true);
		store.a = true;
		expect(store.a).toMatchObject({b:12});
		expect(icepto).toHaveBeenCalledTimes(1);
		expect(icept).toHaveBeenCalledTimes(1);
		catalyst.stopIntercept(ido);

		
		let idv = catalyst.intercept(".a", iceptv, true, true);
		store.a = true;
		expect(store.a).toBe("mod");
		expect(iceptv).toHaveBeenCalledTimes(1);
		expect(icept).toHaveBeenCalledTimes(2);

		store.a = 12;
		expect(store.a).toBe("mod");
		expect(iceptv).toHaveBeenCalledTimes(2);
		expect(icept).toHaveBeenCalledTimes(2);

	});

});