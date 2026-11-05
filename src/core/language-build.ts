/**
 * Building a language's word list from open data, without a model
 * (2026-11-05). The server streams the sources (src/server/language-add.ts);
 * everything here is pure so the rules can be tested on a few lines.
 *
 * - Words, glosses, gender and inflected forms come from Wiktionary as
 *   extracted by kaikki.org (one JSON object per line).
 * - Which words are common comes from FrequencyWords (OpenSubtitles 2018);
 *   a language it lacks is ranked by how often Tatoeba uses the word.
 * - Example sentences come only from Tatoeba, with their English translation
 *   and id (E27: no sentence a learner drills is written by a model).
 * - A form names one lemma or none: a form two entries share is never
 *   blanked (the homograph guard of E28).
 */

import { foldDiacritics, type LanguageInfo } from "./language.ts";
import type { LexiconEntry, LexiconExample } from "./review.ts";

export interface BuildWord {
	/** Unique per lemma and part of speech. */
	key: string;
	lemma: string;
	pos: string;
	glosses: string[];
	gender?: string;
	forms: string[];
	/** Each form's grammar as Wiktionary labels it ("genitive", "plural"),
	 *  the lemma's own form included: what a generated lesson unit selects by. */
	formTags?: Record<string, string[]>;
}

export interface FormOf {
	form: string;
	lemma: string;
	pos: string;
	tags?: string[];
}

export interface TatoebaSentence {
	id: number;
	text: string;
	en: string;
}

/** Wiktionary marks stress on Russian, Ukrainian and other Cyrillic forms
 *  with a combining acute or grave; running text never has it. Only marks
 *  on Cyrillic letters go, so Latin é or ŕ are untouched. */
export function stripStress(text: string): string {
	return text.normalize("NFD").replace(/([Ѐ-ӿ])[̀́]/gu, "$1").normalize("NFC");
}

export function normWord(text: string, tag: string): string {
	return stripStress(text).toLocaleLowerCase(tag).trim();
}

/** "word count" lines, most common first → word → rank (1-based). */
export function parseFrequency(text: string, tag: string, max = 30_000): Map<string, number> {
	const out = new Map<string, number>();
	for (const line of text.split(/\r?\n/)) {
		const word = line.split(" ")[0];
		if (!word || !/^\p{L}+$/u.test(word)) continue;
		const w = normWord(word, tag);
		if (!out.has(w)) out.set(w, out.size + 1);
		if (out.size >= max) break;
	}
	return out;
}

/** Rank by use in the sentences themselves, for a language with no list. */
export function frequencyFromSentences(sentences: Iterable<{ text: string }>, tag: string, max = 30_000): Map<string, number> {
	const counts = new Map<string, number>();
	for (const s of sentences) for (const t of tokenize(s.text)) {
		const w = normWord(t.token, tag);
		counts.set(w, (counts.get(w) ?? 0) + 1);
	}
	const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
	return new Map(sorted.map(([w], i) => [w, i + 1]));
}

const WORD_FIELD = /"word": ?"((?:[^"\\]|\\.)*)"/g;

/** A cheap look at a raw line before parsing it: does any "word" field in
 *  it name a wanted word? Most lines of a 1 GB file are rare words. */
export function lineMayMatter(line: string, wanted: ReadonlySet<string>, tag: string): boolean {
	for (const m of line.matchAll(WORD_FIELD)) {
		let w: string;
		try {
			w = JSON.parse(`"${m[1]}"`) as string;
		} catch {
			continue;
		}
		if (wanted.has(normWord(w, tag))) return true;
	}
	return false;
}

const CAT: Record<string, string> = {
	noun: "Nouns",
	verb: "Verbs",
	adj: "Adjectives",
	adv: "Adverbs",
	pron: "Pronouns",
	prep: "Prepositions",
	postp: "Postpositions",
	conj: "Conjunctions",
	num: "Numerals",
	particle: "Particles",
	det: "Determiners",
	article: "Articles",
	intj: "Phrases",
	phrase: "Phrases",
};

/** The Words page groups by these. Other parts of speech (names, letters,
 *  affixes, symbols) are not words a learner drills. */
export function catOf(pos: string): string | null {
	return CAT[pos] ?? null;
}

/** Table cells that are not forms (headers, template names, romanizations)
 *  and forms not to drill (pre-reform spellings such as кошкѣ, rare ones). */
const NOT_A_FORM = new Set(["error-unrecognized-form", "table-tags", "inflection-template", "class", "romanization", "error-unknown-tag", "canonical", "transliteration", "dated", "archaic", "obsolete", "rare", "nonstandard", "misspelling"]);

