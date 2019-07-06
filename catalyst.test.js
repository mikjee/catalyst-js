// Import
import {Catalyst, designator as root} from "./catalyst";

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

	test('parent(path)', () => {
		store.a = { b: { c: true }};
		expect(catalyst.parent(root.a.b)).toMatchObject(store.a);
	});

	test('parent(o)', () => {
		store.a = { b: { c: true }};
		expect(catalyst.parent(store.a.b)).toMatchObject(store.a);
	});

});

// --------------------------------------------
// OBSERVERS
// --------------------------------------------
/*
describe("Observer", () => {

	test("observe() + stopObserve()", done => {
		let obs = jest.fn();
		let id = catalyst.observe(root.a, obs, false, false);

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

			expect(obs).toHaveBeenNthCalledWith(1, ['a']);
			expect(obs).toHaveBeenNthCalledWith(2, ['a']);
			expect(obs).toHaveBeenNthCalledWith(3, ['a']);
			expect(obs).toHaveBeenNthCalledWith(4, ['a']);
			expect(obs).toHaveBeenNthCalledWith(5, ['a']);
			expect(obs).toHaveBeenNthCalledWith(6, ['a']);
			expect(obs).toHaveBeenNthCalledWith(7, ['a']);

			done();
		});

	});

	test("observe(child)", done => {
		let obs = jest.fn();
		catalyst.observe(root.a, obs, true, false);

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

			expect(obs).toHaveBeenNthCalledWith(1, ['a']);
			expect(obs).toHaveBeenNthCalledWith(2, ['a']);
			expect(obs).toHaveBeenNthCalledWith(3, ['a']);
			expect(obs).toHaveBeenNthCalledWith(4, ['a', 'b']);
			expect(obs).toHaveBeenNthCalledWith(5, ['a']);
			expect(obs).toHaveBeenNthCalledWith(6, ['a']);
			expect(obs).toHaveBeenNthCalledWith(7, ['a']);
			expect(obs).toHaveBeenNthCalledWith(8, ['a']);

			done();
		});

	});

	test("observe(deep)", done => {
		let obs = jest.fn();
		store.x = {y: {z: {}}};
		catalyst.observe(root.x.y.z.a, obs, true, true);

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

			expect(obs).toHaveBeenNthCalledWith(1, ['x','y','z','a']);
			expect(obs).toHaveBeenNthCalledWith(2, ['x','y','z','a']);
			expect(obs).toHaveBeenNthCalledWith(3, ['x','y','z','a']);
			expect(obs).toHaveBeenNthCalledWith(4, ['x','y','z','a','b','c']);
			expect(obs).toHaveBeenNthCalledWith(5, ['x','y','z','a','b']);
			expect(obs).toHaveBeenNthCalledWith(6, ['x','y','z','a']);
			expect(obs).toHaveBeenNthCalledWith(7, ['x','y','z','a']);
			expect(obs).toHaveBeenNthCalledWith(8, ['x','y','z','a']);
			expect(obs).toHaveBeenNthCalledWith(9, ['x','y','z','a']);

			done();
		}, 100);

	});

	test("multiple observe()", done => {

		let obs1 = jest.fn(), obs2 = jest.fn();
		catalyst.observe(root.a, obs1, true, true);
		catalyst.observe(root.a.b, obs2, false, false);

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

	// TODO: Add tests for adding path to observers, batching callbacks based on id, batching callback based on path, async nature of observers

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


});
*/