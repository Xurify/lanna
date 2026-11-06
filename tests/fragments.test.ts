/**
 * FRAGMENT PINS (LangHarness, 2026-11-06): the stretches of a video worth
 * watching — how a stretch scores (known-word share, new words that come
 * back, speech all the way through, about two minutes), how the best ones
 * are chosen without overlapping, the strip and the range a learner drags,
 * and preparing only a stretch of a video (one cut kept per video).
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-fragments-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const f = await import("../src/core/fragments.ts");
const core = await import("../src/core/watch.ts");
const watch = await import("../src/server/watch.ts");
const server = await import("../src/server/fragments.ts");
const { videoStore } = await import("../src/store/videos.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

// ─── Pure rules ─────────────────────────────────────────────────────────────

/** A 10-minute video of 120 lines, 5 seconds each, 16 words a line. */
function video(fresh: (i: number) => { fresh: number; u?: string[]; words?: number }): { lines: import("../src/core/fragments.ts").FragmentLine[]; lex: import("../src/core/fragments.ts").FragmentLex } {
	const lines = Array.from({ length: 120 }, (_, i) => {
		const x = fresh(i);
		return { start: i * 5, end: i * 5 + 4.2, words: x.words ?? 16, fresh: x.fresh, ...(x.u ? { u: x.u } : {}) };
	});
	const lex = Object.fromEntries(["káva", "pivo", "chlieb", "mlieko", "dážď"].map((s, i) => [s, { lemma: s, gloss: `gloss of ${s}`, rank: 500 + i * 900 }]));
	return { lines, lex };
}

const SLUGS = ["káva", "pivo", "chlieb", "mlieko"];

test("comprehension: a sliver under 85% that still sorts by nearness, a ramp to 93%, full to 97%, little when nothing is new", () => {
	assert.ok(f.comprehension(0.8) > 0 && f.comprehension(0.8) < 0.05, "too hard keeps a sliver");
	assert.ok(f.comprehension(0.4) < f.comprehension(0.6) && f.comprehension(0.6) < f.comprehension(0.8), "nearer ranks higher");
	assert.equal(f.comprehension(0), 0);
	assert.ok(f.comprehension(0.85) <= 0.05 + 1e-9);
	assert.ok(Math.abs(f.comprehension(0.9) - 0.6) < 1e-9);
	assert.ok(f.comprehension(0.92) > 0.6 && f.comprehension(0.92) < 1);
	assert.equal(f.comprehension(0.95), 1);
	assert.equal(f.comprehension(0.97), 1);
	assert.ok(f.comprehension(0.98) < 1 && f.comprehension(0.98) > 0.2);
	assert.equal(f.comprehension(1), 0.2);
});

test("density and length: music is out, fast speech a little harder, about two minutes best", () => {
	assert.equal(f.density(20), 0);
	assert.ok(f.density(65) > 0 && f.density(65) < 1);
	assert.equal(f.density(150), 1);
	assert.equal(f.density(260), 0.8);
	assert.equal(f.lengthFactor(110), 1);
	assert.ok(f.lengthFactor(50) < f.lengthFactor(100));
	assert.equal(f.lengthFactor(1000), 0.7);
});

test("wordWeight and recurrenceFactor: common words and second meetings count most", () => {
	assert.ok(f.wordWeight(300) > f.wordWeight(3000));
	assert.ok(f.wordWeight(3000) > f.wordWeight(20000));
	assert.ok(f.wordWeight(undefined) < 1);
	assert.equal(f.recurrenceFactor(1), 1);
	assert.ok(f.recurrenceFactor(2) > 1.3);
	assert.equal(f.recurrenceFactor(9), f.recurrenceFactor(4));
});