/** A "form of" sense that names another word, not an inflection of it. */
const RELATED_WORD = new Set(["diminutive", "augmentative", "endearing", "pejorative", "abbreviation", "alt-of", "misspelling", "dated", "archaic", "obsolete"]);

/** The name of a letter of the alphabet is not the word it is spelled like. */
const LETTER_NAME = /\bname of the\b.*\bletter\b/i;

const SCRIPTS: Array<[string, RegExp]> = [
	["Cyrillic", /\p{Script=Cyrillic}/u],
	["Greek", /\p{Script=Greek}/u],
	["Latin", /\p{Script=Latin}/u],
];

function scriptOf(text: string): string | null {
	return SCRIPTS.find(([, re]) => re.test(text))?.[0] ?? null;
}

function genderOf(tags: readonly string[]): string | undefined {
	const t = new Set(tags);
	if (t.has("masculine")) return t.has("animate") ? "masculine-animate" : t.has("inanimate") ? "masculine-inanimate" : "masculine";
	if (t.has("feminine")) return "feminine";
	if (t.has("neuter")) return "neuter";
	return undefined;
}

interface KaikkiSense {
	glosses?: string[];
	tags?: string[];
	form_of?: Array<{ word?: string }>;
	alt_of?: Array<{ word?: string }>;
}

interface KaikkiEntry {
	word?: string;
	pos?: string;
	forms?: Array<{ form?: string; tags?: string[]; source?: string }>;
	senses?: KaikkiSense[];
}

/** One kaikki line: a lemma with its glosses and forms, and/or the lemmas
 *  this word is an inflected form of. */
export function readKaikkiEntry(raw: unknown): { word: BuildWord | null; formOf: FormOf[] } {
	const e = raw as KaikkiEntry;
	const lemma = typeof e?.word === "string" ? stripStress(e.word).trim() : "";
	const pos = typeof e?.pos === "string" ? e.pos : "";
	if (!lemma || !catOf(pos) || /\d/.test(lemma)) return { word: null, formOf: [] };
	const formOf: FormOf[] = [];
	const glosses: string[] = [];
	const senseTags: string[] = [];
	for (const s of e.senses ?? []) {
		const tags = s.tags ?? [];
		const target = s.form_of?.[0]?.word;
		if (target) {
			if (!tags.some((t) => RELATED_WORD.has(t))) formOf.push({ form: lemma, lemma: stripStress(target), pos, tags: grammarTags(tags) });
			continue;
		}
		if (s.alt_of?.length || tags.includes("form-of") || tags.includes("alt-of") || tags.includes("misspelling")) continue;
		// Nested senses list the parent's gloss first ("[with prepositional]", "in, at").
		const g = s.glosses?.at(-1)?.trim();
		if (g && LETTER_NAME.test(g)) continue;
		if (g && !glosses.includes(g)) glosses.push(g.length > 90 ? `${g.slice(0, 87)}…` : g);
		senseTags.push(...tags);
	}
	if (glosses.length === 0) return { word: null, formOf };
	const forms = new Set<string>();
	const formTags: Record<string, string[]> = {};
	const script = scriptOf(lemma);
	for (const f of e.forms ?? []) {
		const form = typeof f.form === "string" ? stripStress(f.form).trim() : "";
		if (!form || form === "-" || /[\s\d]/.test(form) || !/\p{L}/u.test(form)) continue;
		if (scriptOf(form) !== script) continue;
		if ((f.tags ?? []).some((t) => NOT_A_FORM.has(t))) continue;
		// A form outside an inflection table is a related word (the aspect
		// partner, a diminutive), not this lemma's form.
		if (!f.source) continue;
		addTags(formTags, form, grammarTags(f.tags ?? []));
		if (form !== lemma) forms.add(form);
	}
	return {
		word: { key: `${lemma}\u0000${pos}`, lemma, pos, glosses: glosses.slice(0, 3), gender: pos === "noun" ? genderOf(senseTags) : undefined, forms: [...forms], ...(Object.keys(formTags).length ? { formTags } : {}) },
		formOf,
	};
}

/** The tags that say a form's grammar; layout and source labels go. */
function grammarTags(tags: readonly string[]): string[] {
	return tags.filter((t) => !NOT_A_FORM.has(t) && !RELATED_WORD.has(t) && t !== "form-of" && t !== "table-tags");
}

