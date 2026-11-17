/**
 * The pdf-reader sub-agent (sources v0) — the hand-rolled loop on a faux
 * engine: triage→extract→brief flow, the unread-finish doctrine gate, the
 * render path via the renderer fake, and the unreadable-source failure.
 * The pdfjs layer itself is covered by pdf-ops.test.ts against the fixture.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, describe, it } from "node:test";
import {
	createFauxCore,
	fauxAssistantMessage,
	fauxText,
	fauxToolCall,
	type FauxResponseStep,
} from "@earendil-works/pi-ai";
import type { PiEngine } from "../src/agent/models.ts";
import { runPdfReaderAgent } from "../src/agent/subagents/pdf-reader.ts";
import type { PdfPageRenderer } from "../src/agent/subagents/pdf-pages.ts";
import { sendCopy, unsend } from "./fixtures/sent-files.ts";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "sample-3page.pdf");
const NOT_A_PDF = path.join(import.meta.dirname, "fixtures", "not-a-pdf.txt");
const SENT = "pdf-reader";
const OUTSIDE = "Only the PDFs and images the learner sends with the composer's buttons can be read.";

function fauxEngine(steps: FauxResponseStep[]): PiEngine {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

/** Runs the reader on a path it must refuse, counting any model call. */
async function refused(input: string) {
	let modelCalls = 0;
	const engine = fauxEngine([]);
	engine.streamFn = () => {
		modelCalls++;
		throw new Error("the model must not be called");
	};
	const result = await runPdfReaderAgent({ path: input, question: "anything" }, { engine });
	return { result, modelCalls };
}

const PNG_1PX = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
	0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
	0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00,
	0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function fakeRenderer(
	rendered: { pages: number[] } = { pages: [] },
): PdfPageRenderer & { calls: string[]; paths: string[] } {
	const calls: string[] = [];
	const paths: string[] = [];
	return {
		calls,
		paths,
		renderPdfPages: async (pdfPath, pages) => {
			paths.push(pdfPath);
			calls.push(`render:${pages.join(",")}`);
			rendered.pages.push(...pages);
			return pages.map((page) => ({ page, png: PNG_1PX }));
		},
	};
}

