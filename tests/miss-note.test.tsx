import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-miss-note-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

// ESM evaluates static imports before this module's body, so the app modules are imported after the env is set.

const core = await import("../src/core/miss-note.ts");
const { missWordOf, contrastSource } = await import("../src/core/review-miss.ts");
const { ensureMissNote } = await import("../src/server/miss-note.ts");
const { missNoteStore } = await import("../src/store/miss-notes.ts");
const { reviewMiss } = await import("../src/server/review.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { exampleText } = await import("../src/core/review.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { MissWhy } = await import("../components/miss-why.tsx");
type ReviewCard = import("../src/core/review.ts").ReviewCard;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const lexicon = loadLexicon()!;
const entry = (slug: string) => lexicon.bySlug.get(slug)!;
const evidenceOf = (a: string, b: string) => core.missNoteEvidence(entry(a), entry(b));
const AT = new Date("2026-11-11T09:00:00Z");

const RECORDED = {
	zOd: '{"differ": true, "note": "*od* is used for a person as the source (*od mamy*), for distance from a place (*od centra*), and for a starting time (*od rána*, *od pondelka*). *z* is used for coming out of a place or container (*z domu*, *z vrecka*) and for where someone or something is from (*z Bratislavy*).", "cites": ["A1", "A2", "A3", "B1", "B2", "B4"]}',
	istChodit: "{\"differ\": true, \"note\": \"*chodiť* is for habitual or repeated going, like *Chodím do školy* and *Často chodím*, and it also means 'to walk'. *ísť* is for going on a particular occasion, like *Idem do školy* ('I'm going to school').\", \"cites\": [\"A1\", \"A4\", \"B2\", \"B4\"]}",
	lenIba: '{"differ": false, "note": "", "cites": []}',
};

const draft = (note: string, cites: string[]) => ({ differ: true, note, cites });

describe("the evidence", () => {
	it("is the same for either direction of a miss, with sentences that hold only one of the two words", () => {
		const e = evidenceOf("z", "od");
		assert.deepEqual(evidenceOf("od", "z"), e);
		assert.equal(e.key, "od~z");
		for (const [i, w] of e.words.entries()) {
			const other = e.words[1 - i]!;
			assert.ok(w.sentences.length >= core.NOTE_MIN_SENTENCES && w.sentences.length <= core.NOTE_SENTENCES);
			for (const s of w.sentences) assert.ok(!new RegExp(`(^|[^\\p{L}])${other.lemma}([^\\p{L}]|$)`, "iu").test(s.text), `${s.text} holds ${other.lemma}`);
		}
	});

	it("is too thin when one word has no verified sentence, and then nothing is asked", async () => {
		const ahoj = lexicon.entries.find((x) => x.sk === "ahoj")!;
		const dobryDen = lexicon.entries.find((x) => x.sk === "dobrý deň")!;
		assert.equal(core.enoughEvidence(core.missNoteEvidence(ahoj, dobryDen)), false);
		const faux = createFauxCore({ tokenSize: { min: 8, max: 8 } });
		assert.equal(await ensureMissNote(ahoj, dobryDen, { engine: { model: faux.getModel(), streamFn: faux.streamSimple } }), null);
		assert.equal(missNoteStore.get(core.missNoteEvidence(ahoj, dobryDen).key), undefined);
	});
});

describe("the check on a model's note", () => {
	const zOd = evidenceOf("z", "od");

	it("keeps recorded notes whose every Slovak word is in the evidence", () => {
		assert.deepEqual(core.verifyMissNote(core.parseMissNote(RECORDED.zOd)!, zOd), { ok: true });
		assert.deepEqual(core.verifyMissNote(core.parseMissNote(RECORDED.istChodit)!, evidenceOf("ist", "chodit")), { ok: true });
	});

	it("reads 'no clear difference' as a note of its own, not a rejection", () => {
		const record = core.missNoteRecord(evidenceOf("len", "iba"), core.parseMissNote(RECORDED.lenIba), RECORDED.lenIba, { model: "faux", now: AT });
		assert.equal(record.status, "none");
	});

	it("refuses a Slovak word the evidence does not hold", () => {
		const check = core.verifyMissNote(draft("*z* is for out of (*z domu*), *od* is for from a person (*od mamy*), like *zo školy*.", ["A1", "B1"]), zOd);
		assert.deepEqual(check, { ok: false, reason: '"zo" is not in the evidence' });
	});

	it("refuses Slovak text left outside the asterisks", () => {
		const check = core.verifyMissNote(draft("*z* is for out of, as in z domu; *od* is from a person (*od mamy*).", ["A1", "B1"]), zOd);
		assert.equal(check.ok, false);
	});

	it("refuses a grammar category the evidence does not name", () => {
		const check = core.verifyMissNote(draft("*z* takes the genitive (*z domu*), and so does *od* (*od mamy*).", ["A1", "B1"]), zOd);
		assert.deepEqual(check, { ok: false, reason: 'names "genitive", which the evidence does not' });
	});

	it("refuses a note that names only one of the two words", () => {
		assert.deepEqual(core.verifyMissNote(draft("*z* is for coming out of a place (*z domu*).", ["A1", "B1"]), zOd), { ok: false, reason: "does not name od" });
	});

	it("refuses citations that do not exist or leave one word unread", () => {
		const note = "*z* is for out of (*z domu*); *od* is from a person (*od mamy*).";
		assert.deepEqual(core.verifyMissNote(draft(note, ["A1", "B9"]), zOd), { ok: false, reason: "cites B9, which does not exist" });
		assert.equal(core.verifyMissNote(draft(note, ["A1", "A2"]), zOd).ok, false);
	});

	it("refuses a note far over the length asked for", () => {
		const long = `*z* and *od* ${"differ ".repeat(core.NOTE_MAX_WORDS)}`;
		assert.equal(core.verifyMissNote(draft(long, ["A1", "B1"]), zOd).ok, false);
	});

	it("names a two-word dictionary form when the note has it in one span", () => {
		const ahoj = lexicon.entries.find((x) => x.sk === "ahoj")!;
		const dobryDen = lexicon.entries.find((x) => x.sk === "dobrý deň")!;
		const e = core.missNoteEvidence(ahoj, dobryDen);
		assert.deepEqual(core.verifyMissNote(draft("*ahoj* is also bye (*Ahoj, maj sa!*); *dobrý deň* is good day.", ["A1"]), e), { ok: true });
	});
});

describe("the note is written once per pair and kept", () => {
	function scripted(...replies: string[]) {
		const faux = createFauxCore({ tokenSize: { min: 16, max: 16 } });
		faux.setResponses(replies.map((r) => fauxAssistantMessage(r)));
		let calls = 0;
		const streamFn: typeof faux.streamSimple = (...args) => {
			calls++;
			return faux.streamSimple(...args);
		};
		return { engine: { model: faux.getModel(), streamFn }, calls: () => calls };
	}

	it("a note the check and the judge accept is kept, and a second miss asks nothing", async () => {
		const s = scripted(RECORDED.zOd, '{"supported": true, "problem": ""}');
		const note = await ensureMissNote(entry("od"), entry("z"), { engine: s.engine, model: "faux:note", now: AT });
		assert.equal(note?.status, "kept");
		assert.equal(s.calls(), 2, "one call writes, one judges");
		const again = await ensureMissNote(entry("z"), entry("od"), { engine: s.engine, model: "faux:note", now: AT });
		assert.equal(again?.note, note?.note);
		assert.equal(s.calls(), 2);
		assert.equal(missNoteStore.get("od~z")?.raw, RECORDED.zOd, "the reply is kept as it came");
	});

	it("a note the judge does not support is kept as rejected with its reason, written once more on a later miss, then never again", async () => {
		const s = scripted(RECORDED.istChodit, '{"supported": false, "problem": "walk is not shown"}', RECORDED.istChodit, '{"supported": false, "problem": "still not shown"}');
		const note = await ensureMissNote(entry("ist"), entry("chodit"), { engine: s.engine, now: AT });
		assert.equal(note?.status, "rejected");
		assert.equal(note?.reason, "judge: walk is not shown");
		assert.equal(note?.attempts, 1);
		const second = await ensureMissNote(entry("ist"), entry("chodit"), { engine: s.engine, now: AT });
		assert.equal(second?.attempts, 2);
		assert.equal(s.calls(), 4);
		await ensureMissNote(entry("ist"), entry("chodit"), { engine: s.engine, now: AT });
		assert.equal(s.calls(), 4, "two attempts at most");
	});

	it("a rejected note saved before attempts were counted is its first attempt", async () => {
		missNoteStore.put({ key: "od~z", words: ["od", "z"], status: "rejected", reason: "judge: x", raw: "", model: "faux", created: AT.toISOString() });
		const s = scripted(RECORDED.zOd, '{"supported": true, "problem": ""}');
		const rewritten = await ensureMissNote(entry("od"), entry("z"), { engine: s.engine, now: AT });
		assert.equal(rewritten?.status, "kept");
		assert.equal(rewritten?.attempts, 2);
	});

	it("'no clear difference' asks no judge", async () => {
		const s = scripted(RECORDED.lenIba);
		const note = await ensureMissNote(entry("len"), entry("iba"), { engine: s.engine, now: AT });
		assert.equal(note?.status, "none");
		assert.equal(s.calls(), 1);
	});
});

describe("the Review card", () => {
	const NOW = "2026-11-11T10:00:00Z";
	const cardFor = (slug: string, sentence: string): string => {
		const e = entry(slug);
		const example = e.examples.find((x) => exampleText(x) === sentence)!;
		const id = `${slug}#${sentence}`;
		reviewStore.writeCards({ ...reviewStore.readCards(), [id]: { id, slug, lemma: e.sk ?? "", gloss: "", sentence, translation: example.en, answer: example.cloze!.answer, at: example.cloze!.at, state: "new", due: NOW, reps: 0, lapses: 0, createdAt: NOW } as ReviewCard });
		return id;
	};
	const cardAnswer = (id: string) => reviewStore.readCards()[id]!.answer;
	const textOf = (html: string) => html.replace(/<\/p>/g, " ").replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();

	it("shows a kept note in place of the example, labeled as an unchecked AI note", () => {
		const id = cardFor("z", exampleText(entry("z").examples.find((x) => x.cloze && !x.rejected)!));
		const reason = reviewMiss(id, "od")!;
		assert.equal(reason.other?.note, missNoteStore.get("od~z")?.note);
		assert.equal(contrastSource(reason.other!, false), "ai note");
		const html = renderToStaticMarkup(<MissWhy reason={reason} given="od" answer={cardAnswer(id)} />);
		const text = textOf(html);
		assert.ok(text.includes("is used for a person as the source (od mamy)"), text);
		assert.ok(text.includes("AI note from the dictionary's sentences, not checked by a person."), text);
		assert.match(html, /<b class="font-semibold text-ink-2">od mamy<\/b>/);
		assert.match(html, /decoration-miss">od<\/b>/, "the word typed carries the miss color in the note");
		assert.match(html, /decoration-teal">z<\/b>/, "the word needed carries the right color in the note");
	});

	it("shows no note for a pair the model saw no difference in, and is not pending", () => {
		const id = cardFor("iba", "Máme iba čaj.");
		const reason = reviewMiss(id, "len")!;
		assert.equal(reason.other?.note, undefined);
		assert.equal(reason.other?.notePending, undefined);
	});

	it("never asks for a note where a curated rule or the parts of speech already explain the miss", () => {
		const kam = missWordOf({ slug: "kde", lemma: "kde", entry: entry("kde") }, entry("kam"), { typed: "kam", isLemma: true, language: "slovak", noteCanBeWritten: true });
		assert.equal(kam.notePending, undefined);
		const vodny = lexicon.entries.find((x) => x.sk === "vodný")!;
		const water = missWordOf({ slug: "voda", lemma: "voda", entry: entry("voda") }, vodny, { typed: "vodný", isLemma: true, language: "slovak", noteCanBeWritten: true });
		assert.equal(water.notePending, undefined);
		const country = missWordOf({ slug: "krajina", lemma: "krajina", entry: entry("krajina") }, entry("stat-n"), { typed: "štát", isLemma: true, language: "slovak", noteCanBeWritten: true });
		assert.equal(country.notePending, true);
	});

	it("says a note is on its way while it is written", () => {
		const other = missWordOf({ slug: "krajina", lemma: "krajina", entry: entry("krajina") }, entry("stat-n"), { typed: "štát", isLemma: true, language: "slovak", noteCanBeWritten: true });
		const text = textOf(renderToStaticMarkup(<MissWhy reason={{ slip: "other", lemma: "krajina", gloss: "country", inflects: true, other }} given="štát" answer="krajina" />));
		assert.ok(text.includes("Comparing the two words in the dictionary's sentences…"), text);
	});
});
