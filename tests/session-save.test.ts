import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

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
const sent: Array<{ url: string; clientId: string }> = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
	const body = JSON.parse(String(init?.body)) as { clientId: string };
	sent.push({ url: String(url), clientId: body.clientId });
	const reply = replies.shift() ?? { status: 200 };
	if (reply === "network") throw new TypeError("fetch failed");
	if (reply.status !== 200) return new Response("no", { status: reply.status });
	return new Response(JSON.stringify({ xp: 10 }), { status: 200 });
}) as typeof fetch;

const { _resetSessionsForTests, keepSession, onSessionSaved, RefusedError, sendSession } = await import("../components/session-save.ts");
const waiting = () => JSON.parse(store.get("lh-session-outbox") ?? "[]") as Array<{ id: string; lang: string }>;

beforeEach(() => {
	_resetSessionsForTests();
	store.clear();
	sent.length = 0;
	replies = [];
});
after(() => {
	_resetSessionsForTests();
	globalThis.fetch = realFetch;
});

describe("a Listen, Read or Watch session is kept until the server has it (E77)", () => {
	it("is kept from the moment it ends, sent with its id, and dropped once recorded", async () => {
		const session = keepSession("sk", "/api/listen", { reps: [] });
		assert.deepEqual(waiting().map((s) => s.id), [session.id]);
		assert.deepEqual(await sendSession(session), { xp: 10 });
		assert.deepEqual(sent, [{ url: "/api/listen", clientId: session.id }]);
		assert.deepEqual(waiting(), []);
	});

	it("stays kept when the network or the server fails, so it can be sent again with the same id", async () => {
		const session = keepSession("sk", "/api/read", { action: "finish" });
		replies = ["network", { status: 500 }];
		await assert.rejects(sendSession(session));
		await assert.rejects(sendSession(session));
		assert.equal(waiting().length, 1);
		assert.equal(new Set(sent.map((s) => s.clientId)).size, 1, "every try carries the same id");
	});

	it("is dropped when the server refuses it, since sending it again cannot help", async () => {
		const session = keepSession("sk", "/api/watch", { action: "finish" });
		replies = [{ status: 404 }];
		await assert.rejects(sendSession(session), RefusedError);
		assert.deepEqual(waiting(), []);
	});

	it("tells the open end screen when a later send lands", async () => {
		const session = keepSession("sk", "/api/listen", { reps: [] });
		replies = ["network"];
		await assert.rejects(sendSession(session));
		const told: unknown[] = [];
		onSessionSaved(session.id, (outcome) => told.push(outcome));
		await sendSession(session);
		assert.deepEqual(told, [{ xp: 10 }]);
	});
});
