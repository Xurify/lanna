import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-line-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const {
	LINE_MAX_WORDS,
	LINE_MIN_WORDS,
	LINE_NEW_MAX,
	LINE_NEW_MIN,
	lineRow,
	lineSeed,
	pickLine,
	repeatWindowStart,
	scoreLine,
} = await import("../src/core/line.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { resolveWord, STORY_NAMES } = await import("../src/server/reading.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

test("lineSeed: the same language and day give the same seed; another day or language does not", () => {
	assert.equal(lineSeed("slovak", "2026-11-05"), lineSeed("slovak", "2026-11-05"));
	assert.notEqual(lineSeed("slovak", "2026-11-05"), lineSeed("slovak", "2026-11-06"));
	assert.notEqual(lineSeed("slovak", "2026-11-05"), lineSeed("estonian", "2026-11-05"));
});

test("scoreLine: an exact hearing catches every word, and a missing word is the one not caught", () => {
	const sentence = "Pes prejavuje radosť, keď počuje kľúče.";
	const full = scoreLine(sentence, "pes prejavuje radosť keď počuje kľúče");
	assert.equal(full.words, 6);
	assert.equal(full.caught, 6);
	assert.ok(full.marks.every((m) => m.caught && !m.almost));
	const missing = scoreLine(sentence, "pes prejavuje keď počuje kľúče");
	assert.equal(missing.caught, 5);
	assert.deepEqual(
		missing.marks.filter((m) => !m.caught).map((m) => m.word),
		["radosť"],
	);
});

test("scoreLine: a word typed without its accent is marked almost and is not caught; extra words do not count", () => {
	const accent = scoreLine("Je to vína.", "je to vina");
	assert.equal(accent.caught, 2);
	assert.deepEqual(
		accent.marks.map((m) => [m.word, m.caught, m.almost]),
		[
			["je", true, false],
			["to", true, false],
			["vína", false, true],
		],
	);
	const extra = scoreLine("Ahoj.", "ahoj a ešte veľa");
	assert.equal(extra.words, 1);
	assert.equal(extra.caught, 1);
	assert.equal(extra.marks.length, 1);
});

test("scoreLine: a missed word carries what was typed in its place, as typed, and a skipped word carries nothing", () => {
	const { marks } = scoreLine("Lekár sa opatrne dotkol zraneného miesta.", "Lekar sa opýtrnie zhraju miesta");
	assert.deepEqual(
		marks.filter((m) => !m.caught).map((m) => [m.word, m.given]),
		[
			["lekár", "Lekar"],
			["opatrne", "opýtrnie"],
			["dotkol", undefined],
			["zraneného", "zhraju"],
		],
	);
});

test("scoreLine: nothing typed catches nothing, and the words are still counted", () => {
	const none = scoreLine("Pes prejavuje radosť.", "");
	assert.equal(none.words, 3);
	assert.equal(none.caught, 0);
});

test("pickLine: five to twelve words, one or two glossed new words, the same for the same seed, and a recent sentence is skipped", () => {
	const lexicon = loadLexicon()!;
	assert.ok(lexicon, "the Slovak lexicon loads");
	// A learner who knows the commonest words, as the listen tests assume.
	const known = new Set<string>();
	for (const e of lexicon.entries)
		if ((e.rank !== undefined && e.rank <= 800) || e.origin === "curated" || e.cat === "Places") known.add(e.slug);
	const lookup = { resolve: (form: string) => resolveWord(lexicon, form, known), known, names: STORY_NAMES };
	const seed = lineSeed("slovak", "2026-11-05");
	const a = pickLine(lexicon.entries, lookup, { seed });
	assert.ok(a, "the dictionary has a line for a learner at this level");
	assert.deepEqual(pickLine(lexicon.entries, lookup, { seed }), a);
	assert.ok(a.words >= LINE_MIN_WORDS && a.words <= LINE_MAX_WORDS);
	assert.ok(a.newWords.length >= LINE_NEW_MIN && a.newWords.length <= LINE_NEW_MAX);
	assert.ok(a.newWords.every((w) => w.gloss.length > 0));
	assert.ok(a.translation.length > 0);
	const again = pickLine(lexicon.entries, lookup, { seed, recent: new Set([a.id]) });
	assert.ok(again && again.id !== a.id, "a sentence heard recently is not picked again");
});

test("repeatWindowStart: the window is fourteen days ending on the day, inclusive", () => {
	assert.equal(repeatWindowStart("2026-11-05"), "2026-10-23");
	assert.equal(repeatWindowStart("2026-03-01"), "2026-02-16");
});

test("lineRow: says where the day's line stands, in the learner's own counts", () => {
	assert.equal(lineRow({ hasLine: false, morning: null, evening: null, eveningOpen: false }).tone, "none");
	const fresh = lineRow({ hasLine: true, morning: null, evening: null, eveningOpen: false });
	assert.equal(fresh.tone, "idle");
	assert.equal(fresh.pill, "Not heard yet");
	const waiting = lineRow({ hasLine: true, morning: { caught: 3, words: 9 }, evening: null, eveningOpen: false });
	assert.equal(waiting.tone, "idle");
	assert.match(waiting.line, /^First hearing 3 of 9 words\./);
	assert.equal(waiting.pill, "Back later");
	const open = lineRow({ hasLine: true, morning: { caught: 3, words: 9 }, evening: null, eveningOpen: true });
	assert.equal(open.tone, "open");
	assert.equal(open.pill, "Hear it again");
	const both = lineRow({
		hasLine: true,
		morning: { caught: 3, words: 9 },
		evening: { caught: 8, words: 9 },
		eveningOpen: true,
	});
	assert.equal(both.tone, "done");
	assert.equal(both.line, "First hearing 3 of 9 words, second hearing 8 of 9.");
});
