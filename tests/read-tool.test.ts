/**
 * The read tool (sources v0) — a Node port of pi's read semantics:
 * truncation with continuation offsets, image mime detection, error paths.
 * Driven through the NATIVE AgentTool execute (Wave A, 2026-09-26): text
 * reads return the raw string as details (the record's tool part output
 * reads it); image reads return native pi content parts (text + image)
 * with null details (the output-less part until the record persists).
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { readTool } from "../src/agent/tools/read.ts";
import { PATHS } from "../config.ts";

const tmp = path.join(PATHS.sentFiles, "read-tool");
fs.mkdirSync(tmp, { recursive: true });
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const OUTSIDE = "Only the PDFs and images the learner sends with the composer's buttons can be read.";
const TEXT_FIXTURE = path.join(import.meta.dirname, "fixtures", "cheatsheet-a.txt");

function write(name: string, content: string): string {
	const file = path.join(tmp, name);
	fs.writeFileSync(file, content, "utf-8");
	return file;
}

/** Native execute → the raw string body (text reads ride details verbatim). */
const run = (args: { path: string; offset?: number; limit?: number }) =>
	readTool.execute!("test", args).then((r) => {
		assert.ok(r.content.length >= 1);
		const first = r.content[0]!;
		assert.equal(first.type, "text");
		return { text: (first as { type: "text"; text: string }).text, details: r.details };
	});

describe("read tool — text semantics", () => {
	it("reads a small file verbatim", async () => {
		const file = write("small.txt", "hello\nworld");
		const { text, details } = await run({ path: file });
		assert.equal(text, "hello\nworld");
		assert.equal(details, "hello\nworld", "the record part output carries the string verbatim");
	});

	it("resolves a relative path inside the sent-files folder", async () => {
		write("relative.txt", "rel");
		assert.equal((await run({ path: path.join("read-tool", "relative.txt") })).text, "rel");
	});

	it("honors offset (1-indexed) and limit", async () => {
		const body = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n");
		const file = write("thirty.txt", body);
		const out = (await run({ path: file, offset: 10, limit: 3 })).text;
		// pi parity: the explicit limit stopping short gets a remaining notice
		assert.match(out, /^line 10\nline 11\nline 12\n\n\[18 more lines in file\. Use offset=13 to continue\.\]$/);
	});

	it("offset beyond EOF is an error the model sees", async () => {
		const file = write("tiny.txt", "one");
		await assert.rejects(() => run({ path: file, offset: 99 }), /beyond end of file/);
	});

	it("a missing file throws (pi's error-result semantics)", async () => {
		await assert.rejects(() => run({ path: path.join(tmp, "nope.txt") }), /No such file: .*nope\.txt$/);
	});

	it("truncates at 2000 lines with a use-offset continuation notice", async () => {
		const body = Array.from({ length: 3000 }, (_, i) => `l${i + 1}`).join("\n");
		const file = write("big.txt", body);
		const out = (await run({ path: file })).text;
		assert.match(out, /Showing lines 1-2000 of 3000 \(2000 line limit\)/);
		assert.match(out, /Use offset=2001 to continue/);
		assert.ok(!out.includes("l2001\n"), "line 2001 must not ride along");
	});

	it("truncates at 50KB with the same continuation notice", async () => {
		// 200 lines of ~400B = ~80KB total, under the line cap — byte cap fires
		const line = "x".repeat(400);
		const body = Array.from({ length: 200 }, () => line).join("\n");
		const file = write("wide.txt", body);
		const out = (await run({ path: file })).text;
		assert.match(out, /50\.0KB limit\)\. Use offset=\d+ to continue\./);
		// and the truncation actually cut content
		assert.ok(out.length < 52_000, "the 50KB ceiling must cut the 80KB body");
	});

	it("an explicit limit that stops short gets a remaining-lines notice", async () => {
		const body = Array.from({ length: 10 }, (_, i) => `l${i + 1}`).join("\n");
		const file = write("ten.txt", body);
		const out = (await run({ path: file, limit: 4 })).text;
		assert.match(out, /\[6 more lines in file\. Use offset=5 to continue\.\]/);
	});
});

