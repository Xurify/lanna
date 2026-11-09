import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	exportChatAnkiTsv,
	exportChatJson,
	exportChatMarkdown,
	extractChatAnkiCards,
	slugifyTitle,
} from "../src/core/chat-export.ts";
import type { LhViewMessage } from "../src/core/view.ts";

describe("chat-export", () => {
	it("slugifies titles into clean filename slugs", () => {
		assert.equal(slugifyTitle("Slovak Demonstratives"), "slovak-demonstratives");
		assert.equal(slugifyTitle("  Čo je toto? (Lesson 1)  "), "co-je-toto-lesson-1");
		assert.equal(slugifyTitle(""), "chat");
		assert.equal(slugifyTitle("---!!!###---"), "chat");
	});

	it("exports a chat session to clean Markdown with SVG drawings", () => {
		const messages: LhViewMessage[] = [
			{
				id: "m-1",
				role: "user",
				parts: [{ type: "text", text: "Why is it ten muž, but táto kniha?" }],
			},
			{
				id: "m-2",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: '`say: ten muž` = "that man" uses the masculine demonstrative. For feminine, we use `say: táto kniha` = "this book".',
					},
					{
						type: "tool-draw",
						callId: "call-1",
						state: "output-available",
						input: { brief: "man near book vs far book" },
						output: { svg: '<svg viewBox="0 0 320 180"><text>ten muž</text></svg>' },
					},
				],
			},
		];

		const md = exportChatMarkdown(messages, {
			title: "Demonstratives",
			exportedAt: "2026-11-08",
		});

		assert.ok(md.startsWith("# Demonstratives\n\n*Exported from LangHarness · 2026-11-08*"));
		assert.ok(md.includes("### Learner\n\nWhy is it ten muž, but táto kniha?"));
		assert.ok(md.includes("### Tutor\n\n**ten muž** = \"that man\""), "a say: span reads as the bold form, not as code");
		assert.ok(md.includes("```svg\n<svg viewBox=\"0 0 320 180\"><text>ten muž</text></svg>\n```"));
	});

	it("makes Anki cards from the glossed forms only, since a posed question has no question text to put on a card", () => {
		const messages: LhViewMessage[] = [
			{
				id: "m-1",
				role: "user",
				parts: [{ type: "text", text: "How do demonstratives work?" }],
			},
			{
				id: "m-2",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: 'Here are the forms: `say: ten muž` = "that man", and `say: táto kniha` = "this book".',
					},
					{
						type: "tool-pose",
						callId: "call-pose-1",
						state: "output-available",
						input: { answer: "táto", focus: "feminine this" },
					},
				],
			},
		];

		const cards = extractChatAnkiCards(messages, { tag: "langharness::slovak" });
		assert.equal(cards.length, 2);

		// Card 1: ten muž
		assert.equal(cards[0]?.front, "ten muž");
		assert.equal(cards[0]?.back, "that man");
		assert.equal(cards[0]?.tags, "langharness::slovak::vocab");

		// Card 2: táto kniha
		assert.equal(cards[1]?.front, "táto kniha");
		assert.equal(cards[1]?.back, "this book");
		assert.equal(cards[1]?.tags, "langharness::slovak::vocab");
	});

	it("formats Anki TSV correctly with headers and tab separation", () => {
		const messages: LhViewMessage[] = [
			{
				id: "m-1",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: 'Remember `say: toto dieťa` = "this child".',
					},
				],
			},
		];

		const tsv = exportChatAnkiTsv(messages);
		assert.ok(tsv.startsWith("#separator:tab\n#html:true\n#tags column:3\n"));
		assert.ok(tsv.includes("toto dieťa\tthis child\tlangharness::chat::vocab"));
	});

	it("exports a chat session as valid JSON with metadata", () => {
		const messages: LhViewMessage[] = [
			{
				id: "m-1",
				role: "user",
				parts: [{ type: "text", text: "Ahoj!" }],
			},
		];

		const jsonStr = exportChatJson("chat-123", "Greetings", messages);
		const parsed = JSON.parse(jsonStr) as {
			version: number;
			format: string;
			chatId: string;
			title: string;
			exportedAt: string;
			messages: unknown[];
		};

		assert.equal(parsed.version, 1);
		assert.equal(parsed.format, "langharness-chat-export");
		assert.equal(parsed.chatId, "chat-123");
		assert.equal(parsed.title, "Greetings");
		assert.equal(parsed.messages.length, 1);
		assert.ok(typeof parsed.exportedAt === "string");
	});
});
