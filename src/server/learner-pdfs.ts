import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS } from "../../config.ts";
import { pdfInfo, pdfProbe } from "../agent/subagents/pdf-ops.ts";

/** Next buffers at most this much of a request (next.config.ts proxyClientMaxBodySize). */
export const LEARNER_PDF_MAX_BYTES = 10 * 1024 * 1024;

export interface SavedLearnerPdf {
	path: string;
	name: string;
	pages: number;
}

export function learnerPdfDir(): string {
	return PATHS.sentFiles;
}

export function learnerPdfFileName(original: string): string {
	const stem = path
		.basename(original)
		.replace(/\.pdf$/i, "")
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "")
		.slice(0, 60);
	return `${stem || "document"}-${randomBytes(3).toString("hex")}.pdf`;
}

export class LearnerPdfError extends Error {}

export async function saveLearnerPdf(bytes: Uint8Array, originalName: string): Promise<SavedLearnerPdf> {
	if (bytes.byteLength === 0) throw new LearnerPdfError("The file is empty.");
	if (bytes.byteLength > LEARNER_PDF_MAX_BYTES) throw new LearnerPdfError("The PDF is larger than 10 MB.");
	if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-")
		throw new LearnerPdfError("That file is not a PDF.");
	const dir = learnerPdfDir();
	await fs.mkdir(dir, { recursive: true });
	const file = path.join(dir, learnerPdfFileName(originalName));
	await fs.writeFile(file, bytes);
	try {
		await pdfProbe(file);
		const info = await pdfInfo(file);
		return { path: file, name: path.basename(originalName) || "document.pdf", pages: info.page_count };
	} catch {
		await fs.rm(file, { force: true });
		throw new LearnerPdfError("The PDF could not be opened.");
	}
}
