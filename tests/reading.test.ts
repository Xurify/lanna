/**
 * READING PINS (LangHarness, 2026-10-28): the Read task's pure rules
 * (tokenizing, the model's JSON, grading, XP), glossing against the
 * lexicon (forms → lemma, fresh words), a whole episode written on a
 * scripted engine and kept on disk (one generation, reused until read,
 * redone once when too hard), a reading recorded (log, XP, deck, the
 * daily plan's Read task), and the corpus and spending folds seeing it.
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";
import type { StoryGenre, StoryRecord } from "../src/core/reading.ts";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-reading-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const core = await import("../src/core/reading.ts");
const reading = await import("../src/server/reading.ts");
const { storyStore } = await import("../src/store/stories.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { progressSummary } = await import("../src/server/lesson.ts");
const { usageReport } = await import("../src/server/usage-report.ts");
const { exportCorpus } = await import("../src/server/corpus-export.ts");
const { allChapters } = await import("../src/core/curriculum.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

function fauxEngine(steps: FauxResponseStep[]) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

const EPISODE = {
	title: "Robo pije kávu",
	sentences: [
		{ sk: "Robo je v Bratislave.", en: "Robo is in Bratislava." },
		{ sk: "Ráno ide do kaviarne.", en: "In the morning he goes to a café." },
		{ sk: "Pije kávu a je chlieb.", en: "He drinks coffee and eats bread." },
		{ sk: "Káva je dobrá, chlieb je dobrý.", en: "The coffee is good, the bread is good." },
		{ sk: "Potom ide domov.", en: "Then he goes home." },
		{ sk: "Doma má psa.", en: "At home he has a dog." },
	],
	newWords: [{ sk: "kaviareň", en: "café" }],
	questions: [
		{ q: "Kde je Robo?", options: ["V Bratislave", "V Košiciach", "Doma"], answer: 0 },
		{ q: "Čo pije?", options: ["Čaj", "Kávu", "Vodu"], answer: 1 },
		{ q: "Čo má doma?", options: ["Mačku", "Psa", "Auto"], answer: "Psa" },
	],
	recap: "Robo has coffee and bread in a café, then goes home to his dog.",
};

describe("the pure rules", () => {
	it("tokenizes a sentence into words and the pieces between them, losslessly", () => {
		const t = core.tokenize("„Dobrý deň,“ povedal Robo — a odišiel.");
		assert.equal(t.map((x) => x.text).join(""), "„Dobrý deň,“ povedal Robo — a odišiel.");
		assert.deepEqual(t.filter((x) => x.word).map((x) => x.text), ["Dobrý", "deň", "povedal", "Robo", "a", "odišiel"]);
		assert.deepEqual(core.tokenize("rock'n'roll 5-krát").filter((x) => x.word).map((x) => x.text), ["rock'n'roll", "5-krát"]);
	});

	it("reads the model's JSON out of fences and prose, and normalizes the questions", () => {
		const d = core.parseStoryDraft(`Here you go:\n\`\`\`json\n${JSON.stringify(EPISODE)}\n\`\`\`\nEnjoy!`);
		assert.equal(d.title, "Robo pije kávu");
		assert.equal(d.sentences.length, 6);
		assert.equal(d.questions.length, 3);
		assert.equal(d.questions[2]!.answer, 1, "an answer given as text becomes its index");
		const kinds = core.parseStoryDraft(JSON.stringify({ ...EPISODE, questions: [{ kind: "vocab", q: "Čo znamená „čerstvý“?", options: ["nový", "starý", "drahý", "malý"], answer: 0 }, { kind: "nonsense", q: "Kde?", options: ["a", "b"], answer: 1 }] }));
		assert.equal(kinds.questions[0]!.kind, "vocab", "the model's kind is kept");
		assert.equal(kinds.questions[0]!.options.length, 4, "four options from B1");
		assert.equal(kinds.questions[1]!.kind, undefined, "an unknown kind is dropped, the question kept");
		assert.deepEqual(core.QUESTION_PLAN.A1.kinds, ["recall", "recall", "recall"]);
		assert.ok(core.QUESTION_PLAN.B1.kinds.includes("inference") && core.QUESTION_PLAN.B1.options === 4);
		assert.ok(core.QUESTION_PLAN.C1.kinds.includes("attitude") && core.QUESTION_PLAN.C1.count === 5);
		assert.throws(() => core.parseStoryDraft("Sorry, I cannot do that."), /no JSON/);
		assert.throws(() => core.parseStoryDraft('{"title": "x", "sentences": [{"sk": "Ahoj."}]}'), /sentences/);
	});

	it("grades the check and pays XP for the text once and the questions every time", () => {
		const qs = EPISODE.questions.map((q) => ({ ...q, answer: Number(q.answer === "Psa" ? 1 : q.answer) }));
		assert.deepEqual(core.gradeAnswers(qs, [0, 1, 1]), { correct: 3, total: 3 });
		assert.deepEqual(core.gradeAnswers(qs, [0, 2]), { correct: 1, total: 3 });
		assert.equal(core.readXp(6, 3, false), 27);
		assert.equal(core.readXp(6, 3, true), 15);
		assert.equal(core.storyId(3, "Robo na trhu!"), "ep-003-robo-na-trhu");
	});

	it("measures coverage from the fresh marks", () => {
		const s = [{ tokens: [{ text: "a", word: true }, { text: " ", word: false }, { text: "b", word: true, fresh: true }, { text: "c", word: true }, { text: "d", word: true }] }];
		assert.equal(core.knownCoverage(s), 0.75);
		assert.equal(core.knownCoverage([{ tokens: [] }]), 1);
	});
});

describe("glossing against the lexicon", () => {
	const lexicon = loadLexicon()!;

	it("finds the lemma behind a form: listed forms, then the stem", () => {
		assert.equal(reading.resolveWord(lexicon, "pije", new Set())?.slug, "pit", "a listed verb form");
		assert.equal(reading.resolveWord(lexicon, "Kávu", new Set())?.slug, "kava", "a noun case by stem");
		assert.equal(reading.resolveWord(lexicon, "kaviarne", new Set())?.slug, "kaviaren");
		assert.equal(reading.resolveWord(lexicon, "pekného", new Set())?.slug, "pekny", "an adjective form");
		assert.equal(reading.resolveWord(lexicon, "chýba", new Set())?.sk, "chýbať", "diacritics decide between look-alikes");
		assert.equal(reading.resolveWord(lexicon, "Xyzzyq", new Set()), undefined);
	});

	it("resolves the lexicon's own cloze forms to their entries at least 94 times in 100", () => {
		let n = 0;
		let ok = 0;
		for (const e of lexicon.entries) {
			for (const ex of e.examples) {
				if (!ex.cloze) continue;
				n++;
				if (reading.resolveWord(lexicon, ex.cloze.answer, new Set())?.slug === e.slug) ok++;
			}
		}
		assert.ok(n > 20_000);
		assert.ok(ok / n >= 0.94, `${ok}/${n} = ${(ok / n).toFixed(3)}`);
	});

	it("glosses a sentence: dictionary words carry lemma and gloss, unmet words are fresh, names are not", () => {
		const known = new Set(["pit", "kava", "byt"]);
		const s = reading.glossSentence("Robo pije kávu v kaviarni.", "Robo drinks coffee in a café.", lexicon, known, [{ lemma: "kaviareň", gloss: "café", slug: "kaviaren" }]);
		assert.equal(s.tokens.map((t) => t.text).join(""), "Robo pije kávu v kaviarni.");
		const words = s.tokens.filter((t) => t.word);
		assert.equal(words[0]!.text, "Robo");
		assert.equal(words[0]!.fresh, undefined, "a capitalised name is not fresh vocabulary");
		assert.equal(words[1]!.lemma, "piť");
		assert.match(words[1]!.gloss!, /drink/);
		assert.equal(words[1]!.fresh, undefined);
		assert.equal(words[2]!.lemma, "káva");
		assert.equal(words[4]!.slug, "kaviaren");
		assert.equal(words[4]!.fresh, true, "a word not in the known set is fresh");
	});

	it("reads the grammar table as known even when the dictionary also has the word, and beats a stem guess", () => {
		const s = reading.glossSentence("Aj nejaký človek povedal jedno, tri alebo štyri.", "", lexicon, new Set(), []);
		const w = (text: string) => s.tokens.find((t) => t.text === text)!;
		assert.equal(w("Aj").fresh, undefined, "aj is in the dictionary but unmet; the table still makes it known");
		assert.equal(w("nejaký").fresh, undefined);
		assert.equal(w("jedno").lemma, "jeden", "jedno is the number, not a form of jednať");
		assert.equal(w("jedno").fresh, undefined);
		assert.equal(w("tri").lemma, "tri", "tri is the number, not trio");
		assert.equal(w("štyri").fresh, undefined);
	});
});

describe("an episode on a scripted engine", () => {
	it("knows the learner: level, chapter, met words, grammar held", () => {
		const k = reading.knownWords();
		assert.equal(k.level, "A1");
		assert.ok(k.known.size > 100, "common words at the level count as known");
		assert.equal(k.met.size, 0);
		const brief = reading.storyBrief(k, [], []);
		assert.equal(brief.episode, 1);
		assert.match(brief.prompt, /episode 1 of the running series/, "without a story bible the series has no named lead");
		assert.match(brief.prompt, /first episode/);
		assert.match(brief.prompt, /20 to 25 sentences/);
		const diary = reading.storyBrief(k, [{ id: "x", series: "diary", episode: 0, title: "t", level: "A2", theme: "a diary page", genre: "diary", topic: "a rainy Monday", createdAt: "", wordCount: 40, coverage: 0.95, newWords: [], model: "m" }], [], new Date(), "diary");
		assert.equal(diary.episode, 0);
		assert.match(diary.prompt, /diary entry/);
		assert.match(diary.prompt, /write about something else\): a rainy Monday/);
		assert.doesNotMatch(diary.prompt, /first episode/);
	});

	it("the shelf plan: the learner's level first, one each side, genres rotate, Robo first", () => {
		const needs = core.shelfNeeds("A2", []);
		assert.deepEqual(needs.map((n) => n.level), ["A2", "A2", "A2", "A1", "B1"]);
		assert.equal(needs[0]!.genre, "robo");
		assert.equal(new Set(needs.filter((n) => n.level === "A2").map((n) => n.genre)).size, 3, "three different genres at the own level");
		const stocked = core.shelfNeeds("A2", [{ level: "A2", genre: "robo" }, { level: "A2", genre: "dialogue" }, { level: "A2", genre: "diary" }, { level: "A1", genre: "robo" }, { level: "B1", genre: "news" }]);
		assert.deepEqual(stocked, [], "a full shelf needs nothing");
		assert.ok(core.shelfNeeds("A1", []).every((n) => n.level !== "A1" || core.genreInfo(n.genre).from === "A1"), "A1 only gets A1 genres");
		assert.ok(!core.shelfNeeds("C1", []).some((n) => n.level === "C2" as never));
	});

	it("the picker: the best-fitting unread story, Robo in order, none when too hard", () => {
		const mk = (id: string, level: "A1" | "A2" | "B1", genre: StoryGenre, episode: number, fresh: number): StoryRecord => ({
			id, lang: "sk", series: genre, episode, title: id, level, chapter: "hello", theme: "t", genre, createdAt: "2026-10-28T00:00:00Z", drafts: 1, wordCount: 20, coverage: 1, recap: "", usage: { model: "m", steps: [] }, questions: [], newWords: [],
			sentences: [{ sk: "x", en: "x", tokens: Array.from({ length: 20 }, (_, i) => ({ text: "w", word: true, slug: i < fresh ? `unk${i}` : `k${i}`, ...(i < fresh ? { fresh: true } : {}) })) }],
		});
		const known = new Set(Array.from({ length: 20 }, (_, i) => `k${i}`));
		const input = { level: "A2" as const, known, recentGenres: ["dialogue" as const], recentTopics: [] };
		const good = mk("ep-2", "A2", "robo", 2, 1); // 95% known
		const later = mk("ep-3", "A2", "robo", 3, 0);
		const hard = mk("news", "B1", "news", 0, 6); // 70% known
		const dialogue = mk("dlg", "A2", "dialogue", 0, 1);
		const pick = core.pickStory([later, hard, dialogue, good], input);
		assert.equal(pick?.story.id, "ep-2", "episode 2 before 3, Robo bonus over the dialogue just read");
		assert.ok(pick!.reason.coverage > 0.9 && pick!.reason.line.includes("95 of 100"));
		assert.equal(core.pickStory([hard], input), null, "70% known is not readable: write a new one");
		assert.equal(core.pickStory([], input), null);
		assert.equal(core.storyCoverage(good, known), 0.95);
	});

	it("the model's text as it streams: the Slovak sentences so far", () => {
		const partial = '{"title": "Ahoj", "cast": [{"name": "Robo"}], "sentences": [{"who": "narrator", "sk": "Robo je doma.", "en": "Robo is at home."}, {"who": "Robo", "sk": "„Ahoj, mama!“ hovor';
		assert.deepEqual(reading.sentencesSoFar(partial), ["Robo je doma."], "a sentence is listed once its closing quote has arrived");
		assert.deepEqual(reading.sentencesSoFar(partial + 'í.", "en": "x"}'), ["Robo je doma.", "„Ahoj, mama!“ hovorí."]);
	});

	it("cast and speakers: parsed from the draft, each character gets a stable voice, the narrator its own", async () => {
		const { assignVoices, NARRATOR_VOICE, VOICE_PALETTE } = await import("../src/server/voices.ts");
		const d = core.parseStoryDraft(JSON.stringify({ ...EPISODE, cast: [{ name: "Robo", gender: "m", age: "young" }, { name: "Eva", gender: "female", age: "old" }], sentences: [{ who: "narrator", sk: "Robo je doma.", en: "x" }, { who: "Eva", sk: "Ahoj, Robo!", en: "x" }, { who: "Nobody", sk: "Kto?", en: "x" }] }));
		assert.deepEqual(d.cast, [{ name: "Robo", gender: "m", age: "young" }, { name: "Eva", gender: "f", age: "old" }]);
		assert.deepEqual(d.sentences.map((s) => s.who), [undefined, "Eva", undefined], "narrator and unknown names carry no speaker");
		const voiced = assignVoices(d.cast);
		assert.equal(voiced.length, 2);
		assert.ok(voiced.every((c) => c.voice && c.voice !== NARRATOR_VOICE), "characters never use the narrator's voice");
		assert.notEqual(voiced[0]!.voice, voiced[1]!.voice);
		assert.equal(VOICE_PALETTE.find((v) => v.id === voiced[0]!.voice)?.gender, "m");
		assert.equal(VOICE_PALETTE.find((v) => v.id === voiced[1]!.voice)?.age, "old");
		assert.equal(assignVoices([{ name: "robo", gender: "m", age: "young" }])[0]!.voice, voiced[0]!.voice, "the same name gets the same voice in every story");
		assert.equal(assignVoices(d.cast, new Set([NARRATOR_VOICE]))[0]!.voice, NARRATOR_VOICE, "with no usable voice in the account, the narrator reads it");
	});

	it("writes, glosses, measures and keeps the episode; usage is on the record", async () => {
		const engine = fauxEngine([fauxAssistantMessage(JSON.stringify(EPISODE))]);
		const story = await reading.generateStory({ engine, model: "faux:story", now: new Date("2026-10-28T10:00:00Z") });
		assert.equal(story.id, "ep-001-robo-pije-kavu");
		assert.equal(story.episode, 1);
		assert.equal(story.level, "A1");
		assert.equal(story.sentences.length, 6);
		assert.equal(story.questions.length, 3);
		assert.equal(story.questions[2]!.answer, 1);
		assert.deepEqual(story.questions.map((q) => q.kind), ["recall", "recall", "recall"], "an A1 episode's questions are literal, stamped from the plan");
		assert.match(reading.questionLine("B1"), /4 options/);
		assert.match(reading.questionLine("B1"), /inference/);
		assert.match(reading.questionLine("A1"), /3 options/);
		assert.ok(story.coverage > 0.6 && story.coverage <= 1, `coverage ${story.coverage}`);
		assert.equal(story.drafts, 1);
		assert.equal(story.usage.model, "faux:story");
		assert.equal(story.usage.steps.length, 1);
		assert.ok(story.newWords.some((w) => w.slug === "kaviaren"), "the introduced word is on the list with its slug");
		assert.equal(story.genre, "robo");
		assert.ok(Array.isArray(story.cast) && story.narratorVoice, "the record carries its cast and narrator voice");
		assert.ok(fs.existsSync(path.join(PATHS.stories, "ep-001-robo-pije-kavu.json")));
		assert.ok(fs.existsSync(path.join(PATHS.stories, "README.md")), "the folder explains itself");
		const index = storyStore.list();
		assert.equal(index.length, 1);
		assert.equal(index[0]!.title, "Robo pije kávu");
		assert.equal(index[0]!.model, "faux:story");
	});

	it("the unread episode is reused: nextStory does not call the model again", async () => {
		const engine = fauxEngine([]); // any call would fail
		const again = await reading.nextStory({ engine });
		assert.equal(again.id, "ep-001-robo-pije-kavu");
		const state = reading.readingState();
		assert.equal(state.current?.id, "ep-001-robo-pije-kavu");
		assert.equal(state.library.length, 1);
		assert.equal(state.library[0]!.reads, 0);
		assert.equal(state.readToday, 0);
	});

	it("a reading: graded, logged, XP and the day, the new words into the deck, the plan's Read task done", () => {
		const before = progressSummary(0, new Date("2026-10-28T10:30:00Z"));
		const task = before.plan.tasks.find((t) => t.id === "read");
		assert.ok(task, "the plan has a Read task");
		assert.equal(task.done, false);
		assert.equal(task.href, "/read");

		const out = reading.recordRead({ storyId: "ep-001-robo-pije-kavu", answers: [0, 1, 0], tapped: ["pes", "kava"], ms: 150_000, tz: 0 }, new Date("2026-10-28T10:31:00Z"));
		assert.equal(out.correct, 2);
		assert.equal(out.total, 3);
		assert.equal(out.xp, 6 * 2 + 2 * 5);
		assert.equal(out.reread, false);
		assert.ok(out.queued.includes("kaviaren"), "the episode's new word is in the deck");
		assert.ok(out.queued.includes("pes"), "a word looked up is in the deck");
		const cards = Object.values(reviewStore.readCards());
		assert.ok(cards.some((c) => c.slug === "kaviaren"));
		const p = progressStore.read();
		assert.equal(p.days["2026-10-28"]?.reads, 1);
		assert.equal(p.xp, out.xp);
		assert.ok((p.days["2026-10-28"]?.minutes ?? 0) > 2);
		const log = storyStore.reads();
		assert.equal(log.length, 1);
		assert.deepEqual(log[0]!.answers, [0, 1, 0]);
		assert.deepEqual(log[0]!.tapped, ["pes", "kava"]);
		assert.equal(out.summary.plan.tasks.find((t) => t.id === "read")?.done, true);
		const state = reading.readingState(0, new Date("2026-10-28T10:32:00Z"));
		assert.equal(state.current, null, "nothing unread is left");
		assert.equal(state.readToday, 1);
		assert.equal(state.library[0]!.reads, 1);
		assert.deepEqual(state.library[0]!.lastScore, { correct: 2, total: 3 });
	});

	it("a draft under the coverage floor is written again, and the easier draft wins", async () => {
		const hard = {
			...EPISODE,
			title: "Ťažký deň",
			sentences: [
				{ sk: "Xyzzor blorfuje grimbalu.", en: "nonsense" },
				{ sk: "Quuxor plimblaje zorbam.", en: "nonsense" },
				{ sk: "Frobnic wibblaje.", en: "nonsense" },
			],
		};
		const engine = fauxEngine([fauxAssistantMessage(JSON.stringify(hard)), fauxAssistantMessage(JSON.stringify({ ...EPISODE, title: "Lepší deň" }))]);
		const story = await reading.generateStory({ engine, model: "faux:story", now: new Date("2026-10-29T10:00:00Z") });
		assert.equal(story.episode, 2);
		assert.equal(story.title, "Lepší deň");
		assert.equal(story.drafts, 2);
		assert.equal(story.usage.steps.length, 2, "both drafts are paid for and on the record");
		assert.match(story.recap, /coffee/);
	});

	it("fills the shelf in the background: one story per need, varied genres, the day's cap, and the picker serves it", async () => {
		const piece = (title: string, genre: string) => fauxAssistantMessage(JSON.stringify({ ...EPISODE, title, topic: `${genre} topic`, cast: [{ name: "Robo", gender: "m", age: "young" }], sentences: EPISODE.sentences.map((x, i) => ({ ...x, who: i === 0 ? "narrator" : "Robo" })) }));
		const before = storyStore.list().length;
		const engine = fauxEngine(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((t) => piece(`Príbeh ${t}`, t)));
		const written = await reading.fillShelf({ engine, model: "faux:shelf", now: new Date("2026-10-29T09:00:00Z") });
		const list = storyStore.list();
		assert.ok(written >= 3 && written <= core.SHELF_DAILY_CAP, `wrote ${written}`);
		assert.equal(list.length, before + written);
		const fresh = list.slice(before);
		assert.ok(reading.library().filter((s) => s.reads === 0 && s.level === "A1").length >= 3, "three unread at the learner's level");
		assert.ok(fresh.some((s) => s.level === "A2"), "one at the level above");
		assert.ok(new Set(reading.library().filter((s) => s.reads === 0 && s.level === "A1").map((s) => s.genre ?? "robo")).size >= 3, "different genres at the own level");
		assert.ok(fresh.every((s) => s.genre === "robo" || s.id.startsWith(`${s.genre}-`)), "stand-alone pieces are named by genre");
		assert.equal(await reading.fillShelf({ engine, now: new Date("2026-10-29T09:00:00Z") }), 0, "a stocked shelf writes nothing");
		const state = reading.readingState(0, new Date("2026-10-29T09:00:00Z"));
		assert.ok(state.current, "the picker has something to offer");
		assert.ok(state.pick && state.pick.coverage > 0.9, "and says why");
		assert.equal(state.generating, null);
		assert.equal(storyStore.get(state.current!.id)!.sentences[1]!.who, "Robo", "speakers are kept on the sentences");
	});

	it("the spending report and the export see the episodes", () => {
		const report = usageReport(new Date("2026-10-29T12:00:00Z"));
		assert.ok(report.stories.count >= 5);
		assert.equal(report.stories.unpriced, report.stories.count, "a faux model has no catalog price");
		assert.equal(report.storiesUsd, 0);
		const { dir, summary } = exportCorpus({ stamp: "reading-test", now: new Date("2026-10-29T12:00:00Z") });
		assert.equal(summary.counts.stories, report.stories.count);
		assert.equal(summary.counts.readings, 1);
		const file = JSON.parse(fs.readFileSync(path.join(dir, "stories.json"), "utf-8")) as { stories: unknown[]; readings: unknown[] };
		assert.equal(file.stories.length, report.stories.count);
		assert.equal(file.readings.length, 1);
		assert.match(fs.readFileSync(path.join(dir, "README.md"), "utf-8"), /stories\.json/);
	});
});


// ─── Chapter story episodes (chapter-arc phase 2): the bible, the picker,
// ─── the brief seeded from it, the field kept on disk ───────────────────────

describe("the story bible (curriculum/slovak/world.json)", () => {
	const bible = JSON.parse(fs.readFileSync(path.join(PATHS.curriculum, "slovak", "world.json"), "utf-8")) as {
		cast: Array<{ name: string; gender: string; age: string; role: string }>;
		places: Array<{ id: string; name: string; note: string }>;
		beats: Record<string, string>;
	};

	it("carries six cast members starting with Robo, six places, and one beat per chapter", () => {
		assert.equal(bible.cast.length, 6);
		assert.equal(bible.cast[0]!.name, "Robo", "the lead is listed first");
		assert.ok(bible.cast.every((c) => c.name.length > 0 && c.role.length > 0 && /^[A-ZÁÄÔĽŔŠČŤŽÝ]/.test(c.name)), "Slovak names, each with a one-line role");
		assert.ok(bible.cast.every((c) => c.gender === "f" || c.gender === "m"));
		assert.ok(bible.cast.every((c) => ["child", "young", "adult", "old"].includes(c.age)));
		assert.equal(bible.places.length, 6);
		assert.ok(bible.places.every((p) => p.id && p.name && p.note), "each place named with its note");
		assert.deepEqual(Object.keys(bible.beats).sort(), allChapters().map((c) => c.id).sort(), "one beat per chapter, keyed exactly by the chapters' ids");
		assert.equal(Object.keys(bible.beats).length, allChapters().length, "no extra or missing beats");
		for (const beat of Object.values(bible.beats)) assert.match(beat.trim(), /\.$/, "each beat is one closed sentence");
	});

	it("seeds the Robo brief with the cast and the chapter's beat; stand-alone pieces leave it out", async () => {
		const { loadWorld } = await import("../src/server/world.ts");
		const world = loadWorld();
		assert.ok(world, "the Slovak profile has a bible");
		const brief = reading.storyBrief(reading.knownWords(), [], [], new Date(), "robo", world);
		assert.match(brief.prompt, /episode 1 of the Robo series/, "the bible names the lead");
		assert.match(brief.prompt, /Series bible, keep them as written — the cast: Robo \(man, young\) the lead/);
		assert.match(brief.prompt, /Zuzka/);
		assert.match(brief.prompt, /This episode's beat: "Robo arrives in Bratislava with two suitcases and meets Zuzka in the stairwell/, "the current chapter's beat (hello) is in the brief");
		assert.match(brief.prompt, /Miletičova market/, "the bible's places are in the brief");
		const diary = reading.storyBrief(reading.knownWords(), [], [], new Date(), "diary", world);
		assert.doesNotMatch(diary.prompt, /Series bible/, "a stand-alone piece uses no series bible");
		assert.doesNotMatch(diary.prompt, /beat/, "and no chapter beat");
	});

	it("the picker: the current chapter's unread episodes come first, in publication order, whatever their score", () => {
		const mk = (id: string, chapter: string, episode: number, createdAt: string, fresh: number): StoryRecord => ({
			id, lang: "sk", series: "robo", episode, title: id, level: "A2", chapter, theme: "t", genre: "robo", createdAt, drafts: 1, wordCount: 20, coverage: 1, recap: "", usage: { model: "m", steps: [] }, questions: [], newWords: [],
			sentences: [{ sk: "x", en: "x", tokens: Array.from({ length: 20 }, (_, i) => ({ text: "w", word: true, slug: i < fresh ? `unk${i}` : `k${i}`, ...(i < fresh ? { fresh: true } : {}) })) }],
		});
		const known = new Set(Array.from({ length: 20 }, (_, i) => `k${i}`));
		const chapterFirst = mk("ep-5", "cafe", 5, "2026-11-01T09:00:00Z", 6); // 70% known — normally not readable
		const chapterSecond = mk("ep-6", "cafe", 6, "2026-11-02T09:00:00Z", 0);
		const better = mk("ep-4", "hello", 4, "2026-11-03T09:00:00Z", 0); // 100% known, would outscore the hard one normally
		const input = { level: "A2" as const, known, recentGenres: [] as const, recentTopics: [] as const, chapter: "cafe" };
		const pick = core.pickStory([better, chapterSecond, chapterFirst], input);
		assert.equal(pick?.story.id, "ep-5", "the chapter's first unread episode, even when it scores lower");
		assert.equal(pick!.reason.coverage, 0.7, "it comes out even when hard: the gate that nulls other stories is bypassed");
		const ordered = core.pickStory([chapterSecond, chapterFirst], input);
		assert.equal(ordered?.story.id, "ep-5", "publication order (written first) decides among the chapter's episodes");
		const other = core.pickStory([chapterFirst, better], { ...input, chapter: "offices" });
		assert.equal(other?.story.id, "ep-4", "an episode of another chapter is not preferred: the best fit wins");
		assert.equal(core.pickStory([chapterFirst], { level: "A2", known, recentGenres: [], recentTopics: [] }), null, "no chapter given: the old rule that nulls a 70% story holds");
	});

	it("the chapter field survives the store's round trip, record and index", () => {
		const record: StoryRecord = { id: "round-trip-test", lang: "sk", series: "robo", episode: 900, title: "round trip", level: "A1", chapter: "offices", theme: "t", createdAt: "2026-11-01T00:00:00Z", sentences: [], questions: [], newWords: [], recap: "", coverage: 1, wordCount: 0, usage: { model: "m", steps: [] }, drafts: 1 };
		storyStore.put(record);
		assert.equal(storyStore.get(record.id)?.chapter, "offices", "the record keeps it");
		assert.equal(storyStore.list().find((s) => s.id === record.id)!.chapter, "offices", "the index line keeps it");
	});
});

describe("the chapter's episode on the shelf", () => {
	it("a chapter without an episode gets one written before the shelf top-ups, and the picker serves it first", async () => {
		// Move the learner on: finish Chapter 1 (Hello), so the current
		// chapter is At the café and no episode of it exists yet.
		const p = progressStore.read();
		for (const id of ["words", "lx-greetings", "sounds", "lx-questions", "present", "vykanie"]) p.units[id] = { lessons: 3, reps: 30, correct: 30 };
		progressStore.write(p);
		const k = reading.knownWords();
		assert.equal(k.chapter, "cafe", "the learner is now in the second chapter");
		assert.ok(!storyStore.list().some((s) => s.chapter === "cafe"), "no episode of it exists");
		const beforeIds = new Set(storyStore.list().map((s) => s.id));
		const piece = (t: string) => fauxAssistantMessage(JSON.stringify({ ...EPISODE, title: t, topic: "shelf topic", cast: [{ name: "Robo", gender: "m", age: "young" }], sentences: EPISODE.sentences.map((x, i) => ({ ...x, who: i === 0 ? "narrator" : "Robo" })) }));
		const written = await reading.fillShelf({ engine: fauxEngine([piece("Dvojkáva"), piece("Trojkáva")]), model: "faux:shelf", now: new Date("2026-10-30T09:00:00Z") });
		const fresh = storyStore.list().filter((s) => !beforeIds.has(s.id));
		assert.ok(written >= 1, "something was written");
		const chapterStories = fresh.filter((s) => s.chapter === "cafe");
		assert.equal(chapterStories.length, 1, "exactly one episode for the new chapter");
		assert.equal(chapterStories[0]!.genre, "robo", "the chapter's episode is a Robo episode");
		const state = reading.readingState(0, new Date("2026-10-30T09:01:00Z"));
		assert.equal(state.current?.chapter, "cafe", "the picker serves the chapter's episode, not the unread shelf stock");
	});
});
describe("a language other than Slovak", () => {
	it("the writer and the brief name the language and its country, and no Slovak place or word", async () => {
		const ESTONIAN = { english: "Estonian", tag: "et-EE" };
		const system = reading.storySystem(ESTONIAN, null);
		assert.match(system, /graded Estonian reading texts/);
		assert.match(system, /a town in Estonia/);
		assert.doesNotMatch(system, /Slovak|Bratislava|Robo|že/);
		const brief = reading.storyBrief(reading.knownWords(), [], [], new Date(), "travel", null, ESTONIAN);
		assert.match(brief.prompt, /a real town, region or custom in Estonia/);
		assert.equal(reading.episodeTheme(["curious"], 2, null), "a day in the mountains");
	});
});
