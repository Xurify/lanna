import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-story-cache-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const { storyStore } = await import("../src/store/stories.ts");
type StoryRecord = Parameters<typeof storyStore.put>[0];

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const story = (title: string): StoryRecord => ({
	id: "ep-001-cache",
	lang: "sk",
	series: "robo",
	episode: 1,
	title,
	level: "A2",
	chapter: "a1",
	theme: "daily",
	createdAt: "2026-11-16T10:00:00.000Z",
	sentences: [{ sk: "Martin je doma.", en: "Martin is at home.", tokens: [{ text: "Martin", word: true }] }],
	questions: [],
	newWords: [],
	recap: "Martin is home.",
	coverage: 1,
	wordCount: 3,
	usage: { model: "faux:story", steps: [] },
	drafts: 1,
});

test("a story is parsed once and the same frozen record is shared until the file changes", () => {
	storyStore.put(story("Martin je doma"));
	const first = storyStore.get("ep-001-cache");
	assert.equal(first?.title, "Martin je doma");
	assert.equal(storyStore.get("ep-001-cache"), first, "the second read reuses the parsed record");
	assert.ok(
		Object.isFrozen(first) && Object.isFrozen(first!.sentences[0]),
		"a shared record cannot be changed by one caller for all",
	);

	storyStore.put(story("Martin je zase doma"));
	assert.equal(storyStore.get("ep-001-cache")?.title, "Martin je zase doma", "a rewrite on disk is read again");
});

test("a story file edited by hand is read again", () => {
	const file = path.join(PATHS.stories, "ep-001-cache.json");
	const saved = JSON.parse(fs.readFileSync(file, "utf-8")) as StoryRecord;
	fs.writeFileSync(file, JSON.stringify({ ...saved, title: "Iný názov a dlhší" }, null, "\t"));
	assert.equal(storyStore.get("ep-001-cache")?.title, "Iný názov a dlhší");
});
