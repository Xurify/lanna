import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore, fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import type { PiEngine } from "../src/agent/models.ts";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lh-fast-chat-"));
const originalEnv = process.env;
const originalFetch = globalThis.fetch;
process.env = {
	...(originalEnv.NODE_TEST_CONTEXT ? { NODE_TEST_CONTEXT: originalEnv.NODE_TEST_CONTEXT } : {}),
	...(originalEnv.NODE_OPTIONS ? { NODE_OPTIONS: originalEnv.NODE_OPTIONS } : {}),
	NODE_ENV: "test",
	LH_DATA_DIR: path.join(scratch, "data"),
	LH_AUTH_FILE: path.join(scratch, "auth.json"),
	HOME: path.join(scratch, "home"),
};
globalThis.fetch = async () => {
	throw new Error("CLOSED: unexpected network request");
};
after(() => {
	process.env = originalEnv;
	globalThis.fetch = originalFetch;
	fs.rmSync(scratch, { recursive: true, force: true });
});

const { createChatAgent, composeInstructions } = await import("../src/agent/teacher-agent.ts");
const {
	closesChatReply,
	needsContinuation,
	appContentText,
	unitHref,
	tutorUnitAt,
	chatLinkTarget,
	curriculumState,
	curriculumUnits,
} = await import("../src/core/index.ts");
const { svgOf, latestReplyText } = await import("../src/server/drawing.ts");
const { appContentNow } = await import("../src/server/app-content.ts");

const POSE = { answer: "táto kniha", focus: "feminine this" };
const GRADE = { verdict: "right", given: "tento muž", expected: "tento muž", focus: "masculine this" };

/** A scripted model: each step is one model call; the count says how many calls the turn made. */
function scripted(steps: Array<() => ReturnType<typeof fauxAssistantMessage>>): {
	engine: PiEngine;
	calls: () => number;
} {
	let calls = 0;
	const faux = createFauxCore({ provider: "anthropic", models: [{ id: "claude-haiku-5-5" }] });
	faux.setResponses(
		steps.map((step) => () => {
			calls++;
			return step();
		}),
	);
	return { engine: { model: faux.getModel(), streamFn: faux.streamSimple }, calls: () => calls };
}

describe("a chat reply that ends on its record", () => {
	it("takes one model call: the text, then grade and pose, and the turn is over", async () => {
		const model = scripted([
			() =>
				fauxAssistantMessage([
					fauxText('Correct: `say: tento muž` = "this man". Now: "this book"?'),
					fauxToolCall("grade", GRADE, { id: "g1" }),
					fauxToolCall("pose", POSE, { id: "p1" }),
				]),
			() => fauxAssistantMessage([fauxText("This must never be asked for.")]),
		]);
		const recorded: unknown[] = [];
		const agent = createChatAgent({ answers: { record: (a) => recorded.push(a) } }, { engine: model.engine });
		await agent.prompt({ role: "user", content: "tento muž", timestamp: Date.now() });
		assert.equal(model.calls(), 1);
		assert.equal(recorded.length, 1, "the grade is still recorded");
		const last = agent.state.messages.at(-1) as { role: string; toolName?: string };
		assert.equal(last.role, "toolResult");
		assert.equal(needsContinuation(agent.state.messages as never), false, "a reload owes no second call");
	});

	it("ends even when a record call fails, so the reply is never written twice", async () => {
		const model = scripted([
			() =>
				fauxAssistantMessage([
					fauxText('`say: do mesta` = "to the city". Now: "to the shop"?'),
					fauxToolCall("pose", {}, { id: "p1" }),
				]),
			() => fauxAssistantMessage([fauxText("The same reply again.")]),
		]);
		const agent = createChatAgent({}, { engine: model.engine });
		await agent.prompt({ role: "user", content: "Why do mesta?", timestamp: Date.now() });
		assert.equal(model.calls(), 1);
		const last = agent.state.messages.at(-1) as { role: string; isError?: boolean };
		assert.equal(last.isError, true, "the failed call stays in the record for the next turn to see");
		assert.equal(needsContinuation(agent.state.messages as never), false);
	});

	it("still takes a second call when the record comes before any text", async () => {
		const model = scripted([
			() => fauxAssistantMessage([fauxToolCall("pose", POSE, { id: "p1" })]),
			() => fauxAssistantMessage([fauxText('Say "this book".')]),
		]);
		const agent = createChatAgent({}, { engine: model.engine });
		await agent.prompt({ role: "user", content: "Explain this and that", timestamp: Date.now() });
		assert.equal(model.calls(), 2);
	});

	it("still takes a second call after a check, whose answer the reply needs", async () => {
		const model = scripted([
			() =>
				fauxAssistantMessage([fauxText("Let me check."), fauxToolCall("lookup_word", { word: "kniha" }, { id: "l1" })]),
			() => fauxAssistantMessage([fauxText('`say: kniha` = "book".')]),
		]);
		const agent = createChatAgent({}, { engine: model.engine });
		await agent.prompt({ role: "user", content: "What is kniha?", timestamp: Date.now() });
		assert.equal(model.calls(), 2);
	});
});

