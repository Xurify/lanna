import { NEW_WORDS_PER_LESSON, shortGloss, type LessonItem, type LessonPlan } from "./lesson.ts";

export interface LessonWord {
	slug: string;
	lemma: string;
	gloss: string;
	gender?: string;
}

/** The words a vocabulary lesson teaches, in the order its reps first ask
 *  them: what the learner meets before the first rep and matches after the
 *  last. Words mixed in from other units are left out, and so is a word
 *  whose meaning would read the same as another's. */
export function lessonWords(plan: Pick<LessonPlan, "unit" | "items">, max = NEW_WORDS_PER_LESSON): LessonWord[] {
	const picked: LessonItem[] = [];
	const seen = new Set<string>();
	for (const item of plan.items as readonly LessonItem[]) {
		if (item.mixed || item.again || item.task || item.unit !== plan.unit) continue;
		const key = item.lemma.toLocaleLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		picked.push(item);
	}
	const short = (item: LessonItem) => (item.hint || item.gloss).toLocaleLowerCase();
	const shared = new Set(picked.map(short).filter((g, i, all) => all.indexOf(g) !== i));
	const words: LessonWord[] = [];
	const labels = new Set<string>();
	for (const item of picked) {
		const gloss = shared.has(short(item)) ? shortGloss(item.gloss) : item.hint || item.gloss;
		if (labels.has(gloss.toLocaleLowerCase())) continue;
		labels.add(gloss.toLocaleLowerCase());
		words.push({
			slug: item.slug,
			lemma: item.lemma,
			gloss,
			...(item.gender ? { gender: item.gender } : {}),
		});
		if (words.length >= max) break;
	}
	return words;
}
