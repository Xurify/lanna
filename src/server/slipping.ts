import { loadLexicon } from "../agent/lexicon.ts";
import type { LessonPlan } from "../core/lesson.ts";
import { dayKey } from "../core/review.ts";
import { buildSlippingLesson, slippingWords, type SlippingWord } from "../core/slipping.ts";
import { readLessonLog } from "../store/corpus.ts";
import { progressStore } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { activeLanguage } from "./active-language.ts";
import { aspectFrames } from "./aspect-frames.ts";

export function activeSlippingWords(opts: { tz?: number; minWrongs?: number } = {}): SlippingWord[] {
	const cards = Object.values(reviewStore.readCards());
	const log = reviewStore.readLog();
	return slippingWords(cards, log, { langTag: activeLanguage().tag, tz: opts.tz, minWrongs: opts.minWrongs });
}

export function activeSlippingSlugs(opts: { tz?: number; minWrongs?: number } = {}): Set<string> {
	return new Set(activeSlippingWords(opts).map((w) => w.slug));
}

export function slippingLessonFor(seed = Date.now(), tz?: number, now = new Date()): LessonPlan {
	const today = dayKey(now, tz);
	const drilledToday = new Set<string>();
	for (const entry of readLessonLog()) {
		if (entry.day !== today || entry.mode !== "slipping") continue;
		for (const rep of entry.reps) drilledToday.add(rep.slug);
	}
	const p = progressStore.read();
	return buildSlippingLesson(activeSlippingWords({ tz }), loadLexicon()?.entries ?? [], p.mixups, {
		seed,
		recent: new Set(p.recent),
		drilledToday,
		frames: aspectFrames(),
	});
}
