import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-path-ids-"));
process.env.LH_DATA_DIR = path.join(TMP, "data");
const REPO_SHEETS = path.join(TMP, "repo-sheets");
process.env.LH_REPO_CHEATSHEETS_DIR = REPO_SHEETS;
fs.mkdirSync(REPO_SHEETS, { recursive: true });

const OUTSIDE = path.join(TMP, "outside");
fs.mkdirSync(OUTSIDE, { recursive: true });
const SENTINELS = ["secret.json", "secret.txt", "secret.md", "secret.wav", "secret.jsonl"];
for (const name of SENTINELS) fs.writeFileSync(path.join(OUTSIDE, name), `sentinel ${name}`);
fs.writeFileSync(path.join(TMP, "secret.json"), "sentinel above the data folder");

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const HOSTILE = [
	"../../../outside/secret",
	"..%2F..%2F..%2Foutside%2Fsecret",
	"%2e%2e/%2e%2e/%2e%2e/outside/secret",
	"/etc/passwd",
	"C:\\Windows\\win.ini",
	"..\\..\\outside\\secret",
	"a/../../../../outside/secret",
	"secret\u0000.json",
	"..",
	".",
	"",
	"x".repeat(5000),
];

const snapshot = () => {
	const out: Record<string, string> = {};
	const inside = [process.env.LH_DATA_DIR!, REPO_SHEETS];
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (inside.includes(full)) continue;
			if (entry.isDirectory()) walk(full);
			else out[path.relative(TMP, full)] = fs.readFileSync(full, "utf8");
		}
	};
	walk(TMP);
	return out;
};
const before = snapshot();

type Handler = (request: Request, context?: unknown) => Promise<Response> | Response;
const load = async (route: string): Promise<Record<string, Handler>> => (await import(`../app/api/${route}/route.ts`)) as Record<string, Handler>;

interface Call {
	route: string;
	method: string;
	/** The dynamic segment, for routes such as chats/[id]. */
	param?: [name: string, from: string];
	query?: string;
	extraQuery?: string;
	body?: (id: string) => unknown;
}

