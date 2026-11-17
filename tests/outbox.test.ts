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
	return new Response(
		JSON.stringify({
			queued: ["vták"],
			summary: {
				streak: { days: 1, activeToday: true },
				todayXp: 10,
				dailyGoal: 50,
				next: "loc",
				bestBlitz: 0,
				units: [],
			},
		}),
		{ status: 200 },
	);
}) as typeof fetch;

const outbox = await import("../components/lesson/outbox.ts");
const waiting = () =>
	JSON.parse(store.get("lanna-outbox") ?? "[]") as Array<{ id: string; lang: string; refused?: number }>;

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
		assert.deepEqual(
			waiting().map((p) => p.id),
			[entry.id],
		);
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

	it("tells the end screen at once when a save fails, and again when a later try lands", async () => {
		replies = [{ status: 500 }, { status: 200 }];
		const entry = outbox.enqueueLesson("sk", { unit: "loc" });
		const told: Array<{ queued: string[] } | null> = [];
		outbox.onSettled(entry.id, (r) => told.push(r));
		await outbox.flushOutbox("sk");
		assert.deepEqual([...told], [null], "the screen learns the save failed instead of waiting");
		await outbox.flushOutbox("sk");
		assert.equal(told.length, 2);
		assert.deepEqual(told[1]?.queued, ["vták"]);
		assert.deepEqual(waiting(), []);
	});

	it("tells every waiting lesson when the server is down, not only the oldest", async () => {
		replies = ["network"];
		const older = outbox.enqueueLesson("sk", { unit: "loc" });
		const newer = outbox.enqueueLesson("sk", { unit: "gen" });
		const told: string[] = [];
		outbox.onSettled(older.id, (r) => r === null && told.push("older"));
		outbox.onSettled(newer.id, (r) => r === null && told.push("newer"));
		await outbox.flushOutbox("sk");
		assert.deepEqual(told.sort(), ["newer", "older"]);
		assert.equal(sent.length, 1, "one try per run while the server is down");
	});

	it("keeps the lesson when the connection drops", async () => {
		replies = ["network"];
		outbox.enqueueLesson("sk", { unit: "loc" });
		await outbox.flushOutbox("sk");
		assert.equal(waiting().length, 1);
	});

	it("keeps a lesson the server refuses, marked as refused, and sends the rest", async () => {
		replies = [{ status: 400 }, { status: 200 }];
		const bad = outbox.enqueueLesson("sk", { unit: "bad" });
		const good = outbox.enqueueLesson("sk", { unit: "good" });
		const verdict = new Promise((resolve) => outbox.onSettled(bad.id, resolve));
		await outbox.flushOutbox("sk");
		assert.deepEqual(
			sent.map((s) => s.unit),
			["bad", "good"],
			"the refused lesson is tried once per run",
		);
		assert.equal(await verdict, null);
		assert.deepEqual(
			waiting().map((p) => p.id),
			[bad.id],
			"the refused lesson is kept, the recorded one is removed",
		);
		assert.equal(waiting()[0]!.refused, 400);
		assert.ok(good.id);
	});

	it("tells the waiter about a refusal, and again once a later run records the lesson", async () => {
		replies = [{ status: 409 }, { status: 200 }];
		const entry = outbox.enqueueLesson("sk", { unit: "loc" });
		const heard: Array<string | null> = [];
		outbox.onSettled(entry.id, (recorded) => heard.push(recorded ? recorded.summary.next : null));
		await outbox.flushOutbox("sk");
		await outbox.flushOutbox("sk");
		assert.deepEqual(heard, [null, "loc"]);
		assert.equal(waiting().length, 0);
	});

	it("sends a refused lesson again on a later run", async () => {
		replies = [{ status: 400 }, { status: 200 }];
		const bad = outbox.enqueueLesson("sk", { unit: "bad" });
		await outbox.flushOutbox("sk");
		assert.equal(waiting().length, 1);
		await outbox.flushOutbox("sk");
		assert.equal(sent.length, 2);
		assert.deepEqual(
			waiting().map((p) => p.id),
			[],
		);
		assert.ok(bad.id);
	});

	it("leaves another language's lessons alone", async () => {
		outbox.enqueueLesson("ru", { unit: "ru-unit" });
		outbox.enqueueLesson("sk", { unit: "sk-unit" });
		await outbox.flushOutbox("sk");
		assert.deepEqual(
			sent.map((s) => s.unit),
			["sk-unit"],
		);
		assert.deepEqual(
			waiting().map((p) => p.lang),
			["ru"],
		);
	});

	it("two flushes at once send each lesson once", async () => {
		outbox.enqueueLesson("sk", { unit: "loc" });
		await Promise.all([outbox.flushOutbox("sk"), outbox.flushOutbox("sk")]);
		assert.equal(sent.length, 1);
	});
});
