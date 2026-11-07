import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TtlMemo } from "../src/core/ttl-memo.ts";

describe("TtlMemo", () => {
	test("a fresh result is returned without loading again, an old one is loaded again", async () => {
		let t = 0;
		const memo = new TtlMemo<number>({ ttlMs: 1000, now: () => t });
		let loads = 0;
		const load = async () => ++loads;
		assert.equal(await memo.run("a", load), 1);
		t = 999;
		assert.equal(await memo.run("a", load), 1);
		t = 1000;
		assert.equal(await memo.run("a", load), 2);
	});

	test("callers that ask while a load runs share it", async () => {
		const memo = new TtlMemo<string>({ ttlMs: 1000 });
		let loads = 0;
		let release!: (v: string) => void;
		const load = () => {
			loads++;
			return new Promise<string>((r) => (release = r));
		};
		const [a, b] = [memo.run("k", load), memo.run("k", load)];
		release("done");
		assert.deepEqual(await Promise.all([a, b]), ["done", "done"]);
		assert.equal(loads, 1);
	});

	test("a failed load is not kept", async () => {
		const memo = new TtlMemo<number>({ ttlMs: 1000 });
		await assert.rejects(memo.run("k", async () => Promise.reject(new Error("down"))), /down/);
		assert.equal(await memo.run("k", async () => 7), 7);
	});

	test("falsy results are kept", async () => {
		const memo = new TtlMemo<number>({ ttlMs: 1000 });
		let loads = 0;
		await memo.run("z", async () => (loads++, 0));
		await memo.run("z", async () => (loads++, 0));
		assert.equal(loads, 1);
	});

	test("the oldest result goes when there are more than max", () => {
		const memo = new TtlMemo<number>({ ttlMs: 1000, max: 2 });
		memo.set("a", 1);
		memo.set("b", 2);
		memo.set("c", 3);
		assert.equal(memo.peek("a"), undefined);
		assert.equal(memo.peek("b"), 2);
		assert.equal(memo.peek("c"), 3);
	});

	test("forget clears by prefix and drops a load in flight from sharing", async () => {
		const memo = new TtlMemo<number>({ ttlMs: 1000 });
		memo.set("p|1", 1);
		memo.set("q|1", 2);
		memo.forget("p|");
		assert.equal(memo.peek("p|1"), undefined);
		assert.equal(memo.peek("q|1"), 2);
		let release!: (v: number) => void;
		const slow = memo.run("q|2", () => new Promise<number>((r) => (release = r)));
		memo.forget();
		const fresh = await memo.run("q|2", async () => 9);
		release(5);
		await slow;
		assert.equal(fresh, 9);
		// The older load finishing must not overwrite the newer result.
		assert.equal(memo.peek("q|2"), 9);
	});
});
