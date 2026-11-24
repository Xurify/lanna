import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { isCoverMotif } from "../src/core/cover.ts";
import type { StoryDraft } from "../src/core/reading.ts";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-chapter-stories-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { CHAPTER_STORIES, chapterStoriesFor } = await import("../src/core/chapter-stories.ts");
const { allChapters, curriculumState, curriculumUnit } = await import("../src/core/curriculum.ts");
const { chapterArc } = await import("../src/core/arc.ts");
const { applyStoryGlosses, authoredNewWords, keepChapterStory, SHIPPED_STORY_MODEL } =
	await import("../src/server/chapter-stories.ts");
const { recordRead } = await import("../src/server/reading.ts");
const { storyStore } = await import("../src/store/stories.ts");
const { progressStore } = await import("../src/store/progress.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const chapterOf = (id: string) => allChapters().find((c) => c.units.includes(id));

describe("chapter stories on the Slovak path", () => {
	it("sits right after the weather words in Plans and weather, as the chapter's story step", () => {
		const plans = chapterOf("story-rainbow")!;
		assert.equal(plans.id, "plans");
		assert.equal(plans.units[plans.units.indexOf("lx-weather") + 1], "story-rainbow");
		assert.equal(curriculumUnit("story-rainbow")?.kind, "story");
		assert.deepEqual(chapterArc("plans")![0]!.units, ["story-rainbow"]);
	});

	it("puts the café story right after the food words in At the café, before the chapter's goal", () => {
		const cafe = chapterOf("story-cafe")!;
		assert.equal(cafe.id, "cafe");
		assert.equal(cafe.units[cafe.units.indexOf("lx-food") + 1], "story-cafe");
		assert.ok(cafe.units.indexOf("story-cafe") < cafe.units.indexOf("can-order"));
		assert.equal(curriculumUnit("story-cafe")?.kind, "story");
	});

	const a1Stories = [
		{ id: "story-hello", chapter: "hello", after: "present", goal: "can-introduce" },
		{ id: "story-town", chapter: "town", after: "lx-transport", goal: "can-directions" },
		{ id: "story-family", chapter: "family", after: "lx-home", goal: "can-family" },
		{ id: "story-everyday", chapter: "everyday", after: "lx-colours", goal: "can-describe-day" },
		{ id: "story-yesterday", chapter: "yesterday", after: "byt-past", goal: "can-tell-day" },
	];
	for (const s of a1Stories) {
		it(`puts ${s.id} right after ${s.after} in ${s.chapter}, before ${s.goal}`, () => {
			const ch = chapterOf(s.id)!;
			assert.equal(ch.id, s.chapter);
			assert.equal(ch.units[ch.units.indexOf(s.after) + 1], s.id);
			assert.ok(ch.units.indexOf(s.id) < ch.units.indexOf(s.goal));
			assert.equal(curriculumUnit(s.id)?.kind, "story");
		});
	}

	it("the café story is kept in At the café at A1, and a name the dictionary took for a verb is glossed as a name", async () => {
		const story = (await keepChapterStory("story-cafe"))!;
		assert.equal(story.chapter, "cafe");
		assert.equal(story.level, "A1");
		assert.equal(story.cover, "cup");
		const name = story.sentences.flatMap((s) => s.tokens).find((t) => t.text === "Lucia")!;
		assert.equal(name.gloss, "Lucia (a name)");
		assert.equal(name.cat, undefined, "a name the dictionary took for a verb keeps none of the verb's labels");
	});

	for (const s of chapterStoriesFor("slovak")) {
		it(`${s.id} is glossed in full and kept in its chapter`, async () => {
			const story = (await keepChapterStory(s.id))!;
			assert.equal(story.chapter, chapterOf(s.id)!.id);
			const words = story.sentences.flatMap((x) => x.tokens.filter((t) => t.word));
			assert.deepEqual(
				words.filter((t) => !t.gloss).map((t) => t.text),
				[],
			);
			assert.deepEqual(
				words.filter((t) => t.gloss?.endsWith("(a name)") && t.cat).map((t) => `${t.text}: ${t.cat}`),
				[],
			);
		});
	}

	it("two opens at once write one copy", async () => {
		await Promise.all([keepChapterStory("story-rainbow"), keepChapterStory("story-rainbow")]);
		assert.equal(storyStore.list().filter((s) => s.id === "story-rainbow").length, 1);
	});

	it("is glossed and kept on first open without a model call, and done after one reading", async () => {
		const story = (await keepChapterStory("story-rainbow"))!;
		assert.equal(story.id, "story-rainbow");
		assert.equal(story.chapter, "plans");
		assert.equal(story.level, "A2");
		assert.equal(story.usage.model, SHIPPED_STORY_MODEL);
		assert.equal(story.usage.steps.length, 0);
		assert.ok(story.sentences.every((s) => s.tokens.some((t) => t.word)));
		assert.equal(storyStore.list().filter((s) => s.id === "story-rainbow").length, 1);
		await keepChapterStory("story-rainbow");
		assert.equal(storyStore.list().filter((s) => s.id === "story-rainbow").length, 1, "opened twice, kept once");

		const unitStatus = () =>
			curriculumState(progressStore.read().units)
				.chapters.flatMap((c) => c.units)
				.find((u) => u.id === "story-rainbow")!;
		assert.notEqual(unitStatus().status, "done");
		recordRead({ storyId: "story-rainbow", answers: story.questions.map((q) => q.answer), tapped: [] });
		assert.equal(unitStatus().status, "done");
		assert.equal(unitStatus().accuracy, 1);
	});

	it("a chapter finishes without its story, and the story is done once read", () => {
		const plans = chapterOf("story-rainbow")!;
		const finished: Record<string, { lessons: number; reps: number; correct: number }> = {};
		for (const id of plans.units) if (id !== "story-rainbow") finished[id] = { lessons: 5, reps: 50, correct: 50 };
		const plansWith = (evidence: typeof finished) =>
			curriculumState(evidence, "B2", { startChapter: "plans" }).chapters.find((c) => c.id === "plans")!;
		const unread = plansWith(finished);
		assert.equal(unread.done, true);
		assert.equal(unread.units.find((u) => u.kind === "goal")!.status, "done");
		assert.equal(unread.units.find((u) => u.id === "story-rainbow")!.status, "open");
		const read = plansWith({ ...finished, "story-rainbow": { lessons: 1, reps: 1, correct: 1 } });
		assert.equal(read.units.find((u) => u.id === "story-rainbow")!.status, "done");
	});

	it("rebuilds a kept copy whose shipped file changed: list() shows one entry with the rebuilt title, reads untouched", async () => {
		const reads = storyStore.reads().length;
		const kept = storyStore.get("story-rainbow")!;
		storyStore.put({ ...kept, title: "Story: an older title", shippedHash: "an older text" });
		const rebuilt = (await keepChapterStory("story-rainbow"))!;
		const shipped = createHash("sha256")
			.update(fs.readFileSync("curriculum/slovak/stories/story-rainbow.json", "utf-8"))
			.digest("hex");
		assert.equal(rebuilt.shippedHash, shipped);
		assert.equal(storyStore.get("story-rainbow")!.shippedHash, shipped);
		const entries = storyStore.list().filter((s) => s.id === "story-rainbow");
		assert.equal(entries.length, 1);
		assert.equal(entries[0]!.title, rebuilt.title);
		assert.notEqual(rebuilt.title, "Story: an older title");
		assert.equal(storyStore.reads().length, reads);
	});

	it("opens nothing for an id that is not a chapter story", async () => {
		assert.equal(await keepChapterStory("story-nothing"), null);
	});
});

describe("chapter stories in the written courses", () => {
	const cases = [
		{ language: "russian", chapter: "many-things", after: "lx-words-colors" },
		{ language: "estonian", chapter: "with-friends", after: "lx-words-colors" },
	];
	for (const c of cases) {
		it(`${c.language}: right after the colour words, with weather met in an earlier chapter`, () => {
			const g = globalThis as Record<string, unknown>;
			g.__lhCourse = JSON.parse(fs.readFileSync(`curriculum/${c.language}/course.json`, "utf-8"));
			try {
				const ch = chapterOf("story-rainbow")!;
				assert.equal(ch.id, c.chapter);
				assert.equal(ch.units[ch.units.indexOf(c.after) + 1], "story-rainbow");
				const chapters = allChapters();
				const weather = chapters.findIndex((x) => x.units.includes("lx-words-weather"));
				assert.ok(weather >= 0 && weather < chapters.indexOf(ch));
			} finally {
				g.__lhCourse = undefined;
			}
		});
	}

	const cafes = [
		{ language: "russian", chapter: "what-i-want", goal: "can-order-simply" },
		{ language: "estonian", chapter: "counting", goal: "can-buy-things" },
	];
	for (const c of cafes) {
		it(`${c.language}: the café story right after the food words, before ${c.goal}`, () => {
			const g = globalThis as Record<string, unknown>;
			g.__lhCourse = JSON.parse(fs.readFileSync(`curriculum/${c.language}/course.json`, "utf-8"));
			try {
				const ch = chapterOf("story-cafe")!;
				assert.equal(ch.id, c.chapter);
				assert.equal(ch.units[ch.units.indexOf("lx-words-food") + 1], "story-cafe");
				assert.ok(ch.units.indexOf("story-cafe") < ch.units.indexOf(c.goal));
			} finally {
				g.__lhCourse = undefined;
			}
		});
	}
});

describe("the A1 chapter stories of the written courses", () => {
	const placements: Record<string, Record<string, string>> = {
		russian: {
			"story-hello": "who-i-am",
			"story-town": "where-is-it",
			"story-family": "my-family",
			"story-everyday": "with-friends",
			"story-yesterday": "yesterday",
		},
		estonian: {
			"story-hello": "who-i-am",
			"story-town": "where-things-are",
			"story-family": "whose-is-it",
			"story-everyday": "with-friends",
			"story-yesterday": "yesterday",
		},
	};
	for (const [language, stories] of Object.entries(placements))
		it(`${language}: each story sits in the chapter whose grammar it uses`, () => {
			const g = globalThis as Record<string, unknown>;
			g.__lhCourse = JSON.parse(fs.readFileSync(`curriculum/${language}/course.json`, "utf-8"));
			try {
				for (const [id, chapter] of Object.entries(stories)) assert.equal(chapterOf(id)?.id, chapter, id);
			} finally {
				g.__lhCourse = undefined;
			}
		});

	it("a story's new words are the author's, with the dictionary's link only when it is the same word", () => {
		const words = authoredNewWords(
			[
				{ lemma: "naaber", gloss: "neighbour", slug: "naaber" },
				{ lemma: "peatuma", gloss: "to stop", slug: "peatuma" },
				{
					lemma: "площадь",
					gloss: "square (open area in a town or city); space, living space; area",
					slug: "ploshchad",
				},
			],
			[
				{ sk: "naaber", en: "neighbor" },
				{ sk: "peatus", en: "stop (bus or tram stop)" },
			],
		);
		assert.deepEqual(words, [
			{ lemma: "naaber", gloss: "neighbor", slug: "naaber" },
			{ lemma: "peatus", gloss: "stop (bus or tram stop)" },
		]);
	});

	it("occurrence overrides disambiguate homographs per sentence and per token occurrence without breaking word-wide glosses", () => {
		const sentences = [
			{
				sk: "Здесь есть кофе, я хочу есть.",
				en: "There is coffee here, I want to eat.",
				tokens: [
					{ text: "Здесь", word: true, lemma: "здесь", gloss: "here", slug: "zdes", cat: "Adverbs" },
					{ text: " ", word: false },
					{ text: "есть", word: true, lemma: "есть", gloss: "to eat", slug: "est-eat", cat: "Verbs" },
					{ text: " ", word: false },
					{ text: "кофе", word: true, lemma: "кофе", gloss: "coffee", slug: "kofe", cat: "Nouns" },
					{ text: ", ", word: false },
					{ text: "я", word: true, lemma: "я", gloss: "I", slug: "ya", cat: "Pronouns" },
					{ text: " ", word: false },
					{ text: "хочу", word: true, lemma: "хотеть", gloss: "to want", slug: "khotet", cat: "Verbs" },
					{ text: " ", word: false },
					{ text: "есть", word: true, lemma: "есть", gloss: "to eat", slug: "est-eat", cat: "Verbs" },
				],
			},
			{
				sk: "У нас есть чай.",
				en: "We have tea.",
				tokens: [
					{ text: "У", word: true, lemma: "у", gloss: "by", slug: "u", cat: "Prepositions" },
					{ text: " ", word: false },
					{ text: "нас", word: true, lemma: "мы", gloss: "we", slug: "my", cat: "Pronouns" },
					{ text: " ", word: false },
					{ text: "есть", word: true, lemma: "есть", gloss: "to eat", slug: "est-eat", cat: "Verbs" },
					{ text: " ", word: false },
					{ text: "чай", word: true, lemma: "чай", gloss: "tea", slug: "chay", cat: "Nouns" },
				],
			},
		];
		const applied = applyStoryGlosses(sentences, { есть: { lemma: "есть", gloss: "to eat" } }, [
			{ sentence: 0, token: "есть", occurrence: 0, lemma: "быть", gloss: "there is" },
			{ sentence: 1, token: "есть", lemma: "быть", gloss: "there is / have" },
		]);
		const firstSentenceMatches = applied[0]!.tokens.filter((token) => token.text === "есть");
		assert.equal(firstSentenceMatches[0]!.gloss, "there is");
		assert.equal(firstSentenceMatches[0]!.lemma, "быть");
		assert.equal(firstSentenceMatches[0]!.slug, undefined);
		assert.equal(firstSentenceMatches[1]!.gloss, "to eat");
		assert.equal(firstSentenceMatches[1]!.slug, "est-eat");
		const secondSentenceMatch = applied[1]!.tokens.find((token) => token.text === "есть")!;
		assert.equal(secondSentenceMatch.gloss, "there is / have");
		assert.equal(secondSentenceMatch.lemma, "быть");
	});
});

describe("the shipped story files", () => {
	for (const s of CHAPTER_STORIES) {
		it(`${s.language}/${s.id} has a cast, a full length and three answerable questions`, () => {
			const d = JSON.parse(fs.readFileSync(`curriculum/${s.language}/stories/${s.id}.json`, "utf-8")) as StoryDraft;
			const speakers = new Set(d.sentences.map((x) => x.who).filter((w) => w && w !== "narrator"));
			assert.deepEqual([...speakers].sort(), d.cast.map((x) => x.name).sort());
			assert.ok(d.sentences.length >= 20 && d.sentences.length <= 28);
			assert.ok(d.sentences.every((x) => x.sk.trim() && x.en.trim()));
			assert.equal(d.questions.length, 3);
			for (const q of d.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length);
			assert.ok(isCoverMotif(d.cover));
			const text = d.sentences.map((x) => x.sk.toLocaleLowerCase()).join(" ");
			const glosses = (d as StoryDraft & { glosses?: Record<string, unknown> }).glosses ?? {};
			for (const form of Object.keys(glosses)) {
				assert.equal(form, form.toLocaleLowerCase());
				assert.ok(text.includes(form), `${form} is glossed but not in the story`);
			}
		});
	}
});