test("rangeStats: the share, the new words most worth first with their counts, those that come back", () => {
	const v = video((i) => (i >= 10 && i < 20 ? { fresh: 1, u: [SLUGS[i % 4]!] } : { fresh: 4, u: ["dážď"] }));
	const s = f.rangeStats(v.lines, v.lex, 10, 19)!;
	assert.equal(s.words, 160);
	assert.equal(s.fresh, 10);
	assert.ok(Math.abs(s.coverage - 150 / 160) < 1e-9);
	assert.equal(s.start, 50);
	assert.ok(Math.abs(s.end - 99.2) < 1e-9);
	assert.deepEqual(s.newWords.map((w) => [w.slug, w.count]).sort(), [["chlieb", 3], ["káva", 2], ["mlieko", 3], ["pivo", 2]].sort());
	assert.equal(s.recurring, 4);
	assert.equal(s.newWords[0]!.gloss, `gloss of ${s.newWords[0]!.slug}`);
	assert.equal(f.rangeStats(v.lines, v.lex, 5, 2), null);
	assert.equal(f.rangeStats([], {}, 0, 0), null);
});

test("bestFragments: the comfortable stretch with new words that come back wins, away from silence and too-hard speech, with no overlap", () => {
	const v = video((i) => {
		if (i >= 40 && i < 62) return { fresh: 1, u: [SLUGS[i % 4]!] };
		if (i >= 80 && i < 100) return { fresh: 0, words: 0 };
		return { fresh: 5, u: ["dážď"] };
	});
	const picks = f.bestFragments(v.lines, v.lex);
	assert.ok(picks.length >= 1);
	const best = picks[0]!;
	assert.ok(best.from >= 39 && best.to <= 62, `best is lines ${best.from}-${best.to}`);
	assert.ok(best.coverage >= 0.93);
	assert.ok(best.sec >= f.FRAGMENT_MIN_SEC && best.sec <= f.FRAGMENT_MAX_SEC);
	assert.equal(best.band, "Comfortable");
	assert.ok(best.recurring >= 3, "the new words come back inside it");
	for (let i = 0; i < picks.length; i++) {
		assert.ok(picks[i]!.score > 0);
		if (i > 0) assert.ok(picks[i]!.score <= picks[i - 1]!.score, "best first");
		for (let j = i + 1; j < picks.length; j++) assert.ok(picks[i]!.to < picks[j]!.from || picks[j]!.to < picks[i]!.from, "no overlap");
	}
	assert.ok(picks.slice(1).every((p) => p.coverage >= 0.85 || p.score < best.score * 0.1), "a stretch under 85% is only a distant runner-up");
	assert.equal(f.bestFragments(v.lines, v.lex, { max: 1 }).length, 1);
	assert.deepEqual(f.bestFragments([], {}), []);
});

test("bestFragments: a video all too hard offers only its nearest stretches, none in reach; starts and stops sit at pauses when there are pauses", () => {
	const hard = video(() => ({ fresh: 6, u: ["dážď"] }));
	const nearest = f.bestFragments(hard.lines, hard.lex);
	assert.ok(nearest.length > 0, "the nearest are still listed");
	assert.ok(nearest.every((p) => p.coverage < f.IN_REACH && p.band === "Too hard for now" && p.score < 0.1));
	const worse = video((i) => (i < 60 ? { fresh: 6, u: ["dážď"] } : { fresh: 9, u: ["dážď"] }));
	assert.ok(f.bestFragments(worse.lines, worse.lex)[0]!.end <= 300 + 1, "the nearer half comes first");
	// a pause (2 s) after every 10th line, none elsewhere (4.2 s lines 5 s apart leave 0.8 s: a pause too), so shorten the lines
	const gapped = video((i) => (i >= 20 && i < 70 ? { fresh: 1, u: [SLUGS[i % 4]!] } : { fresh: 6, u: ["dážď"] }));
	gapped.lines.forEach((l, i) => {
		l.end = l.start + 4.95;
		if (i % 10 === 9) l.end = l.start + 3;
	});
	const picks = f.bestFragments(gapped.lines, gapped.lex);
	assert.ok(picks.length > 0);
	for (const p of picks) {
		assert.ok(p.from === 0 || p.from % 10 === 0, `starts after a pause: line ${p.from}`);
		assert.ok(p.to === 119 || p.to % 10 === 9, `stops before a pause: line ${p.to}`);
	}
});

