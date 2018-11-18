// Import
import Catalyst from "./catalyst";

// Prep
let catalyst, store;

// Setup
beforeEach(() => {
	catalyst = new Catalyst();
	store = catalyst.store;

	catalyst.preserveReferences = true;
	catalyst.preserveFragments = true;
});

afterEach(() => {
	catalyst = undefined;
	store = undefined;
});

// TODO: add tests for array prototype mutators!
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

	test('undef->a', () => {
		let arr1 = [1,2,3];
		store.a = arr1;
		expect(store.a).toMatchObject(arr1);
		expect(store.a).toHaveLength(arr1.length);

		let arr2 = [[1,2,3], {}, "a", 4];
		store.z = arr2;
		expect(store.z).toMatchObject(arr2);
		expect(store.z).toHaveLength(arr2.length);

		let arr3 = [];
		store.x = arr3;
		expect(store.x).toMatchObject(arr3);
		expect(store.x).toHaveLength(arr3.length);
	});

	test('a->undef', () => {
		store.a = [1,2,3];
		store.a = undefined;
		expect(store.a).toBeUndefined();
	});

	test('delete a', () => {
		store.a = [[1,2], 2,3,{a: []}];
		delete store.a;
		expect(store.a).toBeUndefined();
	});

	test('v->a', () => {
		let arr1 = [1,2,3];
		store.a = 1;
		store.a = arr1;
		expect(store.a).toMatchObject(arr1);
		expect(store.a).toHaveLength(arr1.length);

		let arr2 = [[1,[]], 2,3,{a: []}];
		store.z = 2;
		store.z = arr2;
		expect(store.z).toMatchObject(arr2);
		expect(store.z).toHaveLength(arr2.length);
	});

	test('a->v', () => {
		store.a = [1,2,3];
		store.a = 2;
		expect(store.a).toBe(2);

		store.z = [[1,[]], 2,3,{a: []}];
		store.z = 4;
		expect(store.z).toBe(4);
	});

	test('a->a', () => {
		let arr1 = [1,2,3], arr2 = [4,5], arr3 = [5, ["a", "b", {}, []], {}, 6], arr4 = [4];
		store.a = arr1;

		store.a = arr2;
		expect(store.a).toMatchObject(arr2);
		expect(store.a).toHaveLength(arr2.length);
		expect(store.a).not.toMatchObject(arr1);
		expect(store.a).not.toHaveProperty("b", true);

		store.a = arr3;
		expect(store.a).toMatchObject(arr3);
		expect(store.a).toHaveLength(arr3.length);
		expect(store.a).not.toMatchObject(arr2);
		expect(store.a).not.toHaveProperty("c", true);

		store.a = arr4;
		expect(store.a).toMatchObject(arr4);
		expect(store.a).toHaveLength(arr4.length);
		expect(store.a).not.toMatchObject(arr3);
		expect(store.a).not.toHaveProperty("d.e.f", true);
		expect(store.a).not.toHaveProperty("d.e.g", 12);
		expect(store.a).not.toHaveProperty("d.h", 13);
	});

	test('a->o', () => {
		let arr1 = [1,2,3], obj1 = {a: "a"};
		store.a = arr1;
		store.a = obj1;
		expect(store.a).toMatchObject(obj1);
		expect(store.a).not.toMatchObject(arr1);

		let arr2 = [5, ["a", "b", {}, []], {}, 6], obj2 = {a: [1,2,3], b: { c: { d: []}}, c: [], 1: false};
		store.z = arr2;
		store.z = obj2;
		expect(store.z).toMatchObject(obj2);
		expect(store.z).not.toMatchObject(arr2);
	});

	test('o->a', () => {
		let arr1 = [1,2,3], obj1 = {a: "a"};
		store.a = obj1;
		store.a = arr1;
		expect(store.a).toMatchObject(arr1);
		expect(store.a).toHaveLength(arr1.length);
		expect(store.a).not.toMatchObject(obj1);

		let arr2 = [5, ["a", "b", {}, []], {}, 6], obj2 = {a: [1,2,3], b: { c: { d: []}}, c: [], 1: false};
		store.z = obj2;
		store.z = arr2;
		expect(store.z).toMatchObject(arr2);
		expect(store.z).toHaveLength(arr2.length);
		expect(store.z).not.toMatchObject(obj2);
	});

	test('ref(o)->o', () => {
		let obj1 = {c: {d: {}}};
		let obj2 = {c: true};

		let obj3 = {b: obj1};
		let obj4 = {b: obj2};
		let obj5 = {b: {c: true, e: "5"}};

		store.a = obj3;
		let ref = store.a.b;

		store.a = obj4;
		expect(store.a).toMatchObject(obj4);
		expect(ref).toMatchObject(obj2);

		ref.e = "5";
		expect(store.a).toMatchObject(obj5);
	});

	test('ref(a)->a', () => {
		let arr1 = [1,2,3];
		let arr2 = [4,5];

		let obj3 = {b: arr1};
		let obj4 = {b: arr2};
		let obj5 = {b: [4,5,6]};

		store.a = obj3;
		let ref = store.a.b;

		store.a = obj4;
		expect(store.a).toMatchObject(obj4);
		expect(ref).toMatchObject(arr2);
		expect(ref).toHaveLength(2);

		ref.push(6);
		expect(store.a).toMatchObject(obj5);
		expect(ref).toHaveLength(3);
	});

	test('parse()', () => {
		store.a = {b:{c:{d:{e:true}}}};

		expect(catalyst.parse("a.b.c.d.e")).toBe(true);
		expect(catalyst.parse("a.b.c.d")).toMatchObject(store.a.b.c.d);
		expect(catalyst.parse("a.b.c")).toMatchObject(store.a.b.c);
		expect(catalyst.parse("a.b")).toMatchObject(store.a.b);
		expect(catalyst.parse("a")).toMatchObject(store.a);
	});

	test('parent(path)', () => {
		store.a = { b: { c: true }};
		expect(catalyst.parent(".a.b")).toMatchObject(store.a);
	});

	test('parent(o)', () => {
		store.a = { b: { c: true }};
		expect(catalyst.parent(store.a.b)).toMatchObject(store.a);
	});

	test('o->o (preserveRef=false)', () => {
		catalyst.preserveReferences = false;

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

	test('a->a (preserveRef=false)', () => {
		catalyst.preserveReferences = false;

		let arr1 = [1,2,3], arr2 = [4,5], arr3 = [5, ["a", "b", {}, []], {}, 6], arr4 = [4];
		store.a = arr1;

		store.a = arr2;
		expect(store.a).toMatchObject(arr2);
		expect(store.a).toHaveLength(arr2.length);
		expect(store.a).not.toMatchObject(arr1);
		expect(store.a).not.toHaveProperty("b", true);

		store.a = arr3;
		expect(store.a).toMatchObject(arr3);
		expect(store.a).toHaveLength(arr3.length);
		expect(store.a).not.toMatchObject(arr2);
		expect(store.a).not.toHaveProperty("c", true);

		store.a = arr4;
		expect(store.a).toMatchObject(arr4);
		expect(store.a).toHaveLength(arr4.length);
		expect(store.a).not.toMatchObject(arr3);
		expect(store.a).not.toHaveProperty("d.e.f", true);
		expect(store.a).not.toHaveProperty("d.e.g", 12);
		expect(store.a).not.toHaveProperty("d.h", 13);
	});

	test('a->o (preserveRef=false)', () => {
		catalyst.preserveReferences = false;

		let arr1 = [1,2,3], obj1 = {a: "a"};
		store.a = arr1;
		store.a = obj1;
		expect(store.a).toMatchObject(obj1);
		expect(store.a).not.toMatchObject(arr1);

		let arr2 = [5, ["a", "b", {}, []], {}, 6], obj2 = {a: [1,2,3], b: { c: { d: []}}, c: [], 1: false};
		store.z = arr2;
		store.z = obj2;
		expect(store.z).toMatchObject(obj2);
		expect(store.z).not.toMatchObject(arr2);
	});

	test('o->a (preserveRef=false)', () => {
		catalyst.preserveReferences = false;

		let arr1 = [1,2,3], obj1 = {a: "a"};
		store.a = obj1;
		store.a = arr1;
		expect(store.a).toMatchObject(arr1);
		expect(store.a).toHaveLength(arr1.length);
		expect(store.a).not.toMatchObject(obj1);

		let arr2 = [5, ["a", "b", {}, []], {}, 6], obj2 = {a: [1,2,3], b: { c: { d: []}}, c: [], 1: false};
		store.z = obj2;
		store.z = arr2;
		expect(store.z).toMatchObject(arr2);
		expect(store.z).toHaveLength(arr2.length);
		expect(store.z).not.toMatchObject(obj2);
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

	test('ref(o) + undo() + redo()', () => {
		store.a = { b: true };
		store.a = { b: false };
		let ref = store.a

		catalyst.undo();
		expect(ref).toBe(store.a);

		catalyst.redo();
		expect(ref).toBe(store.a);
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
// FRAGMENTATION
// --------------------------------------------

describe("Fragmentation", () => {

	test('fragment(o)', () => {
		let obj = {c:{d:true}};
		store.a = {b: obj};

		let fragment = catalyst.fragment.a.b();
		expect(fragment.store).toMatchObject(obj);
		expect(fragment.fragmentPath).toBe(".a.b");
		expect(fragment.isFragment()).toBe(1);
		expect(catalyst.isFragment.a.b()).toBe(1);
	});

	test('fragment(a)', () => {
		let arr = [1,2,3];
		store.a = {b: arr};

		let fragment = catalyst.fragment.a.b();
		expect(fragment.store).toMatchObject(arr);
		expect(fragment.fragmentPath).toBe(".a.b");
		expect(fragment.isFragment()).toBe(1);
		expect(catalyst.isFragment.a.b()).toBe(1);
	});

	test('multiple fragment()', () => {
		let obj = {c:{d:true}};
		store.a = {b: obj};

		let fragment1 = catalyst.fragment.a.b();
		let fragment2 = catalyst.fragment.a.b();

		expect(fragment1.isFragment()).toBe(2);
		expect(fragment2.isFragment()).toBe(2);
		expect(catalyst.isFragment.a.b()).toBe(2);
	});

	test('nested fragment()', () => {
		let obj = {c:{d:true}};
		store.a = {b: obj};

		let fragment1 = catalyst.fragment.a.b();
		let fragment2 = fragment1.fragment.c();

		expect(fragment1.isFragment()).toBe(1);
		expect(catalyst.isFragment.a.b()).toBe(1);

		expect(fragment2.store).toMatchObject({d:true});
		expect(fragment2.fragmentPath).toBe(".a.b.c");
		expect(fragment2.isFragment()).toBe(1);
		expect(catalyst.isFragment.a.b.c()).toBe(1);
	});

	test ('fragment() + dissolve()', () => {
		store.a = {b:true};
		let onDissolve = jest.fn();
		let fragment = catalyst.fragment.a(onDissolve);

		fragment.dissolve();
		expect(onDissolve).toHaveBeenCalled();
	});

	test('fragment() + augment()', () => {
		let obj = {b:{c:{d:true}}};
		let onDissolve = jest.fn();
		let fragment1, fragment2;

		store.a = obj;
		fragment1 = catalyst.fragment.a.b(onDissolve);
		fragment2 = catalyst.fragment.a.b(onDissolve);
		fragment1.augment();

		expect(onDissolve).toHaveBeenCalledTimes(2);
		expect(fragment1.store).toBeUndefined();
		expect(fragment2.store).toBeUndefined();

		store.a = obj;
		fragment1 = catalyst.fragment.a.b(onDissolve);
		fragment2 = catalyst.fragment.a.b(onDissolve);
		catalyst.augment.a.b();

		expect(onDissolve).toHaveBeenCalledTimes(4);
		expect(fragment1.store).toBeUndefined();
		expect(fragment2.store).toBeUndefined();

		let onDissolve2 = jest.fn();
		store.a = obj;
		fragment1 = catalyst.fragment.a.b(onDissolve2);
		fragment2 = catalyst.fragment.a.b(onDissolve2);
		let fragment3 = catalyst.fragment.a(onDissolve);
		fragment3.augment.b();

		expect(onDissolve).toHaveBeenCalledTimes(4);
		expect(onDissolve2).toHaveBeenCalledTimes(2);
		expect(fragment1.store).toBeUndefined();
		expect(fragment2.store).toBeUndefined();
		expect(fragment3.store).toMatchObject(obj);
		expect(fragment3.isFragment()).toBe(1);
		expect(catalyst.isFragment.a.b()).toBeFalsy();
	});

	test("delete fragment (preserveRef=false)", () => {
		catalyst.preserveReferences = false;
		let obj = {b: {k:"k"}, c: {}};
		store.a = obj;
		let fragment = catalyst.fragment.a.b();

		store.a.b = undefined;
		expect(fragment.store).toMatchObject({k:"k"});
		expect(store.a).toMatchObject(obj);

		delete store.a.b;
		expect(fragment.store).toMatchObject({k:"k"});
		expect(store.a).toMatchObject(obj);

		store.a.b = true;
		expect(fragment.store).toMatchObject({k:"k"});
		expect(store.a).toMatchObject(obj);
	});

	test("delete parent (preserveRef=false)", () => {
		catalyst.preserveReferences = false;
		store.a = {b: {k:"k"}, c: {}};
		let fragment = catalyst.fragment.a.b();

		store.a = undefined;
		expect(fragment.store).toMatchObject({k:"k"});
		expect(store.a).toMatchObject({b: {k:"k"}});

		delete store.a;
		expect(fragment.store).toMatchObject({k:"k"});
		expect(store.a).toMatchObject({b: {k:"k"}});

		store.a = true;
		expect(fragment.store).toMatchObject({k:"k"});
		expect(store.a).toMatchObject({b: {k:"k"}});
	});

	test("delete fragment (preserveRef=false, preserveFrag=false)", () => {
		catalyst.preserveReferences = false;
		catalyst.preserveFragments = false;

		let obj = {b: {k:"k"}, c: {}};
		let onDissolve = jest.fn();
		let fragment;

		store.a = obj;
		fragment = catalyst.fragment.a.b(onDissolve);
		store.a.b = undefined;
		expect(fragment.store).toBeUndefined();
		expect(onDissolve).toHaveBeenCalledTimes(1);
		expect(store.a).toMatchObject({});

		store.a = obj;
		fragment = catalyst.fragment.a.b(onDissolve);
		delete store.a.b;
		expect(fragment.store).toBeUndefined();
		expect(onDissolve).toHaveBeenCalledTimes(2);
		expect(store.a).toMatchObject({});

		store.a = obj;
		fragment = catalyst.fragment.a.b(onDissolve);
		store.a.b = true;
		expect(fragment.store).toBeUndefined();
		expect(onDissolve).toHaveBeenCalledTimes(3);
		expect(store.a).toMatchObject({b:true});
	});

	test("delete parent (preserveRef=false, preserveFrag=false)", () => {
		catalyst.preserveReferences = false;
		catalyst.preserveFragments = false;

		let obj = {b: {k:"k"}, c: {}};
		let onDissolve = jest.fn();
		let fragment;

		store.a = obj;
		fragment = catalyst.fragment.a.b(onDissolve);
		store.a = undefined;
		expect(fragment.store).toBeUndefined();
		expect(onDissolve).toHaveBeenCalledTimes(1);
		expect(store.a).toBeUndefined();

		store.a = obj;
		fragment = catalyst.fragment.a.b(onDissolve);
		delete store.a;
		expect(fragment.store).toBeUndefined();
		expect(onDissolve).toHaveBeenCalledTimes(2);
		expect(store.a).toBeUndefined();

		store.a = obj;
		fragment = catalyst.fragment.a.b(onDissolve);
		store.a = true;
		expect(fragment.store).toBeUndefined();
		expect(onDissolve).toHaveBeenCalledTimes(3);
		expect(store.a).toBe(true);
	});

	test('fragment(o)->o (preserveRef=false)', () => {
		catalyst.preserveReferences = false;
		store.a = {b: {k:"k"}, c: {}};
		let fragment = catalyst.fragment.a.b();

		store.a = {b: {n:"n"}};
		expect(fragment.store).toMatchObject({n:"n"});
		expect(store.a).toMatchObject({b: {n:"n"}});
	});

	test('fragment(a)->a (preserveRef=false)', () => {
		catalyst.preserveReferences = false;
		store.a = [[1,2,3], [4,5,6]];
		let fragment = catalyst.fragment.a[0]();

		store.a = [[7,8,9]];
		expect(fragment.store).toMatchObject([7,8,9]);
		expect(store.a).toMatchObject([[7,8,9]]);
	});

	test('dissolve() + o -> undef (preserveRef=false)', () => {
		catalyst.preserveReferences = false;
		store.a = {b: {k:"k"}, c: {}};

		let fragment = catalyst.fragment.a.b();
		fragment.dissolve();

		delete store.a;
		expect(fragment.store).toBeUndefined();
		expect(store.a).toBeUndefined();
	});

	test('multiple dissolve() + o -> undef (preserveRef=false)', () => {
		catalyst.preserveReferences = false;
		store.a = {b: {k:"k"}, c: {}};

		let fragment1 = catalyst.fragment.a.b();
		let fragment2 = catalyst.fragment.a.b();

		fragment1.dissolve();
		delete store.a;
		expect(fragment1.store).toBeUndefined();
		expect(store.a).toMatchObject({b: {k:"k"}});

		fragment2.dissolve();
		delete store.a;
		expect(fragment2.store).toBeUndefined();
		expect(store.a).toBeUndefined();
	});

	test('fragment() + undo() + redo()', () => {
		let obj1 = {c: true};
		let obj2 = {d: true};
		let obj3 = {b: obj1};
		let obj4 = {b: obj2};
		let obj5 = {b: true};
		let onDissolve = jest.fn();
		let fragment;

		store.a = true;
		store.a = obj3;
		store.a = obj4;
		store.a = obj5;
		catalyst.undo();

		fragment = catalyst.fragment.a.b(onDissolve);
		expect(fragment).toBeTruthy();

		catalyst.undo();
		expect(onDissolve).not.toHaveBeenCalled();
		expect(fragment.store).toMatchObject({c: true});
		expect(fragment.isFragment()).toBe(1);

		catalyst.undo();
		expect(onDissolve).toHaveBeenCalledTimes(1);
		expect(catalyst.isFragment.a.b()).toBe(0);
		expect(fragment.store).toBeUndefined();
		expect(store.a).toBe(true);

		catalyst.redo();
		fragment = catalyst.fragment.a.b(onDissolve);
		expect(fragment.store).toMatchObject(obj1);

		catalyst.redo();
		expect(onDissolve).toHaveBeenCalledTimes(1);
		expect(catalyst.isFragment.a.b()).toBe(1);
		expect(fragment.store).toMatchObject(obj2);

		catalyst.redo();
		expect(onDissolve).toHaveBeenCalledTimes(2);
		expect(catalyst.isFragment.a.b()).toBe(0);
		expect(fragment.store).toBeUndefined();
		expect(store.a).toMatchObject(obj5);
	});

	test('fragment() + parse()', () => {
		store.a = {b:{c:{d:{e:true}}}};
		let fragment = catalyst.fragment.a.b();

		expect(fragment.parse(".c.d.e")).toBe(true);
		expect(fragment.parse(".c.d")).toMatchObject(fragment.store.c.d);
		expect(fragment.parse(".c")).toMatchObject(fragment.store.c);
	});

	test('fragment() + parent(path)', () => {
		store.a = {b: {c: {d: true }}};
		let fragment = catalyst.fragment.a.b();

		expect(fragment.parent(".c")).toMatchObject(store.a.b);
		expect(fragment.parent()).toMatchObject(store.a);
	});

	test('fragment() + parent(o)', () => {
		store.a = {b: {c: {d: true }}};
		let fragment = catalyst.fragment.a.b();

		expect(fragment.parent(fragment.store.c)).toMatchObject(store.a.b);
		expect(fragment.parent(fragment.store)).toMatchObject(store.a);
	});

	test('disconnected ref (preserveRef=true/false)', () => {
		let obj = {b: {c: {d: {e:true}}}};
		let ref;

		let refOps = len => {
			ref.b.c.d.e = [];
			ref.b.c.d = true;
			ref.b.c = {};
			delete ref.b;

			expect(catalyst.history).toHaveLength(len);
		};

		store.a = obj;
		ref = store.a;
		delete store.a;
		expect(catalyst.history).toHaveLength(2);
		refOps(2);

		store.a = obj;
		ref = store.a;
		store.a = 21;
		expect(catalyst.history).toHaveLength(4);
		refOps(4);

		catalyst.preserveReferences = false;

		store.a = obj;
		ref = store.a;
		store.a = Object.assign({}, obj);
		expect(catalyst.history).toHaveLength(6);
		refOps(6);

	});

});

// --------------------------------------------
// OBSERVERS
// --------------------------------------------

describe("Observer", () => {

	test("observe() + stopObserve()", done => {
		let obs = jest.fn();
		let id = catalyst.observe.a(obs, false, false, false);

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

			expect(obs).toHaveBeenNthCalledWith(1, ".a", undefined, catalyst,".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(2, ".a", true, catalyst,".a", true);
			expect(obs).toHaveBeenNthCalledWith(3, ".a", {}, catalyst,".a", {});
			expect(obs).toHaveBeenNthCalledWith(4, ".a", {b:12}, catalyst,".a", {b:12});
			expect(obs).toHaveBeenNthCalledWith(5, ".a", 1, catalyst,".a", 1);
			expect(obs).toHaveBeenNthCalledWith(6, ".a", undefined, catalyst,".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(7, ".a", {}, catalyst,".a", {});

			done();
		}, 100);

	});

	test("fragment() + observe() + dissolve()", done => {

		store.a = { b: 1 };
		let fragment = catalyst.fragment.a();
		let obs = jest.fn();
		let id = fragment.observe.b(obs, false, false, false);

		store.a = { b: 2 };
		fragment.store.b = 3;
		fragment.dissolve();
		store.a = { b: 4};

		setTimeout(() => {
			expect(obs).toHaveBeenCalledTimes(2);

			expect(obs).toHaveBeenNthCalledWith(1, ".b", 1, fragment,".a", {b:1});
			expect(obs).toHaveBeenNthCalledWith(2, ".b", 2, fragment,".a.b", 2);

			done();
		}, 100);

	});

	test("observe(child)", done => {
		let obs = jest.fn();
		catalyst.observe.a(obs, true, false, false);

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

			expect(obs).toHaveBeenNthCalledWith(1, ".a", undefined, catalyst, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(2, ".a", true, catalyst, ".a", true);
			expect(obs).toHaveBeenNthCalledWith(3, ".a", {}, catalyst, ".a", {});
			expect(obs).toHaveBeenNthCalledWith(4, ".a.b", {c:10}, catalyst, ".a.b", {c:10});
			expect(obs).toHaveBeenNthCalledWith(5, ".a", {b:12}, catalyst, ".a", {b:12});
			expect(obs).toHaveBeenNthCalledWith(6, ".a", 1, catalyst, ".a", 1);
			expect(obs).toHaveBeenNthCalledWith(7, ".a", undefined, catalyst, ".a", undefined);
			expect(obs).toHaveBeenNthCalledWith(8, ".a", {}, catalyst, ".a", {});

			done();
		}, 100);

	});

	test("observe(deep)", done => {
		let obs = jest.fn();
		store.x = {y: {z: {}}};
		catalyst.observe.x.y.z.a(obs, true, true, false);

		store.x.y.z.a = true;
		store.x.y.z.a = {};
		store.x.y.z.a = {b:{c:true}};
		store.x.y.z.a.b.c = 10;
		store.x.y.z.a.b = 12;
		store.x.y.z.a = 1;
		store.x.y.z.a = undefined;
		store.x.y.z.a = {};
		delete store.x.y.z.a;

		setTimeout(() => {
			expect(obs).toHaveBeenCalledTimes(9);

			expect(obs).toHaveBeenNthCalledWith(1, ".x.y.z.a", undefined, catalyst, ".x.y.z.a", undefined);
			expect(obs).toHaveBeenNthCalledWith(2, ".x.y.z.a", true, catalyst, ".x.y.z.a", true);
			expect(obs).toHaveBeenNthCalledWith(3, ".x.y.z.a", {}, catalyst, ".x.y.z.a", {});
			expect(obs).toHaveBeenNthCalledWith(4, ".x.y.z.a.b.c", true, catalyst, ".x.y.z.a.b.c", true);
			expect(obs).toHaveBeenNthCalledWith(5, ".x.y.z.a.b", {c:10}, catalyst, ".x.y.z.a.b", {c:10});
			expect(obs).toHaveBeenNthCalledWith(6, ".x.y.z.a", {b:12}, catalyst, ".x.y.z.a", {b:12});
			expect(obs).toHaveBeenNthCalledWith(7, ".x.y.z.a", 1, catalyst, ".x.y.z.a", 1);
			expect(obs).toHaveBeenNthCalledWith(8, ".x.y.z.a", undefined, catalyst, ".x.y.z.a", undefined);
			expect(obs).toHaveBeenNthCalledWith(9, ".x.y.z.a", {}, catalyst, ".x.y.z.a", {});

			done();
		}, 100);

	});

	test("multiple observe()", done => {

		let obs1 = jest.fn(), obs2 = jest.fn();
		catalyst.observe.a(obs1, true, true, false);
		catalyst.observe.a.b(obs2, false, false, false);

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

			expect(obs1).toHaveBeenNthCalledWith(1, ".a", undefined, catalyst, ".a", undefined);
			expect(obs1).toHaveBeenNthCalledWith(2, ".a", true, catalyst, ".a", true);
			expect(obs1).toHaveBeenNthCalledWith(3, ".a", {}, catalyst, ".a", {});
			expect(obs1).toHaveBeenNthCalledWith(4, ".a.b.c", true, catalyst, ".a.b.c", true);
			expect(obs1).toHaveBeenNthCalledWith(5, ".a.b", {c:10}, catalyst, ".a.b", {c:10});
			expect(obs1).toHaveBeenNthCalledWith(6, ".a", {b:12}, catalyst, ".a", {b:12});
			expect(obs1).toHaveBeenNthCalledWith(7, ".a", 1, catalyst, ".a", 1);
			expect(obs1).toHaveBeenNthCalledWith(8, ".a", undefined, catalyst, ".a", undefined);
			expect(obs1).toHaveBeenNthCalledWith(9, ".a", {}, catalyst, ".a", {});

			expect(obs2).toHaveBeenCalledTimes(3);

			expect(obs2).toHaveBeenNthCalledWith(1, ".a.b", undefined, catalyst, ".a", {});
			expect(obs2).toHaveBeenNthCalledWith(2, ".a.b", {c:10}, catalyst, ".a.b", {c:10});
			expect(obs2).toHaveBeenNthCalledWith(3, ".a.b", 12, catalyst, ".a", {b:12});

			done();
		}, 100);

	});

	// TODO: this is not working !
	test("observeAsync", () => {
		catalyst.isObserveAsync = false;

		let obs = jest.fn();
		catalyst.observe.a(obs, false, false, false);
		store.a = true;

		expect(obs).toHaveBeenCalled();
	});

	test("deferObservers() + resumeObservers()", done => {
		let obs = jest.fn();
		catalyst.observe.a(obs, false, false, false);

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
		catalyst.observe.a(obs, false, false, false);
		catalyst.observe.b(obs, false, false, false);

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
		catalyst.observe.a(obs, false, false, false);

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

	test("refresh()", done => {

		store.a = {b:{c:{d:{e:true}}}};
		let obs = jest.fn();
		catalyst.observe.a.b.c(obs, true, true, false);

		catalyst.refresh.a();
		catalyst.refresh.a.b();
		catalyst.refresh.a.b.c();
		catalyst.refresh.a.b.c.d();
		catalyst.refresh.a.b.c.d.e();

		setTimeout(() => {
			expect(obs).toHaveBeenCalledTimes(3);

			expect(obs).toHaveBeenNthCalledWith(1, ".a.b.c", undefined, catalyst, ".a.b.c", undefined);
			expect(obs).toHaveBeenNthCalledWith(2, ".a.b.c.d", undefined, catalyst, ".a.b.c.d", undefined);
			expect(obs).toHaveBeenNthCalledWith(3, ".a.b.c.d.e", undefined, catalyst, ".a.b.c.d.e", undefined);

			done();
		}, 100);

	});

	test("fragment() + refresh()", () => {

		store.a = {b:{c:{d:{e:true}}}};
		let obs1 = jest.fn();
		let obs2 = jest.fn();
		let fragment = catalyst.fragment.a.b();

		catalyst.observe.a.b(obs1, true, true, false);
		fragment.observe.c(obs2, true, true, false);

		catalyst.refresh.a();
		catalyst.refresh.a.b();
		catalyst.refresh.a.b.c();
		catalyst.refresh.a.b.c.d();
		catalyst.refresh.a.b.c.d.e();

		fragment.refresh.c();
		fragment.refresh.c.d();
		fragment.refresh.c.d.e();

		setTimeout(() => {
			expect(obs1).toHaveBeenCalledTimes(7);

			expect(obs1).toHaveBeenNthCalledWith(1, ".a.b", undefined, catalyst, ".a.b", undefined);
			expect(obs1).toHaveBeenNthCalledWith(2, ".a.b.c", undefined, catalyst, ".a.b.c", undefined);
			expect(obs1).toHaveBeenNthCalledWith(3, ".a.b.c.d", undefined, catalyst, ".a.b.c.d", undefined);
			expect(obs1).toHaveBeenNthCalledWith(4, ".a.b.c.d.e", undefined, catalyst, ".a.b.c.d.e", undefined);

			expect(obs1).toHaveBeenNthCalledWith(5, ".a.b.c", undefined, catalyst, ".a.b.c", undefined);
			expect(obs1).toHaveBeenNthCalledWith(6, ".a.b.c.d", undefined, catalyst, ".a.b.c.d", undefined);
			expect(obs1).toHaveBeenNthCalledWith(7, ".a.b.c.d.e", undefined, catalyst, ".a.b.c.d.e", undefined);

			expect(obs2).toHaveBeenCalledTimes(6);

			expect(obs1).toHaveBeenNthCalledWith(1, ".a.b.c", undefined, catalyst, ".a.b.c", undefined);
			expect(obs1).toHaveBeenNthCalledWith(2, ".a.b.c.d", undefined, catalyst, ".a.b.c.d", undefined);
			expect(obs1).toHaveBeenNthCalledWith(3, ".a.b.c.d.e", undefined, catalyst, ".a.b.c.d.e", undefined);

			expect(obs1).toHaveBeenNthCalledWith(4, ".a.b.c", undefined, catalyst, ".a.b.c", undefined);
			expect(obs1).toHaveBeenNthCalledWith(5, ".a.b.c.d", undefined, catalyst, ".a.b.c.d", undefined);
			expect(obs1).toHaveBeenNthCalledWith(6, ".a.b.c.d.e", undefined, catalyst, ".a.b.c.d.e", undefined);

			done();
		}, 100);

	});

});

// --------------------------------------------
// INTERCEPTORS
// --------------------------------------------

describe("Interceptor", () =>{

	test("intercept() + stopIntercept()", () => {
		let icept = jest.fn((path, newValue) => newValue);
		let id = catalyst.intercept.a(icept, false, false);

		store.a = true;
		expect(icept).toHaveBeenCalledWith(".a", true, catalyst, ".a", true);
		expect(store).toHaveProperty("a", true);

		catalyst.stopIntercept(id);
		store.a = "nope";
		expect(icept).toHaveBeenCalledTimes(1);
	});

	test("fragment() + intercept() + dissolve()", () => {
		store.a = { b: true };
		let onDissolve = jest.fn();
		let icept = jest.fn((path, newValue) => newValue);
		let fragment = catalyst.fragment.a(onDissolve);

		fragment.intercept.b(icept, false, false);

		store.a = { c: true };
		expect(fragment.store).toMatchObject({ c: true });

		fragment.dissolve();
		store.a = { d: true };
		expect(store.a).toMatchObject({ d: true });
		expect(icept).toHaveBeenCalledTimes(1);
		expect(icept).toHaveBeenCalledWith(".b", undefined, fragment, ".a", {c:true});
	});

	test("intercepted -> oldValue", () => {
		let icept = jest.fn((path, newValue) => store.a);
		let id = catalyst.intercept.a(icept, false, false);

		store.a = true;
		expect(icept).toHaveBeenCalledWith(".a", true, catalyst, ".a", true);
		expect(store.a).toBeUndefined();
	});

	test("multiple intercept() (requireDiff)", () => {
		store.a = 0;
		let incr = (path, newValue) => newValue + 1;
		let cancel = (path, newValue) => 0;
		let icept1 = jest.fn(incr);
		let icept2 = jest.fn(cancel);

		catalyst.intercept.a(icept1, false, false);
		catalyst.intercept.a(icept2, false, false);
		catalyst.intercept.a(icept1, false, false);

		store.a = 1;
		expect(store.a).toBe(0);
		expect(icept1).toHaveBeenCalledTimes(1);
		expect(icept1).toHaveBeenCalledWith(".a", 1, catalyst, ".a", 1);
		expect(icept2).toHaveBeenCalledTimes(1);
		expect(icept2).toHaveBeenCalledWith(".a", 2, catalyst, ".a", 1);
	});

	test("intercept(child)", () => {
		let icept = jest.fn((path, newValue) => newValue);
		let id = catalyst.intercept.a(icept, true, false);

		let obj = {b:{c:true}};
		store.a = obj;
		expect(icept).toHaveBeenCalledWith(".a", obj, catalyst, ".a", obj);
		expect(store.a).toMatchObject(obj);

		store.a.b.c = false;
		expect(icept).toHaveBeenCalledTimes(1);

		store.a.b = "ok";
		expect(icept).toHaveBeenCalledWith(".a.b", "ok", catalyst, ".a.b", "ok");
		expect(store.a).toHaveProperty("b", "ok");

		store.a = 1;
		expect(icept).toHaveBeenCalledWith(".a", 1, catalyst, ".a", 1);
		expect(store).toHaveProperty("a", 1);
	});

	test("intercept(deep)", () => {
		let icept = jest.fn((path, newValue) => newValue);
		let id = catalyst.intercept.a(icept, true, true);

		let obj = {b:{c:true}};
		store.a = obj;
		expect(icept).toHaveBeenCalledWith(".a", obj, catalyst, ".a", obj);
		expect(store.a).toMatchObject(obj);

		store.a.b.c = false;
		expect(icept).toHaveBeenCalledWith(".a.b.c", false, catalyst, ".a.b.c", false);
		expect(store.a.b.c).toBe(false);

		store.a.b = "ok";
		expect(icept).toHaveBeenCalledWith(".a.b", "ok", catalyst, ".a.b", "ok");
		expect(store.a).toHaveProperty("b", "ok");

		store.a = 1;
		expect(icept).toHaveBeenCalledWith(".a", 1, catalyst, ".a", 1);
		expect(store).toHaveProperty("a", 1);
	});

	test("multilevel intercept o <=> v", () => {
		let iceptv = jest.fn((path, newValue) => "mod");
		let icepto = jest.fn((path, newValue) => { return {b:12}; });
		let icept = jest.fn((path, newValue) => newValue);
		catalyst.intercept.a.b(icept, false, false);

		let ido = catalyst.intercept.a(icepto, true, true);
		store.a = true;
		expect(store.a).toMatchObject({b:12});
		expect(icepto).toHaveBeenCalledTimes(1);
		expect(icept).toHaveBeenCalledTimes(1);
		catalyst.stopIntercept(ido);


		let idv = catalyst.intercept.a(iceptv, true, true);
		store.a = true;
		expect(store.a).toBe("mod");
		expect(iceptv).toHaveBeenCalledTimes(1);
		expect(icept).toHaveBeenCalledTimes(2);

		store.a = 12;
		expect(store.a).toBe("mod");
		expect(iceptv).toHaveBeenCalledTimes(2);
		expect(icept).toHaveBeenCalledTimes(2);

	});

	test("intercept() + undo() + redo()", () => {
		store.a = 0;
		let icept = jest.fn((path, newValue) => newValue + 1);
		catalyst.intercept.a(icept, false, false);

		store.a = 1;
		expect(store.a).toBe(2);
		expect(icept).toHaveBeenCalledTimes(1);
		expect(icept).toHaveBeenCalledWith(".a", 1, catalyst, ".a", 1);

		catalyst.undo();
		expect(store.a).toBe(0);
		expect(icept).toHaveBeenCalledTimes(1);

		catalyst.redo();
		expect(store.a).toBe(2);
		expect(icept).toHaveBeenCalledTimes(1);
	});

	test("intercept history atomicity", () => {
		store.a = 0;
		store.b = 0;
		catalyst.intercept.a((path, newValue) => { store.b = newValue; return newValue; }, false, false);

		store.a = 1;
		expect(store.a).toBe(1);
		expect(store.b).toBe(1);

		catalyst.undo();
		expect(store.a).toBe(0);
		expect(store.b).toBe(0);

		catalyst.redo();
		expect(store.a).toBe(1);
		expect(store.b).toBe(1);
	});

});
