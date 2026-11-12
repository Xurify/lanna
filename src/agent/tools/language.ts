import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { activeProfile, PATHS } from "../../../config.ts";
import { checkerNote, checkSlovak } from "../../core/slovak-check.ts";
import { serverExecute } from "../tool-execute.ts";
import { referenceDir } from "../language-reference.ts";
import { formatEntry, loadLexicon, lookupWord, slovakLookup } from "../lexicon.ts";

/**
 * The language tools (LangHarness) — composed into all three agents
 * (prober, teacher, practice):
 *
 * - lookup_word: the bundled dictionary (agent/lexicon.ts) as ground truth
 *   for forms, gender and examples. Always present when the active profile
 *   has a lexicon.
 * - check_slovak / slovak_reference (Slovak only): the rules a program can
 *   check for certain (core/slovak-check.ts), and the slovak-language skill's
 *   chapters (docs/research/slovak-accuracy-eval.md says why).
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

const checkInput = Type.Object({
	text: Type.String({ minLength: 1, maxLength: 2000, description: "Slovak text: the learner's sentence, or a correction you are about to give." }),
});

const checkSlovakTool: AgentTool<typeof checkInput> = {
	name: "check_slovak",
	label: "check_slovak",
	description:
		"Check Slovak against the rules a program can verify for certain: so/zo/ku/vo before the sounds that need them, \"nie je\", no Czech letters, budem with a perfective infinitive, dva/dve/dvaja against the noun's gender. Also says when a sentence is a curated dictionary example, which is correct Slovak. Run it before you mark a learner's sentence wrong and before you give a correction. A clean result does not prove a sentence right.",
	parameters: checkInput,
	executionMode: "sequential",
	execute: serverExecute("check_slovak", checkInput, async ({ text }) => {
		const check = checkSlovak(text, slovakLookup() ?? undefined);
		return checkerNote(check) ?? "[Checker: none of the certain rules is broken. That does not prove the text right; use lookup_word for forms.]";
	}),
};

/** The slovak-language skill's references (.claude/skills/slovak-language, from slovak.wiki). */
const REFERENCE_DIR = referenceDir("slovak")!;

const REFERENCES: Record<string, string> = {
	"grammar-core": "cases, agreement, verbs, aspect, prepositions: the overview",
	nouns: "noun paradigms, plurals, genitive plural, names, place names",
	"adjectives-pronouns-numerals": "adjectives, pronouns, numbers with nouns (dva/dve/dvaja, 2–4 vs 5+)",
	"verb-forms": "conjugation, irregular verbs, past, future, imperative",
	"aspect-and-motion": "aspect pairs, motion verbs, kde/kam/odkiaľ",
	"valency-and-prepositions": "which case a verb or preposition takes",
	"syntax-and-style": "clitic position, negation, word order",
	"orthography-and-punctuation": "i/y, so/zo, capitals, commas, quotes",
	"phonology-and-orthography": "sounds, stress, vowel length, the rhythmic law",
	"lexical-choice-and-interference": "English and Czech traps, false friends",
	"spoken-slovak-and-variation": "colloquial speech, register, greetings, idioms",
	"foundations-and-core-communication": "beginner patterns with examples",
};

const referenceInput = Type.Object({
	topic: Type.Union(
		Object.keys(REFERENCES).map((k) => Type.Literal(k)),
		{ description: `One of: ${Object.entries(REFERENCES).map(([k, v]) => `${k} (${v})`).join("; ")}.` },
	),
});

const slovakReferenceTool: AgentTool<typeof referenceInput> = {
	name: "slovak_reference",
	label: "slovak_reference",
	description:
		"Read one chapter of the Slovak reference (the slovak-language skill): rules with checked examples. Read the chapter for the point you are teaching before you explain a rule you are not certain of, rather than reconstructing it from memory.",
	parameters: referenceInput,
	executionMode: "sequential",
	execute: serverExecute("slovak_reference", referenceInput, async ({ topic }) => {
		try {
			return fs.readFileSync(path.join(REFERENCE_DIR, `${topic}.md`), "utf-8");
		} catch {
			return `The reference "${topic}" is not available here. Say you are not certain rather than guessing.`;
		}
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
	if (activeProfile() === "slovak") {
		tools.check_slovak = checkSlovakTool;
		tools.slovak_reference = slovakReferenceTool;
	}
	if (review) {
		tools.add_to_review = addToReviewTool(review);
		tools.review_status = reviewStatusTool(review);
	}
	return tools;
}