test("heatStrip, linesTouching, linesIn: the share along the video, null where nobody speaks; the lines a range touches or holds", () => {
	const v = video((i) => (i < 60 ? { fresh: 0 } : i < 100 ? { fresh: 16 } : { fresh: 0, words: 0 }));
	const strip = f.heatStrip(v.lines, 600, 6);
	assert.deepEqual(strip.map((x) => (x === null ? null : Math.round(x * 100))), [100, 100, 100, 0, 0, null]);
	assert.equal(f.heatStrip(v.lines, 0, 4).every((x) => x === null), true);
	assert.deepEqual(f.linesTouching(v.lines, 12, 31), { from: 2, to: 6 });
	assert.equal(f.linesTouching(v.lines, 4.5, 4.9), null, "the pause between two lines touches none");
	assert.equal(f.linesTouching(v.lines, 1000, 1100), null);
	assert.deepEqual(f.linesIn(v.lines, 10, 30), { from: 2, to: 5 });
});

test("lineFacts: counts words and fresh words, keeps the dictionary ones with their gloss and rank, marks a line that ends a sentence", () => {
	const tok = (text: string, o: Record<string, unknown> = {}) => ({ text, word: true, ...o });
	const { lines, lex } = f.lineFacts(
		[
			{ start: 0, end: 3, sk: "Dnes pijem kávu.", tokens: [tok("Dnes"), tok("pijem"), tok("kávu", { fresh: true, slug: "káva", lemma: "káva", gloss: "coffee" }), { text: ".", word: false }] },
			{ start: 3.5, end: 6, sk: "a potom spím", tokens: [tok("a"), tok("potom"), tok("spím", { fresh: true })] },
		],
		(slug) => (slug === "káva" ? 400 : undefined),
	);
	assert.deepEqual(lines[0], { start: 0, end: 3, words: 3, fresh: 1, u: ["káva"], stop: true });
	assert.deepEqual(lines[1], { start: 3.5, end: 6, words: 3, fresh: 1 }, "a fresh word with no dictionary entry counts but cannot be taught");
	assert.deepEqual(lex, { káva: { lemma: "káva", gloss: "coffee", rank: 400 } });
});

test("lineFacts and rangeStats: a word the level only assumes is new to the learner but not beyond the level; expected counts it, coverage does not", () => {
	const tok = (text: string, o: Record<string, unknown> = {}) => ({ text, word: true, ...o });
	const { lines, lex } = f.lineFacts([
		{ start: 0, end: 4, sk: "Ja pijem pivo a kávu", tokens: [tok("Ja"), tok("pijem", { assumed: true, slug: "piť", lemma: "piť", gloss: "to drink" }), tok("pivo", { assumed: true, slug: "pivo", lemma: "pivo", gloss: "beer" }), tok("a"), tok("kávu", { fresh: true, slug: "káva", lemma: "káva", gloss: "coffee" })] },
	]);
	assert.equal(lines[0]!.fresh, 3, "assumed and fresh are both new to the learner");
	assert.equal(lines[0]!.beyond, 1, "only the fresh one is beyond the level");
	assert.deepEqual(lines[0]!.u, ["piť", "pivo", "káva"], "an assumed word can be taught");
	assert.deepEqual(Object.keys(lex).sort(), ["káva", "pivo", "piť"].sort());
	const s = f.rangeStats(lines, lex, 0, 0)!;
	assert.ok(Math.abs(s.coverage - 2 / 5) < 1e-9);
	assert.ok(Math.abs(s.expected - 4 / 5) < 1e-9);
	const plain = f.rangeStats([{ start: 0, end: 4, words: 10, fresh: 2 }], {}, 0, 0)!;
	assert.equal(plain.expected, plain.coverage, "with no `beyond` the two shares are the same");
});

