import fs from "node:fs";
import path from "node:path";
import { loadLexicon } from "../src/agent/lexicon.ts";
import { knownWords, assembleStory } from "../src/server/reading";
import { storyStore } from "../src/store/stories";
import type { StoryBrief } from "../src/server/reading";
import type { StoryDraft, StoryQuestionKind } from "../src/core/reading";
import { STORIES_A1 } from "./stories-data-a1";
import { STORIES_A2 } from "./stories-data-a2";
import { STORIES_B1 } from "./stories-data-b1";
import { STORIES_B2 } from "./stories-data-b2";

async function main() {
	console.log("Loading Slovak lexicon...");
	const lexicon = loadLexicon();
	if (!lexicon) {
		throw new Error("Could not load Slovak lexicon!");
	}

	const storiesDir = path.resolve(process.cwd(), "data/profiles/slovak/stories");
	const indexFile = path.join(storiesDir, "index.jsonl");

	// 1. Remove old robot story if present
	const oldRobotStory = path.join(storiesDir, "ep-001-dva-kufre.json");
	if (fs.existsSync(oldRobotStory)) {
		fs.unlinkSync(oldRobotStory);
		console.log("Removed old robot story ep-001-dva-kufre.json");
	}

	// 2. Clear index.jsonl
	if (fs.existsSync(indexFile)) {
		fs.writeFileSync(indexFile, "", "utf-8");
		console.log("Reset index.jsonl");
	}

	const allStories = [...STORIES_A1, ...STORIES_A2, ...STORIES_B1, ...STORIES_B2];

	console.log(`Starting assembly of ${allStories.length} graded reader stories...`);

	let count = 0;
	for (const s of allStories) {
		count++;
		const kw = knownWords(lexicon, s.level);
		kw.chapter = s.chapter;

		const brief: StoryBrief = {
			genre: s.genre,
			episode: 0,
			theme: s.theme,
			prompt: s.topic,
		};

		const draft: StoryDraft = {
			title: s.title,
			topic: s.topic,
			cast: s.cast,
			sentences: s.sentences,
			newWords: s.newWords,
			questions: s.questions.map((q) => ({
				q: q.q,
				options: q.options,
				answer: q.answer,
				kind: (q.kind === "attitude" ? "attitude" : "recall") as StoryQuestionKind,
			})),
			recap: s.recap,
		};

		const story = assembleStory(
			draft,
			brief,
			kw,
			lexicon,
			{ model: "curated-traditional", steps: [] },
			1,
			new Date(Date.now() + count * 1000),
		);

		// Override ID to match human-friendly slug
		story.id = s.id;
		story.level = s.level;
		story.chapter = s.chapter;
		story.theme = s.theme;

		storyStore.put(story);
		console.log(
			`[${count}/${allStories.length}] [${s.level}] ${story.id} (${story.title}) - ${story.sentences.length} sentences, coverage: ${Math.round(story.coverage * 100)}%`,
		);
	}

	console.log("\nFinished generating all 60 curated graded reader stories!");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
