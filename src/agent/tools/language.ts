import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { serverExecute } from "../tool-execute.ts";
import { formatEntry, loadLexicon, lookupWord } from "../lexicon.ts";

/**
 * The language tools (LangHarness) — composed into all three agents
 * (prober, teacher, practice):
 *
 * - lookup_word: the bundled dictionary (agent/lexicon.ts) as ground truth
 *   for forms, gender and examples. Always present when the active profile
 *   has a lexicon.
 * - add_to_review / review_status: the spaced-review deck, through a seam
 *   the composition root injects (the agent layer never imports the
 *   store). Absent seam (tests) = absent tools.
 */

export interface ReviewSeam {
	/** Queue words by lexicon slug; returns the slugs actually added. */
	enqueue(slugs: string[]): string[];
	/** Plain-text digest: deck size, due count, words that keep slipping. */
	digest(): string;
}

const lookupInput = Type.Object({
	word: Type.String({
		minLength: 1,
		description: "A word in any form (inflected forms, missing diacritics and English glosses also match).",
	}),
});

const lookupWordTool: AgentTool<typeof lookupInput> = {
	name: "lookup_word",
	label: "lookup_word",
	description:
		"Look a word up in the bundled dictionary: lemma, English gloss, gender, frequency rank, checked declension or verified forms when available, and example sentences. Use it before asserting an inflected form, gender or conjugation you are not certain of, and before marking a learner's form wrong. Returns up to five entries; says plainly when nothing matches.",
	parameters: lookupInput,
	executionMode: "sequential",
	execute: serverExecute("lookup_word", lookupInput, async ({ word }) => {
		const result = lookupWord(word);
		if (result.match === "none") return `No dictionary entry matches "${word}". Do not present a form for it as certain.`;
		const how =
			result.match === "exact"
				? "exact match"
				: result.match === "folded"
					? "matched only after ignoring diacritics — check the spelling"
					: "matched an English gloss";
		return [`${result.entries.length} entr${result.entries.length === 1 ? "y" : "ies"} for "${word}" (${how}). Slug in brackets.`, ...result.entries.map((e) => `[${e.slug}] ${formatEntry(e)}`)].join("\n\n");
	}),
};

const enqueueInput = Type.Object({
	words: Type.Array(Type.String({ minLength: 1 }), {
		minItems: 1,
		maxItems: 20,
		description: "Words taught in this session — lemmas (with diacritics) or dictionary slugs from lookup_word.",
	}),
});

function addToReviewTool(seam: ReviewSeam): AgentTool<typeof enqueueInput> {
	return {
		name: "add_to_review",
		label: "add_to_review",
		description:
			"Add words this session actually taught to the learner's spaced-review deck (cloze sentences scheduled with FSRS), so they come back before they are forgotten. Use lemmas or slugs; words the dictionary lacks are reported back, not added.",
		parameters: enqueueInput,
		execute: serverExecute("add_to_review", enqueueInput, async ({ words }) => {
			const lexicon = loadLexicon();
			const slugs: string[] = [];
			const unknown: string[] = [];
			for (const w of words) {
				const byLemma = lookupWord(w);
				const entry = lexicon?.bySlug.get(w) ?? (byLemma.match === "exact" ? byLemma.entries[0] : undefined);
				if (entry) slugs.push(entry.slug);
				else unknown.push(w);
			}
			const added = seam.enqueue(slugs);
			const skipped = slugs.filter((s) => !added.includes(s));
			return [
				added.length ? `Added to review: ${added.join(", ")}.` : "Nothing new was added.",
				skipped.length ? `Already in the deck or without a usable sentence: ${skipped.join(", ")}.` : "",
				unknown.length ? `Not in the dictionary: ${unknown.join(", ")}.` : "",
			]
				.filter(Boolean)
				.join(" ");
		}),
	};
}

const statusInput = Type.Object({});

function reviewStatusTool(seam: ReviewSeam): AgentTool<typeof statusInput> {
	return {
		name: "review_status",
		label: "review_status",
		description:
			"The learner's spaced-review deck at a glance: how many words, how many are stable, how many are due, and which words keep slipping (lapses). Read it when choosing vocabulary for checks or practice.",
		parameters: statusInput,
		execute: serverExecute("review_status", statusInput, async () => seam.digest()),
	};
}

/** The language tool set for one agent. */
export function languageTools(review?: ReviewSeam): Record<string, AgentTool<any>> {
	const tools: Record<string, AgentTool<any>> = {};
	if (loadLexicon()) tools.lookup_word = lookupWordTool;
	if (review) {
		tools.add_to_review = addToReviewTool(review);
		tools.review_status = reviewStatusTool(review);
	}
	return tools;
}
