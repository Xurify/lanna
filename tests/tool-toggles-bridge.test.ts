/**
 * The P2 tool-toggle bridge (2026-09-19): AgentBuildOptions.toolToggles is
 * first-class — the agent constructors thread it to the factories' enabled?
 * param (an explicit opts.tools registry is never filtered), and the
 * settings write side rejects unknown tool keys against the toggleable set.
 *
 * Parser tests are PURE (no fs — parallel-test discipline); the agent
 * construction tests use an in-memory chat fixture.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Type } from "typebox";
import { createChatAgent, createPracticeAgent } from "../src/agent/teacher-agent.ts";
import type { PracticeToolContext } from "../src/agent/tools/practice.ts";
import { jobStore } from "../src/store/jobs.ts";
import { parseAgentSettingsBody } from "../src/server/settings-body.ts";
import { chatStore } from "../src/store/chats.ts";
import { createFauxCore } from "@earendil-works/pi-ai";
import type { PiEngine } from "../src/agent/models.ts";
import type { AgentSettings } from "../src/core/settings.ts";

/** A scripted pi engine — the agent builds need an injected engine since
 *  BYOK removed the factory pins (owner, 2026-09-22). */
function fauxEngine(): PiEngine {
	const faux = createFauxCore({});
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

describe("AgentBuildOptions.toolToggles (the P2 bridge)", () => {
	const toolNames = (agent: { state: { tools: Array<{ name: string }> } }) =>
		agent.state.tools.map((t) => t.name).sort();

	it("flows into the chat's registry: a job-tool delta is a no-op on the bare set", () => {
		// No jobs ctx → bare agent: no research/pdf to drop. A job-tool delta
		// names tools that are not there — the bridge must not crash on it.
		const bare = createChatAgent({}, { engine: fauxEngine() });
		const withDelta = createChatAgent({}, { engine: fauxEngine(), toolToggles: { research: false } });
		assert.deepEqual(toolNames(withDelta), toolNames(bare));
		assert.ok(toolNames(bare).includes("pose"), "the chat's commit tool is always on");
	});

	it("flows into the practitioner's registry: the delta drops research and keeps the rest", () => {
		const chatId = chatStore.createChat("Toggle bridge test").id;
		const ctx: PracticeToolContext = {
			chatId,
			chatStore,
			jobs: { chatId, jobStore, spawn: () => {} },
		};
		const practice = createPracticeAgent(ctx, { engine: fauxEngine(), toolToggles: { research: false } });
		const names = toolNames(practice);
		assert.ok(!names.includes("research"), "the delta dropped the research tool");
		assert.ok(names.includes("pdf"), "pdf is untouched by a research delta");
		assert.ok(names.includes("problem") && names.includes("conclude"), "the problem gate tools are always on");
	});

	it("an explicitly injected opts.tools registry is NEVER toggle-filtered", () => {
		const chat = createChatAgent(
			{},
			{
				engine: fauxEngine(),
				tools: {
					pose: {
						name: "pose",
						label: "pose",
						description: "test",
						parameters: Type.Object({}),
						execute: async () => ({ content: [{ type: "text", text: "ok" }], details: null }),
					},
				},
				toolToggles: { pose: false },
			},
		);
		assert.deepEqual(toolNames(chat), ["pose"]);
	});
});

describe("parseAgentSettingsBody: tool keys validate at write time", () => {
	const parse = (tools: Record<string, boolean>) =>
		parseAgentSettingsBody({ tools }) as { ok: true; settings: AgentSettings } | { ok: false; error: string };

	it("a valid job-tool delta parses", () => {
		const r = parse({ research: false, pdf: false });
		assert.equal(r.ok, true);
		assert.deepEqual(r.ok && r.settings.tools, { research: false, pdf: false });
	});

	it("unknown keys are rejected with the supported list (a persisted quiz key never lands)", () => {
		const r = parse({ quiz: false });
		assert.equal(r.ok, false);
		assert.match(!r.ok && r.error, /unknown tool "quiz" \(supported: research, pdf/);
		const typo = parse({ reasearch: false });
		assert.equal(typo.ok, false);
		assert.match(!typo.ok && typo.error, /unknown tool "reasearch"/);
	});

	it("a saved toggle for the removed visual tool is dropped, so the section still saves", () => {
		const r = parse({ visual: false, pdf: true });
		assert.equal(r.ok, true);
		assert.deepEqual(r.ok && r.settings.tools, { pdf: true });
	});

	it("absent tools field is fine (absent = enabled everywhere)", () => {
		const r = parseAgentSettingsBody({}) as { ok: boolean };
		assert.equal(r.ok, true);
	});
});
