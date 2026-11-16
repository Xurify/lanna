/**
 * Catch the mistake (LangHarness, 2026-11-06): a short exercise apart from the
 * Read episodes. It shows two or three sentences with one wrong word, from a
 * pair the learner mixes up. The learner taps the wrong word, then types the
 * word that belongs there, which is graded with compareAnswer.
 *
 * The pair is chosen by chooseCatch and the wrong and right words are checked by
 * verifyCatch (src/core/catch-pair.ts). An item is kept only when that code can
 * see the mistake, so the model writes the sentences and does not grade them.
 *
 * Pure. The model call is in src/server/catch-mistake.ts and the file in
 * src/store/catch-mistake.ts.
 */

import { compareAnswer, type AnswerVerdict } from "./language.ts";
import type { PairDef } from "./pairs.ts";
import { tokenize, type StorySentence } from "./reading.ts";
import type { RepVerdict } from "./lesson.ts";
import type { MixupEvent } from "./mixups.ts";
import { verifyCatch, type CatchDraftMark, type CatchLexicon, type CatchTarget, type CatchWord } from "./catch-pair.ts";

/** Sentences in one item: a context line, the wrong one, and its correction. */
const CATCH_SENTENCES = 3;
/** The speaker every item sentence is given: an item has no cast. */
export const CATCH_SPEAKER = "item";
/** Forms of each word the brief lists, so the model picks one the check knows. */
const BRIEF_FORMS = 12;

export interface CatchToken {
	text: string;
	word: boolean;
}

export interface CatchSentence {
	sk: string;
	en: string;
	tokens: CatchToken[];
}

export interface CatchSlip {
	/** Index of the sentence with the wrong word; the correction is the next one. */
	sentence: number;
	/** Index, in that sentence's tokens, of the wrong word. */
	token: number;
	/** The wrong word and the right one, as written. */
	wrong: string;
	right: string;
	wrongSlug: string;
	rightSlug: string;
}

export interface CatchAnswer {
	sentence: number;
	token: number;
	typed: string;
	tapOk: boolean;
	verdict: AnswerVerdict;
	at: string;
}

export interface CatchItem {
	id: string;
	pair: string;
	rule: string;
	sentences: CatchSentence[];
	slip: CatchSlip;
	/** The model that wrote the sentences. */
	model: string;
	created: string;
	answer?: CatchAnswer;
}

/** What the page shows before an answer: only the sentences up to the wrong one. */
export interface CatchView {
	id: string;
	sentences: CatchToken[][];
}

/** What the page shows after an answer: the whole item and the verdicts. */
export interface CatchResult {
	tapOk: boolean;
	verdict: AnswerVerdict;
	typed: string;
	tapped: { sentence: number; token: number };
	wrong: string;
	right: string;
	rule: string;
	sentences: Array<{ sk: string; en: string }>;
}

export interface CatchNext {
	view: CatchView | null;
	/** Why there is no item, in plain English, when there is none. */
	reason?: string;
}

interface CatchDraft {
	sentences: Array<{ sk: string; en: string }>;
	slip: CatchDraftMark;
}

/** The sentences the page shows before the answer. */
function visibleSentences(item: CatchItem): CatchSentence[] {
	return item.sentences.slice(0, item.slip.sentence + 1);
}

export function viewOf(item: CatchItem): CatchView {
	return { id: item.id, sentences: visibleSentences(item).map((s) => s.tokens) };
}

export function resultOf(item: CatchItem): CatchResult {
	const a = item.answer!;
	return {
		tapOk: a.tapOk,
		verdict: a.verdict,
		typed: a.typed,
		tapped: { sentence: a.sentence, token: a.token },
		wrong: item.slip.wrong,
		right: item.slip.right,
		rule: item.rule,
		sentences: item.sentences.map((s) => ({ sk: s.sk, en: s.en })),
	};
}

/** The tap is right when it lands on the wrong word itself. */
export function isTapRight(item: CatchItem, tap: { sentence: number; token: number }): boolean {
	return tap.sentence === item.slip.sentence && tap.token === item.slip.token;
}

/** The typed word, graded like a lesson answer: accents-only is its own verdict. */
export function gradeTyped(right: string, typed: string, tag: string): AnswerVerdict {
	return compareAnswer(right, typed, tag);
}

