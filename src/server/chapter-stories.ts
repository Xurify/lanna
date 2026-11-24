import { createHash } from "node:crypto";
import fs from "node:fs";
import { activeProfile, curriculumFile } from "../../config.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { chapterStoriesFor } from "../core/chapter-stories.ts";
import { allChapters, STAGES } from "../core/curriculum.ts";
import type { StoryDraft, StoryRecord, StorySentence, StoryWord } from "../core/reading.ts";
import { storyStore } from "../store/stories.ts";
import { assembleStory, knownWords } from "./reading.ts";
import { availableVoiceIds } from "./voices.ts";

export const SHIPPED_STORY_MODEL = "shipped";

export interface StoryGlossOverride {
	lemma: string;
	gloss: string;
}

export interface StoryOccurrenceOverride extends StoryGlossOverride {
	sentence: number;
	token: string;
	occurrence?: number;
}

export interface ShippedStory extends StoryDraft {
	glosses?: Record<string, StoryGlossOverride>;
	occurrences?: readonly StoryOccurrenceOverride[];
}

export function applyStoryGlosses(
	sentences: readonly StorySentence[],
	glosses: ShippedStory["glosses"],
	occurrences?: ShippedStory["occurrences"],
): StorySentence[] {
	if (!glosses && (!occurrences || occurrences.length === 0)) return [...sentences];
	const bySentence = new Map<number, StoryOccurrenceOverride[]>();
	for (const entry of occurrences ?? []) {
		const bucket = bySentence.get(entry.sentence);
		if (bucket) bucket.push(entry);
		else bySentence.set(entry.sentence, [entry]);
	}
	return sentences.map((sentence, sentenceIndex) => {
		const sentenceOverrides = bySentence.get(sentenceIndex);
		const seenCount = new Map<string, number>();
		return {
			...sentence,
			tokens: sentence.tokens.map((token) => {
				if (!token.word) return token;
				const lower = token.text.toLocaleLowerCase();
				const occurrenceIndex = seenCount.get(lower) ?? 0;
				seenCount.set(lower, occurrenceIndex + 1);
				const exact = sentenceOverrides?.find(
					(entry) => entry.token.toLocaleLowerCase() === lower && entry.occurrence === occurrenceIndex,
				);
				const sentenceWide = sentenceOverrides?.find(
					(entry) => entry.token.toLocaleLowerCase() === lower && entry.occurrence === undefined,
				);
				const fixed = exact ?? sentenceWide ?? glosses?.[lower];
				if (!fixed) return token;
				const { slug, cat, gender, ...rest } = token;
				const sameWord = token.lemma === fixed.lemma;
				return {
					...rest,
					lemma: fixed.lemma,
					gloss: fixed.gloss,
					...(sameWord ? { ...(slug ? { slug } : {}), ...(cat ? { cat } : {}), ...(gender ? { gender } : {}) } : {}),
				};
			}),
		};
	});
}

export function authoredNewWords(found: readonly StoryWord[], authored: ShippedStory["newWords"]): StoryWord[] {
	return authored.map((own) => {
		const same = found.find((w) => w.lemma.toLocaleLowerCase() === own.sk.toLocaleLowerCase());
		return { lemma: own.sk, gloss: own.en, ...(same?.slug ? { slug: same.slug } : {}) };
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
	const sentences = applyStoryGlosses(assembled.sentences, draft.glosses, draft.occurrences);
	const slugs = new Set(sentences.flatMap((s) => s.tokens.map((t) => t.slug)));
	const story: StoryRecord = {
		...assembled,
		id,
		sentences,
		newWords: authoredNewWords(assembled.newWords, draft.newWords).map(({ slug, ...w }) =>
			slug && slugs.has(slug) ? { ...w, slug } : w,
		),
		...(level ? { level } : {}),
		...(chapter ? { chapter: chapter.id } : {}),
		shippedHash: hash,
	};
	storyStore.put(story);
	return storyStore.get(id);
}