describe("closesChatReply", () => {
	it("needs text and only record calls", () => {
		assert.equal(
			closesChatReply([
				{ type: "text", text: "Hi" },
				{ type: "toolCall", name: "pose" },
			]),
			true,
		);
		assert.equal(
			closesChatReply([
				{ type: "text", text: "Hi" },
				{ type: "toolCall", name: "add_to_review" },
			]),
			true,
		);
		assert.equal(
			closesChatReply([
				{ type: "text", text: "  " },
				{ type: "toolCall", name: "pose" },
			]),
			false,
		);
		assert.equal(closesChatReply([{ type: "text", text: "Hi" }]), false, "no calls: the loop ends on its own");
		assert.equal(
			closesChatReply([
				{ type: "text", text: "Hi" },
				{ type: "toolCall", name: "pose" },
				{ type: "toolCall", name: "check_slovak" },
			]),
			false,
		);
		assert.equal(
			closesChatReply([
				{ type: "text", text: "Hi" },
				{ type: "toolCall", name: "research" },
				{ type: "toolCall", name: "pose" },
			]),
			true,
			"a dispatched job only acknowledges",
		);
		assert.equal(
			closesChatReply([
				{ type: "text", text: "Hi" },
				{ type: "toolCall", name: "read" },
			]),
			false,
			"a file read is a check the reply needs",
		);
	});
});

describe("what the app has, for the chat", () => {
	const state = curriculumState({}, "B2");
	const text = appContentText({
		pages: [{ href: "/read", label: "Read", hint: "Stories" }],
		state,
		scenes: [{ id: "cafe", title: "Kaviareň", blurb: "Order coffee" }],
		sheets: [{ id: "a b", title: "Animals" }],
		stories: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, title: `Story ${i}` })),
	});

	it("links every unit the way the app opens it", () => {
		for (const unit of curriculumUnits()) {
			const href = unitHref({ id: unit.id, kind: unit.kind, scene: unit.scene });
			if (href) assert.ok(text.includes(`](${href})`), unit.id);
		}
		assert.equal(unitHref({ id: "can-order", kind: "goal", scene: "cafe" }), "/speak?scene=cafe");
		assert.equal(unitHref({ id: "can-x", kind: "goal" }), null);
	});

	it("names the learner's chapter and gives each open unit its state", () => {
		const current = state.chapters.find((c) => c.id === state.current)!;
		assert.ok(text.includes(`they are in "${current.title}"`));
		const first = current.units[0]!;
		assert.ok(text.includes(`${first.tagline} (`), "a unit in an open chapter carries its state");
	});

	it("leaves the state off units of a chapter that opens later", () => {
		const later = state.chapters.find((c) => !c.open)!;
		const line = text.split("\n").find((l) => l.includes(`](${unitHref(later.units[0]!)})`))!;
		assert.ok(!line.endsWith("(later on the path)"), line);
		assert.ok(text.includes(`${later.title}: ${later.tagline} (opens later; its units are later on the path)`));
	});

	it("lists scenes, cheatsheets and the latest stories with their links", () => {
		assert.ok(text.includes("[Kaviareň](/speak?scene=cafe)"));
		assert.ok(text.includes("[Animals](/words?tab=cheatsheets&sheet=a%20b)"));
		assert.ok(text.includes("[Story 19](/read?id=s19)"));
		assert.ok(!text.includes("[Story 7]"), "only the latest stories");
	});

	it("is built from the profile on disk and reaches the chat agent's prompt after the doctrine", () => {
		const map = appContentNow();
		assert.match(map, /^# What the app has/);
		const agent = createChatAgent({}, { engine: scripted([]).engine, appContent: map });
		assert.ok(agent.state.systemPrompt.startsWith(composeInstructions("chat")));
		assert.ok(agent.state.systemPrompt.includes(map));
	});
});

