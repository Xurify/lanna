import { NEW_WORDS_PER_LESSON, type LessonItem, type LessonPlan } from "./lesson.ts";

export interface LessonWord {
	slug: string;
	lemma: string;
	gloss: string;
	gender?: string;
}

/** The words a vocabulary lesson teaches, in the order its reps first ask
 *  them: what the learner meets before the first rep and matches after the
 *  last. Words mixed in from other units are left out. */
export function lessonWords(plan: Pick<LessonPlan, "unit" | "items">, max = NEW_WORDS_PER_LESSON): LessonWord[] {
	const words: LessonWord[] = [];
	const seen = new Set<string>();
	for (const item of plan.items as readonly LessonItem[]) {
		if (item.mixed || item.again || item.task || item.unit !== plan.unit) continue;
		const key = item.lemma.toLocaleLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		words.push({
			slug: item.slug,
			lemma: item.lemma,
			gloss: item.hint || item.gloss,
			...(item.gender ? { gender: item.gender } : {}),
		});
		if (words.length >= max) break;
	}
	return words;
}
