import { loadLexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { dayKey, type LexiconEntry } from "../core/review.ts";
import {
	parseVerdict,
	SENTENCE_MAX_CHARS,
	SENTENCE_XP,
	sentenceProblems,
	type PracticeSentenceEntry,
} from "../core/sentences.ts";
import { progressStore } from "../store/progress.ts";
import { sentenceStore } from "../store/sentences.ts";
import { activeLanguage } from "./active-language.ts";
import { storyEngine } from "./reading.ts";

export interface PracticeSentenceAnswer {
	ok: boolean;
	corrected: string;
	why: string;
	cached: boolean;
	xp: number;
}

export function sentenceSystem(name: string = activeLanguage().english): string {
	return `You check one ${name} sentence that a beginner wrote to use a given ${name} word. You answer with ONE JSON object and nothing else: {"ok": true, "corrected": "...", "why": "..."}.

Rules:
- ok is true when the sentence is correct, standard ${name} and uses the word in any form.
- Answer ok false only when you are sure the sentence is wrong or does not use the word. When you are unsure, answer ok true and say in "why" what to check.
- "corrected": the sentence with the smallest fix when ok is false; otherwise the sentence as written.
- "why": one plain English sentence for the learner, at most 25 words.
- Nothing outside the JSON.`;
}

export function knownFormsOf(entry: LexiconEntry | undefined): string[] {
	if (!entry) return [];
	const out = new Set<string>();
	if (entry.sk) out.add(entry.sk);
	if (entry.lemma) out.add(entry.lemma);
	for (const f of entry.forms ?? []) if (f) out.add(f);
	if (entry.declension) {
		for (const num of [entry.declension.singular, entry.declension.plural]) {
			if (!num) continue;
			for (const val of num) {
				if (typeof val === "string" && val) out.add(val);
			}
		}
	}
	return [...out];
}

export async function checkPracticeSentence(
	input: {
		lemma: string;
		slug?: string;
		gloss?: string;
		sentence: string;
		source?: "hardwords" | "practice";
		tz?: number;
	},
	opts: {
		engine?: PiEngine;
		model?: string;
		now?: Date;
		ask?: (req: { system: string; prompt: string }) => Promise<string>;
	} = {},
): Promise<PracticeSentenceAnswer> {
	const lemma = input.lemma.trim();
	const sentence = input.sentence.trim();
	if (!lemma) throw new Error("word is required");
	if (!sentence || sentence.length > SENTENCE_MAX_CHARS)
		throw new Error(`Write one sentence, up to ${SENTENCE_MAX_CHARS} characters.`);

	const lang = activeLanguage();
	const lexicon = loadLexicon();
	const entry =
		(input.slug ? lexicon?.bySlug.get(input.slug) : undefined) ??
		lexicon?.byForm.get(lemma.toLocaleLowerCase(lang.tag))?.[0];
	const forms = knownFormsOf(entry);

	const problems = sentenceProblems(sentence, lemma, { langTag: lang.tag, forms });
	if (problems.length) return { ok: false, corrected: sentence, why: problems[0]!, cached: false, xp: 0 };

	const all = sentenceStore.readAll();
	const earlierForLemma = all.filter((s) => s.lemma.toLocaleLowerCase(lang.tag) === lemma.toLocaleLowerCase(lang.tag));
	const same = earlierForLemma.find((s) => s.sentence === sentence);
	if (same) return { ok: same.ok, corrected: same.corrected, why: same.why, cached: true, xp: 0 };

	const gloss = input.gloss?.trim() || entry?.en || "";
	const system = sentenceSystem(lang.english);
	const prompt = `The word: "${lemma}" (dictionary form; meaning: ${gloss || "not given"}).\nThe sentence: ${JSON.stringify(sentence)}`;

	let text: string;
	let model: string;
	if (opts.ask) {
		text = await opts.ask({ system, prompt });
		model = opts.model ?? "test";
	} else {
		const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "test" } : storyEngine();
		if (!resolved) throw new Error("No model is configured. Pick one in Settings → AI models.");
		const out = await runSubagent([], {
			role: "researcher",
			engine: resolved.engine,
			systemPrompt: system,
			prompt,
			maxTurns: 1,
		});
		text = out.text;
		model = resolved.model;
	}
	const verdict = parseVerdict(text, sentence);
	if (!verdict) throw new Error("The check did not answer in the form it should. Try again.");

	const now = opts.now ?? new Date();
	const record: PracticeSentenceEntry = {
		source: input.source ?? "hardwords",
		...((input.slug ?? entry?.slug) ? { slug: input.slug ?? entry?.slug } : {}),
		lemma,
		sentence,
		ok: verdict.ok,
		corrected: verdict.corrected,
		why: verdict.why,
		model,
		at: now.toISOString(),
	};
	sentenceStore.append(record);

	const today = dayKey(now, input.tz);
	const acceptedToday = earlierForLemma.some((s) => s.ok && dayKey(new Date(s.at), input.tz) === today);
	const xp = verdict.ok && !acceptedToday ? SENTENCE_XP : 0;
	if (xp) {
		const p = progressStore.read();
		const d = (p.days[today] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
		d.xp += xp;
		p.xp += xp;
		progressStore.write(p);
	}

	return { ok: verdict.ok, corrected: verdict.corrected, why: verdict.why, cached: false, xp };
}
