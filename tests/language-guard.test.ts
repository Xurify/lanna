import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, test } from "node:test";

// Next's server sets this before any request; without it Next's request store is a stub.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

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
		units: [
			{
				id: "acc",
				kind: "grammar",
				title: "Objects",
				tagline: "What you have",
				rule: "The object takes the accusative: Piju kávu.",
				glyph: "coffee",
				grammarTerm: "Accusative case",
				cat: "Nouns",
				tags: ["accusative", "singular"],
			},
		],
		tutors: [],
		goals: [],
		chapters: [{ id: "cafe", stage: "a1", title: "At the café", tagline: "Objects", units: ["acc"] }],
	}),
);
fs.writeFileSync(
	path.join(czech, "language.json"),
	JSON.stringify({ id: "czech", tag: "cs-CZ", code: "cs", endonym: "Čeština", english: "Czech" }),
);

const { NextRequest } = await import("next/server");
const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external.js");
const config = await import("../config.ts");
const { languageOf } = await import("../src/server/request-language.ts");
const { activeCourse } = await import("../src/core/course.ts");
const { languageGone, isSameOrigin, SHOWN_LANGUAGE_HEADER, DEVICE_LANGUAGE_COOKIE } =
	await import("../src/core/language-guard.ts");
const { recordActiveTime } = await import("../src/server/lesson.ts");
const { shownLanguageFetch } = await import("../lib/shown-language.ts");
const { proxy } = await import("../proxy.ts");
const lessonRoute = await import("../app/api/lesson/route.ts");
const timeRoute = await import("../app/api/progress/time/route.ts");
const profileRoute = await import("../app/api/profile/route.ts");

const origin = "http://127.0.0.1:3010";
const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
	"/api/lesson": lessonRoute.POST,
	"/api/progress/time": timeRoute.POST,
	"/api/profile": profileRoute.POST,
};

interface From {
	page?: string;
	device?: string;
}

function headersFrom(from: From, extra: Record<string, string> = {}): Headers {
	const h = new Headers(extra);
	if (from.page) h.set(SHOWN_LANGUAGE_HEADER, from.page);
	if (from.device) h.set("cookie", `${DEVICE_LANGUAGE_COOKIE}=${from.device}`);
	return h;
}

// Next runs a route or a page inside its request store, which holds the headers and cookies.
function inRequest<T>(from: From, fn: () => T): T {
	const headers = headersFrom(from);
	const store = {
		type: "request",
		url: { pathname: "/", search: "" },
		headers,
		cookies: {
			get: (name: string) =>
				name === DEVICE_LANGUAGE_COOKIE && from.device ? { name, value: from.device } : undefined,
		},
	};
	return workUnitAsyncStorage.run(store as never, fn);
}

async function send(pathname: string, body: unknown, from: From): Promise<Response> {
	const init = {
		method: "POST",
		headers: headersFrom(from, { "content-type": "application/json" }),
		body: JSON.stringify(body),
	};
	const gate = await proxy(new NextRequest(origin + pathname, init));
	if (gate.headers.get("x-middleware-next") !== "1") return gate;
	return inRequest(from, () => ROUTES[pathname]!(new Request(origin + pathname, init)));
}

const profileDir = (id: string) => path.join(dir, "profiles", id);
const minutesIn = (id: string): number => {
	try {
		const p = JSON.parse(fs.readFileSync(path.join(profileDir(id), "progress.json"), "utf-8")) as {
			days: Record<string, { minutes?: number }>;
		};
		return Object.values(p.days).reduce((n, d) => n + (d.minutes ?? 0), 0);
	} catch {
		return 0;
	}
};
const lessonLogs = (id: string) =>
	fs.existsSync(path.join(profileDir(id), "lessons"))
		? fs.readdirSync(path.join(profileDir(id), "lessons")).filter((f) => f.endsWith(".jsonl"))
		: [];

