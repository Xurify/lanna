import fs from "node:fs";
import path from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";
import { PATHS } from "../../config.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { parseSketch } from "../core/sketch.ts";

const DRAWING_PROMPT = path.join(PATHS.root, "src", "agent", "prompts", "drawing", "10-drawing.md");

export function svgOf(text: string): string | null {
	const fenced = /```svg\s*\n([\s\S]*?)```/.exec(text)?.[1];
	const bare = /<svg[\s\S]*<\/svg>/.exec(text)?.[0];
	const svg = (fenced ?? bare)?.trim();
	return svg && parseSketch(svg) ? svg : null;
}

export function latestReplyText(messages: readonly AgentMessage[]): string {
	const reply = [...messages].reverse().find((m) => (m as { role?: string }).role === "assistant") as
		| { content?: Array<{ type: string; text?: string }> }
		| undefined;
	return (reply?.content ?? []).flatMap((c) => (c.type === "text" && c.text ? [c.text] : [])).join("\n\n");
}

export const DRAWING_TIMEOUT_MS = 25_000;

export async function drawForReply(opts: {
	engine: PiEngine;
	reply: string;
	brief: string;
	signal?: AbortSignal;
	onUsage?: (usage: Usage) => void;
	chatId?: string;
	timeoutMs?: number;
}): Promise<string | null> {
	if (opts.signal?.aborted) {
		const err = new Error("aborted");
		err.name = "AbortError";
		throw err;
	}
	const timeout = AbortSignal.timeout(opts.timeoutMs ?? DRAWING_TIMEOUT_MS);
	const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
	try {
		const { text } = await runSubagent([], {
			role: "teacher",
			engine: opts.engine,
			systemPrompt: fs.readFileSync(DRAWING_PROMPT, "utf-8"),
			prompt: `The reply:\n\n${opts.reply}\n\nThe brief: ${opts.brief}`,
			maxTurns: 1,
			abortSignal: signal,
			onUsage: opts.onUsage,
			chatId: opts.chatId,
		});
		return svgOf(text);
	} catch (err: any) {
		if (opts.signal?.aborted || (err?.name === "AbortError" && opts.signal?.aborted)) throw err;
		return null;
	}
}
