import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-language-guard-"));
process.env.LH_DATA_DIR = dir;
delete process.env.LH_PROFILE;

const czech = path.join(dir, "languages", "czech");
fs.mkdirSync(czech, { recursive: true });
fs.writeFileSync(
	path.join(czech, "course.json"),
	JSON.stringify({
		language: "czech",
		code: "cs",
		tag: "cs-CZ",
		version: 1,
		draft: true,
		units: [{ id: "acc", kind: "grammar", title: "Objects", tagline: "What you have", rule: "The object takes the accusative: Piju kávu.", glyph: "coffee", grammarTerm: "Accusative case", cat: "Nouns", tags: ["accusative", "singular"] }],
		tutors: [],
		goals: [],
		chapters: [{ id: "cafe", stage: "a1", title: "At the café", tagline: "Objects", units: ["acc"] }],
	}),
);
fs.writeFileSync(path.join(czech, "language.json"), JSON.stringify({ id: "czech", tag: "cs-CZ", code: "cs", endonym: "Čeština", english: "Czech" }));

const { NextRequest } = await import("next/server");
const config = await import("../config.ts");
const { languageChanged, isOwnApiCall, SHOWN_LANGUAGE_HEADER } = await import("../src/core/language-guard.ts");
const { subscribe } = await import("../src/core/events.ts");
const { selectProfile } = await import("../src/server/language.ts");
const { shownLanguageFetch } = await import("../lib/shown-language.ts");
const { proxy } = await import("../proxy.ts");
const lessonRoute = await import("../app/api/lesson/route.ts");
const timeRoute = await import("../app/api/progress/time/route.ts");

const origin = "http://127.0.0.1:3010";
const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
	"/api/lesson": lessonRoute.POST,
	"/api/progress/time": timeRoute.POST,
};

async function send(pathname: string, body: unknown, shown?: string): Promise<Response> {
	const init = { method: "POST", headers: { "content-type": "application/json", ...(shown ? { [SHOWN_LANGUAGE_HEADER]: shown } : {}) }, body: JSON.stringify(body) };
	const gate = await proxy(new NextRequest(origin + pathname, init));
	if (gate.headers.get("x-middleware-next") !== "1") return gate;
	return ROUTES[pathname]!(new Request(origin + pathname, init));
}

const profileDir = (id: string) => path.join(dir, "profiles", id);
const minutesIn = (id: string): number => {
	try {
		const p = JSON.parse(fs.readFileSync(path.join(profileDir(id), "progress.json"), "utf-8")) as { days: Record<string, { minutes?: number }> };
		return Object.values(p.days).reduce((n, d) => n + (d.minutes ?? 0), 0);
	} catch {
		return 0;
	}
};
const lessonLogs = (id: string) => (fs.existsSync(path.join(profileDir(id), "lessons")) ? fs.readdirSync(path.join(profileDir(id), "lessons")).filter((f) => f.endsWith(".jsonl")) : []);

const SLOVAK_LESSON = { unit: "acc-fem", mode: "lesson", reps: [{ itemId: "i1", slug: "kava", kind: "type", verdict: "exact" }], activeMs: 60_000 };

after(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
	fs.rmSync(path.join(dir, "profiles"), { recursive: true, force: true });
	config.switchProfile("slovak");
});

describe("which requests a page's language guards", () => {
	const running = "czech";
	test("a write that names another language than the running one is refused", () => {
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			const refusal = languageChanged({ method, pathname: "/api/lesson", shown: "slovak" }, running);
			assert.equal(refusal?.error, "language_changed", method);
			assert.equal(refusal?.shown, "slovak");
			assert.equal(refusal?.running, "czech");
		}
	});

	test("reads, pages, the switch itself, active time and callers that name no language pass", () => {
		assert.equal(languageChanged({ method: "GET", pathname: "/api/lesson", shown: "slovak" }, running), null);
		assert.equal(languageChanged({ method: "POST", pathname: "/lesson", shown: "slovak" }, running), null);
		assert.equal(languageChanged({ method: "POST", pathname: "/api/profile", shown: "slovak" }, running), null);
		assert.equal(languageChanged({ method: "POST", pathname: "/api/progress/time", shown: "slovak" }, running), null);
		assert.equal(languageChanged({ method: "POST", pathname: "/api/lesson", shown: null }, running), null);
		assert.equal(languageChanged({ method: "POST", pathname: "/api/lesson", shown: "czech" }, running), null);
	});

	test("only this app's own API calls carry the language", () => {
		assert.equal(isOwnApiCall("/api/lesson", origin), true);
		assert.equal(isOwnApiCall(`${origin}/api/lesson?unit=acc`, origin), true);
		assert.equal(isOwnApiCall("/lesson", origin), false);
		assert.equal(isOwnApiCall("https://example.com/api/lesson", origin), false);
	});
});