const SLOVAK_LESSON = {
	unit: "acc-fem",
	mode: "lesson",
	reps: [{ itemId: "i1", slug: "kava", kind: "type", verdict: "exact" }],
	activeMs: 60_000,
};

after(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
	fs.rmSync(path.join(dir, "profiles"), { recursive: true, force: true });
	config.switchProfile("slovak");
});

describe("which language a request runs", () => {
	const known = (id: string) => id === "slovak" || id === "czech";
	const hints = (page: string | null, device?: string) => ({
		headers: { get: () => page },
		cookies: { get: () => (device ? { value: device } : undefined) },
	});

	test("the page's language, else the device's, else none", () => {
		assert.equal(languageOf(hints("slovak", "czech"), known), "slovak");
		assert.equal(languageOf(hints(null, "czech"), known), "czech");
		assert.equal(languageOf(hints("estonian", "czech"), known), "czech", "a language that is gone is passed over");
		assert.equal(languageOf(hints(null, "klingon"), known), undefined);
	});

	test("two devices run two languages at once, each with its own folder and course", () => {
		const phone = inRequest({ device: "slovak" }, () => ({
			profile: config.activeProfile(),
			data: config.PATHS.data,
			course: activeCourse()?.language,
		}));
		const pc = inRequest({ device: "czech" }, () => ({
			profile: config.activeProfile(),
			data: config.PATHS.data,
			course: activeCourse()?.language,
		}));
		assert.deepEqual(phone, { profile: "slovak", data: profileDir("slovak"), course: undefined });
		assert.deepEqual(pc, { profile: "czech", data: profileDir("czech"), course: "czech" });
		assert.equal(config.activeProfile(), "slovak", "outside a request, the default");
	});

	test("withProfile borrows inside a request and gives the request's language back", () => {
		const seen = inRequest({ device: "czech" }, () => [
			config.withProfile("slovak", () => config.activeProfile()),
			config.activeProfile(),
		]);
		assert.deepEqual(seen, ["slovak", "czech"]);
	});

	test("work a request started keeps its language after another device switches", async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const job = inRequest({ device: "slovak" }, async () => {
			await gate;
			await new Promise((r) => setTimeout(r, 5));
			return recordActiveTime("lesson", 60_000);
		});
		const switched = await send("/api/profile", { active: "czech" }, { device: "slovak" });
		assert.equal(switched.status, 200);
		release();
		await job;
		assert.equal(minutesIn("slovak"), 1);
		assert.equal(minutesIn("czech"), 0);
	});
});

describe("a page left open while another device switches", () => {
	test("the Slovak phone's lesson and minutes land in Slovak after the PC switched to Czech", async () => {
		const pc = await send("/api/profile", { active: "czech" }, { device: "slovak" });
		assert.equal(pc.status, 200);
		assert.match(pc.headers.get("set-cookie") ?? "", /lh-language=czech/);
		assert.equal(config.defaultProfile(), "czech", "a new device starts in Czech");

		const phone = { page: "slovak", device: "slovak" };
		assert.equal((await send("/api/lesson", SLOVAK_LESSON, phone)).status, 200);
		assert.equal((await send("/api/progress/time", { activity: "lesson", ms: 120_000 }, phone)).status, 200);
		assert.equal(lessonLogs("slovak").length, 1);
		assert.equal(minutesIn("slovak"), 3, "the lesson's minute and the two sent as the page closed");
		assert.deepEqual(lessonLogs("czech"), []);
		assert.equal(minutesIn("czech"), 0);
	});

	test("an old tab on the same device keeps writing into the language it shows", async () => {
		const oldTab = { page: "slovak", device: "czech" };
		assert.equal((await send("/api/lesson", SLOVAK_LESSON, oldTab)).status, 200);
		assert.equal(lessonLogs("slovak").length, 1);
		assert.deepEqual(lessonLogs("czech"), []);
	});

	test("a page whose language was removed saves nothing and says why", async () => {
		const res = await send(
			"/api/progress/time",
			{ activity: "lesson", ms: 60_000 },
			{ page: "estonian", device: "slovak" },
		);
		assert.equal(res.status, 409);
		assert.equal(((await res.json()) as { error: string }).error, "language_gone");
		assert.equal(minutesIn("slovak"), 0);
		assert.equal(fs.existsSync(profileDir("estonian")), false);
	});
});

