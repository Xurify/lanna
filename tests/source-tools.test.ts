/**
 * The research and pdf tools (src/agent/tools/sources.ts): each runs its
 * reader in-process and returns the brief as the tool's own result. The
 * readers run on scripted faux engines; search and fetch are stubbed, so
 * nothing touches the network.
 */
import assert from "node:assert/strict";
import * as path from "node:path";
import { after, before, describe, it } from "node:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
	createFauxCore,
	fauxAssistantMessage,
	fauxText,
	fauxToolCall,
	type FauxResponseStep,
} from "@earendil-works/pi-ai";
import type { PdfResult, ResearchResult } from "../src/core/contracts/jobs.ts";
import type { SearchProvider } from "../src/core/search.ts";
import type { PiEngine } from "../src/agent/models.ts";
import { sourceTools, type SourceToolContext } from "../src/agent/tools/sources.ts";
import { createPdfTools } from "../src/agent/subagents/pdf-reader.ts";
import { webTools } from "../src/agent/tools/web.ts";
import { stubSafeFetch } from "./fixtures/stub-safe-fetch.ts";
import { sendCopy, unsend } from "./fixtures/sent-files.ts";

const BRIEF = `## Summary
sigma.js v3 is current.

## Findings
1. **v3 is the latest major.** [sigma.js docs](https://www.sigmajs.org/docs)

## Sources
- sigma.js docs (https://www.sigmajs.org/docs)`;

