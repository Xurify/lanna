import { checkSlovak } from "./slovak-check.ts";

export const SENTENCE_TARGETS = 3;
export const SENTENCE_XP = 5;
export const SENTENCE_MAX_CHARS = 300;

export interface PracticeSentenceTarget {
	lemma: string;
	slug?: string;
	gloss: string;
	line?: string;
}

export interface PracticeSentenceEntry {
	source: "hardwords" | "practice";
	slug?: string;
	lemma: string;
	sentence: string;
	ok: boolean;
	corrected: string;
	why: string;
	model: string;
	at: string;
}

export interface SentenceCheckOptions {
	langTag?: string;
	forms?: readonly string[];
}

export function usesLemma(words: readonly string[], lemma: string, opts?: SentenceCheckOptions): boolean {
	const tag = opts?.langTag ?? "sk-SK";
	const l = lemma.normalize("NFC").toLocaleLowerCase(tag);
	if (/\s/.test(l)) return true;
	const lowered = words.map((w) => w.normalize("NFC").toLocaleLowerCase(tag));
	if (opts?.forms?.length) {
		const known = new Set(opts.forms.map((f) => f.normalize("NFC").toLocaleLowerCase(tag)));
		known.add(l);
		if (lowered.some((w) => known.has(w))) return true;
	}
	const stem = l.slice(0, Math.max(3, l.length - 1));
	return lowered.some((w) => w.startsWith(stem));
}

export function sentenceProblems(sentence: string, lemma: string, opts?: SentenceCheckOptions): string[] {
	const tag = opts?.langTag ?? "sk-SK";
	const text = sentence.normalize("NFC").trim();
	const words = text.match(/[\p{L}]+/gu) ?? [];
	if (words.length < 2) return ["Write a whole sentence, not only the word."];
	if (!usesLemma(words, lemma, opts)) return [`Use "${lemma}" in the sentence, in any form.`];
	if (tag.toLowerCase().startsWith("sk")) return checkSlovak(text).issues.map((i) => i.why);
	return [];
}

export interface SentenceVerdict {
	ok: boolean;
	corrected: string;
	why: string;
}

export function parseVerdict(text: string, sentence: string): SentenceVerdict | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
	if (!raw || typeof raw !== "object") return null;
	const o = raw as { ok?: unknown; corrected?: unknown; why?: unknown };
	if (typeof o.ok !== "boolean" || typeof o.why !== "string" || !o.why.trim()) return null;
	const corrected = typeof o.corrected === "string" && o.corrected.trim() ? o.corrected.trim() : sentence;
	return { ok: o.ok, corrected, why: o.why.trim() };
}