/** A form can fill several cells (Czech "kávě" is dative and locative):
 *  its tags are each cell's, kept as alternatives joined by "|". */
function addTags(into: Record<string, string[]>, form: string, tags: readonly string[]): void {
	if (tags.length === 0) return;
	const cell = [...tags].sort().join(" ");
	const list = into[form] ?? [];
	if (!list.includes(cell)) list.push(cell);
	into[form] = list;
}

/** Every form names the lemmas it belongs to; the ones only one lemma owns
 *  can be blanked and can rank it. */
export function formIndex(words: readonly BuildWord[], tag: string): Map<string, Set<string>> {
	const index = new Map<string, Set<string>>();
	const add = (form: string, key: string) => {
		const f = normWord(form, tag);
		const set = index.get(f);
		if (set) set.add(key);
		else index.set(f, new Set([key]));
	};
	for (const w of words) {
		add(w.lemma, w.key);
		for (const f of w.forms) add(f, w.key);
	}
	return index;
}

/** Give a lemma the forms Wiktionary lists only as their own entries
 *  ("kun: genitive plural of kuna"). */
export function mergeFormOf(words: BuildWord[], formOf: readonly FormOf[]): void {
	const byLemma = new Map<string, BuildWord>();
	for (const w of words) byLemma.set(`${w.lemma}\u0000${w.pos}`, w);
	for (const f of formOf) {
		const w = byLemma.get(`${f.lemma}\u0000${f.pos}`);
		if (!w || f.form === w.lemma) continue;
		if (!w.forms.includes(f.form)) w.forms.push(f.form);
		// The table's cells are exact; a "form of" entry often lumps several.
		if (f.tags?.length && !w.formTags?.[f.form]) {
			w.formTags ??= {};
			addTags(w.formTags, f.form, f.tags);
		}
	}
}

const INFLECTING = new Set(["noun", "verb", "adj"]);

/** Wiktionary gives one entry per part of speech: "co" is a pronoun, a
 *  conjunction and a particle. Entries that do not inflect are one word to
 *  a learner, so they become one row, which then owns the token and gets
 *  its sentences. Inflecting entries (jak, "yak") stay apart. */
export function mergeHomographs(words: readonly BuildWord[], tag: string): BuildWord[] {
	const out: BuildWord[] = [];
	const merged = new Map<string, BuildWord>();
	for (const w of words) {
		if (INFLECTING.has(w.pos) && w.forms.length > 0) {
			out.push(w);
			continue;
		}
		const lemma = normWord(w.lemma, tag);
		const into = merged.get(lemma);
		if (!into) {
			const copy = { ...w, glosses: [...w.glosses], forms: [...w.forms] };
			merged.set(lemma, copy);
			out.push(copy);
			continue;
		}
		const first = w.glosses[0];
		if (first && !into.glosses.includes(first)) into.glosses.push(first);
		for (const f of w.forms) if (!into.forms.includes(f)) into.forms.push(f);
	}
	for (const w of merged.values()) w.glosses = w.glosses.slice(0, 4);
	return out;
}

/** The most common lemmas: a lemma ranks by its commonest form it alone
 *  owns. A noun, verb or adjective that shares its spelling with another
 *  entry ranks by its other forms only: "jak" is common as "how", which
 *  says nothing about "jak", the yak. */
export function rankWords(words: readonly BuildWord[], freq: ReadonlyMap<string, number>, tag: string, limit: number): Array<BuildWord & { rank: number }> {
	const index = formIndex(words, tag);
	const spellings = new Map<string, number>();
	for (const w of words) spellings.set(normWord(w.lemma, tag), (spellings.get(normWord(w.lemma, tag)) ?? 0) + 1);
	const ranked: Array<BuildWord & { rank: number }> = [];
	for (const w of words) {
		const lemma = normWord(w.lemma, tag);
		const shared = (spellings.get(lemma) ?? 0) > 1 && INFLECTING.has(w.pos) && w.forms.length > 0;
		let best = shared ? Infinity : (freq.get(lemma) ?? Infinity);
		for (const f of w.forms) {
			const n = normWord(f, tag);
			if (index.get(n)?.size !== 1) continue;
			best = Math.min(best, freq.get(n) ?? Infinity);
		}
		if (Number.isFinite(best)) ranked.push({ ...w, rank: best });
	}
	ranked.sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma));
	return ranked.slice(0, limit);
}

const TOKEN = /\p{L}[\p{L}\p{M}]*/gu;