describe("tutorUnitAt", () => {
	it("names a tutor unit, and nothing for a lesson or another page", () => {
		const tutor = curriculumUnits().find((u) => u.kind === "tutor")!;
		const drill = curriculumUnits().find((u) => u.kind === "drill")!;
		assert.equal(tutorUnitAt(`/lesson?unit=${tutor.id}`), tutor.id);
		assert.equal(tutorUnitAt(`/lesson?unit=${drill.id}`), null);
		assert.equal(tutorUnitAt("/read"), null);
		assert.equal(tutorUnitAt(`/lesson?unit=${tutor.id}&x=1`), null);
	});
});

describe("chatLinkTarget", () => {
	const origin = "http://127.0.0.1:3010";
	it("opens the app's own pages in place and a tutor unit as its chat", () => {
		const tutor = curriculumUnits().find((u) => u.kind === "tutor")!;
		assert.deepEqual(chatLinkTarget("/read?id=s1", origin), { kind: "app", path: "/read?id=s1" });
		assert.deepEqual(chatLinkTarget("speak?scene=cafe", origin), { kind: "app", path: "/speak?scene=cafe" });
		assert.deepEqual(chatLinkTarget(`${origin}/review`, origin), { kind: "app", path: "/review" });
		assert.deepEqual(chatLinkTarget(`/lesson?unit=${tutor.id}`, origin), { kind: "tutor", unit: tutor.id });
	});
	it("keeps the server's own routes and unknown schemes as plain text, and sends other sites to a new window", () => {
		assert.deepEqual(chatLinkTarget("/api/chats", origin), { kind: "text" });
		assert.deepEqual(chatLinkTarget("javascript:alert(1)", origin), { kind: "text" });
		assert.deepEqual(chatLinkTarget("//evil.example/x", origin), { kind: "web", href: "http://evil.example/x" });
		assert.deepEqual(chatLinkTarget("https://slovak.wiki/a", origin), { kind: "web", href: "https://slovak.wiki/a" });
		assert.deepEqual(chatLinkTarget("#fn-1", origin), { kind: "anchor", href: "#fn-1" });
		assert.deepEqual(chatLinkTarget(undefined, origin), { kind: "text" });
	});
});