const calls: Call[] = [
	{ route: "chats/[id]", method: "GET", param: ["id", "id"] },
	{ route: "chats/[id]", method: "PUT", param: ["id", "id"], body: () => ({ title: "x" }) },
	{ route: "chats/[id]", method: "DELETE", param: ["id", "id"] },
	{ route: "chats/[id]/restore", method: "POST", param: ["id", "id"] },
	{ route: "chats/[id]/markdown", method: "GET", param: ["id", "id"] },
	{ route: "chats/[id]/stream", method: "GET", param: ["id", "id"] },
	{ route: "chats/[id]/steer", method: "POST", param: ["id", "id"], body: () => ({ input: "x" }) },
	{ route: "chats/[id]/settings", method: "PUT", param: ["id", "id"], body: () => ({}) },
	{ route: "chats/[id]/dismiss", method: "POST", param: ["id", "id"], body: () => ({}) },
	{ route: "chats/[id]/artifact-ui", method: "POST", param: ["id", "id"], body: () => ({}) },
	{ route: "cheatsheets/[id]", method: "GET", param: ["id", "id"] },
	{ route: "cheatsheets/[id]", method: "PUT", param: ["id", "id"], body: () => ({ title: "t", text: "a | b" }) },
	{ route: "cheatsheets/[id]", method: "DELETE", param: ["id", "id"] },
	{ route: "cheatsheets/[id]/add", method: "POST", param: ["id", "id"], body: () => ({ text: "a | b" }) },
	{ route: "cheatsheets/[id]/review", method: "POST", param: ["id", "id"] },
	{ route: "cheatsheets/[id]/to-repo", method: "POST", param: ["id", "id"] },
	{ route: "keys/[id]", method: "PUT", param: ["id", "id"], body: () => ({ value: "x" }) },
	{ route: "keys/[id]", method: "DELETE", param: ["id", "id"] },
	{ route: "settings/[section]", method: "PUT", param: ["section", "id"], body: () => ({}) },
	{ route: "settings/prompts/[...segment]", method: "PUT", param: ["segment", "id"], body: () => ({ text: "x" }) },
	{ route: "settings/prompts/[...segment]", method: "DELETE", param: ["segment", "id"] },
	{ route: "read", method: "GET", query: "id" },
	{ route: "watch", method: "GET", query: "id" },
	{ route: "watch/prep", method: "GET", query: "id" },
	{ route: "watch/sections", method: "GET", query: "id" },
	{ route: "watch/fragments", method: "GET", query: "id" },
	{ route: "speak", method: "GET", query: "id" },
	{ route: "placement/words", method: "GET", query: "id" },
	{ route: "fluency", method: "GET", query: "id" },
	{ route: "milestones", method: "GET", query: "id" },
	{ route: "exam", method: "GET", query: "chapter" },
	{ route: "lesson", method: "GET", query: "unit" },
	{ route: "words/known", method: "GET", query: "slug" },
	{ route: "read", method: "POST", body: (id) => ({ action: "open", storyId: id, id }) },
	{ route: "watch", method: "POST", body: (id) => ({ action: "open", videoId: id, id, url: id }) },
	{ route: "watch/prep", method: "POST", body: (id) => ({ action: "prepare", videoId: id, id }) },
	{ route: "watch/sections", method: "POST", body: (id) => ({ action: "find", videoId: id, id }) },
	{ route: "speak", method: "POST", body: (id) => ({ action: "turn", id, scene: id }) },
	{ route: "placement", method: "POST", body: (id) => ({ id }) },
	{ route: "placement/answer", method: "POST", body: (id) => ({ id, itemId: id }) },
	{ route: "placement/probe", method: "POST", body: (id) => ({ id }) },
	{ route: "placement/words", method: "POST", body: (id) => ({ id, answers: [] }) },
	{ route: "catch", method: "POST", body: (id) => ({ id }) },
	{ route: "languages", method: "POST", body: (id) => ({ action: "remove", id }) },
	{ route: "languages", method: "POST", body: (id) => ({ action: "add", id }) },
	{ route: "tts", method: "GET", query: "lang", extraQuery: "&text=dobry%20den&skip=elevenlabs,edge,piper" },
	{ route: "tts", method: "GET", query: "voice", extraQuery: "&text=dobry%20den&lang=sk&skip=elevenlabs,edge,piper" },
	{ route: "profile", method: "POST", body: (id) => ({ active: id }) },
	{ route: "tasks", method: "POST", body: (id) => ({ action: "cancel", id }) },
	{ route: "milestones", method: "DELETE", query: "id" },
	{ route: "phrases", method: "DELETE", query: "id" },
];

const urlFor = (call: Call, id: string) => {
	const query = call.query ? `?${call.query}=${encodeURIComponent(id)}${call.extraQuery ?? ""}` : "";
	return `http://localhost/api/${call.route.replace(/\[.*\]/, "x")}${query}`;
};

describe("a hostile id never reaches a file outside the data folder", () => {
	for (const call of calls) {
		it(`${call.method} /api/${call.route}${call.query ? `?${call.query}=` : ""}`, async () => {
			const handlers = await load(call.route);
			const handler = handlers[call.method];
			assert.ok(handler, `${call.method} exists on ${call.route}`);
			for (const id of HOSTILE) {
				const init: RequestInit = { method: call.method };
				if (call.body) {
					init.body = JSON.stringify(call.body(id));
					init.headers = { "content-type": "application/json" };
				}
				const request = new Request(urlFor(call, id), init);
				const context = call.param ? { params: Promise.resolve({ [call.param[0]]: call.param[0] === "segment" ? id.split("/") : id }) } : undefined;
				let status = 0;
				try {
					status = (await handler(request, context)).status;
				} catch {
					status = 500;
				}
				assert.ok(status > 0 && status < 500, `${call.method} ${call.route} answered ${status} for ${JSON.stringify(id).slice(0, 40)}`);
				assert.deepEqual(snapshot(), before, `${call.method} ${call.route} with ${JSON.stringify(id).slice(0, 60)} touched a file outside the data folder`);
			}
		});
	}
});

describe("the check itself", () => {
	it("notices a new file, a changed file and a removed file outside the data folder", () => {
		const stray = path.join(TMP, "stray.json");
		fs.writeFileSync(stray, "x");
		assert.notDeepEqual(snapshot(), before);
		fs.rmSync(stray);
		fs.appendFileSync(path.join(OUTSIDE, "secret.json"), "!");
		assert.notDeepEqual(snapshot(), before);
		fs.writeFileSync(path.join(OUTSIDE, "secret.json"), "sentinel secret.json");
		assert.deepEqual(snapshot(), before);
	});
});
