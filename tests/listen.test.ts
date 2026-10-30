/**
 * LISTEN + FOUR STRANDS PINS (LangHarness, 2026-10-28): the input task's
 * sentence picker (95–98% known words, one stretch word, three meanings),
 * the strand balance under the daily plan, and the server round trip
 * (the day's listening, XP, the stretch words into the deck, the log).
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-listen-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const { judgeSentence, LISTEN_COUNT, LISTEN_FLOOR, listenXp, meaningOptions, pickListen, sessionCoverage, STRETCH_MAX, understood } = await import("../src/core/listen.ts");
const { strandAdvice, strandBalance, STRANDS } = await import("../src/core/strands.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { knownWords, resolveWord } = await import("../src/server/reading.ts");
const { listenFor, recordListen } = await import("../src/server/listen.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const lexicon = loadLexicon()!;
assert.ok(lexicon, "the Slovak lexicon loads");

/** A learner who knows the 800 commonest words of each kind. */
function lookup(bound = 800) {
	const known = new Set<string>();
	for (const e of lexicon.entries) if ((e.rank !== undefined && e.rank <= bound) || e.origin === "curated" || e.cat === "Places") known.add(e.slug);
	return { resolve: (form: string) => resolveWord(lexicon, form, known), known };
}

test("judgeSentence: known words, names and grammar words count as known; the rest are stretch words with a gloss", () => {
	const l = lookup();
	const j = judgeSentence("Robo ide do školy.", l);
	assert.ok(j.words >= 3);
	assert.ok(j.coverage > 0.5, `coverage ${j.coverage}`);
	for (const w of j.stretch) assert.ok(w.text.length > 0);
	// A sentence of only the commonest words is fully known.
	const easy = judgeSentence("Ja som doma.", l);
	assert.equal(easy.stretch.length, 0);
	assert.equal(easy.coverage, 1);
});

test("pickListen: ten sentences, one per word, each inside the band with at most two glossed stretch words, three meanings each", () => {
	const l = lookup();
	const items = pickListen(lexicon.entries, l, { seed: 11 });
	assert.equal(items.length, LISTEN_COUNT);
	assert.equal(new Set(items.map((i) => i.slug)).size, items.length, "one sentence per dictionary word");
	assert.equal(new Set(items.map((i) => i.id)).size, items.length);
	let withStretch = 0;
	assert.equal(new Set(items.map((i) => i.sentence.toLowerCase())).size, items.length, "never the same sentence twice");
	assert.ok(sessionCoverage(items) >= LISTEN_FLOOR, `session coverage ${sessionCoverage(items)}`);
	for (const it of items) {
		assert.ok(it.stretch.length <= STRETCH_MAX);
		if (it.stretch.length) assert.ok(it.words >= 6, it.sentence);
		for (const w of it.stretch) assert.ok(w.gloss, `${w.text} has no gloss`);
		assert.equal(it.options.length, 3);
		assert.ok(it.options.includes(it.translation));
		assert.equal(new Set(it.options).size, 3);
		assert.ok(it.translation.length > 0);
		if (it.stretch.length > 0) withStretch++;
	}
	assert.ok(withStretch >= 3, `${withStretch} sentences carry a stretch word`);
	assert.ok(withStretch < items.length, "some sentences are fully known (fluency)");
	// Deterministic for a seed; different for another.
	assert.deepEqual(
		pickListen(lexicon.entries, l, { seed: 11 }).map((i) => i.id),
		items.map((i) => i.id),
	);
	assert.notDeepEqual(
		pickListen(lexicon.entries, l, { seed: 12 }).map((i) => i.id),
		items.map((i) => i.id),
	);
	// Recent ids are skipped.
	const again = pickListen(lexicon.entries, l, { seed: 11, recent: new Set(items.map((i) => i.id)) });
	assert.ok(again.every((i) => !items.some((x) => x.id === i.id)));
});

test("meaningOptions: the translation plus two others of similar length, never a duplicate", () => {
	const pool = ["I am at home.", "Where is the station?", "He drinks coffee in the morning.", "I am at home.", "We go to school.", "A very long sentence about something else entirely, far longer than the rest."];
	const opts = meaningOptions("She is at work.", pool, () => 0.5);
	assert.equal(opts.length, 3);
	assert.ok(opts.includes("She is at work."));
	assert.equal(new Set(opts).size, 3);
	assert.ok(!opts.includes("A very long sentence about something else entirely, far longer than the rest."));
});

