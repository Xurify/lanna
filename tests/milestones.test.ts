/**
 * MILESTONES PINS (LangHarness, 2026-10-28): the coverage curve and the
 * speed ladder, the estimate's arithmetic (what binds, the dates), the
 * speed reading from Listen reps, the custom-milestone mapping, and the
 * server round trip (facts from a profile, the report, the store).
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-milestones-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const core = await import("../src/core/milestones.ts");
type LearnerFacts = import("../src/core/milestones.ts").LearnerFacts;
const { coverageAt, lemmasFor, GENRES, genreLemmas, hoursForSpeed, speedForHours, speedFromSamples, speedTrend, estimateMilestone, MILESTONES, parseCustomMapping, customMilestone, customId, speedNeeded, creditedSpeed } = core;
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { frequencyOrder } = await import("../src/server/reading.ts");
const { addCustomMilestone, learnerFacts, milestonesReport, removeCustomMilestone, wordSets } = await import("../src/server/milestones.ts");
const { milestoneStore } = await import("../src/store/milestones.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { appendLessonLog } = await import("../src/store/corpus.ts");
const { recordListen } = await import("../src/server/listen.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = new Date("2026-10-28T12:00:00Z");

test("the coverage curve passes through the published points and is monotone", () => {
	for (const g of Object.values(GENRES)) {
		const { n95, n98 } = genreLemmas(g);
		assert.ok(Math.abs(coverageAt(g, n95) - 0.95) < 0.002, `${g.id} at n95`);
		assert.ok(Math.abs(coverageAt(g, n98) - 0.98) < 0.002, `${g.id} at n98`);
		assert.equal(lemmasFor(g, 0.95), n95);
		assert.equal(lemmasFor(g, 0.98), n98);
		let last = 0;
		for (const v of [100, 500, 1000, 2000, 4000, 8000]) {
			const c = coverageAt(g, v);
			assert.ok(c >= last && c <= 0.995, `${g.id} monotone at ${v}`);
			last = c;
		}
	}
	// TV is harder than conversation, newspapers harder than TV.
	assert.ok(lemmasFor(GENRES.conversation, 0.95) < lemmasFor(GENRES.tv, 0.95));
	assert.ok(lemmasFor(GENRES.tv, 0.95) < lemmasFor(GENRES.news, 0.95));
	assert.equal(coverageAt(GENRES.tv, 0), 0);
});

test("the speed ladder is anchored to the guided hours and inverts", () => {
	assert.equal(Math.round(hoursForSpeed(135)), 650, "B2 speed ↔ B2 hours");
	assert.equal(Math.round(hoursForSpeed(95)), 400);
	assert.equal(Math.round(speedForHours(650)), 135);
	assert.equal(Math.round(speedForHours(0)), 0);
	assert.ok(hoursForSpeed(70) > hoursForSpeed(60) && hoursForSpeed(70) < hoursForSpeed(95));
	// The vlog needs B2 speed with pictures helping; the café far less.
	assert.equal(speedNeeded(MILESTONES.find((m) => m.id === "vlog")!), 135);
	assert.equal(speedNeeded(MILESTONES.find((m) => m.id === "cafe")!), 70);
	assert.equal(speedNeeded(MILESTONES.find((m) => m.id === "news")!), 0);
});

test("speed from Listen reps: the audio's time counts, replays and peeks slow it, wrong answers do not count", () => {
	const at = "2026-10-28T10:00:00Z";
	// Eight words heard in 3.2 s, answered as the audio ends → the speaker's pace.
	const atPace = speedFromSamples([{ words: 8, ms: 3200, heardMs: 3200, correct: true, at }])!;
	assert.equal(atPace.wpm, 150);
	assert.equal(atPace.realtime, 1);
	assert.equal(atPace.audioWpm, 150);
	// The same sentence needing its length again → half the pace.
	const half = speedFromSamples([{ words: 8, ms: 6400, heardMs: 3200, correct: true, at }])!;
	assert.equal(half.wpm, 75);
	assert.equal(half.realtime, 0);
	// Peeked and wrong reps are not understanding by ear.
	assert.equal(speedFromSamples([{ words: 8, ms: 3200, correct: false, at }]), null);
	assert.equal(speedFromSamples([{ words: 8, ms: 3200, correct: true, peeked: true, at }]), null);
	// No audio length: 400 ms a word is assumed, and a pick faster than that is capped.
	const fast = speedFromSamples([{ words: 10, ms: 1000, correct: true, at }])!;
	assert.equal(fast.wpm, 150);
	// A tab left open is not a thought.
	assert.equal(speedFromSamples([{ words: 8, ms: 400_000, correct: true, at }]), null);
});

test("the speed trend needs eight sessions across a week, then gives a slope", () => {
	const few = Array.from({ length: 7 }, (_, i) => ({ hours: i, wpm: 60 + i * 2, at: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00Z` }));
	assert.equal(speedTrend(few), null);
	const sameDay = Array.from({ length: 9 }, (_, i) => ({ hours: i, wpm: 60 + i * 2, at: "2026-10-10T10:00:00Z" }));
	assert.equal(speedTrend(sameDay), null);
	const enough = Array.from({ length: 9 }, (_, i) => ({ hours: i * 2, wpm: 60 + i * 4, at: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00Z` }));
	const t = speedTrend(enough)!;
	assert.ok(Math.abs(t.slope - 2) < 1e-9, "2 words a minute per hour");
	assert.equal(t.points, 9);
});

function facts(over: Partial<LearnerFacts> = {}): LearnerFacts {
	const base: Omit<LearnerFacts, "speed"> = {
		level: "B1",
		levelProgress: 0.4,
		placed: true,
		words: { basis: "level", credited: 2880 },
		met: 400,
		solid: 120,
		assumed: 3200,
		vocabulary: 3600,
		wordsPerDayPlanned: 15,
		wordsPerDayReal: 6,
		minutesPerDay: 60,
		daysPerWeek: 6,
		paceMinutes: 20,
		paceDays: 12,
		hoursDone: 300,
		hoursLogged: 40,
		listen: { sessions: 12, reading: { wpm: 80, samples: 90, words: 700, realtime: 0.3, audioWpm: 150 }, trend: null, knownSentences: { total: 60, right: 52 } },
		watch: null,
	};
	const merged = { ...base, ...over };
	return { ...merged, speed: over.speed ?? creditedSpeed(merged) };
}

test("Xurify's case: the words are nearly there for a vlog and speed is the gap; the date is the later of the two", () => {
	const f = facts();
	assert.deepEqual(f.speed, { wpm: 80, basis: "listen" });
	const vlog = estimateMilestone(MILESTONES.find((m) => m.id === "vlog")!, f, { now: NOW });
	assert.equal(vlog.words.need, 3750);
	assert.equal(vlog.words.toGo, 150);
	assert.ok(vlog.words.coverageNow > 0.94 && vlog.words.coverageNow < 0.95);
	assert.equal(vlog.speed.need, 135);
	assert.equal(vlog.speed.have, 80);
	// Hours: ladder(135) − ladder(80) = 650 − (200 + (20/35)·200) ≈ 336.
	assert.equal(vlog.speed.hoursToGo, 336);
	assert.equal(vlog.speed.hoursBasis, "ladder");
	assert.equal(vlog.binding, "speed");
	assert.match(vlog.verdict, /Speed is the longer road/);
	// Words: 150 / (15·6/7) ≈ 11.7 days; speed: 336 h at 6 h/week ≈ 392 days → the later one.
	assert.equal(vlog.words.eta.daysPlanned, 150 / ((15 * 6) / 7));
	assert.equal(Math.round(vlog.speed.eta.daysPlanned!), 392);
	assert.equal(vlog.eta.daysPlanned, vlog.speed.eta.daysPlanned);
	assert.equal(vlog.eta.planned, vlog.speed.eta.planned);
	assert.equal(vlog.status, "on-the-way");
	// At the real pace (20 min/day) speed takes 336 / (20/60) = 1,008 days.
	assert.equal(Math.round(vlog.eta.daysPace!), 1007);
	assert.equal(vlog.missing.length, 2);
});

test("reading news is self-paced: words alone decide; a café exchange is within reach at B1", () => {
	const f = facts();
	const news = estimateMilestone(MILESTONES.find((m) => m.id === "news")!, f, { now: NOW });
	assert.equal(news.speed.need, 0);
	assert.equal(news.speed.hoursToGo, 0);
	assert.equal(news.binding, "words");
	assert.equal(news.words.need, 5000);
	assert.equal(news.eta.daysPlanned, news.words.eta.daysPlanned);
	const cafe = estimateMilestone(MILESTONES.find((m) => m.id === "cafe")!, f, { now: NOW });
	assert.equal(cafe.status, "reached");
	assert.equal(cafe.binding, "none");
	assert.equal(cafe.eta.daysPlanned, 0);
	assert.equal(cafe.missing.length, 0);
});

test("without a Listen measurement the speed is assumed from the hours ladder and said so", () => {
	const f = facts({ listen: { sessions: 0, reading: null, trend: null, knownSentences: { total: 0, right: 0 } }, hoursDone: 200 });
	assert.deepEqual(f.speed, { wpm: 95, basis: "level" }, "a placed B1 is credited B1's rung, not the few hours the map has");
	assert.deepEqual(facts({ listen: f.listen, hoursDone: 500, level: "A2" }).speed, { wpm: 111, basis: "level" }, "more hours than the rung count");
	const vlog = estimateMilestone(MILESTONES.find((m) => m.id === "vlog")!, f, { now: NOW });
	assert.equal(vlog.speed.basis, "level");
	assert.match(vlog.missing[1]!, /a listener at your level/);
	// A trend is never used over an assumed speed.
	const withTrend = facts({ listen: { sessions: 0, reading: null, trend: { slope: 5, points: 9 }, knownSentences: { total: 0, right: 0 } }, hoursDone: 200 });
	assert.equal(estimateMilestone(MILESTONES.find((m) => m.id === "vlog")!, withTrend, { now: NOW }).speed.hoursBasis, "ladder");
});

test("the learner's own trend replaces the ladder, clamped to half and twice of it", () => {
	const base = facts();
	const ladder = estimateMilestone(MILESTONES.find((m) => m.id === "vlog")!, base, { now: NOW }).speed.hoursToGo;
	// 1 word a minute per hour → 55 hours, far under half the ladder → clamped to half.
	const slow = facts({ listen: { ...base.listen, trend: { slope: 1, points: 9 } } });
	const s = estimateMilestone(MILESTONES.find((m) => m.id === "vlog")!, slow, { now: NOW }).speed;
	assert.equal(s.hoursBasis, "trend");
	assert.equal(s.hoursToGo, Math.round(ladder * 0.5));
	// 0.2 a minute per hour → 275 hours, inside the band → used as is.
	const mid = facts({ listen: { ...base.listen, trend: { slope: 0.2, points: 9 } } });
	assert.equal(estimateMilestone(MILESTONES.find((m) => m.id === "vlog")!, mid, { now: NOW }).speed.hoursToGo, 275);
	// A flat or falling trend keeps the ladder.
	const flat = facts({ listen: { ...base.listen, trend: { slope: -0.1, points: 9 } } });
	assert.equal(estimateMilestone(MILESTONES.find((m) => m.id === "vlog")!, flat, { now: NOW }).speed.hoursBasis, "ladder");
});

test("a custom mapping is checked field by field and odd answers fall back", () => {
	const good = parseCustomMapping('Sure: {"title":"Follow my mother-in-law on the phone","line":"Phone calls about family news.","genre":"conversation","coverage":0.95,"wpm":150,"support":"interactive","icon":"phone","cefr":"B1: can follow speech directed at me"}', "x");
	assert.equal(good.genre, "conversation");
	assert.equal(good.coverage, 0.95);
	assert.equal(good.support, "interactive");
	assert.equal(good.icon, "phone");
	const odd = parseCustomMapping('{"genre":"opera","coverage":1.5,"wpm":-4,"support":"telepathy","icon":"dragon"}', "Understand opera");
	assert.equal(odd.genre, "conversation");
	assert.equal(odd.coverage, 0.98);
	assert.equal(odd.wpm, 0);
	assert.equal(odd.support, "none");
	assert.equal(odd.icon, "sparkles");
	assert.equal(odd.title, "Understand opera");
	const none = parseCustomMapping("I cannot help with that.", "Read a lease");
	assert.equal(none.title, "Read a lease");
	assert.equal(none.wpm, 150);
	const def = customMilestone("  Read a   lease ", good);
	assert.equal(def.id, customId("read a lease"));
	assert.equal(def.custom, "Read a lease");
});

// ─── The server: a profile on disk ──────────────────────────────────────────

test("facts from a profile: met and assumed words, the frequency order, pace and hours", () => {
	const lexicon = loadLexicon()!;
	const order = frequencyOrder(lexicon);
	assert.equal(order.length, lexicon.entries.length);
	assert.equal(order[0], "byt", "byť is the commonest word in the dictionary's sentences");
	assert.ok(order.indexOf("mat") < 20);

	const p = progressStore.read();
	p.goal = { level: "B2", minutesPerDay: 60, daysPerWeek: 5, placedLevel: "A2", placedAt: NOW.toISOString(), startChapter: "health", onboardedAt: NOW.toISOString() };
	for (let i = 0; i < 14; i++) {
		const d = new Date(NOW.getTime() - i * 86_400_000).toISOString().slice(0, 10);
		p.days[d] = { xp: 10, lessons: 1, reps: 10, reviews: 0, minutes: 30 };
	}
	progressStore.write(p);
	const cards = reviewStore.readCards();
	const mint = (slug: string, i: number, stability: number) => {
		cards[`${slug}#0`] = { id: `${slug}#0`, slug, lemma: slug, gloss: "", sentence: "", translation: "", answer: "", at: 0, state: "review", memory: { stability, difficulty: 5 }, due: NOW.toISOString(), reps: 3, lapses: 0, createdAt: new Date(NOW.getTime() - i * 86_400_000).toISOString() };
	};
	mint("byt", 1, 30);
	mint("mesto", 2, 10);
	mint("praca", 20, 2);
	reviewStore.writeCards(cards);

	const sets = wordSets(lexicon);
	assert.equal(sets.level, "A2", "the map, whose start placement set");
	assert.equal(sets.basis, "level");
	assert.equal(sets.credited, core.LEVEL_VOCAB.A1, "entering A2 credits the A1 band, not A2's (the old over-credit)");
	assert.equal(core.levelVocabulary("A1", 0), 0);
	assert.equal(core.levelVocabulary("A2", 0.5), 1800);
	assert.equal(core.levelVocabulary("B1", 1), core.LEVEL_VOCAB.B1);
	assert.equal(sets.met.size, 3);
	assert.equal(sets.solid, 2);
	assert.equal(sets.known.size, sets.credited + (sets.met.has("praca") && order.indexOf("praca") >= sets.credited ? 1 : 0) + (order.indexOf("mesto") >= sets.credited ? 1 : 0) + (order.indexOf("byt") >= sets.credited ? 1 : 0));
	// A word check replaces the band.
	p.goal.vocabulary = { size: 2150, at: NOW.toISOString(), reliable: true };
	progressStore.write(p);
	const measured = wordSets(lexicon);
	assert.equal(measured.basis, "measured");
	assert.equal(measured.credited, 2150);
	delete p.goal.vocabulary;
	progressStore.write(p);
	assert.ok(sets.known.has("byt") && sets.known.has("praca"));

	const f = learnerFacts(lexicon, NOW, 0);
	assert.equal(f.vocabulary, sets.known.size);
	assert.equal(f.paceMinutes, 30);
	assert.equal(f.hoursLogged, 7);
	assert.equal(f.daysPerWeek, 5);
	assert.equal(f.wordsPerDayPlanned, 15);
	// Two of three cards were minted in the last 14 days, and the deck is 20 days old.
	assert.equal(f.wordsPerDayReal, 2 / 14);
	assert.equal(f.speed.basis, "level");
	assert.equal(f.listen.sessions, 0);
});

test("Listen sessions feed the speed reading; the report ranks milestones and lists the next words", () => {
	// A session recorded through the real service, with timing on every rep.
	const reps = Array.from({ length: 10 }, (_, i) => ({
		itemId: `w${i}#0`,
		slug: `w${i}`,
		lemma: `w${i}`,
		gloss: "",
		sentence: "Toto je veta so siedmimi slovami tu.",
		translation: `meaning ${i}`,
		given: i === 0 ? "other" : `meaning ${i}`,
		verdict: (i === 0 ? "wrong" : "exact") as "wrong" | "exact",
		stretch: [],
		ms: 5600,
		heardMs: 2800,
		replays: 0,
		peeked: i === 1,
		words: 7,
	}));
	recordListen({ reps, ms: 60_000, tz: 0 }, NOW);
	const f = learnerFacts(loadLexicon(), NOW, 0);
	assert.equal(f.listen.sessions, 1);
	assert.equal(f.listen.reading!.samples, 8, "the wrong and the peeked rep do not count");
	assert.equal(f.listen.reading!.wpm, 75, "twice the audio's time → half its 150 words a minute");
	assert.equal(f.listen.reading!.audioWpm, 150);
	assert.equal(f.listen.knownSentences.total, 10);
	assert.equal(f.listen.knownSentences.right, 9);
	assert.deepEqual(f.speed, { wpm: 75, basis: "listen" });

	const report = milestonesReport(NOW, 0);
	assert.equal(report.milestones.length, MILESTONES.length);
	const vlog = report.milestones.find((m) => m.def.id === "vlog")!;
	assert.equal(vlog.speed.have, 75);
	assert.equal(vlog.speed.basis, "listen");
	assert.ok(report.nextWords.length > 0 && report.nextWords.length <= 24);
	for (const w of report.nextWords) assert.ok(!["byt", "mesto", "praca"].includes(w.slug), "met words are not next words");
	assert.ok(report.nextWords[0]!.rank > core.LEVEL_VOCAB.A1, "the next words sit past the credited band");
	assert.ok(report.goals["can-order"], "the map's goals are on the report");
});

test("a custom milestone is mapped once on the cheap slot and kept; the same words again cost nothing", async () => {
	let calls = 0;
	const engine = {
		model: { provider: "faux", id: "faux" } as never,
		level: "off" as never,
		streamFn: (() => {
			calls++;
			throw new Error("not used in this test");
		}) as never,
	};
	// The faux engine route is exercised through the mapping seam instead:
	// write the record the service would, then check the store and report.
	const mapping = parseCustomMapping('{"title":"Follow the in-laws on the phone","line":"Family calls.","genre":"conversation","coverage":0.95,"wpm":150,"support":"interactive","icon":"phone"}', "x");
	const text = "understand my in-laws on the phone";
	milestoneStore.upsert({ def: customMilestone(text, mapping), text, mapping, model: "test", usage: { model: "test", steps: [] }, createdAt: NOW.toISOString() });
	const again = await addCustomMilestone(text, { engine: engine as never, now: NOW });
	assert.equal(again.reused, true);
	assert.equal(calls, 0, "no model call for the same words");
	assert.equal(again.record.def.icon, "phone");
	let report = milestonesReport(NOW, 0);
	assert.equal(report.milestones.length, MILESTONES.length + 1);
	const mine = report.milestones.find((m) => m.def.custom)!;
	assert.equal(mine.def.title, "Follow the in-laws on the phone");
	assert.equal(mine.speed.need, 105);
	// Removing keeps the line on disk, hidden.
	assert.equal(removeCustomMilestone(mine.def.id, NOW), true);
	report = milestonesReport(NOW, 0);
	assert.equal(report.milestones.length, MILESTONES.length);
	assert.ok(milestoneStore.find(mine.def.id)?.removedAt);
	assert.equal(removeCustomMilestone(mine.def.id, NOW), false);
	// Adding it back restores it without a model call.
	const back = await addCustomMilestone(text, { engine: engine as never, now: NOW });
	assert.equal(back.reused, true);
	assert.equal(milestoneStore.active().length, 1);
	assert.equal(calls, 0);
	// Too short to mean anything.
	await assert.rejects(addCustomMilestone("a", { engine: engine as never }), /few words/);
});

test("appendLessonLog keeps the timing fields a Listen rep carries", () => {
	appendLessonLog({ id: "t1", at: NOW.toISOString(), day: "2026-10-28", unit: "listen", mode: "listen", xp: 0, correct: 1, total: 1, perfect: true, queued: [], reps: [{ itemId: "a#0", kind: "meaning", unit: "listen", slug: "a", lemma: "a", gloss: "", sentence: "A b c d.", translation: "x", answer: "x", given: "x", verdict: "exact", assisted: false, ms: 1200, heardMs: 1000, replays: 1, peeked: false, words: 4 }] });
	const f = learnerFacts(loadLexicon(), NOW, 0);
	assert.ok(f.listen.sessions >= 2);
});

test("a typed Listen sentence is timed by its clip, not by the typing", () => {
	const before = learnerFacts(loadLexicon(), NOW, 0).listen.reading;
	const typed = { itemId: "b#0", kind: "dictation", unit: "listen", slug: "b", lemma: "b", gloss: "", sentence: "E f g h.", translation: "y", answer: "E f g h.", given: "e f g h", verdict: "exact" as const, assisted: false, ms: 20_000, heardMs: 2000, replays: 0, peeked: false, words: 4 };
	appendLessonLog({ id: "t2", at: NOW.toISOString(), day: "2026-10-28", unit: "listen", mode: "listen", xp: 0, correct: 1, total: 1, perfect: true, queued: [], reps: [typed, { ...typed, itemId: "c#0", heardMs: undefined }, { ...typed, itemId: "d#0", verdict: "wrong" as const }] });
	const after = learnerFacts(loadLexicon(), NOW, 0).listen.reading!;
	assert.equal(after.samples, (before?.samples ?? 0) + 1, "one usable sample: the one without a clip length and the wrong one do not count");
	assert.equal(after.words, (before?.words ?? 0) + 4);
});