export function tokenize(text: string): Array<{ token: string; at: number }> {
	return [...text.matchAll(TOKEN)].map((m) => ({ token: m[0], at: m.index! }));
}

/** A sentence short and plain enough to drill: 2–14 words, no digits. */
export function sentenceUsable(text: string): boolean {
	if (text.length > 110 || /\d/.test(text)) return false;
	const n = tokenize(text).length;
	return n >= 2 && n <= 14;
}

/**
 * Collects up to `perWord` Tatoeba sentences per word, each blanked at a
 * form only that word owns. Feed sentences shortest first: the first to
 * arrive are kept.
 */
export class ExampleCollector {
	private readonly index: Map<string, Set<string>>;
	readonly examples = new Map<string, LexiconExample[]>();

	private readonly lemmaOf = new Map<string, string>();
	private readonly rankOf = new Map<string, number>();

	constructor(words: ReadonlyArray<BuildWord & { rank?: number }>, private readonly tag: string, private readonly perWord = 5) {
		this.index = formIndex(words, tag);
		for (const w of words) {
			this.lemmaOf.set(w.key, normWord(w.lemma, tag));
			this.rankOf.set(w.key, w.rank ?? Infinity);
		}
	}

	/** The one word a token belongs to: its only owner, or else the one
	 *  whose dictionary form it is ("prosím" is "please" before it is a
	 *  form of prosit), the commoner one when two share that spelling. */
	private ownerOf(token: string): string | null {
		const owners = this.index.get(token);
		if (!owners) return null;
		if (owners.size === 1) return owners.values().next().value!;
		const exact = [...owners].filter((k) => this.lemmaOf.get(k) === token).sort((a, b) => this.rankOf.get(a)! - this.rankOf.get(b)!);
		if (exact.length === 0) return null;
		if (exact.length > 1 && this.rankOf.get(exact[0]!) === this.rankOf.get(exact[1]!)) return null;
		return exact[0]!;
	}

	add(s: TatoebaSentence): void {
		const text = s.text.normalize("NFC");
		const used = new Set<string>();
		for (const { token, at } of tokenize(text)) {
			const key = this.ownerOf(normWord(token, this.tag));
			if (!key) continue;
			if (used.has(key)) continue;
			used.add(key);
			const list = this.examples.get(key) ?? [];
			if (list.length >= this.perWord) continue;
			list.push({ text, en: s.en, src: "tatoeba", tatoebaId: s.id, cloze: { answer: token, at } });
			this.examples.set(key, list);
		}
	}
}

/** Letters a learner's English keyboard lacks, for the letter bar. Other
 *  scripts are typed on their own keyboard layout, so they get none. */
export function specialLettersOf(lemmas: readonly string[], tag: string): string[] {
	const counts = new Map<string, number>();
	for (const l of lemmas) {
		for (const ch of l.normalize("NFC").toLocaleLowerCase(tag)) {
			if (!/\p{L}/u.test(ch) || /[a-z]/.test(ch)) continue;
			counts.set(ch, (counts.get(ch) ?? 0) + 1);
		}
	}
	const letters = [...counts.entries()].filter(([, n]) => n >= 3).map(([ch]) => ch);
	if (letters.some((ch) => !/\p{Script=Latin}/u.test(ch))) return [];
	return letters.sort((a, b) => a.localeCompare(b, tag)).slice(0, 20);
}

function slugOf(lemma: string, tag: string): string {
	return foldDiacritics(lemma.toLocaleLowerCase(tag)).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "word";
}

/** The lexicon file's word rows, commonest first. */
export function toLexiconEntries(ranked: ReadonlyArray<BuildWord & { rank: number }>, examples: ReadonlyMap<string, LexiconExample[]>, tag: string): LexiconEntry[] {
	const slugs = new Set<string>();
	return ranked.map((w) => {
		let slug = slugOf(w.lemma, tag);
		for (let i = 2; slugs.has(slug); i++) slug = `${slugOf(w.lemma, tag)}-${i}`;
		slugs.add(slug);
		return {
			slug,
			lemma: w.lemma,
			en: w.glosses.join("; "),
			cat: catOf(w.pos) ?? "Other",
			pos: w.pos,
			rank: w.rank,
			...(w.gender ? { gender: w.gender } : {}),
			...(w.forms.length ? { forms: w.forms } : {}),
			...(w.formTags ? { formTags: w.formTags } : {}),
			origin: "wiktionary",
			examples: examples.get(w.key) ?? [],
			related: [],
		};
	});
}

/** The tutor's doctrine for an added language. Written from a template, so
 *  it states nothing about the language a model would have to know. */
