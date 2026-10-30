/**
 * THE LESSON OUTBOX (LangHarness, 2026-10-30): a finished lesson waits in
 * storage until the server has recorded it. Pins: the write is synchronous;
 * a sent lesson carries its id and leaves the outbox once recorded (its waiter
 * gets the answer); a server error or a dropped connection keeps it; a request
 * the server refuses is dropped, so it cannot block the rest; another
 * language's lessons are left alone; two flushes at once send each lesson once.
 */

import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
	},
});

type Reply = { status: number } | "network";
let replies: Reply[] = [];
const sent: Array<{ clientId: string; unit: string }> = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
	const body = JSON.parse(String(init?.body)) as { clientId: string; unit: string };
	sent.push({ clientId: body.clientId, unit: body.unit });
	const reply = replies.shift() ?? { status: 200 };
	if (reply === "network") throw new TypeError("fetch failed");
	if (reply.status !== 200) return new Response("no", { status: reply.status });
	return new Response(JSON.stringify({ queued: ["vták"], summary: { streak: { days: 1, activeToday: true }, todayXp: 10, dailyGoal: 50, next: "loc", bestBlitz: 0, units: [] } }), { status: 200 });
}) as typeof fetch;

const outbox = await import("../components/lesson/outbox.ts");
const waiting = () => JSON.parse(store.get("lh-outbox") ?? "[]") as Array<{ id: string; lang: string }>;

beforeEach(() => {
	store.clear();
	sent.length = 0;
	replies = [];
	outbox._resetOutboxForTests();
});
afterEach(() => outbox._resetOutboxForTests());
after(() => {
	globalThis.fetch = realFetch;
});

describe("lesson outbox", () => {
	it("keeps a finished lesson the moment it is enqueued", () => {
		const entry = outbox.enqueueLesson("sk", { unit: "loc" });
		assert.deepEqual(waiting().map((p) => p.id), [entry.id]);
		assert.equal(sent.length, 0, "nothing is sent by enqueueing");
	});

	it("sends a lesson with its id, and removes it once the server has recorded it", async () => {
		const entry = outbox.enqueueLesson("sk", { unit: "loc" });
		const recorded = new Promise((resolve) => outbox.onSettled(entry.id, resolve));
		await outbox.flushOutbox("sk");
		assert.deepEqual(sent, [{ clientId: entry.id, unit: "loc" }]);
		assert.deepEqual(waiting(), []);
		assert.deepEqual(((await recorded) as { queued: string[] }).queued, ["vták"]);
	});

	it("keeps the lesson when the server errors", async () => {
		replies = [{ status: 500 }];
		outbox.enqueueLesson("sk", { unit: "loc" });
		await outbox.flushOutbox("sk");
		assert.equal(sent.length, 1);
		assert.equal(waiting().length, 1);
	});

	it("keeps the lesson when the connection drops", async () => {
		replies = ["network"];
		outbox.enqueueLesson("sk", { unit: "loc" });
		await outbox.flushOutbox("sk");
		assert.equal(waiting().length, 1);
	});

	it("drops a lesson the server refuses for good, and sends the rest", async () => {
		replies = [{ status: 400 }, { status: 200 }];
		const bad = outbox.enqueueLesson("sk", { unit: "bad" });
		const good = outbox.enqueueLesson("sk", { unit: "good" });
		const verdict = new Promise((resolve) => outbox.onSettled(bad.id, resolve));
		await outbox.flushOutbox("sk");
		assert.deepEqual(sent.map((s) => s.unit), ["bad", "good"]);
		assert.equal(await verdict, null);
		assert.deepEqual(waiting().map((p) => p.id), []);
		assert.ok(good.id);
	});

	it("leaves another language's lessons alone", async () => {
		outbox.enqueueLesson("ru", { unit: "ru-unit" });
		outbox.enqueueLesson("sk", { unit: "sk-unit" });
		await outbox.flushOutbox("sk");
		assert.deepEqual(sent.map((s) => s.unit), ["sk-unit"]);
		assert.deepEqual(waiting().map((p) => p.lang), ["ru"]);
	});

	it("two flushes at once send each lesson once", async () => {
		outbox.enqueueLesson("sk", { unit: "loc" });
		await Promise.all([outbox.flushOutbox("sk"), outbox.flushOutbox("sk")]);
		assert.equal(sent.length, 1);
	});
});
