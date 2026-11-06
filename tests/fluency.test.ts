/**
 * FLUENCY PINS (LangHarness, 2026-10-28): the speed strand — the known-
 * sentence picker (100% known, practiced sentences first), the shrinking
 * windows, words a minute and the XP rules, and the server round trips
 * (a timed re-read of a stored episode with its history; a "say it
 * faster" round into the ledger and the logs).
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-fluency-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const { FAST_COUNT, FAST_PASSES, fastWindows, fastXp, pickKnown, rereadXp, wordsPerMinute, WPM_TARGET } = await import("../src/core/fluency.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { knownWords, resolveWord, STORY_NAMES } = await import("../src/server/reading.ts");
const fluency = await import("../src/server/fluency.ts");
const { fluencyStore } = await import("../src/store/speak.ts");
const { storyStore } = await import("../src/store/stories.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { appendLessonLog, readLessonLog } = await import("../src/store/corpus.ts");
const { dailyPlan, curriculumState, nextLessonUnit } = await import("../src/core/curriculum.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const lexicon = loadLexicon()!;
assert.ok(lexicon, "the Slovak lexicon loads");

function lookup(bound = 800) {
	const known = new Set<string>();
	for (const e of lexicon.entries) if ((e.rank !== undefined && e.rank <= bound) || e.origin === "curated" || e.cat === "Places") known.add(e.slug);
	return { resolve: (form: string) => resolveWord(lexicon, form, known), known };
}

test("pickKnown: six sentences with no stretch word at all, one per word, three to nine words, practiced ones first", () => {
	const l = lookup();
	const items = pickKnown(lexicon.entries, l, { seed: 7 });
	assert.equal(items.length, FAST_COUNT);
	assert.equal(new Set(items.map((i) => i.slug)).size, items.length);
	for (const i of items) {
		assert.ok(i.words >= 3 && i.words <= 9, `${i.sentence}: ${i.words} words`);
		assert.ok(i.translation.length > 0);
	}
	// A practiced sentence (answered right in a lesson) is taken first.
	const any = pickKnown(lexicon.entries, l, { seed: 3, count: 12 });
	const practiced = new Set([any[4]!.id]);
	const again = pickKnown(lexicon.entries, l, { seed: 9, practiced });
	assert.ok(again.some((i) => i.id === any[4]!.id && i.practiced), "the practiced sentence is in the round");
	// Recent sentences are skipped while fresher ones remain.
	const recent = new Set(items.map((i) => i.id));
	const fresh = pickKnown(lexicon.entries, l, { seed: 7, recent });
	assert.ok(fresh.every((i) => !recent.has(i.id)));
});

test("fastWindows shrink and the XP counts passes, sentences and the finish", () => {
	const w = fastWindows(5);
	assert.equal(w.length, FAST_PASSES);
	assert.ok(w[0]! > w[1]! && w[1]! > w[2]!);
	assert.ok(fastWindows(8)[2]! > fastWindows(3)[2]!);
	assert.equal(fastXp(0, 0, 0), 0);
	assert.equal(fastXp(10, 2, 6), 10 * 2 + 2 * 4 + 8);
});

test("words a minute and the re-read XP: the read, a bonus for beating the bar, the question", () => {
	assert.equal(wordsPerMinute(120, 60_000), 120);
	assert.equal(wordsPerMinute(0, 1000), 0);
	assert.equal(rereadXp(90, WPM_TARGET.A2, null, true), 12 + 6 + 5);
	assert.equal(rereadXp(70, WPM_TARGET.A2, null, false), 12);
	assert.equal(rereadXp(90, 80, 95, true), 12 + 5, "the last time on the text is the bar once there is one");
});

test("a timed re-read of a stored episode: the plan, the record, the history, the next question", () => {
	const story = {
		id: "ep-001-martin-prisiel",
		lang: "sk",
		series: "robo",
		episode: 1,
		title: "Martin prišiel",
		level: "A2" as const,
		chapter: "a1",
		theme: "daily",
		createdAt: "2026-10-26T10:00:00.000Z",
		sentences: [
			{ sk: "Martin je v Bratislave.", en: "Martin is in Bratislava.", tokens: [{ text: "Martin", word: true }, { text: " ", word: false }, { text: "je", word: true }, { text: " ", word: false }, { text: "v", word: true }, { text: " ", word: false }, { text: "Bratislave", word: true }, { text: ".", word: false }] },
			{ sk: "Má novú prácu.", en: "He has a new job.", tokens: [{ text: "Má", word: true }, { text: " ", word: false }, { text: "novú", word: true }, { text: " ", word: false }, { text: "prácu", word: true }, { text: ".", word: false }] },
		],
		questions: [
			{ q: "Kde je Martin?", options: ["V Bratislave", "V Košiciach", "Doma"], answer: 0, kind: "recall" as const },
			{ q: "Čo má Martin?", options: ["Nové auto", "Novú prácu", "Nový byt"], answer: 1, kind: "recall" as const },
		],
		newWords: [],
		recap: "Martin arrives.",
		coverage: 1,
		wordCount: 7,
		usage: { model: "faux:story", steps: [] },
		drafts: 1,
	};
	storyStore.put(story);
	assert.equal(fluency.rereadFor({ now: new Date("2026-10-28T10:00:00Z"), tz: 0 }), null, "an episode never read is not re-read");
	storyStore.appendRead({ storyId: story.id, at: "2026-10-27T10:00:00.000Z", day: "2026-10-27", ms: 8_400, correct: 3, total: 3, answers: [0, 1], tapped: [], queued: [], xp: 10 });
	const plan = fluency.rereadFor({ now: new Date("2026-10-28T10:00:00Z"), tz: 0 })!;
	assert.equal(plan.story.id, story.id);
	assert.equal(plan.words, 7);
	assert.equal(plan.targetWpm, WPM_TARGET.A2);
	assert.equal(plan.firstWpm, 50);
	assert.equal(plan.questionIndex, 0);
	assert.deepEqual(plan.history, []);

	const out = fluency.recordReread({ storyId: story.id, ms: 4_000, questionIndex: 0, answer: 0, tz: 0 }, new Date("2026-10-28T10:01:00Z"));
	assert.equal(out.wpm, 105);
	assert.equal(out.faster, true);
	assert.equal(out.right, true);
	assert.equal(out.xp, 12 + 6 + 5);
	const day = progressStore.read().days["2026-10-28"]!;
	assert.equal(day.rereads, 1);
	assert.equal(day.xp, out.xp);
	assert.equal(fluencyStore.list().length, 1);
	assert.ok(fs.existsSync(path.join(PATHS.fluency, "README.md")));

	// The next re-read is measured against the last one and asks the next question.
	const next = fluency.rereadFor({ now: new Date("2026-10-29T10:00:00Z"), tz: 0 })!;
	assert.equal(next.targetWpm, 105);
	assert.equal(next.previousWpm, 105);
	assert.equal(next.questionIndex, 1);
	assert.equal(next.history.length, 1);
	const slower = fluency.recordReread({ storyId: story.id, ms: 6_000, questionIndex: 1, answer: 0, tz: 0 }, new Date("2026-10-29T10:01:00Z"));
	assert.equal(slower.faster, false);
	assert.equal(slower.right, false);
	assert.equal(slower.xp, 12);

	// The daily plan offers the re-read once an episode was read on an earlier day.
	const p = progressStore.read();
	const state = curriculumState(p.units, "B2");
	const planned = dailyPlan({ state, evidence: p.units, day: { units: {}, reviews: 0, blitz: 0, talks: 0, stories: 0, tutors: 0 }, review: { due: 0, newLeft: 0, available: false }, minutesPerDay: 60, next: nextLessonUnit(state), dayOfYear: 301, reread: true });
	assert.equal(planned.tasks.find((t) => t.id === "fluency")?.href, "/speed?mode=reread");
});

test("a say-it-faster round: the plan from the lexicon, the practiced sentences first, the record into the ledger and the logs", () => {
	// A lesson the learner got right: its sentence should come first. The
	// lookup is the server's own known set (knownWords, level-bounded), the
	// one the round is judged against.
	const k = knownWords(lexicon);
	const l = { resolve: (form: string) => resolveWord(lexicon, form, k.known), known: k.known, names: STORY_NAMES };
	const seedItems = pickKnown(lexicon.entries, l, { seed: 21, count: 3 });
	appendLessonLog({
		id: "l1",
		at: "2026-10-27T10:00:00.000Z",
		day: "2026-10-27",
		unit: "present",
		mode: "lesson",
		xp: 10,
		correct: 1,
		total: 1,
		perfect: true,
		queued: [],
		reps: [{ itemId: seedItems[0]!.id, kind: "type", unit: "present", slug: seedItems[0]!.slug, lemma: seedItems[0]!.lemma, gloss: "", sentence: seedItems[0]!.sentence, translation: seedItems[0]!.translation, answer: "x", given: "x", verdict: "exact", assisted: false }],
	});
	const plan = fluency.fastFor(5);
	assert.equal(plan.items.length, FAST_COUNT);
	assert.ok(plan.known > 100);
	const mine = plan.items.find((i) => i.id === seedItems[0]!.id);
	assert.ok(mine?.practiced, "the sentence answered right in a lesson is in the round, marked practiced");

	const reps = plan.items.map((i, n) => ({
		itemId: i.id,
		slug: i.slug,
		sentence: i.sentence,
		translation: i.translation,
		passes: fastWindows(i.words).map((w, k) => ({ ms: n === 0 && k === 2 ? w + 500 : w - 100, window: w, made: !(n === 0 && k === 2), ...(k === 0 ? { heard: i.sentence, match: 1 } : {}) })),
	}));
	const out = fluency.recordFast({ reps, ms: 120_000, tz: 0 }, new Date("2026-10-28T11:00:00Z"));
	assert.equal(out.total, FAST_COUNT);
	assert.equal(out.sentencesMade, FAST_COUNT - 1);
	assert.equal(out.passesMade, FAST_COUNT * FAST_PASSES - 1);
	assert.equal(out.xp, fastXp(out.passesMade, out.sentencesMade, out.total));
	const day = progressStore.read().days["2026-10-28"]!;
	assert.equal(day.fasts, 1);
	const log = fluencyStore.list().filter((e) => e.mode === "fast");
	assert.equal(log.length, 1);
	assert.equal(log[0]!.mode === "fast" && log[0]!.reps[0]!.passes[0]!.heard, reps[0]!.sentence);
	const lesson = readLessonLog().filter((e) => e.mode === "fluency");
	assert.equal(lesson.length, 1);
	assert.equal(lesson[0]!.reps[0]!.verdict, "wrong");
	assert.equal(lesson[0]!.reps[1]!.verdict, "exact");
	// The next round skips what was just said.
	const next = fluency.fastFor(6);
	const said = new Set(plan.items.map((i) => i.id));
	assert.ok(next.items.filter((i) => said.has(i.id) && !i.practiced).length === 0, "sentences just said do not come straight back");
});