describe("a page left open in one language while another device switches", () => {
	test("a lesson finished on the Slovak page after the switch to Czech is refused and lands nowhere", async () => {
		config.switchProfile("czech");
		const res = await send("/api/lesson", SLOVAK_LESSON, "slovak");
		assert.equal(res.status, 409);
		const body = (await res.json()) as { error: string; shown: string; running: string };
		assert.deepEqual([body.error, body.shown, body.running], ["language_changed", "slovak", "czech"]);
		assert.deepEqual(lessonLogs("czech"), []);
		assert.deepEqual(lessonLogs("slovak"), []);
	});

	test("the same lesson from a page that shows the running language is recorded", async () => {
		const res = await send("/api/lesson", SLOVAK_LESSON, "slovak");
		assert.equal(res.status, 200);
		assert.equal(lessonLogs("slovak").length, 1);
	});

	test("active time from the Slovak page goes to Slovak, not to the language running now", async () => {
		config.switchProfile("czech");
		const res = await send("/api/progress/time", { activity: "lesson", ms: 120_000 }, "slovak");
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { minutes: number }).minutes, 2);
		assert.equal(minutesIn("slovak"), 2);
		assert.equal(minutesIn("czech"), 0);
		assert.equal(config.activeProfile(), "czech", "borrowing the language does not switch it");
	});

	test("active time that names no language goes to the running one; a language that is gone gets none", async () => {
		config.switchProfile("czech");
		await send("/api/progress/time", { activity: "lesson", ms: 60_000 });
		assert.equal(minutesIn("czech"), 1);
		const gone = await send("/api/progress/time", { activity: "lesson", ms: 60_000 }, "estonian");
		assert.equal(((await gone.json()) as { minutes: number }).minutes, 0);
		assert.equal(minutesIn("czech"), 1);
		assert.equal(fs.existsSync(profileDir("estonian")), false);
	});

	test("a switch tells every open page", () => {
		const seen: string[] = [];
		const off = subscribe((e) => seen.push(e.type));
		selectProfile("czech");
		selectProfile("czech");
		off();
		assert.deepEqual(seen.filter((t) => t === "language-changed"), ["language-changed"], "once per actual switch");
	});
});

describe("the page's fetch", () => {
	const calls: Array<{ url: string; header: string | null; other: string | null }> = [];
	let reply = () => new Response("{}", { status: 200 });
	const base = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const headers = new Headers(init?.headers);
		calls.push({ url: String(input instanceof Request ? input.url : input), header: headers.get(SHOWN_LANGUAGE_HEADER), other: headers.get("content-type") });
		return reply();
	}) as typeof fetch;
	const refusals: string[] = [];
	const pageFetch = shownLanguageFetch(base, "slovak", origin, (r) => refusals.push(r.running));

	beforeEach(() => {
		calls.length = 0;
		refusals.length = 0;
		reply = () => new Response("{}", { status: 200 });
	});

	test("names the page's language on this app's API calls, and keeps the caller's headers", async () => {
		await pageFetch("/api/lesson", { method: "POST", headers: { "content-type": "application/json" } });
		await pageFetch(new URL(`${origin}/api/progress/time`), { method: "POST" });
		await pageFetch(new Request(`${origin}/api/review`, { method: "POST", headers: { "content-type": "text/plain" } }));
		assert.deepEqual(
			calls.map((c) => [c.header, c.other]),
			[
				["slovak", "application/json"],
				["slovak", null],
				["slovak", "text/plain"],
			],
		);
	});

	test("leaves pages and other sites alone", async () => {
		await pageFetch("/lesson");
		await pageFetch("https://example.com/api/x");
		assert.deepEqual(calls.map((c) => c.header), [null, null]);
	});

	test("reports a refusal for a changed language, and no other 409", async () => {
		reply = () => new Response(JSON.stringify({ message: "The tutor is still answering." }), { status: 409 });
		await pageFetch("/api/profile", { method: "POST" });
		reply = () => new Response(JSON.stringify({ error: "language_changed", shown: "slovak", running: "czech", message: "" }), { status: 409 });
		const res = await pageFetch("/api/lesson", { method: "POST" });
		assert.equal(((await res.json()) as { error: string }).error, "language_changed", "the caller still reads the body");
		await new Promise((r) => setTimeout(r, 0));
		assert.deepEqual(refusals, ["czech"]);
	});
});
