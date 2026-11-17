import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { serverExecute, type ImageFileResult } from "../tool-execute.ts";
import { resolveSentFile } from "./sent-files.ts";
import { pdfExtract, pdfInfo } from "../subagents/pdf-ops.ts";

/**
 * The read tool: a file the learner sent with the composer's PDF or Image
 * button (its path is in their message) — never anything else on the disk.
 * Images come back as image content the model sees; a short PDF with real
 * text comes back as text by page; a long or scanned PDF points to the pdf
 * tool. Text output keeps pi's 2000-line / 50KB ceiling with offset/limit.
 */
const MAX_LINES = 2000;

const INLINE_PDF_MAX_PAGES = 10;
const INLINE_PDF_MIN_PAGE_TEXT = 40;
const MAX_BYTES = 50 * 1024;

/** Extension map for v0 (pi sniffs magic bytes; extensions suffice here —
 *  learner files are pasted paths, not adversarial uploads). */
const IMAGE_MIME: Record<string, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".webp": "image/webp",
	".bmp": "image/bmp",
};

const readInput = Type.Object({
	path: Type.String({ minLength: 1, description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Integer({ minimum: 1, description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Integer({ minimum: 1, description: "Maximum number of lines to read" })),
});

function formatSize(bytes: number): string {
	return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;
}

/** Slice + truncate the text body, pi's continuation-notice style. */
function readTextSlice(text: string, offset: number | undefined, limit: number | undefined): string {
	const allLines = text.split("\n");
	const totalLines = allLines.length;
	const startLine = offset ? Math.max(0, offset - 1) : 0;
	if (startLine >= totalLines) {
		throw new Error(`Offset ${offset} is beyond end of file (${totalLines} lines total)`);
	}
	// honor an explicit limit first (never beyond EOF)
	let selected = allLines.slice(startLine, limit !== undefined ? startLine + limit : totalLines);
	// then the 2000-line ceiling
	let truncatedBy: "lines" | "bytes" | null = null;
	if (selected.length > MAX_LINES) {
		selected = selected.slice(0, MAX_LINES);
		truncatedBy = "lines";
	}
	// then the 50KB ceiling
	if (Buffer.byteLength(selected.join("\n"), "utf-8") > MAX_BYTES) {
		while (selected.length > 0 && Buffer.byteLength(selected.join("\n"), "utf-8") > MAX_BYTES) {
			selected.pop();
		}
		truncatedBy = "bytes";
	}
	if (truncatedBy === null) {
		const remaining = totalLines - (startLine + selected.length);
		if (remaining > 0) {
			return `${selected.join("\n")}\n\n[${remaining} more lines in file. Use offset=${startLine + selected.length + 1} to continue.]`;
		}
		return selected.join("\n");
	}
	const endLineDisplay = startLine + selected.length;
	const reason = truncatedBy === "lines" ? `${MAX_LINES} line limit` : `${formatSize(MAX_BYTES)} limit`;
	return `${selected.join("\n")}\n\n[Showing lines ${startLine + 1}-${endLineDisplay} of ${totalLines} (${reason}). Use offset=${endLineDisplay + 1} to continue.]`;
}

export const readTool: AgentTool<typeof readInput> = {
	name: "read",
	label: "read",
	description: `Read a file the learner sent with the PDF or Image button; its path is in their message. Nothing else on their computer can be read. Supports images (jpg, png, gif, webp, bmp), short PDFs and text files. Images are sent as attachments. A PDF of up to ${INLINE_PDF_MAX_PAGES} pages with real text comes back as text marked "--- Page N ---"; a longer or scanned PDF returns a note to use the pdf tool instead. For text files, output is truncated to 2000 lines or 50.0KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
	parameters: readInput,
	execute: serverExecute(
		"read",
		readInput,
		async ({ path: rawPath, offset, limit }): Promise<string | ImageFileResult> => {
			const absolute = await resolveSentFile(rawPath);
			const ext = path.extname(absolute).toLowerCase();
			const mime = IMAGE_MIME[ext];
			if (ext === ".pdf") return readPdf(absolute);
			const buffer = await fs.readFile(absolute); // ENOENT/EACCES → error result the model sees
			if (mime) {
				// NOTE v0: no resize — raw bytes as base64. Learner files are study
				// material (screenshots, figures), not adversarial payloads; a resize
				// step (sharp) can land later if large images prove wasteful.
				return {
					text: `Read image file [${mime}] — ${path.basename(absolute)} (${formatSize(buffer.byteLength)}), attached as an image.`,
					images: [{ data: buffer.toString("base64"), mimeType: mime }],
				};
			}
			const text = buffer.toString("utf-8");
			return readTextSlice(text, offset, limit);
		},
	),
};

async function readPdf(absolute: string): Promise<string> {
	await fs.access(absolute); // ENOENT → error result the model sees
	const info = await pdfInfo(absolute);
	const name = path.basename(absolute);
	const thinPages = info.pages.filter((p) => p.text_length < INLINE_PDF_MIN_PAGE_TEXT).map((p) => p.page);
	if (info.page_count > INLINE_PDF_MAX_PAGES || thinPages.length > 0) {
		const why =
			info.page_count > INLINE_PDF_MAX_PAGES
				? `${info.page_count} pages, too long to read in place`
				: `page${thinPages.length === 1 ? "" : "s"} ${thinPages.join(", ")} ha${thinPages.length === 1 ? "s" : "ve"} little or no text (likely scanned)`;
		return `${name}: ${why}. Call pdf with this path and your question; it can search and render pages.`;
	}
	const text = await pdfExtract(absolute, "all");
	return [
		`${name}: ${info.page_count} page${info.page_count === 1 ? "" : "s"}, text extracted below.`,
		"Cite each claim as (p. N). Copy forms exactly as printed, with diacritics. If accents look broken, call pdf to read the pages by eye.",
		"",
		text,
	].join("\n");
}