// ─── What the level expects ─────────────────────────────────────────────────

test("knownWords: Watch's expected set is the level's honest vocabulary (about 600 words at A1), not the 2,000 the written-text tolerance reaches", async () => {
	const { knownWords, commonestWords, glossSentence } = await import("../src/server/reading.ts");
	const { loadLexicon } = await import("../src/agent/lexicon.ts");
	const lexicon = loadLexicon();
	assert.ok(lexicon, "the Slovak lexicon loads");
	const a1 = knownWords(lexicon, "A1");
	assert.ok(a1.expected.size >= 600 && a1.expected.size <= 800, `expected holds ${a1.expected.size} words`);
	assert.ok(a1.known.size > 1900, "the tolerance for written texts is unchanged");
	assert.ok(knownWords(lexicon, "A2").expected.size > a1.expected.size * 1.7, "each level roughly doubles");
	const cats = new Set(commonestWords(lexicon!, 600).map((s) => lexicon!.bySlug.get(s)!.cat));
	for (const c of ["Verbs", "Nouns", "Adjectives", "Adverbs"]) assert.ok(cats.has(c), `${c} are among the commonest 600`);
	assert.equal(commonestWords(lexicon!, 600).length, 600);
	// A word the level expects but the learner has not studied is assumed; a studied one is not.
	const entry = [...a1.expected].map((s) => lexicon!.bySlug.get(s)!).find((e) => e.cat === "Verbs" && !a1.met.has(e.slug))!;
	const lemma = (entry.sk ?? "").split(" ")[0]!;
	const plain = glossSentence(lemma, "", lexicon, a1.expected, [], undefined, a1.met).tokens.find((t) => t.word)!;
	assert.equal(plain.assumed, true);
	assert.ok(!plain.fresh);
	const studied = glossSentence(lemma, "", lexicon, a1.expected, [], undefined, new Set([...a1.met, entry.slug])).tokens.find((t) => t.word)!;
	assert.ok(!studied.assumed && !studied.fresh);
});

// ─── Analysing a video, and preparing a stretch of it ───────────────────────

const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, "fixtures", "captions-sk.json3"), "utf-8");
const cues = core.parseJson3(FIXTURE);
const fixtureLines = core.segmentCues(cues);

const captions = (lang = "sk") => async (id: string) => ({
	meta: { id, title: "Bratislava za jeden deň", channel: "Zuzana vlogs", durationSec: 58 },
	cues,
	source: { kind: "auto-captions" as const, trackLang: lang, via: "test" as const },
	raw: { ext: "json" as const, text: FIXTURE },
});

function engineFor(n: number) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses([fauxAssistantMessage(JSON.stringify({ t: Array.from({ length: n }, (_, i) => `English ${i + 1}`) }))]);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