describe("a drawing asked for after the reply", () => {
	const SVG =
		'<svg viewBox="0 0 320 80" style="fill:none"><text x="16" y="40" style="fill:var(--ink);font-family:var(--font-sans);font-size:15">v meste</text></svg>';

	it("is made by the drawer with the reply in hand, kept off the model's next prompt, and ends the turn", async () => {
		const model = scripted([
			() =>
				fauxAssistantMessage([
					fauxText('`say: v meste` = "in town".'),
					fauxToolCall("draw", { brief: "v meste in a box" }, { id: "d1" }),
					fauxToolCall("pose", POSE, { id: "p1" }),
				]),
			() => fauxAssistantMessage([fauxText("Never asked for.")]),
		]);
		const seen: Array<{ brief: string; reply: string }> = [];
		let agent: ReturnType<typeof createChatAgent>;
		agent = createChatAgent(
			{ drawing: { draw: async (brief) => (seen.push({ brief, reply: latestReplyText(agent.state.messages) }), SVG) } },
			{ engine: model.engine },
		);
		await agent.prompt({ role: "user", content: "Where is it?", timestamp: Date.now() });
		assert.equal(model.calls(), 1);
		assert.deepEqual(seen, [{ brief: "v meste in a box", reply: '`say: v meste` = "in town".' }]);
		const result = agent.state.messages.find((m) => (m as { toolName?: string }).toolName === "draw") as {
			details: unknown;
			content: Array<{ text: string }>;
		};
		assert.deepEqual(result.details, { svg: SVG });
		assert.ok(!result.content[0]!.text.includes("<svg"));
	});

	it("says so when the drawer fails, and the reply stands", async () => {
		const model = scripted([
			() => fauxAssistantMessage([fauxText("Text."), fauxToolCall("draw", { brief: "x" }, { id: "d1" })]),
		]);
		const agent = createChatAgent({ drawing: { draw: async () => null } }, { engine: model.engine });
		await agent.prompt({ role: "user", content: "Draw it", timestamp: Date.now() });
		const result = agent.state.messages.find((m) => (m as { toolName?: string }).toolName === "draw") as {
			details: unknown;
		};
		assert.deepEqual(result.details, { failed: true });
	});

	it("throws AbortError when aborted during drawing, rather than masking it as failed: true", async () => {
		const controller = new AbortController();
		const { chatTools } = await import("../src/agent/tools/chat.ts");
		const tools = chatTools({
			drawing: {
				draw: async () => {
					controller.abort();
					const err = new Error("aborted");
					err.name = "AbortError";
					throw err;
				},
			},
		});
		assert.ok(tools.draw);
		await assert.rejects(
			tools.draw.execute("d1", { brief: "test" }, controller.signal),
			(err: any) => err?.name === "AbortError" || err?.message === "aborted",
		);
	});

	it("drawForReply rejects immediately on an aborted signal", async () => {
		const controller = new AbortController();
		controller.abort();
		const { drawForReply } = await import("../src/server/drawing.ts");
		await assert.rejects(
			drawForReply({
				engine: scripted([]).engine,
				reply: "A reply",
				brief: "A brief",
				signal: controller.signal,
			}),
			(err: any) => err?.name === "AbortError" || err?.message === "aborted",
		);
	});

	it("drawForReply returns null on drawing timeout without aborting", async () => {
		const { drawForReply } = await import("../src/server/drawing.ts");
		const faux = createFauxCore({ provider: "anthropic", models: [{ id: "claude-haiku-5-5" }] });
		faux.stream = () => {
			return {
				async *[Symbol.asyncIterator]() {
					await new Promise((resolve) => setTimeout(resolve, 500));
					if (Date.now() < 0) yield undefined;
				},
			} as any;
		};
		const engine: PiEngine = {
			model: { provider: "anthropic", id: "claude-haiku-5-5" } as any,
			streamFn: faux.stream.bind(faux) as any,
		};
		const result = await drawForReply({
			engine,
			reply: "A reply",
			brief: "A brief",
			timeoutMs: 20,
		});
		assert.equal(result, null);
	});

	it("drawing prompt forbids introducing unverified forms and does not suggest other words for the question answer", () => {
		const prompt = fs.readFileSync(path.join(process.cwd(), "src/agent/prompts/drawing/10-drawing.md"), "utf-8");
		assert.ok(!prompt.includes("Draw the pattern with other words"));
		assert.ok(prompt.includes("leave that cell or spot empty, or marked with `?`"));
		assert.ok(prompt.includes("Never add a form the reply does not have"));
	});

	it("accepts only a drawing that passes the sketch allowlist", () => {
		assert.equal(svgOf("```svg\n" + SVG + "\n```"), SVG);
		assert.equal(svgOf(`Here: ${SVG}`), SVG);
		assert.equal(svgOf("no drawing"), null);
		assert.equal(svgOf("```svg\n<svg><script>x</script></svg>\n```"), null);
	});
});

describe("the board's glossed forms", () => {
	it("keeps a quoted meaning whole, parentheses included", async () => {
		const { boardPhrases } = await import("../src/core/index.ts");
		assert.deepEqual(boardPhrases(['`say: kde` = "where (at)", and `say: v meste` (in town).']), [
			{ phrase: "kde", meaning: "where (at)" },
			{ phrase: "v meste", meaning: "in town" },
		]);
		assert.deepEqual(
			boardPhrases([
				'Its table shows `say: na stole` (p. 1) and `say: v dome` (pp. 1–2), and `say: v škole` (p. 1) ("in the school").',
			]),
			[{ phrase: "v škole", meaning: "in the school" }],
			"a page citation is not a meaning",
		);
		assert.deepEqual(
			boardPhrases([
				'`say: na stole` (masculine), `say: v meste` (neuter). `say: Som na ___` (ulica, street) = "I am on the street"',
			]),
			[],
			"a grammar label is not a meaning, and a gap prompt is not a word",
		);
	});
});
