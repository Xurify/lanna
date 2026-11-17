import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Type, type Static } from "typebox";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";
import type { PdfResult, ResearchResult } from "../../core/contracts/jobs.ts";
import type { SearchProvider } from "../../core/search.ts";
import type { PiEngine } from "../models.ts";
import { runPdfReaderAgent } from "../subagents/pdf-reader.ts";
import { runResearcherAgent } from "../subagents/researcher.ts";

const READER_LIMIT_MS = 5 * 60_000;

export interface SourceToolContext {
	chatId: string;
	engineFor: (reader: "research" | "pdf") => PiEngine | undefined;
	cannotRun?: (engine: PiEngine) => string | null;
	search?: () => SearchProvider | null;
	recordUsage: (model: string, usage: Usage[]) => void;
}

export const researchInputSchema = Type.Object({
	question: Type.String({
		description:
			"The single research question to answer. Make it specific — the researcher sees nothing else of the conversation.",
	}),
	context: Type.Optional(
		Type.String({
			description: "Why you need this — focuses the brief. One or two sentences.",
		}),
	),
});

export const pdfInputSchema = Type.Object({
	path: Type.String({ description: "Path to the learner's PDF (relative or absolute), exactly as they gave it." }),
	question: Type.String({
		description:
			"What you need from the document: the content, explanation or answer to extract. The reader sees nothing else of the conversation.",
	}),
});

export type ResearchInput = Static<typeof researchInputSchema>;
export type PdfInput = Static<typeof pdfInputSchema>;

const RESEARCH_DESCRIPTION =
	"Look something up on the web: a fact you are not certain about, current data, or a niche detail. A researcher searches, reads " +
	"and returns a brief with its sources; you get it as this call's result, usually within a minute. Cite its sources when you use them. " +
	"Never use it for what you know for certain.";
const PDF_DESCRIPTION =
	"Read a learner's PDF that `read` reports as long or scanned: a reader searches, extracts and looks at rendered pages, and returns a " +
	"brief with page citations and practice lines copied exactly from the document. You get it as this call's result.";

function textResult<T>(text: string, details: T): AgentToolResult<T> {
	return { content: [{ type: "text", text }], details };
}

function progress(line: string): AgentToolResult<never> {
	return { content: [{ type: "text", text: line }], details: undefined as never };
}

async function runReader<T>(
	ctx: SourceToolContext,
	reader: "research" | "pdf",
	signal: AbortSignal | undefined,
	failed: (reason: string) => T,
	run: (engine: PiEngine, signal: AbortSignal, onUsage: (usage: Usage) => void) => Promise<T>,
): Promise<T> {
	const engine = ctx.engineFor(reader);
	if (!engine) return failed("no model is set for it (Settings → AI models)");
	const refusal = ctx.cannotRun?.(engine);
	if (refusal) return failed(refusal);
	const controller = new AbortController();
	const stop = () => controller.abort();
	signal?.addEventListener("abort", stop, { once: true });
	const timer = setTimeout(stop, READER_LIMIT_MS);
	const usage: Usage[] = [];
	try {
		return await run(engine, controller.signal, (u) => usage.push(u));
	} catch (err) {
		if (signal?.aborted) throw err;
		return failed(
			controller.signal.aborted ? "it took longer than five minutes" : String((err as Error)?.message ?? err),
		);
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", stop);
		if (usage.length > 0) ctx.recordUsage(`${engine.model.provider}:${engine.model.id}`, usage);
	}
}

function sourcesOf(brief: string, fetched: readonly string[]): ResearchResult["sources"] {
	const sources: ResearchResult["sources"] = [];
	const seen = new Set<string>();
	for (const match of brief.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
		const title = (match[1] ?? "").trim();
		const url = match[2]!;
		if (!title || seen.has(url)) continue;
		seen.add(url);
		sources.push({ title, url });
	}
	if (sources.length === 0) {
		for (const url of fetched) {
			if (seen.has(url)) continue;
			seen.add(url);
			let title = url;
			try {
				title = new URL(url).hostname;
			} catch {
				// not a URL: keep it as written
			}
			sources.push({ title, url });
		}
	}
	return sources.slice(0, 10);
}

export function sourceTools(ctx: SourceToolContext): Record<"research" | "pdf", AgentTool<any>> {
	const research: AgentTool<typeof researchInputSchema, ResearchResult> = {
		name: "research",
		label: "research",
		description: RESEARCH_DESCRIPTION,
		parameters: researchInputSchema,
		execute: async (_toolCallId, input, signal, onUpdate) => {
			const failed = (reason: string): ResearchResult => ({ brief: `Research failed: ${reason}.`, sources: [] });
			const result = await runReader(ctx, "research", signal, failed, async (engine, readerSignal, onUsage) => {
				const prompt = [
					`Research question: ${input.question}`,
					input.context?.trim() ? `Context (what this is needed for): ${input.context}` : null,
					"Produce your final brief in the required format.",
				]
					.filter(Boolean)
					.join("\n\n");
				const fetched: string[] = [];
				const pdfDir = await fs.mkdtemp(path.join(os.tmpdir(), "lanna-research-"));
				try {
					const brief = await runResearcherAgent(prompt, {
						engine,
						search: ctx.search,
						pdfDir,
						abortSignal: readerSignal,
						chatId: ctx.chatId,
						onUsage,
						onToolStart: (toolName, args) => {
							const url = (args as { url?: unknown } | undefined)?.url;
							if (typeof url === "string" && (toolName === "web_fetch" || toolName === "web_fetch_pdf"))
								fetched.push(url);
							onUpdate?.(progress(`Researching: ${toolName}`));
						},
					});
					if (!brief.trim()) return failed("the researcher wrote nothing");
					return { brief: brief.trim(), sources: sourcesOf(brief, fetched) };
				} finally {
					await fs.rm(pdfDir, { recursive: true, force: true });
				}
			});
			return textResult(result.brief, result);
		},
	};
	const pdf: AgentTool<typeof pdfInputSchema, PdfResult> = {
		name: "pdf",
		label: "pdf",
		description: PDF_DESCRIPTION,
		parameters: pdfInputSchema,
		execute: async (_toolCallId, input, signal, onUpdate) => {
			const failed = (reason: string): PdfResult => ({
				path: input.path,
				question: input.question,
				brief: `PDF failed: ${reason}.`,
				pagesRead: [],
				pagesConsulted: [],
			});
			const result = await runReader(ctx, "pdf", signal, failed, (engine, readerSignal, onUsage) =>
				runPdfReaderAgent(
					{ path: input.path, question: input.question },
					{
						engine,
						abortSignal: readerSignal,
						chatId: ctx.chatId,
						onUsage,
						onActivity: (line) => onUpdate?.(progress(line)),
					},
				),
			);
			return textResult(result.brief, result);
		},
	};
	return { research, pdf };
}
