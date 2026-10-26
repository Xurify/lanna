/**
 * The lexicon (LangHarness) — the read-only dictionary bundled under
 * curriculum/<profile>/lexicon.json, exported from slovak.wiki by
 * scripts/export-slovakwiki-lexicon.mjs. It is the GROUND TRUTH the tutor
 * checks word forms against (the lookup_word tool) and the sentence source
 * of the cloze review deck.
 *
 * Lives in the agent layer because the agent's tool reads it; the server
 * re-exports the loader for the review routes (server → agent is lawful).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ACTIVE_PROFILE, PATHS } from "../../config.ts";
import { foldDiacritics } from "../core/language.ts";
import type { LexiconEntry } from "../core/review.ts";

export interface Lexicon {
	entries: LexiconEntry[];
	bySlug: Map<string, LexiconEntry>;
	/** lowercased lemma or form → entries carrying it. */
	byForm: Map<string, LexiconEntry[]>;
	/** diacritic-folded lemma or form → entries (typo-tolerant fallback). */
	byFolded: Map<string, LexiconEntry[]>;
	source?: string;
	license?: string;
}

const cache = new Map<string, Lexicon | null>();

export function lexiconPath(profile: string = ACTIVE_PROFILE): string {
	return path.join(PATHS.curriculum, profile, "lexicon.json");
}

function push(map: Map<string, LexiconEntry[]>, key: string, entry: LexiconEntry) {
	if (!key) return;
	const list = map.get(key);
	if (!list) map.set(key, [entry]);
	else if (!list.includes(entry)) list.push(entry);
}

/** The active profile's lexicon, or null when the language has none yet. */
export function loadLexicon(profile: string = ACTIVE_PROFILE): Lexicon | null {
	if (cache.has(profile)) return cache.get(profile)!;
	let lexicon: Lexicon | null = null;
	try {
		const raw = JSON.parse(fs.readFileSync(lexiconPath(profile), "utf-8")) as {
			words: LexiconEntry[];
			source?: string;
			license?: string;
		};
		const tag = profile === "russian" ? "ru-RU" : "sk-SK";
		const bySlug = new Map<string, LexiconEntry>();
		const byForm = new Map<string, LexiconEntry[]>();
		const byFolded = new Map<string, LexiconEntry[]>();
		for (const entry of raw.words) {
			bySlug.set(entry.slug, entry);
			const keys = new Set<string>([entry.sk, ...(entry.forms ?? []), ...(entry.declension?.singular ?? []), ...(entry.declension?.plural ?? [])]);
			for (const k of keys) {
				const lower = k.toLocaleLowerCase(tag);
				push(byForm, lower, entry);
				push(byFolded, foldDiacritics(lower), entry);
			}
		}
		lexicon = { entries: raw.words, bySlug, byForm, byFolded, source: raw.source, license: raw.license };
	} catch {
		lexicon = null;
	}
	cache.set(profile, lexicon);
	return lexicon;
}

export interface LookupResult {
	query: string;
	match: "exact" | "folded" | "english" | "none";
	entries: LexiconEntry[];
}

/** Find entries for a word: an exact lemma/form first, then the same
 *  letters without diacritics, then an English gloss word. */
export function lookupWord(query: string, profile: string = ACTIVE_PROFILE, limit = 5): LookupResult {
	const lexicon = loadLexicon(profile);
	const q = query.trim().toLocaleLowerCase(profile === "russian" ? "ru-RU" : "sk-SK");
	if (!lexicon || !q) return { query, match: "none", entries: [] };
	const exact = lexicon.byForm.get(q);
	if (exact?.length) return { query, match: "exact", entries: exact.slice(0, limit) };
	const folded = lexicon.byFolded.get(foldDiacritics(q));
	if (folded?.length) return { query, match: "folded", entries: folded.slice(0, limit) };
	const re = new RegExp(`(^|[^a-z])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
	const english = lexicon.entries.filter((e) => re.test(e.en)).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
	if (english.length) return { query, match: "english", entries: english.slice(0, limit) };
	return { query, match: "none", entries: [] };
}

const CASES = ["N", "G", "D", "A", "L", "I"];

/** The tool's text rendering of one entry. */
export function formatEntry(e: LexiconEntry, examples = 3): string {
	const lines = [`${e.sk} — ${e.en} (${e.cat.toLowerCase()}${e.gender ? `, ${e.gender}` : ""}${e.register ? `, ${e.register}` : ""}${e.rank ? `, frequency rank ${e.rank}` : ""})`];
	if (e.declension) {
		lines.push(`  declension (checked against JÚĽŠ) sg: ${e.declension.singular.map((f, i) => `${CASES[i]} ${f}`).join(", ")}`);
		lines.push(`  pl: ${e.declension.plural.map((f, i) => `${CASES[i]} ${f}`).join(", ")}`);
	} else if (e.forms?.length) {
		lines.push(`  verified forms (unordered): ${e.forms.join(", ")}`);
	} else {
		lines.push("  forms: not in the dictionary — do not present a form as certain without saying so");
	}
	for (const ex of e.examples.slice(0, examples)) lines.push(`  e.g. ${ex.sk} — ${ex.en}`);
	if (e.related.length) lines.push(`  related: ${e.related.slice(0, 6).join(", ")}`);
	return lines.join("\n");
}
