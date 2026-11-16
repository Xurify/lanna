/**
 * The auto-title's smart truncation (owner, 2026-10-06): the cut snaps to
 * a word boundary at or under TITLE_MAX_CHARS (72); a single word longer
 * than the cap splits at the cap. Pure seam: titleFromPrompt in
 * core/contracts/graph.ts, applied server-side at chat creation (the one
 * seam — home and both drafts post raw text; the route derives).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TITLE_MAX_CHARS, titleFromPrompt } from "../src/core/title.ts";
import { attachedPdfLine, joinDraft, splitAttachedPdfs, splitDraft } from "../src/core/attached-pdf.ts";

describe("titleFromPrompt (smart truncation)", () => {
	it("short prompts pass through untouched — no ellipsis, whitespace collapsed", () => {
		assert.equal(titleFromPrompt("Relational databases"), "Relational databases");
		assert.equal(titleFromPrompt("line one\nline two\ttabbed"), "line one line two tabbed");
	});

	it("exactly at the cap: unchanged, no ellipsis", () => {
		const exact = "a".repeat(TITLE_MAX_CHARS);
		assert.equal(titleFromPrompt(exact), exact);
	});

	it("over the cap: the cut snaps to the last word boundary under it", () => {
		// > 72 chars total so truncation actually fires.
		const words = ["teach", "me", "the", "relational", "model", "and", "its", "information", "principle", "underlying", "everything", "please"];
		const joined = words.join(" "); // 10 words, > 72 chars
		const out = titleFromPrompt(joined);
		assert.ok(out.endsWith("…"), "marks the truncation");
		assert.ok(!out.slice(0, -1).endsWith(" "), "… attaches directly to the kept word");
		// The kept prefix is a prefix of the original at a word boundary:
		const kept = out.slice(0, -1);
		assert.ok(joined.startsWith(kept));
		assert.ok(kept.length <= TITLE_MAX_CHARS);
		assert.equal(joined[kept.length], " ", "the cut dropped a whole word, never half of one");
	});

	it("boundary landing exactly at the cap is a clean cut (no mid-word split)", () => {
		const first = "b".repeat(TITLE_MAX_CHARS); // fills the cap exactly
		const prompt = `${first} then more words after it`;
		const out = titleFromPrompt(prompt);
		assert.equal(out, `${first}…`);
	});

	it("a single word longer than the cap splits at the cap", () => {
		const giant = "x".repeat(TITLE_MAX_CHARS + 30);
		assert.equal(titleFromPrompt(giant), `${"x".repeat(TITLE_MAX_CHARS)}…`);
	});

	it("the kept title never carries a trailing space", () => {
		const prompt = `${"c".repeat(60)}  ${"d".repeat(60)}`; // collapses to one space
		const out = titleFromPrompt(prompt);
		assert.ok(!out.slice(0, -1).endsWith(" "));
		assert.ok(out.endsWith("…"));
	});
});

describe("a first message that carries a PDF", () => {
	const line = attachedPdfLine({ name: "Lekcia 3 – lokál.pdf", pages: 2, path: "C:/data/profiles/slovak/sources/Lekcia-3-lokal-0a1b2c.pdf" });

	it("is titled by the learner's question, not the file path", () => {
		assert.equal(titleFromPrompt(`${line}\nWhen do I use the locative?`), "When do I use the locative?");
	});

	it("is titled by the file name when the learner wrote nothing else", () => {
		assert.equal(titleFromPrompt(line), "PDF: Lekcia 3 – lokál.pdf");
	});

	it("splits back into the PDF and the learner's words", () => {
		assert.deepEqual(splitAttachedPdfs(`${line}\nWhen do I use the locative?`), {
			pdfs: [{ name: "Lekcia 3 – lokál.pdf", pages: 2, path: "C:/data/profiles/slovak/sources/Lekcia-3-lokal-0a1b2c.pdf" }],
			images: [],
			rest: "When do I use the locative?",
		});
		assert.deepEqual(splitAttachedPdfs("No file here."), { pdfs: [], images: [], rest: "No file here." });
	});
});

describe("the composer's draft with a PDF", () => {
	const pdf = { name: "handout.pdf", pages: 1, path: "/data/sources/handout-0a1b2c.pdf" };

	it("shows only the learner's words in the field and keeps every keystroke, trailing space included", () => {
		const draft = joinDraft([pdf], "When do I ");
		assert.deepEqual(splitDraft(draft), { pdfs: [pdf], images: [], rest: "When do I " });
		assert.equal(joinDraft([], "plain"), "plain");
	});

	it("drops the PDF line when the chip is removed", () => {
		const { pdfs, rest } = splitDraft(joinDraft([pdf], "Question?"));
		assert.equal(joinDraft(pdfs.filter((p) => p !== pdfs[0]), rest), "Question?");
	});
});

describe("a message that carries an image", () => {
	const img = { name: "sign.png", path: "/data/sources/sign-0a1b2c.png" };

	it("is titled by the image name when the learner wrote nothing else", () => {
		assert.equal(titleFromPrompt(`My image "${img.name}": ${img.path}`), "Image: sign.png");
	});

	it("is titled by the learner's question when text is present", () => {
		assert.equal(titleFromPrompt(`My image "${img.name}": ${img.path}\nWhat does this sign mean?`), "What does this sign mean?");
	});

	it("splits and joins draft with image attachments", () => {
		const draft = joinDraft([], "Explain this photo", [img]);
		assert.deepEqual(splitDraft(draft), { pdfs: [], images: [img], rest: "Explain this photo" });
		const { images, rest } = splitDraft(draft);
		assert.equal(joinDraft([], rest, images.filter((i) => i !== images[0])), "Explain this photo");
	});
});
