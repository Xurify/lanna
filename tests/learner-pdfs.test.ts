/**
 * PDFs the learner adds from the chat composer: kept under the profile's
 * data/sources/ with a safe file name, refused when they are not PDFs.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { learnerPdfDir, learnerPdfFileName, LEARNER_PDF_MAX_BYTES, saveLearnerPdf } from "../src/server/learner-pdfs.ts";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "sample-3page.pdf");

describe("saving a learner's PDF", () => {
	it("keeps the PDF under data/sources and answers its path, name and page count", async () => {
		const saved = await saveLearnerPdf(new Uint8Array(fs.readFileSync(FIXTURE)), "Lekcia 3 – lokál.pdf");
		assert.equal(saved.name, "Lekcia 3 – lokál.pdf");
		assert.equal(saved.pages, 3);
		assert.equal(path.dirname(saved.path), learnerPdfDir());
		assert.match(path.basename(saved.path), /^Lekcia-3-lokal-[0-9a-f]{6}\.pdf$/);
		assert.ok(fs.existsSync(saved.path));
	});

	it("never lets a name leave the folder", () => {
		assert.match(learnerPdfFileName("../../etc/passwd.pdf"), /^passwd-[0-9a-f]{6}\.pdf$/);
		assert.doesNotMatch(learnerPdfFileName("..\\..\\secret.pdf"), /[\\/]|^\./);
		assert.match(learnerPdfFileName(".pdf"), /^document-[0-9a-f]{6}\.pdf$/);
	});

	it("refuses a file that is not a PDF, an empty one and one over the size cap", async () => {
		await assert.rejects(saveLearnerPdf(new TextEncoder().encode("hello"), "notes.pdf"), /not a PDF/);
		await assert.rejects(saveLearnerPdf(new Uint8Array(0), "empty.pdf"), /empty/);
		await assert.rejects(saveLearnerPdf(new Uint8Array(LEARNER_PDF_MAX_BYTES + 1), "big.pdf"), /larger than 10 MB/);
	});

	it("removes a file that claims to be a PDF but cannot be opened", async () => {
		const before = fs.existsSync(learnerPdfDir()) ? fs.readdirSync(learnerPdfDir()).length : 0;
		await assert.rejects(saveLearnerPdf(new TextEncoder().encode("%PDF-1.4 broken"), "broken.pdf"), /could not be opened/);
		assert.equal(fs.readdirSync(learnerPdfDir()).length, before);
	});
});
