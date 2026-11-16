/**
 * LISTEN + FOUR STRANDS PINS (2026-10-28): the input task's
 * sentence picker (95–98% known words, one stretch word, three meanings),
 * the strand balance under the daily plan, and the server round trip
 * (the day's listening, XP, the stretch words into the deck, the log).
 *
 * Runs under an isolated LANNA_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-listen-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const {
	almostCount,
	judgeSentence,
	judgeTyped,
	LISTEN_COUNT,
	LISTEN_FLOOR,
	listenXp,
	meaningOptions,
	pickListen,
	sessionCoverage,
	STRETCH_MAX,
	understood,
} = await import("../src/core/listen.ts");
const { foldDiacritics } = await import("../src/core/language.ts");
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
	for (const e of lexicon.entries)
		if ((e.rank !== undefined && e.rank <= bound) || e.origin === "curated" || e.cat === "Places") known.add(e.slug);
	return { resolve: (form: string) => resolveWord(lexicon, form, known), known };
}

test("judgeSentence: known words, names and grammar words count as known; the rest are stretch words with a gloss", () => {
	const l = lookup();
	const j = judgeSentence("Martin ide do školy.", l);
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

test("judgeTyped: case, spacing and punctuation are forgiven, accents are a near miss, a missing word is wrong", () => {
	assert.equal(judgeTyped("za internet platíme mesačne", "Za internet platíme mesačne."), "exact");
	assert.equal(
		judgeTyped("Za internet, platíme mesačne", "Za internet platíme mesačne."),
		"exact",
		"a comma not heard is not a wrong word",
	);
	assert.equal(
		judgeTyped("Za  internet plati\u0301me mesačne", "Za internet platíme mesačne."),
		"exact",
		"decomposed accents read as the same letters",
	);
	assert.equal(judgeTyped("Za internet platime mesacne", "Za internet platíme mesačne."), "accents");
	assert.equal(judgeTyped("Za internet platíme", "Za internet platíme mesačne."), "wrong");
	assert.equal(judgeTyped("", "Za internet platíme mesačne."), "wrong");
	// vina and vína differ by a mark only: a near miss, never exact.
	assert.equal(judgeTyped("to je vina", "To je vína."), "accents");
});

test("listenXp and the typed verdicts: an accents-only answer earns half and is not understood", () => {
	assert.equal(listenXp(2, 4, 1), 2 * 4 + 2 + 10);
	assert.equal(listenXp(2, 4), 2 * 4 + 10, "the picks-only sum is unchanged");
	const reps = [
		{ verdict: "accents" as const },
		{ verdict: "accents" as const, peeked: true },
		{ verdict: "exact" as const },
	];
	assert.equal(almostCount(reps), 1, "a peeked accents answer earns nothing");
	assert.equal(understood(reps), 1);
});

test("meaningOptions: the translation plus two others of similar length, never a duplicate", () => {
	const pool = [
		"I am at home.",
		"Where is the station?",
		"He drinks coffee in the morning.",
		"I am at home.",
		"We go to school.",
		"A very long sentence about something else entirely, far longer than the rest.",
	];
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
	for (const slug of wanted)
		assert.ok(cards.some((c) => c.slug === slug) || !lexicon.bySlug.get(slug), `${slug} in the deck`);
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

test("typed listen: the server grades a typed sentence itself, half XP for a missing accent, logged apart as dictation", () => {
	const plan = listenFor(9);
	const accented = plan.items.find((i) => foldDiacritics(i.sentence) !== i.sentence);
	assert.ok(accented, "the session has a sentence with accents");
	const [plain, third] = plan.items.filter((i) => i !== accented);
	const rep = (it: (typeof plan.items)[number], given: string, verdict: "exact" | "accents" | "wrong") => ({
		itemId: it.id,
		slug: it.slug,
		lemma: it.lemma,
		gloss: it.gloss,
		sentence: it.sentence,
		translation: it.translation,
		given,
		verdict,
		answer: "type" as const,
		stretch: it.stretch.map((w) => w.slug).filter((s): s is string => !!s),
		words: it.words,
	});
	// The client's verdicts are wrong on purpose: the server must not take them.
	const reps = [
		rep(accented!, foldDiacritics(accented!.sentence), "exact"),
		rep(plain!, plain!.sentence.toLowerCase(), "wrong"),
		rep(third!, "nič také nie", "exact"),
	];
	const at = new Date("2026-10-29T10:00:00Z");
	const out = recordListen({ reps, ms: 60_000, tz: 0 }, at);
	assert.equal(out.total, 3);
	assert.equal(out.correct, 1, "only the plain sentence is understood");
	assert.equal(out.almost, 1, "the accented one is a near miss");
	assert.equal(out.xp, listenXp(1, 3, 1));
	const log = readLessonLog().find((e) => e.at === at.toISOString());
	assert.ok(log, "logged");
	const byId = new Map(log!.reps.map((r) => [r.itemId, r]));
	assert.equal(byId.get(accented!.id)?.verdict, "accents");
	assert.equal(byId.get(accented!.id)?.kind, "dictation");
	assert.equal(byId.get(accented!.id)?.answer, accented!.sentence, "a typed rep's answer is the sentence");
	assert.equal(byId.get(plain!.id)?.verdict, "exact");
	assert.equal(byId.get(third!.id)?.verdict, "wrong");
	// A picked rep keeps its kind and its options.
	const picked = listenFor(9).items[0]!;
	const pickOut = recordListen(
		{ reps: [{ ...rep(picked, picked.translation, "exact"), answer: "pick", options: picked.options }], tz: 0 },
		new Date("2026-10-29T11:00:00Z"),
	);
	assert.equal(pickOut.correct, 1);
	const pickLog = readLessonLog().find((e) => e.at === "2026-10-29T11:00:00.000Z");
	assert.equal(pickLog?.reps[0]?.kind, "meaning");
	assert.deepEqual(pickLog?.reps[0]?.options, picked.options);
});