/** The reply the model is asked for, read leniently: the first JSON object in it. */
export function parseCatchDraft(text: string): CatchDraft | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end < start) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
	if (!raw || typeof raw !== "object") return null;
	const o = raw as { sentences?: unknown; slip?: unknown };
	if (!Array.isArray(o.sentences) || o.sentences.length < 2 || o.sentences.length > CATCH_SENTENCES) return null;
	const sentences: Array<{ sk: string; en: string }> = [];
	for (const s of o.sentences) {
		const x = s as { sk?: unknown; en?: unknown } | null;
		if (typeof x?.sk !== "string" || !x.sk.trim()) return null;
		sentences.push({ sk: x.sk.trim(), en: typeof x.en === "string" ? x.en.trim() : "" });
	}
	const sl = o.slip as { sentence?: unknown; wrong?: unknown; right?: unknown } | null | undefined;
	if (!sl || typeof sl.sentence !== "number" || !Number.isInteger(sl.sentence)) return null;
	if (typeof sl.wrong !== "string" || typeof sl.right !== "string") return null;
	return { sentences, slip: { sentence: sl.sentence, wrong: sl.wrong, right: sl.right } };
}

/** The brief for one item, written from the pair the learner mixes up. */
export function catchBrief(t: CatchTarget, language: string): string {
	const forms = (w: CatchWord) =>
		w.forms
			.slice(0, BRIEF_FORMS)
			.map((f) => `"${f}"`)
			.join(", ");
	return [
		`Write ${CATCH_SENTENCES} short sentences in ${language}, one after another, as practice text for a learner who mixes up "${t.wrong.lemma}" and "${t.right.lemma}". The rule: ${t.rule}`,
		`Sentence 0 is plain context with neither word. Sentence 1 uses a form of "${t.wrong.lemma}" where "${t.right.lemma}" belongs, so it is wrong in exactly this way. Use one of these forms, exactly as written: ${forms(t.wrong)}.`,
		`Sentence 2 corrects it: it says the right word, a form of "${t.right.lemma}" (one of ${forms(t.right)}), and nothing else in it is wrong. Sentence 1 must not contain any form of "${t.right.lemma}".`,
		`Reply with one JSON object and nothing else: {"sentences": [{"sk": "...", "en": "..."}, ...], "slip": {"sentence": 1, "wrong": "<the wrong form exactly as written in sentence 1>", "right": "<the right form exactly as written in sentence 2>"}}. Give an English translation for each sentence in "en".`,
	].join("\n");
}

interface CatchBuildInput {
	id: string;
	now: Date;
	model: string;
	draft: CatchDraft;
	target: CatchTarget;
	lexicon: CatchLexicon;
	pairs: readonly PairDef[];
}

/** An item from the model's draft, if the code can see the mistake in it. */
export function buildCatchItem(input: CatchBuildInput): { item: CatchItem } | { reason: string } {
	const { draft, target } = input;
	const sentences: StorySentence[] = draft.sentences.map((s) => ({
		sk: s.sk,
		en: s.en,
		who: target.speaker,
		tokens: tokenize(s.sk),
	}));
	const check = verifyCatch(draft.slip, target, sentences, input.lexicon, input.pairs);
	if (!("slip" in check)) return { reason: check.reason };
	const wanted = check.slip.wrong.toLowerCase();
	const hits = sentences[check.slip.sentence]!.tokens.flatMap((t, i) =>
		t.word && t.text.toLowerCase() === wanted ? [i] : [],
	);
	if (hits.length !== 1)
		return { reason: `"${check.slip.wrong}" appears ${hits.length} times in the wrong sentence, not once` };
	return {
		item: {
			id: input.id,
			pair: check.slip.pair,
			rule: target.rule,
			sentences: sentences.map((s) => ({ sk: s.sk, en: s.en, tokens: s.tokens })),
			slip: {
				sentence: check.slip.sentence,
				token: hits[0]!,
				wrong: check.slip.wrong,
				right: check.slip.right,
				wrongSlug: check.slip.wrongSlug,
				rightSlug: check.slip.rightSlug,
			},
			model: input.model,
			created: input.now.toISOString(),
		},
	};
}

/**
 * An answer as the mix-up record reads it. Catching the wrong word and typing
 * the right one is a right first try on the word the sentence needed. Typing
 * another word is a miss that names it. Letting the wrong word pass counts as
 * having taken it for right, so it is a miss on the wrong word, one the
 * learner saw in the sentence (visible).
 */
export function catchMixupEvent(
	item: CatchItem,
	answer: { tapOk: boolean; typed: string; verdict: AnswerVerdict },
	at: string,
): MixupEvent {
	const sentence = item.sentences[item.slip.sentence]?.sk ?? "";
	const base = { slug: item.slip.rightSlug, answer: item.slip.right, sentence, at };
	if (!answer.tapOk) return { ...base, given: item.slip.wrong, verdict: "wrong", visible: true };
	return { ...base, given: answer.typed, verdict: answer.verdict as RepVerdict };
}
