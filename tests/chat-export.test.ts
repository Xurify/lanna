import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	chatClozeSentences,
	exportChatClozemasterTsv,
	exportChatJson,
	exportChatMarkdown,
	pickClozeWord,
	slugifyTitle,
} from "../src/core/chat-export.ts";
import type { LhMessage } from "../src/core/native-messages.ts";
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
		assert.ok(md.includes("## Learner\n\nWhy is it ten muž, but táto kniha?"));
		assert.ok(md.includes("## Tutor\n\n**ten muž** = \"that man\""), "a say: span reads as the bold form, not as code");
		assert.ok(md.includes("```svg\n<svg viewBox=\"0 0 320 180\"><text>ten muž</text></svg>\n```"));
	});

	it("keeps the tutor's line breaks, puts its headings under the speaker, and drops links that only open in the app", () => {
		const messages: LhViewMessage[] = [
			{
				id: "m-1",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: [
							"## My and your",
							"",
							'`say: môj brat` = "my brother"',
							'`say: moja sestra` = "my sister"',
							"",
							"- one",
							"- two",
							"",
							"The unit is [Gender, this and mine](/lesson?unit=gender-this-my); the forms are at [Hlavac](https://example.org/l22).",
							"",
							"```text",
							"# not a heading",
							"kept as written",
							"```",
						].join("\n"),
					},
				],
			},
		];

		const md = exportChatMarkdown(messages, { title: "Possessives", exportedAt: "2026-11-09" });

		assert.ok(md.includes("## Tutor\n\n### My and your\n"), "the reply's own heading sits one level under the speaker");
		assert.ok(md.includes('**môj brat** = "my brother"  \n**moja sestra** = "my sister"\n'), "two lines stay two lines in any Markdown reader");
		assert.ok(md.includes("- one\n- two\n"), "list items need no hard break");
		assert.ok(md.includes("The unit is Gender, this and mine; the forms are at [Hlavac](https://example.org/l22)."));
		assert.ok(md.includes("# not a heading\nkept as written\n"), "a code fence is left alone");
	});

	it("writes an answered question with its options and the learner's choice, and a drawing kept in a tool result", () => {
		const messages = [
			{ id: "n-1", role: "assistant", content: [{ type: "text", text: "One quick check." }] },
			{
				id: "n-2",
				role: "toolResult",
				toolName: "probe",
				isError: false,
				details: {
					kind: "quiz",
					questionText: 'Complete the sentence: "Čítam ___ knihu."',
					options: [
						{ index: 1, label: "túto" },
						{ index: 2, label: "tú" },
					],
					dontKnow: false,
					answers: [{ label: "tú", value: "b", index: 2 }],
					correctIndices: [1],
					correct: false,
					answeredAt: "2026-11-08T09:37:34.769Z",
				},
			},
			{ id: "n-3", role: "toolResult", toolName: "draw", isError: false, details: { svg: '<svg viewBox="0 0 10 10"></svg>' } },
			{ id: "n-4", role: "toolResult", toolName: "grade", isError: false, details: { correct: true } },
		] as unknown as LhMessage[];

		const md = exportChatMarkdown(messages, { title: "Demonstratives", exportedAt: "2026-11-09" });

		assert.ok(md.includes('## Tutor\n\nOne quick check.\n\nComplete the sentence: "Čítam ___ knihu."\n\n- túto (correct)\n- tú\n\n## Learner\n\ntú\n'));
		assert.ok(md.includes('## Tutor\n\n```svg\n<svg viewBox="0 0 10 10"></svg>\n```'));
		assert.ok(!md.includes("grade"), "a tool the learner never sees leaves no trace");
	});

	it("makes a Clozemaster sentence from each glossed phrase that holds a word the tutor sent to Review", () => {
		const messages: LhViewMessage[] = [
			{
				id: "m-1",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: 'Correct: `say: Toto je môj brat.` = "This is my brother". Alone it is `say: môj` = "my", and `say: naše auto` = "our car".',
					},
					{ type: "tool-add_to_review", toolCallId: "call-1", state: "output-available", input: { words: ["môj", "moja sestra"] } },
				],
			},
		];

		assert.deepEqual(chatClozeSentences(messages), [{ sentence: "Toto je môj brat.", translation: "This is my brother.", cloze: "môj" }]);
	});

	it("blanks the taught word as the sentence writes it", () => {
		assert.equal(pickClozeWord(["Toto", "je", "Môj", "brat"], new Set(["môj"])), "Môj");
	});

	it("blanks inflected forms matching taught word stems", () => {
		const taught = new Set(["tvoj", "svoj"]);
		assert.equal(pickClozeWord(["Toto", "je", "tvoja", "sestra"], taught), "tvoja");
		assert.equal(pickClozeWord(["Toto", "je", "tvoje", "auto"], taught), "tvoje");
		assert.equal(pickClozeWord(["Michal", "išiel", "so", "svojimi", "kamarátmi"], taught), "svojimi");
		assert.equal(pickClozeWord(["naše", "auto"], taught), null);
	});

	it("falls back to the longest word when no words were sent to review", () => {
		assert.equal(pickClozeWord(["Toto", "je", "táto", "kniha"], new Set()), "kniha");
	});

	it("writes the Clozemaster file as bare tab-separated rows: no header, no braces, no line break after the last row", () => {
		const messages: LhViewMessage[] = [
			{
				id: "m-1",
				role: "assistant",
				parts: [
					{ type: "text", text: '`say: môj dom` = "my house" and `say: jeho brat` = "his brother".' },
					{ type: "tool-add_to_review", toolCallId: "call-1", state: "output-available", input: { words: ["môj", "jeho"] } },
				],
			},
		];

		assert.equal(exportChatClozemasterTsv(messages), "môj dom\tmy house\tmôj\njeho brat\this brother\tjeho");
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