/** A scripted pi engine (faux provider): the response queue is the model's whole reply sequence. */
function fauxEngine(steps: FauxResponseStep[]): PiEngine {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

/** The researcher's loop: a web_search call, then the final brief. */
function researcherEngine(): PiEngine {
	return fauxEngine([
		fauxAssistantMessage([fauxToolCall("web_search", { query: "sigma.js latest version" }, { id: "ws1" })], {
			stopReason: "toolUse",
		}),
		fauxAssistantMessage([fauxText(BRIEF)]),
	]);
}

/** A pdf-reader that triages, extracts pages 1-2, then briefs. */
function pdfReaderEngine(): PiEngine {
	return fauxEngine([
		fauxAssistantMessage([fauxToolCall("pdf_info", {}, { id: "i1" })], { stopReason: "toolUse" }),
		fauxAssistantMessage([fauxToolCall("pdf_extract", { pages: "1-2" }, { id: "e1" })], { stopReason: "toolUse" }),
		fauxAssistantMessage([fauxText("The integral rule appears on page 1 (p. 1): x dx integrates to x^2/2.")]),
	]);
}

/** A recording stub provider: no network, the queries captured for assertions. */
function stubSearch(): SearchProvider & { queries: string[] } {
	const queries: string[] = [];
	return {
		id: "tavily",
		async search(query: string, count: number) {
			queries.push(`${query} (${count})`);
			return [{ title: "sigma.js", url: "https://www.sigmajs.org/", snippet: "v3 released" }];
		},
		queries,
	};
}

interface Recorded {
	model: string;
	calls: number;
}

function toolsWith(
	engines: { research?: PiEngine; pdf?: PiEngine },
	extra: Partial<SourceToolContext> = {},
): { tools: Record<"research" | "pdf", AgentTool<any>>; recorded: Recorded[] } {
	const recorded: Recorded[] = [];
	const tools = sourceTools({
		chatId: "chat_source_tools",
		engineFor: (reader) => engines[reader],
		recordUsage: (model, usage) => recorded.push({ model, calls: usage.length }),
		...extra,
	});
	return { tools, recorded };
}

async function run(tool: AgentTool<any>, input: unknown): Promise<{ text: string; details: unknown }> {
	const result = await tool.execute("call_source_1", input as never, undefined, undefined);
	const block = result.content[0];
	return { text: block?.type === "text" ? block.text : "", details: result.details };
}

describe("research tool", () => {
	it("runs the researcher in the call and returns its brief and sources as the tool result", async () => {
		const search = stubSearch();
		const engine = researcherEngine();
		const { tools, recorded } = toolsWith({ research: engine }, { search: () => search });

		const { text, details } = await run(tools.research, { question: "which sigma version?" });

		assert.equal(text, BRIEF, "the brief is the tool's own result text");
		const result = details as ResearchResult;
		assert.equal(result.brief, BRIEF);
		assert.equal(result.sources[0]!.url, "https://www.sigmajs.org/docs");
		assert.deepEqual(search.queries, ["sigma.js latest version (5)"], "the search ran on the injected port");
		assert.equal(recorded.length, 1, "one usage record for the reader");
		assert.equal(recorded[0]!.model, `${engine.model.provider}:${engine.model.id}`, "priced under the reader's model");
		assert.ok(recorded[0]!.calls > 0, "the reader's model calls are recorded");
	});

	it("a keyless fetch-only researcher still returns a sourced brief", async () => {
		const url = "https://example.com/supplied-source";
		const brief = `## Summary\nVerified supplied source. [Source](${url})\n\n## Sources\n- Source (${url})`;
		const fetched: string[] = [];
		const restoreSeams = stubSafeFetch((async (source) => {
			fetched.push(String(source));
			return new Response("Synthetic verified source content", { headers: { "content-type": "text/plain" } });
		}) as typeof fetch);
		const { tools } = toolsWith({
			research: fauxEngine([
				fauxAssistantMessage([fauxToolCall("web_fetch", { url }, { id: "keyless-fetch" })], { stopReason: "toolUse" }),
				fauxAssistantMessage([fauxText(brief)]),
			]),
		});
		try {
			const { text, details } = await run(tools.research, { question: `Verify ${url}` });
			assert.deepEqual(fetched, [url]);
			assert.equal(text, brief);
			assert.ok((details as ResearchResult).sources.some((s) => s.url === url));
		} finally {
			restoreSeams();
		}
	});

	it("a failing researcher returns 'Research failed: <reason>.' as its brief, with no sources", async () => {
		const { tools } = toolsWith({
			research: fauxEngine([
				() => {
					throw new Error("model exploded");
				},
			]),
		});
		const { text, details } = await run(tools.research, { question: "hi" });
		assert.equal(text, "Research failed: model exploded.");
		assert.deepEqual((details as ResearchResult).sources, []);
	});

	it("no research model set: the brief says so, and no reader runs", async () => {
		const { tools, recorded } = toolsWith({});
		const { text } = await run(tools.research, { question: "hi" });
		assert.equal(text, "Research failed: no model is set for it (Settings → AI models).");
		assert.deepEqual(recorded, []);
	});

	it("a model whose provider has no key is refused before any model call", async () => {
		const { tools, recorded } = toolsWith(
			{ research: fauxEngine([]) },
			{ cannotRun: () => "No OpenRouter key is set — add one in Settings → API keys" },
		);
		const { text } = await run(tools.research, { question: "hi" });
		assert.equal(text, "Research failed: No OpenRouter key is set — add one in Settings → API keys.");
		assert.deepEqual(recorded, [], "the refused reader records no usage");
	});
});

describe("pdf tool", () => {
	const PDF_FIXTURE = path.join(import.meta.dirname, "fixtures", "sample-3page.pdf");
	const SENT = "source-tools";
	const relativePath = path.join(SENT, "Course notes", "sample document.pdf");
	let sent: string;

	before(() => {
		sent = sendCopy(PDF_FIXTURE, relativePath);
	});

	after(() => unsend(SENT));

	it("reads the PDF in the call and returns the brief with the pages it read and consulted", async () => {
		const engine = pdfReaderEngine();
		const { tools, recorded } = toolsWith({ pdf: engine });

		const { text, details } = await run(tools.pdf, { path: sent, question: "What is the integral of x dx?" });

		const result = details as PdfResult;
		assert.match(text, /integral rule/);
		assert.equal(result.brief, text);
		assert.equal(result.path, sent);
		assert.deepEqual(result.pagesRead, [1, 2], "extracted pages are READ pages");
		assert.deepEqual(result.pagesConsulted, [1, 2]);
		assert.deepEqual(
			recorded.map((r) => r.model),
			[`${engine.model.provider}:${engine.model.id}`],
		);
	});

	it("a relative path resolves inside the sent-files folder to the PDF's real path", async () => {
		const { tools } = toolsWith({ pdf: pdfReaderEngine() });
		const { details } = await run(tools.pdf, { path: relativePath, question: "What is the integral of x dx?" });
		const result = details as PdfResult;
		assert.equal(result.path, sent);
		assert.deepEqual(result.pagesRead, [1, 2]);
	});

	it("a PDF outside the sent-files folder is refused, and no reader runs", async () => {
		const { tools, recorded } = toolsWith({ pdf: pdfReaderEngine() });
		const { text, details } = await run(tools.pdf, { path: PDF_FIXTURE, question: "anything" });
		assert.equal(
			text,
			"PDF failed: Only the PDFs and images the learner sends with the composer's buttons can be read.",
		);
		assert.equal((details as PdfResult).path, PDF_FIXTURE);
		assert.deepEqual(recorded, []);
	});

	it("an unreadable source returns 'PDF failed: …' with no pages read", async () => {
		const badPath = sendCopy(
			path.join(import.meta.dirname, "fixtures", "not-a-pdf.txt"),
			path.join(SENT, "not-a-pdf.txt"),
		);
		const { tools } = toolsWith({ pdf: pdfReaderEngine() });
		const { text, details } = await run(tools.pdf, { path: badPath, question: "anything" });
		assert.match(text, /^PDF failed:/);
		const result = details as PdfResult;
		assert.deepEqual(result.pagesRead, []);
		assert.deepEqual(result.pagesConsulted, []);
	});

	it("no pdf model set: the brief says so, and no reader runs", async () => {
		const { tools, recorded } = toolsWith({});
		const { text, details } = await run(tools.pdf, { path: sent, question: "anything" });
		assert.equal(text, "PDF failed: no model is set for it (Settings → AI models).");
		assert.equal((details as PdfResult).path, sent);
		assert.deepEqual(recorded, []);
	});
});

describe("sub-agent tool sets", () => {
	it("the researcher's tools are the web tools only", () => {
		assert.ok(webTools.web_search, "web_search available");
		assert.ok(webTools.web_fetch, "web_fetch available");
		assert.equal(Object.keys(webTools).length, 2, "ONLY the web tools — no question tools");
	});

	it("the pdf-reader declares exactly the four skill tools", () => {
		const tools = createPdfTools(path.join(import.meta.dirname, "fixtures", "sample-3page.pdf"));
		assert.deepEqual(Object.keys(tools).sort(), ["pdf_extract", "pdf_info", "pdf_render", "pdf_search"]);
	});
});