describe("pdf-reader source paths", () => {
	const relativePath = path.join(SENT, "Course notes", "sample document.pdf");
	let absolutePath: string;

	before(() => {
		absolutePath = sendCopy(FIXTURE, relativePath);
	});

	after(() => unsend(SENT));

	for (const kind of ["absolute", "relative"] as const) {
		it(`${kind} path to a sent PDF reaches text tools and rendering as the same absolute path`, async () => {
			const inputPath = kind === "absolute" ? absolutePath : relativePath;
			const renderer = fakeRenderer();
			const engine = fauxEngine([
				fauxAssistantMessage([fauxToolCall("pdf_info", {}, { id: "i1" })], { stopReason: "toolUse" }),
				fauxAssistantMessage([fauxToolCall("pdf_search", { query: "integral", literal: true }, { id: "s1" })], {
					stopReason: "toolUse",
				}),
				fauxAssistantMessage([fauxToolCall("pdf_extract", { pages: "2" }, { id: "e1" })], { stopReason: "toolUse" }),
				fauxAssistantMessage([fauxToolCall("pdf_render", { pages: "3" }, { id: "r1" })], { stopReason: "toolUse" }),
				fauxAssistantMessage([fauxText("Read the requested document (p. 1, p. 2, p. 3).")]),
			]);
			let lastContext = "";
			const stream = engine.streamFn;
			engine.streamFn = (...args) => {
				lastContext = JSON.stringify(args[1]);
				return stream(...args);
			};
			const result = await runPdfReaderAgent(
				{ path: inputPath, question: "Read the document" },
				{ engine, pdfPages: renderer },
			);
			assert.equal(result.path, absolutePath);
			assert.match(result.brief, /^Read the requested document/);
			assert.match(lastContext, /Pages: 3/, "metadata opened the sent PDF");
			assert.deepEqual(result.pagesRead, [2, 3]);
			assert.deepEqual(result.pagesConsulted, [1, 2, 3], "search and extraction opened the sent PDF");
			assert.deepEqual(renderer.paths, [absolutePath]);
		});
	}

	it("a PDF outside the sent-files folder is refused before any model call", async () => {
		const { result, modelCalls } = await refused(FIXTURE);
		assert.equal(result.path, FIXTURE);
		assert.equal(result.brief, `PDF failed: ${OUTSIDE}`);
		assert.equal(modelCalls, 0);
		assert.deepEqual(result.pagesRead, []);
		assert.deepEqual(result.pagesConsulted, []);
	});

	it("a PDF in the OS temp dir is refused the same way", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-pdf-outside-"));
		try {
			const file = path.join(dir, "sample document.pdf");
			fs.copyFileSync(FIXTURE, file);
			const { result, modelCalls } = await refused(file);
			assert.equal(result.brief, `PDF failed: ${OUTSIDE}`);
			assert.equal(modelCalls, 0);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("a symbolic link in the sent-files folder that points outside is refused before any model call", async (t) => {
		const link = path.join(path.dirname(absolutePath), "escape.pdf");
		try {
			fs.symlinkSync(FIXTURE, link, "file");
		} catch (err) {
			if ((err as { code?: string }).code === "EPERM") return t.skip("creating symlinks needs privileges on this PC");
			throw err;
		}
		try {
			const { result, modelCalls } = await refused(link);
			assert.equal(result.brief, `PDF failed: ${OUTSIDE}`);
			assert.equal(modelCalls, 0);
		} finally {
			fs.rmSync(link, { force: true });
		}
	});

	it("a missing sent file fails before any model call", async () => {
		const missing = path.join(SENT, "Course notes", "missing.pdf");
		const { result, modelCalls } = await refused(missing);
		assert.equal(result.path, missing);
		assert.equal(result.brief, `PDF failed: No such file: ${missing}`);
		assert.equal(modelCalls, 0);
		assert.deepEqual(result.pagesRead, []);
		assert.deepEqual(result.pagesConsulted, []);
	});
});

describe("pdf-reader loop (faux engine)", () => {
	let sent: string;

	before(() => {
		sent = sendCopy(FIXTURE, path.join(SENT, "loop", "sample-3page.pdf"));
	});

	after(() => unsend(SENT));

	it("triage → extract → final brief: pagesConsulted tracks the extract", async () => {
		const engine = fauxEngine([
			fauxAssistantMessage([fauxToolCall("pdf_info", {}, { id: "i1" })], { stopReason: "toolUse" }),
			fauxAssistantMessage([fauxToolCall("pdf_extract", { pages: "1-2" }, { id: "e1" })], { stopReason: "toolUse" }),
			fauxAssistantMessage([fauxText("The integral rule appears on page 1 (p. 1). Pages consulted: 1, 2")]),
		]);
		const result = await runPdfReaderAgent({ path: sent, question: "what is the integral of x?" }, { engine });
		assert.equal(result.path, sent);
		assert.match(result.brief, /integral rule/);
		assert.deepEqual(result.pagesRead, [1, 2], "extracted pages are read pages");
		assert.deepEqual(result.pagesConsulted, [1, 2]);
	});

	it("the unread-finish gate: a brief with zero consultation is bounced, not delivered", async () => {
		let nudged = false;
		const engine = fauxEngine([
			// first finish attempt with NOTHING read — the loop must inject the
			// nudge and keep going rather than deliver invention
			fauxAssistantMessage([fauxText("The answer is 42, trust me.")]),
			// after the nudge: consult, then brief honestly
			fauxAssistantMessage([fauxToolCall("pdf_search", { query: "integral", literal: false }, { id: "s1" })], {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage([fauxText("Found it on page 1 (p. 1): the integral of x dx.")]),
		]);
		const result = await runPdfReaderAgent(
			{ path: sent, question: "integral of x?" },
			{ engine, onActivity: (line) => void (line && (nudged ||= line.startsWith("pdf_search"))) },
		);
		assert.match(result.brief, /Found it on page 1/);
		assert.deepEqual(result.pagesRead, [], "search hits consult but do not read (the split)");
		assert.deepEqual(result.pagesConsulted, [1]);
		// and the gate lets it through: search hits ARE genuine consultation
		// the first (invention) answer must NOT be the delivered brief
		assert.notEqual(result.brief, "The answer is 42, trust me.");
	});

	it("the render path: images ride a user message after tool results; pages counted", async () => {
		const renderer = fakeRenderer();
		const engine = fauxEngine([
			fauxAssistantMessage([fauxToolCall("pdf_render", { pages: "2-3", dpi: 150 }, { id: "r1" })], {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage([fauxText("The physics formula is visible on page 2 (p. 2).")]),
		]);
		const result = await runPdfReaderAgent(
			{ path: sent, question: "what is the force formula?" },
			{ engine, pdfPages: renderer },
		);
		assert.deepEqual(result.pagesRead, [2, 3], "rendered pages are read pages");
		assert.deepEqual(result.pagesConsulted, [2, 3]);
		assert.deepEqual(renderer.calls, ["render:2,3"]);
	});

	it("a failed render degrades to an error note, text tools still work", async () => {
		const engine = fauxEngine([
			fauxAssistantMessage([fauxToolCall("pdf_render", { pages: "1", dpi: 150 }, { id: "r1" })], {
				stopReason: "toolUse",
			}),
			// the reader adapts after the error: extract instead, then brief
			fauxAssistantMessage([fauxToolCall("pdf_extract", { pages: "1" }, { id: "e1" })], {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage([fauxText("Extracted instead: the calculus line (p. 1).")]),
		]);
		const result = await runPdfReaderAgent(
			{ path: sent, question: "page 1 content?" },
			{
				engine,
				pdfPages: {
					renderPdfPages: async () => {
						throw new Error("render failed");
					},
				},
			},
		);
		assert.match(result.brief, /Extracted instead/);
		assert.deepEqual(result.pagesRead, [1]);
		assert.deepEqual(result.pagesConsulted, [1]);
	});

	it("an unreadable sent file fails deterministically before any model call", async () => {
		const unreadable = sendCopy(NOT_A_PDF, path.join(SENT, "loop", "not-a-pdf.txt"));
		const engine = fauxEngine([fauxAssistantMessage([fauxText("never reached")])]);
		const result = await runPdfReaderAgent({ path: unreadable, question: "anything" }, { engine });
		// had the model been consulted, the brief would be its text instead
		assert.match(result.brief, /^PDF failed:/);
		assert.ok(!result.brief.includes(OUTSIDE), "the file is sent, so the failure is the parse, not the refusal");
		assert.ok(!result.brief.includes("never reached"));
		assert.deepEqual(result.pagesRead, []);
		assert.deepEqual(result.pagesConsulted, []);
	});
});
