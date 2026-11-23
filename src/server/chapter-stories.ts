import fs from "node:fs";
import { activeProfile, curriculumFile } from "../../config.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { chapterStoriesFor } from "../core/chapter-stories.ts";
import { allChapters, STAGES } from "../core/curriculum.ts";
import type { StoryDraft, StoryRecord, StorySentence } from "../core/reading.ts";
import { storyStore } from "../store/stories.ts";
import { assembleStory, knownWords } from "./reading.ts";
import { availableVoiceIds } from "./voices.ts";

export const SHIPPED_STORY_MODEL = "shipped";

/** A shipped story checks its own glosses: the dictionary's guess for a form can be another word (prší → prsia). */
interface ShippedStory extends StoryDraft {
	glosses?: Record<string, { lemma: string; gloss: string }>;
}

function withGlosses(sentences: readonly StorySentence[], glosses: ShippedStory["glosses"]): StorySentence[] {
	if (!glosses) return [...sentences];
	return sentences.map((s) => ({
		...s,
		tokens: s.tokens.map((t) => {
			const fixed = t.word ? glosses[t.text.toLocaleLowerCase()] : undefined;
			if (!fixed) return t;
			const { slug, ...rest } = t;
			return { ...rest, lemma: fixed.lemma, gloss: fixed.gloss, ...(slug && t.lemma === fixed.lemma ? { slug } : {}) };
		}),
	}));
}

function readDraft(id: string): ShippedStory | null {
	try {
		return JSON.parse(fs.readFileSync(curriculumFile(activeProfile(), `stories/${id}.json`), "utf-8")) as ShippedStory;
	} catch {
		return null;
	}
}

/** The chapter story in the library, glossed from the dictionary and kept there the first time it is opened. */
export async function keepChapterStory(id: string, now = new Date()): Promise<StoryRecord | null> {
	const kept = storyStore.get(id);
	if (kept) return kept;
	if (!chapterStoriesFor(activeProfile()).some((s) => s.id === id)) return null;
	const draft = readDraft(id);
	if (!draft) return null;
	const chapter = allChapters().find((c) => c.units.includes(id));
	const level = STAGES.find((s) => s.id === chapter?.stage)?.level;
	const lexicon = loadLexicon();
	const k = knownWords(lexicon);
	const assembled = assembleStory(
		draft,
		{ genre: "dialogue", episode: 0, theme: draft.topic, prompt: "" },
		k,
		lexicon,
		{ model: SHIPPED_STORY_MODEL, steps: [] },
		0,
		now,
		await availableVoiceIds(),
	);
	const sentences = withGlosses(assembled.sentences, draft.glosses);
	const slugs = new Set(sentences.flatMap((s) => s.tokens.map((t) => t.slug)));
	const story: StoryRecord = {
		...assembled,
		id,
		sentences,
		newWords: assembled.newWords.filter((w) => !w.slug || slugs.has(w.slug)),
		...(level ? { level } : {}),
		...(chapter ? { chapter: chapter.id } : {}),
	};
	storyStore.put(story);
	return storyStore.get(id);
}
