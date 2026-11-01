/**
 * Word variants and doublets (LangHarness) — accepted alternate spellings
 * and synonymous lexical twins (e.g. zas ↔ zase / zasa, späť ↔ naspäť).
 * Pure and browser-safe.
 */

import { normalizeAnswer } from "./language.ts";

/** Sets of mutually interchangeable variants / doublets.
 *  Any word in a set is an accepted alternative for any other word in the same set. */
const SLOVAK_VARIANTS: readonly (readonly string[])[] = [
	["zas", "zase", "zasa"],
	["späť", "naspäť"],
	["zatiaľ čo", "zatiaľčo"],
	["tiež", "taktiež"],
	["dovidenia", "do videnia"],
	["pretože", "lebo"],
	["opäť", "znova", "znovu", "opätovne"],
	["akoby", "ako by"],
	["odvtedy", "od vtedy"],
	["dokiaľ", "pokiaľ"],
	["stále", "stále ešte"],
	["nateraz", "teraz"],
];

const VARIANTS_BY_TAG: Record<string, readonly (readonly string[])[]> = {
	"sk-SK": SLOVAK_VARIANTS,
	sk: SLOVAK_VARIANTS,
};

/** Get accepted variants for a given word and language tag. */
export function knownVariants(word: string, tag = "sk-SK"): string[] {
	const n = normalizeAnswer(word, tag);
	if (!n) return [];
	const sets = VARIANTS_BY_TAG[tag] ?? VARIANTS_BY_TAG[tag.slice(0, 2)] ?? [];
	const results: string[] = [];
	for (const set of sets) {
		const matches = set.some((member) => normalizeAnswer(member, tag) === n);
		if (matches) {
			for (const member of set) {
				const memberNorm = normalizeAnswer(member, tag);
				if (memberNorm !== n && !results.includes(member)) {
					results.push(member);
				}
			}
		}
	}
	return results;
}

/** Whether the given answer matches one of the accepted variants/alternatives
 *  rather than the primary expected word. */
export function isVariantMatch(
	expected: string,
	given: string,
	tag = "sk-SK",
	alternatives: readonly string[] = [],
): boolean {
	const e = normalizeAnswer(expected, tag);
	const g = normalizeAnswer(given, tag);
	if (!g || !e || e === g) return false;
	const allAlts = [...alternatives, ...knownVariants(expected, tag)];
	for (const alt of allAlts) {
		const a = normalizeAnswer(alt, tag);
		if (a === g) return true;
	}
	return false;
}
