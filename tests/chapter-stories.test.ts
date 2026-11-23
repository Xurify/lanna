import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import type { StoryDraft } from "../src/core/reading.ts";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-chapter-stories-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { CHAPTER_STORIES } = await import("../src/core/chapter-stories.ts");
const { allChapters, curriculumState, curriculumUnit } = await import("../src/core/curriculum.ts");
const { chapterArc } = await import("../src/core/arc.ts");
const { keepChapterStory, SHIPPED_STORY_MODEL } = await import("../src/server/chapter-stories.ts");
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
		});
	}
});
