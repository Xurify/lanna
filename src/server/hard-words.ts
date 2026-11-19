import { loadLexicon } from "../agent/lexicon.ts";
import type { LessonPlan } from "../core/lesson.ts";
import { dayKey } from "../core/review.ts";
import { buildHardWordsLesson, hardWords, type HardWord } from "../core/hard-words.ts";
import { readLessonLog } from "../store/corpus.ts";
import { progressStore } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { activeLanguage } from "./active-language.ts";
import { aspectFrames } from "./aspect-frames.ts";

export function activeHardWords(opts: { tz?: number; minWrongs?: number } = {}): HardWord[] {
	const cards = Object.values(reviewStore.readCards());
	const log = reviewStore.readLog();
	return hardWords(cards, log, { langTag: activeLanguage().tag, tz: opts.tz, minWrongs: opts.minWrongs });
}

export function activeHardSlugs(opts: { tz?: number; minWrongs?: number } = {}): Set<string> {
	return new Set(activeHardWords(opts).map((w) => w.slug));
}

export function hardWordsLessonFor(seed = Date.now(), tz?: number, now = new Date()): LessonPlan {
	const today = dayKey(now, tz);
	const drilledToday = new Set<string>();
	for (const entry of readLessonLog()) {
		if (entry.day !== today || entry.mode !== "hardwords") continue;
		for (const rep of entry.reps) drilledToday.add(rep.slug);
	}
	const p = progressStore.read();
	return buildHardWordsLesson(activeHardWords({ tz }), loadLexicon()?.entries ?? [], p.mixups, {
		seed,
		recent: new Set(p.recent),
		drilledToday,
		frames: aspectFrames(),
	});
}
