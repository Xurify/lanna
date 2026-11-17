/**
 * The sent-files rule (src/agent/tools/sent-files.ts): the tutor may read only
 * the PDFs and images the learner sent with the composer's buttons, which live
 * in PATHS.sentFiles. The read tool and the pdf reader are tested in their own
 * files; this one pins the resolver itself.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { PATHS } from "../config.ts";
import { resolveSentFile } from "../src/agent/tools/sent-files.ts";
import { sendCopy, unsend } from "./fixtures/sent-files.ts";

const SENT = "sent-files";
const OUTSIDE = "Only the PDFs and images the learner sends with the composer's buttons can be read.";
const PDF_FIXTURE = path.join(import.meta.dirname, "fixtures", "sample-3page.pdf");
const TEXT_FIXTURE = path.join(import.meta.dirname, "fixtures", "cheatsheet-a.txt");

after(() => unsend(SENT));

describe("resolveSentFile: which paths the tutor may read", () => {
	it("an absolute path inside the sent-files folder resolves to its real path", async () => {
		const sent = sendCopy(PDF_FIXTURE, path.join(SENT, "Course notes", "sample document.pdf"));
		assert.equal(await resolveSentFile(sent), sent);
	});

	it("a relative path resolves inside the sent-files folder", async () => {
		const sent = sendCopy(PDF_FIXTURE, path.join(SENT, "relative.pdf"));
		assert.equal(await resolveSentFile(path.join(SENT, "relative.pdf")), sent);
	});

	it("a name that only starts with two dots stays inside", async () => {
		const sent = sendCopy(PDF_FIXTURE, path.join(SENT, "..notes.pdf"));
		assert.equal(await resolveSentFile(sent), sent);
	});

	it("refuses a file in the repository, outside the sent-files folder", async () => {
		await assert.rejects(() => resolveSentFile(PDF_FIXTURE), { message: OUTSIDE });
	});

	it("refuses a file in the OS temp dir", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-sent-outside-"));
		try {
			const file = path.join(dir, "notes.txt");
			fs.writeFileSync(file, "outside");
			await assert.rejects(() => resolveSentFile(file), { message: OUTSIDE });
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("refuses a relative path that climbs out of the sent-files folder", async () => {
		const climbing = path.relative(PATHS.sentFiles, TEXT_FIXTURE);
		await assert.rejects(() => resolveSentFile(climbing), { message: OUTSIDE });
	});

	it("refuses a symbolic link inside the sent-files folder that points outside it", async (t) => {
		const dir = path.dirname(sendCopy(PDF_FIXTURE, path.join(SENT, "links", "anchor.pdf")));
		const link = path.join(dir, "escape.pdf");
		try {
			fs.symlinkSync(PDF_FIXTURE, link, "file");
		} catch (err) {
			if ((err as { code?: string }).code === "EPERM") return t.skip("creating symlinks needs privileges on this PC");
			throw err;
		}
		try {
			await assert.rejects(() => resolveSentFile(link), { message: OUTSIDE });
		} finally {
			fs.rmSync(link, { force: true });
		}
	});

	it("a missing file throws 'No such file' with the path as given", async () => {
		const missing = path.join(SENT, "nope.pdf");
		await assert.rejects(() => resolveSentFile(missing), { message: `No such file: ${missing}` });
	});
});