describe("a video's fragments", () => {
	test("analyzeFragments: the facts of every line, the best stretches, the lines kept so the next look needs no YouTube", async () => {
		const a = await server.analyzeFragments("FRAGMENT001", { captions: captions() });
		assert.equal(a.lines.length, fixtureLines.length);
		assert.equal(a.measurable, true);
		assert.equal(a.title, "Bratislava za jeden deň");
		assert.ok(a.lines.every((l) => l.words > 0 && l.fresh <= l.words));
		assert.ok(a.coverage >= 0 && a.coverage <= 1);
		assert.ok(fs.existsSync(path.join(TMP_DATA, "profiles", "slovak", "videos", "discover", "lines", "FRAGMENT001.json")));
		const again = await server.analyzeFragments("FRAGMENT001", {});
		assert.deepEqual(again.lines, a.lines, "the second look reads the kept lines");
		await assert.rejects(server.analyzeFragments("not a video", {}), /not a YouTube video/);
	});

	test("captions in another language are not measured against the language's words", async () => {
		const a = await server.analyzeFragments("FRAGMENT002", { captions: captions("cs") });
		assert.equal(a.measurable, false);
		assert.deepEqual(a.picks, []);
		assert.ok(a.lines.every((l) => l.fresh === 0 && l.u === undefined));
		assert.match(a.message ?? "", /Pick a stretch by ear/);
	});

	test("prepareVideo with a range translates only that stretch and keeps one cut per video", async () => {
		const url = "https://youtu.be/FRAGMENT003";
		const a = fixtureLines[4]!;
		const b = fixtureLines[11]!;
		const inRange = fixtureLines.filter((l) => l.start >= a.start - 0.5 && l.end <= b.end + 0.5);
		const range = { startSec: a.start, endSec: b.end };
		const rec = await watch.prepareVideo(url, { engine: engineFor(inRange.length), model: "faux:f", captions: captions(), questions: false, range, now: new Date("2026-11-06T10:00:00Z") });
		assert.equal(rec.segments.length, inRange.length);
		assert.equal(rec.segments[0]!.start, a.start);
		assert.equal(rec.segments[0]!.i, 0);
		assert.equal(rec.segments[rec.segments.length - 1]!.end, b.end);
		assert.deepEqual(rec.fragment, { startSec: a.start, endSec: b.end, ofSec: 58 });
		assert.equal(rec.durationSec, Math.ceil(b.end - a.start), "the record's length is the stretch's");
		assert.equal(core.watchMinutes(rec.durationSec) <= 4, true);
		assert.deepEqual(videoStore.list().find((e) => e.id === "FRAGMENT003")?.fragment, rec.fragment);

		const same = await watch.prepareVideo(url, { captions: captions(), range: { startSec: a.start + 0.4, endSec: b.end - 0.4 } });
		assert.equal(same.createdAt, rec.createdAt, "the same stretch is kept, nothing is translated again");
		assert.equal((await server.analyzeFragments("FRAGMENT003", {})).prepared !== undefined, true);

		const c = fixtureLines[12]!;
		const d = fixtureLines[19]!;
		const next = fixtureLines.filter((l) => l.start >= c.start - 0.5 && l.end <= d.end + 0.5);
		const other = await watch.prepareVideo(url, { engine: engineFor(next.length), model: "faux:f", captions: captions(), questions: false, range: { startSec: c.start, endSec: d.end } });
		assert.equal(other.segments.length, next.length);
		assert.equal(videoStore.get("FRAGMENT003")!.fragment!.startSec, c.start, "a different stretch replaces the kept one");

		const whole = await watch.prepareVideo(url, { engine: engineFor(fixtureLines.length), model: "faux:f", captions: captions(), questions: false });
		assert.equal(whole.fragment, undefined);
		assert.equal(whole.segments.length, fixtureLines.length);
		assert.equal(videoStore.list().filter((e) => e.id === "FRAGMENT003").length, 1);
	});

	test("a range outside what a fragment may be, or with no speech in it, is refused", async () => {
		const url = "https://youtu.be/FRAGMENT004";
		await assert.rejects(watch.prepareVideo(url, { captions: captions(), range: { startSec: 5, endSec: 15 } }), /A fragment is between/);
		await assert.rejects(watch.prepareVideo(url, { captions: captions(), range: { startSec: 0, endSec: f.FRAGMENT_PICK_MAX_SEC + 60 } }), /A fragment is between/);
		await assert.rejects(watch.prepareVideo(url, { captions: captions(), range: { startSec: Number.NaN, endSec: 60 } }), /A fragment is between/);
		await assert.rejects(watch.prepareVideo(url, { engine: engineFor(1), captions: captions(), range: { startSec: 500, endSec: 540 } }), /no speech in that stretch/);
		assert.equal(videoStore.get("FRAGMENT004"), null);
	});
});
