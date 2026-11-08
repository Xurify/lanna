/**
 * Does the plain chat (E76) answer fast, short and checked? (LangHarness, 2026-11-08)
 *
 *   LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<auth.json> \
 *     tsx scripts/eval-chat.ts <out-dir> <provider>/<model>:<thinking> ...
 *
 *   e.g. anthropic/claude-haiku-5-5:low anthropic/claude-sonnet-5-5:low
 *
 * Plays scripted learner turns against the real chat agent and its prompt,
 * and writes one JSON file per config with every reply, its timing (first
 * text and done), prose words without the drawing, whether a drawing was
 * written and passes the sketch allowlist, the tools called, and the tokens.
 * A person reads the Slovak in the replies; the script grades none of it.
 * It never prints a key.
 */
import fs from "node:fs";
import path from "node:path";

const [outDir, ...configArgs] = process.argv.slice(2);
if (!outDir || configArgs.length === 0 || !process.env.LH_DATA_DIR) {
	console.error("usage: LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<auth.json> tsx scripts/eval-chat.ts <out-dir> <provider>/<model>:<thinking> ...");
	process.exit(1);
}

const { initAuthEnv } = await import("../src/server/keys.ts");
const { piEngineForSpec } = await import("../src/agent/models.ts");
const { createChatAgent } = await import("../src/agent/teacher-agent.ts");
const { parseSketch } = await import("../src/core/sketch.ts");
const { checkSlovak, checkerNote } = await import("../src/core/slovak-check.ts");
initAuthEnv();

const SCENARIOS: Array<{ id: string; turns: string[] }> = [
	{ id: "demonstratives", turns: ["Explain demonstratives with examples and visualizations", "tá žena", "Hint", "táto žena", "Explain it another way"] },
	{ id: "locative", turns: ["Why is it v škole but do školy?", "v meste", "I don't know", "Quiz me"] },
	{ id: "own-sentence", turns: ["Is this right: Včera som išiel s sestra do obchodu.", "Draw it"] },
];

type TurnLog = { learner: string; reply: string; textBlocks: number; firstTextMs: number | null; totalMs: number; proseWords: number; questions: number; drawing: "none" | "ok" | "rejected"; tools: string[]; inputTokens: number; outputTokens: number };

function proseOf(text: string): string {
	return text.replace(/```[\s\S]*?(?:```|$)/g, "").trim();
}

fs.mkdirSync(outDir, { recursive: true });
for (const config of configArgs) {
	const m = /^([^/]+)\/(.+):(\w+)$/.exec(config);
	if (!m) throw new Error(`bad config ${config}`);
	const [, provider, id, thinkingLevel] = m as unknown as [string, string, string, "low"];
	const results: Record<string, TurnLog[]> = {};
	for (const scenario of SCENARIOS) {
		const engine = piEngineForSpec({ provider, id, thinkingLevel }, false);
		const agent = createChatAgent(
			{ answers: { record: () => {} } },
			{ engine, noteLearnerText: (text) => checkerNote(checkSlovak(text)) },
		);
		const turns: TurnLog[] = [];
		for (const learner of scenario.turns) {
			const started = Date.now();
			let firstText: number | null = null;
			const tools: string[] = [];
			let inputTokens = 0;
			let outputTokens = 0;
			const unsubscribe = agent.subscribe((event) => {
				if (event.type === "message_update" && firstText === null) {
					const content = (event.message as { content?: Array<{ type: string; text?: string }> }).content ?? [];
					if (content.some((c) => c.type === "text" && (c.text ?? "").trim().length > 0)) firstText = Date.now() - started;
				}
				if (event.type === "tool_execution_start") tools.push(event.toolName);
				if (event.type === "message_end" && event.message.role === "assistant") {
					const usage = (event.message as { usage?: { input?: number; output?: number; cacheRead?: number } }).usage;
					inputTokens += (usage?.input ?? 0) + (usage?.cacheRead ?? 0);
					outputTokens += usage?.output ?? 0;
				}
			});
			const before = agent.state.messages.length;
			await agent.prompt({ role: "user", content: learner, timestamp: Date.now() });
			unsubscribe();
			const blocks = agent.state.messages
				.slice(before)
				.filter((msg) => msg.role === "assistant")
				.flatMap((msg) => ((msg as { content: Array<{ type: string; text?: string }> }).content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? ""))
				.filter((text) => text.trim().length > 0);
			const reply = blocks.join("\n\n");
			const fence = /```svg\s*\n([\s\S]*?)```/.exec(reply);
			const prose = proseOf(reply);
			turns.push({
				learner,
				reply,
				textBlocks: blocks.length,
				firstTextMs: firstText,
				totalMs: Date.now() - started,
				proseWords: prose.split(/\s+/).filter(Boolean).length,
				questions: (prose.match(/\?/g) ?? []).length,
				drawing: fence ? (parseSketch(fence[1]!) ? "ok" : "rejected") : "none",
				tools,
				inputTokens,
				outputTokens,
			});
			const t = turns.at(-1)!;
			console.log(`${config} ${scenario.id} "${learner.slice(0, 30)}": first text ${t.firstTextMs ?? "-"} ms, done ${t.totalMs} ms, ${t.proseWords} words, ${t.textBlocks} block(s), ${t.questions}?, drawing ${t.drawing}, tools ${t.tools.join(",") || "-"}`);
		}
		results[scenario.id] = turns;
	}
	fs.writeFileSync(path.join(outDir, `${config.replace(/[/:]/g, "_")}.json`), JSON.stringify(results, null, 1));
}
