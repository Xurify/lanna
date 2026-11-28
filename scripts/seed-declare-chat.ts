/**
 * Seeds one chat each for the two Declare-widget fences, for screenshots of
 * the practice widget (public/declare/):
 *
 *   LANNA_DATA_DIR=<an empty folder> tsx scripts/seed-declare-chat.ts
 *
 * A "quiz" fence (the tutor's data for the fixed drill) and a "declare"
 * fence (a full Declare program). Start the app against the same folder
 * (LANNA_DATA_DIR=<folder> npm run dev) and open the two chats.
 *
 * Refuses a folder that already has chats, so it can never touch your own
 * sessions.
 */

import fs from "node:fs";
import path from "node:path";
import type { LannaMessage } from "../src/core/chat-messages.ts";

const dir = process.env.LANNA_DATA_DIR;
if (!dir) {
	console.error(
		"Set LANNA_DATA_DIR to an empty folder first: this script seeds demo chats and must not touch your real data.",
	);
	process.exit(1);
}

const { createChat, listChats, stores, titleFromPrompt } = await import("../src/server");
const { newMessageId, newUserMessage } = await import("../src/core/chat-messages.ts");

if (listChats().length > 0) {
	console.error(
		`${dir} already has chats. This script only seeds an empty folder; use a new one (npm run dev:sandbox makes one).`,
	);
	process.exit(1);
}

const drill = fs.readFileSync(new URL("../public/declare/widgets/ins-drill.declare", import.meta.url), "utf-8");
const quizRows = [
	{
		title: "The instrumental",
		rows: [
			{
				sentence: "Ideš s ___.",
				gloss: "You are going with a friend.",
				options: ["kamaráta", "kamarátom", "kamaráti"],
				answer: 1,
				full: "s kamarátom",
				meaning: "with a friend",
				hint: "s takes the instrumental",
			},
			{
				sentence: "Ide do kina s ___.",
				gloss: "She is going to the cinema with a friend (a girl).",
				options: ["kamarátky", "kamarátke", "kamarátkou"],
				answer: 2,
				full: "s kamarátkou",
				meaning: "with a friend (a girl)",
				hint: "kamarátka is feminine in -a: -ou",
			},
			{
				sentence: "Auto stojí pred ___.",
				gloss: "The car stands in front of the house.",
				options: ["domom", "domu", "dom"],
				answer: 0,
				full: "pred domom",
				meaning: "in front of the house",
				hint: "pred takes the instrumental",
			},
			{
				sentence: "Hovorím s ___.",
				gloss: "I am talking with my sister.",
				options: ["sestrou", "sestru", "sestre"],
				answer: 0,
				full: "so sestrou",
				meaning: "with my sister",
				hint: "sestra is feminine in -a: -ou",
			},
		],
	},
];

const assistant = (text: string) =>
	({
		id: newMessageId(),
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-completions",
		provider: "openai",
		model: "seed",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	}) as unknown as LannaMessage;

const quiz = createChat(titleFromPrompt("Instrumental drill"), "chat");
stores.chatStore.saveMessages(quiz.id, [
	newUserMessage("Quiz me on the instrumental."),
	assistant("A quick drill on the same choice:\n\n```quiz\n" + JSON.stringify(quizRows[0], null, 2) + "\n```"),
]);

const program = createChat(titleFromPrompt("Declare program widget"), "chat");
stores.chatStore.saveMessages(program.id, [
	newUserMessage("Can you make me a small interactive drill?"),
	assistant("Here is one as a full Declare program:\n\n```declare\n" + drill + "\n```"),
]);

console.log(`Seeded ${quiz.id} (quiz fence) and ${program.id} (declare fence) into ${dir}`);
fs.writeFileSync(path.join(dir, "declare-chats.json"), JSON.stringify({ quiz: quiz.id, program: program.id }));
