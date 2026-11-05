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
import { ACTIVE_PROFILE, curriculumFile } from "../../config.ts";
import { foldDiacritics } from "../core/language.ts";
import { profileLanguage } from "./profile-language.ts";
import { entryLemma, exampleText, type LexiconEntry } from "../core/review.ts";
import type { SlovakLookup } from "../core/slovak-check.ts";

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
	return curriculumFile(profile, "lexicon.json");
}

/** The profile's BCP-47 tag, for lowercasing words the way the language does. */
function tagOf(profile: string): string {
	return profileLanguage(profile)?.tag ?? "sk-SK";
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
		const tag = tagOf(profile);
		const bySlug = new Map<string, LexiconEntry>();
		const byForm = new Map<string, LexiconEntry[]>();
		const byFolded = new Map<string, LexiconEntry[]>();
		for (const entry of raw.words) {
			entry.lemma = entry.lemma ?? entry.sk ?? "";
			entry.sk = entry.sk ?? entry.lemma;
			for (const ex of entry.examples ?? []) {
				ex.text = ex.text ?? ex.sk ?? "";
				ex.sk = ex.sk ?? ex.text;
			}
			bySlug.set(entry.slug, entry);
			const keys = new Set<string>([
				entry.lemma,
				...(entry.forms ?? []),
				...(entry.declension?.singular ?? []),
				...(entry.declension?.plural ?? []),
			]);
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
	const tag = tagOf(profile);
	const q = query.trim().toLocaleLowerCase(tag);
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

const lookups = new Map<string, SlovakLookup | null>();
const sentenceKey = (s: string) => s.normalize("NFC").toLocaleLowerCase("sk").replace(/[.!?…"„“]/g, "").replace(/\s+/g, " ").trim();

/** The dictionary as the Slovak checker reads it (src/core/slovak-check.ts):
 *  each noun form's genders, and the curated example sentences, which a
 *  person checked. Null without a lexicon. */
export function slovakLookup(profile: string = ACTIVE_PROFILE): SlovakLookup | null {
	if (lookups.has(profile)) return lookups.get(profile)!;
	const lexicon = loadLexicon(profile);
	let lookup: SlovakLookup | null = null;
	if (lexicon) {
		const curated = new Set<string>();
		for (const e of lexicon.entries) for (const ex of e.examples) if (ex.src === "curated" && !ex.rejected) curated.add(sentenceKey(exampleText(ex)));
		lookup = {
			genders: (form) => [...new Set((lexicon.byForm.get(form.toLocaleLowerCase("sk")) ?? []).filter((e) => e.pos === "noun" && e.gender).map((e) => e.gender!))],
			isVerifiedExample: (text) => curated.has(sentenceKey(text)),
		};
	}
	lookups.set(profile, lookup);
	return lookup;
}

const CASES = ["nominative", "genitive", "dative", "accusative", "locative", "instrumental"];

/** The tool's text rendering of one entry. */
export function formatEntry(e: LexiconEntry, examples = 3): string {
	const lemma = entryLemma(e);
	const lines = [`${lemma} — ${e.en} (${e.cat.toLowerCase()}${e.gender ? `, ${e.gender}` : ""}${e.register ? `, ${e.register}` : ""}${e.rank ? `, frequency rank ${e.rank}` : ""})`];
	if (e.declension) {
		lines.push(`  declension (checked against JÚĽŠ) singular: ${e.declension.singular.map((f, i) => `${CASES[i]} ${f}`).join(", ")}`);
		lines.push(`  plural: ${e.declension.plural.map((f, i) => `${CASES[i]} ${f}`).join(", ")}`);
	} else if (e.forms?.length) {
		lines.push(`  verified forms (unordered): ${e.forms.join(", ")}`);
	} else {
		lines.push("  forms: not in the dictionary — do not present a form as certain without saying so");
	}
	for (const ex of e.examples.filter((x) => !x.rejected).slice(0, examples)) lines.push(`  e.g. ${exampleText(ex)} — ${ex.en}`);
	if (e.related.length) lines.push(`  related: ${e.related.slice(0, 6).join(", ")}`);
	return lines.join("\n");
}
