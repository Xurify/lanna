/**
 * Prompt composition hygiene: only the numbered fragments enter a system
 * prompt (the README once leaked into every turn), each mode composes its
 * own doctrine, and no fragment or composed prompt balloons.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { describe, it } from "node:test";
import { composeInstructions } from "../src/agent/teacher-agent.ts";

describe("prompt composition", () => {
	it("loads ONLY numeric-prefix fragments — README.md never enters the system prompt", () => {
		const instructions = composeInstructions("chat");
		assert.ok(!instructions.includes("Prompt fragments"), "README content must not leak");
		assert.ok(!instructions.includes("Rules for adding a fragment"), "README content must not leak (rules)");
		for (const f of fs.readdirSync("src/agent/prompts/chat").filter((f) => /^\d+-[\w.-]+\.md$/.test(f))) {
			const body = fs.readFileSync(`src/agent/prompts/chat/${f}`, "utf-8").trim();
			assert.ok(instructions.includes(body), `fragment ${f} must compose verbatim`);
		}
	});

	it("the chat composes its own doctrine with the shared voice and accuracy; the practice doctrine stays out", () => {
		const chat = composeInstructions("chat");
		assert.ok(chat.startsWith("# The chat"), "the chat's own doctrine leads");
		assert.ok(chat.includes("## Grading an answer"), "the chat's grading doctrine is in");
		assert.ok(chat.includes("## Voice"), "the shared voice composes into the chat");
		assert.ok(chat.includes("## Accuracy: non-negotiable"), "the shared accuracy rule composes into the chat");
		assert.ok(!chat.includes("# The practice session"), "the practice doctrine never composes into the chat");
	});

	it("the practice composes its own doctrine with the shared formatting guide; the chat doctrine stays out", () => {
		const practice = composeInstructions("practice");
		assert.ok(practice.includes("# The practice session"), "the practice doctrine is in");
		assert.ok(practice.includes("## Formatting: the learner receives documents"), "the formatting guide is in");
		assert.ok(!practice.includes("# The chat"), "the chat doctrine never composes into practice");
		assert.ok(!practice.includes("## Grading an answer"), "the chat grading doctrine stays out of practice");
	});

	it("guards prompt size — no fragment can silently balloon (the README-leak class)", () => {
		// The largest real fragment is chat/10-chat.md at ~13.4k chars; 16k keeps
		// headroom above it. Composed total ≤ 60k chars.
		for (const dir of ["chat", "practice", "shared", "language", "drawing"]) {
			for (const f of fs.readdirSync(`src/agent/prompts/${dir}`).filter((f) => /^\d+-[\w.-]+\.md$/.test(f))) {
				const body = fs.readFileSync(`src/agent/prompts/${dir}/${f}`, "utf-8").trim();
				assert.ok(body.length <= 16_000, `fragment ${dir}/${f} is ${body.length} chars — over the 16k guard`);
			}
		}
		assert.ok(composeInstructions("chat").length <= 60_000, "composed chat prompt over the 60k guard");
		assert.ok(composeInstructions("practice").length <= 60_000, "composed practice prompt over the 60k guard");
	});
});