describe("read tool — image semantics (native content parts)", () => {
	it("returns native text + image parts for image files, details null (output-less part)", async () => {
		const file = path.join(tmp, "dot.png");
		// minimal valid PNG header bytes are enough — detection is by extension
		fs.writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
		const result = await readTool.execute!("test", { path: file });
		assert.equal(result.content.length, 2);
		const parts = result.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		const textPart = parts[0]!;
		const imagePart = parts[1]!;
		assert.equal(textPart.type, "text");
		assert.match(textPart.text!, /Read image file \[image\/png\]/);
		assert.equal(imagePart.type, "image");
		assert.equal(imagePart.mimeType, "image/png");
		assert.match(imagePart.data!, /^[A-Za-z0-9+/]+={0,2}$/);
		assert.equal(result.details, null, "image reads keep the record part output-less");
	});

	it("plain string results map to a single text part (parity)", async () => {
		const file = write("plain.txt", "body");
		const result = await readTool.execute!("test", { path: file });
		assert.equal(result.content.length, 1);
		assert.equal(result.content[0]!.type, "text");
		assert.equal((result.content[0] as { type: "text"; text: string }).text, "body");
	});
});

/** A minimal text PDF, one string per page ("" = a page with no text, as a scan has). */
function writePdf(name: string, pages: string[]): string {
	const objects: string[] = [];
	const pageIds = pages.map((_, i) => 4 + i * 2);
	objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
	objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
	objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
	pages.forEach((text, i) => {
		const stream = text ? `BT /F1 12 Tf 72 720 Td (${text}) Tj ET` : "";
		objects[pageIds[i]!] =
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i]! + 1} 0 R >>`;
		objects[pageIds[i]! + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
	});
	let body = "%PDF-1.4\n";
	const offsets: number[] = [];
	for (let id = 1; id < objects.length; id++) {
		offsets[id] = body.length;
		body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
	}
	const xref = body.length;
	body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
	for (let id = 1; id < objects.length; id++) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
	body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	const file = path.join(tmp, name);
	fs.writeFileSync(file, body, "latin1");
	return file;
}

const LINE = "The locative follows the prepositions v and na, as in the examples below.";

describe("read tool — PDFs", () => {
	it("reads a short text PDF in place, marked by page", async () => {
		const file = writePdf("handout.pdf", [LINE, `${LINE} Page two.`]);
		const { text } = await run({ path: file });
		assert.match(text, /handout\.pdf: 2 pages, text extracted below\./);
		assert.match(text, /--- Page 1 ---\nThe locative follows/);
		assert.match(text, /--- Page 2 ---/);
		assert.match(text, /\(p\. N\)/, "tells the tutor how to cite");
	});

	it("sends a long PDF to the pdf tool instead of dumping it", async () => {
		const file = writePdf(
			"book.pdf",
			Array.from({ length: 11 }, () => LINE),
		);
		const { text } = await run({ path: file });
		assert.match(text, /11 pages, too long to read in place\. Call pdf with this path/);
		assert.doesNotMatch(text, /--- Page/);
	});

	it("sends a PDF with a textless (scanned) page to the pdf tool", async () => {
		const file = writePdf("scan.pdf", [LINE, ""]);
		const { text } = await run({ path: file });
		assert.match(text, /page 2 has little or no text \(likely scanned\)\. Call pdf with this path/);
	});
});

describe("read tool — only the learner's sent files", () => {
	it("refuses a file in the OS temp dir, which is outside the sent-files folder", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-read-outside-"));
		try {
			const file = path.join(dir, "notes.txt");
			fs.writeFileSync(file, "outside");
			await assert.rejects(() => run({ path: file }), { message: OUTSIDE });
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("refuses a fixture in the repository", async () => {
		await assert.rejects(() => run({ path: TEXT_FIXTURE }), { message: OUTSIDE });
	});

	it("refuses a relative path that climbs out of the sent-files folder", async () => {
		await assert.rejects(() => run({ path: path.relative(PATHS.sentFiles, TEXT_FIXTURE) }), { message: OUTSIDE });
	});
});