export function languagePrompt(info: Pick<LanguageInfo, "english" | "endonym">): string {
	const { english, endonym } = info;
	return `# The language: ${english}

This harness profile teaches **${english}** (${endonym}). Every session is a ${english}-language session: understanding, producing and hearing ${english}, from A1 toward B1 unless the probe or the learner sets another target.

The profile was added from the app. Its word list comes from Wiktionary and its example sentences from Tatoeba; there is no hand-written curriculum yet, so check a form against the lexicon (\`lookup_word\`) before you teach it, and say when you are not sure.

## Bridges

Explanations are in **English**. The learner's other languages are listed in "This learner"; use one as a bridge when it shares the structure, and say where the analogy breaks. Never force a bridge; an analogy that needs three caveats is worse than none.

## Adaptive immersion

Explanations in English; the learner's production in drills and checks strictly in ${english}. Shift your own prose toward ${english} only on evidence of comprehension, and drop back when it fails.

## Sound: \`say:\` spans

Write every ${english} example the learner should hear as inline code prefixed with \`say:\` — one phrase per span, never English inside.

## Production and thinking out loud

Prefer checks where the learner produces ${english} (transformations, sentence completion, short translations) over recognition. Every answer card already has a thinking field, so never write "Thinking field:" or other instructions into the question text. To steer the reasoning, end the question with one short plain question, such as "Which word decides the ending?".
`;
}

export interface SeedDraft {
	language: string;
	version: number;
	draft: true;
	nodes: Array<{ key: string; kind: "grammar"; strand: string; name: string; statement: string }>;
	chains: Array<{ premises: string[]; conclusion: string }>;
}

export const SEED_STRANDS = ["phonetics", "nouns", "pronouns", "verbs", "syntax"] as const;

export function seedDraftPrompt(info: Pick<LanguageInfo, "english">): { system: string; prompt: string } {
	return {
		system: `You draft the grammar map for a ${info.english} course for English-speaking adults, A1 to B1. Reply with JSON only, no prose and no code fence.`,
		prompt: `List 20 to 40 grammar points a learner of ${info.english} meets from A1 to B1, in teaching order, and which points each one builds on.

Shape:
{"nodes":[{"key":"short-kebab-key","strand":"${SEED_STRANDS.join('" | "')}","name":"A short title","statement":"Two or three plain sentences stating the rule, with one short ${info.english} example and its English meaning."}],"chains":[{"premises":["key"],"conclusion":"key"}]}

Rules: keys are unique; every chain names keys from the list; no chain loops; state only rules you are sure of.`,
	};
}

/** The model's grammar map, checked: unknown strands become syntax, chains
 *  naming an unknown key or pointing back at an earlier point are dropped.
 *  Null when nothing usable came back. */
export function parseSeedDraft(text: string, language: string): SeedDraft | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	let raw: { nodes?: unknown; chains?: unknown };
	try {
		raw = JSON.parse(text.slice(start, end + 1)) as typeof raw;
	} catch {
		return null;
	}
	const nodes: SeedDraft["nodes"] = [];
	const order = new Map<string, number>();
	for (const n of Array.isArray(raw.nodes) ? raw.nodes : []) {
		const r = n as Record<string, unknown>;
		const key = typeof r.key === "string" ? r.key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
		const name = typeof r.name === "string" ? r.name.trim() : "";
		const statement = typeof r.statement === "string" ? r.statement.trim() : "";
		if (!key || !name || !statement || order.has(key)) continue;
		const strand = (SEED_STRANDS as readonly string[]).includes(r.strand as string) ? (r.strand as string) : "syntax";
		order.set(key, nodes.length);
		nodes.push({ key, kind: "grammar", strand, name: name.slice(0, 80), statement: statement.slice(0, 600) });
	}
	if (nodes.length < 5) return null;
	const chains: SeedDraft["chains"] = [];
	for (const c of Array.isArray(raw.chains) ? raw.chains : []) {
		const r = c as Record<string, unknown>;
		const conclusion = typeof r.conclusion === "string" ? r.conclusion : "";
		const premises = Array.isArray(r.premises) ? r.premises.filter((p): p is string => typeof p === "string") : [];
		const at = order.get(conclusion);
		if (at === undefined || premises.length === 0) continue;
		if (!premises.every((p) => (order.get(p) ?? Infinity) < at)) continue;
		chains.push({ premises, conclusion });
	}
	return { language, version: 1, draft: true, nodes, chains };
}
