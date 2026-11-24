import { createHash } from "node:crypto";
import fs from "node:fs";
import { activeProfile, curriculumFile } from "../../config.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { chapterStoriesFor } from "../core/chapter-stories.ts";
import { allChapters, STAGES } from "../core/curriculum.ts";
import type { StoryDraft, StoryRecord, StorySentence, StoryWord } from "../core/reading.ts";
import { senseIn } from "../core/lesson.ts";
import { storyStore } from "../store/stories.ts";
import { assembleStory, knownWords } from "./reading.ts";
import { availableVoiceIds } from "./voices.ts";

export const SHIPPED_STORY_MODEL = "shipped";

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
			const { slug, cat, gender, ...rest } = t;
			const sameWord = t.lemma === fixed.lemma;
			return {
				...rest,
				lemma: fixed.lemma,
				gloss: fixed.gloss,
				...(sameWord ? { ...(slug ? { slug } : {}), ...(cat ? { cat } : {}), ...(gender ? { gender } : {}) } : {}),
			};
		}),
	}));
}

export function authoredNewWords(found: readonly StoryWord[], authored: ShippedStory["newWords"]): StoryWord[] {
	return found.map((w, i) => {
		const own = authored[i];
		if (!own) return { ...w, gloss: senseIn(w.gloss, "") };
		const sameWord = w.lemma.toLocaleLowerCase() === own.sk.toLocaleLowerCase();
		return { lemma: own.sk, gloss: own.en, ...(sameWord && w.slug ? { slug: w.slug } : {}) };
	});
}

interface ShippedFile {
	draft: ShippedStory;
	hash: string;
}

function readShipped(id: string): ShippedFile | null {
	try {
		const text = fs.readFileSync(curriculumFile(activeProfile(), `stories/${id}.json`), "utf-8");
		return { draft: JSON.parse(text) as ShippedStory, hash: createHash("sha256").update(text).digest("hex") };
	} catch {
		return null;
	}
}

const inFlight = new Map<string, Promise<StoryRecord | null>>();

export function keepChapterStory(id: string, now = new Date()): Promise<StoryRecord | null> {
	const key = `${activeProfile()}/${id}`;
	let job = inFlight.get(key);
	if (!job) {
		job = writeChapterStory(id, now).finally(() => inFlight.delete(key));
		inFlight.set(key, job);
	}
	return job;
}

async function writeChapterStory(id: string, now: Date): Promise<StoryRecord | null> {
	const kept = storyStore.get(id);
	const shipped = chapterStoriesFor(activeProfile()).some((s) => s.id === id) ? readShipped(id) : null;
	if (kept && (!shipped || kept.shippedHash === shipped.hash)) return kept;
	if (!shipped) return null;
	const { draft, hash } = shipped;
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
		newWords: authoredNewWords(assembled.newWords, draft.newWords).filter((w) => !w.slug || slugs.has(w.slug)),
		...(level ? { level } : {}),
		...(chapter ? { chapter: chapter.id } : {}),
		shippedHash: hash,
	};
	storyStore.put(story);
	return storyStore.get(id);
}