describe("the device's language cookie", () => {
	const page = async (cookie?: string) =>
		proxy(new NextRequest(origin + "/review", { headers: cookie ? { cookie } : {} }));

	test("a device that never chose gets the default on its first page", async () => {
		config.switchProfile("czech");
		assert.match((await page())?.headers.get("set-cookie") ?? "", /lh-language=czech/);
	});

	test("a device that chose keeps its choice, and one naming a removed language gets the default", async () => {
		assert.equal((await page("lh-language=czech"))?.headers.get("set-cookie"), null);
		assert.match((await page("lh-language=estonian"))?.headers.get("set-cookie") ?? "", /lh-language=slovak/);
	});

	test("an API call never sets it", async () => {
		const res = await proxy(new NextRequest(origin + "/api/review"));
		assert.equal(res?.headers.get("set-cookie"), null);
	});
});

describe("which requests the removed-language check refuses", () => {
	const known = (id: string) => id === "slovak";
	test("only a write from a page whose language is gone", () => {
		assert.equal(
			languageGone({ method: "POST", pathname: "/api/lesson", shown: "czech" }, known)?.error,
			"language_gone",
		);
		assert.equal(languageGone({ method: "GET", pathname: "/api/lesson", shown: "czech" }, known), null);
		assert.equal(languageGone({ method: "POST", pathname: "/api/lesson", shown: "slovak" }, known), null);
		assert.equal(languageGone({ method: "POST", pathname: "/api/lesson", shown: null }, known), null);
		assert.equal(languageGone({ method: "POST", pathname: "/review", shown: "czech" }, known), null);
	});

	test("same origin means this app, pages included", () => {
		assert.equal(isSameOrigin("/review", origin), true);
		assert.equal(isSameOrigin(`${origin}/api/lesson`, origin), true);
		assert.equal(isSameOrigin("https://example.com/api/lesson", origin), false);
	});
});

describe("the page's fetch", () => {
	const calls: Array<{ header: string | null; other: string | null }> = [];
	let reply = () => new Response("{}", { status: 200 });
	const base = (async (_input: RequestInfo | URL, init?: RequestInit) => {
		const headers = new Headers(init?.headers);
		calls.push({ header: headers.get(SHOWN_LANGUAGE_HEADER), other: headers.get("content-type") });
		return reply();
	}) as typeof fetch;
	const refusals: string[] = [];
	const pageFetch = shownLanguageFetch(base, "slovak", origin, (r) => refusals.push(r.shown));

	beforeEach(() => {
		calls.length = 0;
		refusals.length = 0;
		reply = () => new Response("{}", { status: 200 });
	});

	test("names the page's language on every call to this app, and keeps the caller's headers", async () => {
		await pageFetch("/api/lesson", { method: "POST", headers: { "content-type": "application/json" } });
		await pageFetch("/review?_rsc=1");
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

	test("leaves other sites alone", async () => {
		await pageFetch("https://example.com/api/x");
		assert.deepEqual(
			calls.map((c) => c.header),
			[null],
		);
	});

	test("reports a refusal for a removed language, and no other 409", async () => {
		reply = () => new Response(JSON.stringify({ message: "busy" }), { status: 409 });
		await pageFetch("/api/profile", { method: "POST" });
		reply = () =>
			new Response(JSON.stringify({ error: "language_gone", shown: "slovak", message: "" }), { status: 409 });
		const res = await pageFetch("/api/lesson", { method: "POST" });
		assert.equal(((await res.json()) as { error: string }).error, "language_gone", "the caller still reads the body");
		await new Promise((r) => setTimeout(r, 0));
		assert.deepEqual(refusals, ["slovak"]);
	});
});