test("the four strands: minutes by strand from the week's ledger, the share, the strand furthest behind", () => {
	const b = strandBalance([
		{ lessons: 2, reviews: 20, blitz: 0, talks: 0, stories: 0, tutors: 0 },
		{ lessons: 1, reviews: 8, blitz: 1, talks: 1, stories: 0, tutors: 0, reads: 1, listens: 1 },
	]);
	assert.equal(b.minutes.form, 3 * 3 + 28 * 0.25);
	assert.equal(b.minutes.output, 6);
	assert.equal(b.minutes.input, 8);
	assert.equal(b.minutes.fluency, 1);
	assert.equal(b.total, 31);
	assert.ok(Math.abs(STRANDS.reduce((n, s) => n + b.share[s.id], 0) - 1) < 1e-9);
	assert.equal(b.behind, "fluency");
	assert.match(strandAdvice(b), /Speed is furthest behind/);
	const empty = strandBalance([]);
	assert.equal(empty.total, 0);
	assert.equal(empty.behind, null);
	assert.match(strandAdvice(empty), /Nothing counted/);
	const even = strandBalance([{ lessons: 2, talks: 1, stories: 1, blitz: 6 }]);
	assert.equal(even.behind, null);
	assert.match(strandAdvice(even), /Close to a quarter each/);
});

test("the server: a session for the learner's known words; finishing records the day, XP, the deck and the log", () => {
	const plan = listenFor(5);
	assert.equal(plan.items.length, LISTEN_COUNT);
	assert.ok(plan.known > 100, `known ${plan.known}`);
	assert.ok(plan.coverage >= LISTEN_FLOOR);
	// A fresh learner's known words are the deck + the level's common words.
	assert.equal(plan.known, knownWords(lexicon).known.size);
	const reps = plan.items.map((it, i) => ({
		itemId: it.id,
		slug: it.slug,
		lemma: it.lemma,
		gloss: it.gloss,
		sentence: it.sentence,
		translation: it.translation,
		given: i === 0 ? it.options.find((o) => o !== it.translation)! : it.translation,
		verdict: (i === 0 ? "wrong" : "exact") as "wrong" | "exact",
		// The second sentence was answered with the text shown: not by ear.
		...(i === 1 ? { peeked: true } : {}),
		options: it.options,
		stretch: it.stretch.map((w) => w.slug).filter((s): s is string => !!s),
	}));
	const out = recordListen({ reps, ms: 150_000, tz: 0 }, new Date("2026-10-28T10:00:00Z"));
	assert.equal(out.total, LISTEN_COUNT);
	assert.equal(out.correct, LISTEN_COUNT - 2, "a peeked sentence is not understood by ear");
	assert.equal(out.xp, listenXp(LISTEN_COUNT - 2, LISTEN_COUNT));
	assert.equal(understood([{ verdict: "exact" }, { verdict: "exact", peeked: true }, { verdict: "wrong" }]), 1);
	const p = progressStore.read();
	assert.equal(p.days["2026-10-28"]?.listens, 1);
	assert.equal(p.days["2026-10-28"]?.xp, out.xp);
	assert.ok((p.days["2026-10-28"]?.minutes ?? 0) > 2);
	assert.ok(p.recent.includes(plan.items[0]!.id), "heard sentences are not picked again soon");
	// The stretch words and the missed sentence's word are in the deck.
	const wanted = new Set([...reps.flatMap((r) => r.stretch), reps[0]!.slug]);
	const cards = Object.values(reviewStore.readCards());
	for (const slug of wanted) assert.ok(cards.some((c) => c.slug === slug) || !lexicon.bySlug.get(slug), `${slug} in the deck`);
	assert.ok(out.queued.length > 0);
	// The summary's plan ticks Listen off and the balance counts it as input.
	assert.equal(out.summary.plan.tasks.find((t) => t.id === "listen")?.done, true);
	// The session's own 2.5 measured minutes, not the plan's 4.
	assert.equal(out.summary.balance.minutes.input, 2.5);
	// The session is in the lesson log, mode "listen".
	const log = readLessonLog();
	const entry = log.find((e) => e.mode === "listen");
	assert.ok(entry, "logged");
	assert.equal(entry!.unit, "listen");
	assert.equal(entry!.reps.length, LISTEN_COUNT);
	assert.equal(entry!.reps[0]!.verdict, "wrong");
	assert.ok(fs.existsSync(path.join(PATHS.lessons, "2026-10-28.jsonl")));
	// The next session skips what was just heard.
	const next = listenFor(5);
	assert.ok(next.items.every((i) => !plan.items.some((x) => x.id === i.id)));
});
