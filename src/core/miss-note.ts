import { foldDiacritics } from "./language.ts";
import { mixupKey } from "./mixups.ts";
import { formsOfEntry, twinSentences } from "./pairs.ts";
import { entryLemma, exampleText, type LexiconEntry } from "./review.ts";

export const NOTE_SENTENCES = 5;
export const NOTE_MIN_SENTENCES = 2;
export const NOTE_ASKED_WORDS = 30;
export const NOTE_MAX_WORDS = 60;

export interface NoteSentence {
	id: string;
	text: string;
	en: string;
}

export interface NoteWord {
	slug: string;
	lemma: string;
	gloss: string;
	partOfSpeech?: string;
	sentences: NoteSentence[];
	forms: string[];
}

export interface MissNoteEvidence {
	key: string;
	words: [NoteWord, NoteWord];
}

export interface MissNoteDraft {
	differ: boolean;
	note: string;
	cites: string[];
}

export type MissNoteCheck = { ok: true } | { ok: false; reason: string };

export interface MissNoteJudgement {
	supported: boolean;
	problem?: string;
}

export interface MissNote {
	key: string;
	words: [string, string];
	status: "kept" | "none" | "rejected";
	note?: string;
	cites?: string[];
	reason?: string;
	judge?: MissNoteJudgement;
	raw: string;
	model: string;
	created: string;
	cost?: number;
	ms?: number;
	attempts?: number;
}

export const MISS_NOTE_ATTEMPTS = 2;

export function missNoteSettled(note: Pick<MissNote, "status" | "attempts">): boolean {
	return note.status !== "rejected" || (note.attempts ?? 1) >= MISS_NOTE_ATTEMPTS;
}

const PART_OF_SPEECH: Readonly<Record<string, string>> = {
	Nouns: "noun",
	Verbs: "verb",
	Adjectives: "adjective",
	Adverbs: "adverb",
};

function noteWord(
	entry: LexiconEntry,
	member: "a" | "b",
	from: ReturnType<typeof twinSentences>,
	tag: string,
): NoteWord {
	const prefix = member === "a" ? "A" : "B";
	const sentences = from
		.filter((s) => s.member === member)
		.map((s) => s.entry.examples[s.index]!)
		.filter((x) => x.en && exampleText(x))
		.map((x) => ({ text: exampleText(x), en: x.en }))
		.sort((x, y) => x.text.length - y.text.length)
		.slice(0, NOTE_SENTENCES)
		.map((x, i) => ({ id: `${prefix}${i + 1}`, ...x }));
	const pos = PART_OF_SPEECH[entry.cat];
	return {
		slug: entry.slug,
		lemma: entryLemma(entry),
		gloss: entry.en,
		...(pos ? { partOfSpeech: pos } : {}),
		sentences,
		forms: formsOfEntry(entry, tag),
	};
}

export function missNoteEvidence(x: LexiconEntry, y: LexiconEntry, tag = "sk-SK"): MissNoteEvidence {
	const [a, b] = x.slug < y.slug ? [x, y] : [y, x];
	const twins = twinSentences(a, b);
	return { key: mixupKey(a.slug, b.slug), words: [noteWord(a, "a", twins, tag), noteWord(b, "b", twins, tag)] };
}

export function enoughEvidence(e: MissNoteEvidence): boolean {
	return e.words.every((w) => w.sentences.length >= NOTE_MIN_SENTENCES);
}

function evidenceBlock(e: MissNoteEvidence): string {
	return e.words
		.map((w, i) => {
			const head = `Word ${i === 0 ? "A" : "B"}: "${w.lemma}"${w.partOfSpeech ? `, ${w.partOfSpeech}` : ""}. Dictionary: "${w.gloss}".`;
			const lines = w.sentences.length
				? w.sentences.map((s) => `  ${s.id}: ${s.text} = ${s.en}`)
				: ["  (no sentences)"];
			return [head, ...lines].join("\n");
		})
		.join("\n");
}

export const MISS_NOTE_SYSTEM = (language: string) =>
	`You explain to an adult learner of ${language} how two words differ, using only the evidence you are given. A wrong rule misleads the learner, and that is worse than saying there is no clear difference. You answer with one JSON object and nothing else.`;

export function missNoteBrief(e: MissNoteEvidence, language: string): string {
	const [a, b] = e.words;
	return [
		`A learner mixed up the ${language} words "${a.lemma}" and "${b.lemma}". Say what tells them apart, in one or two short sentences of plain English.`,
		"",
		"Use ONLY the evidence below: the dictionary glosses and the sentences with their translations. Do not use anything you know about the language that is not shown here.",
		'- Say only what these glosses and sentences show. If they show no clear difference in meaning or use, set "differ" to false and leave "note" empty. That is better than a guess.',
		"- Do not name a grammar category (a case, aspect, perfective, register, formal, colloquial and the like) unless the evidence names it.",
		`- Put every ${language} word or phrase in *asterisks*, and use only words that appear in the evidence. Name both words.`,
		`- At most ${NOTE_ASKED_WORDS} words.`,
		'- In "cites", list the ids of the sentences that show the difference, at least one for each word.',
		"",
		evidenceBlock(e),
		"",
		'Reply as {"differ": true or false, "note": "...", "cites": ["A1", "B2"]}',
	].join("\n");
}

function firstJson(text: string): Record<string, unknown> | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end < start) return null;
	try {
		const raw = JSON.parse(text.slice(start, end + 1)) as unknown;
		return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export function parseMissNote(text: string): MissNoteDraft | null {
	const o = firstJson(text);
	if (!o || typeof o.differ !== "boolean") return null;
	const note = typeof o.note === "string" ? o.note.trim() : "";
	const cites = Array.isArray(o.cites) ? o.cites.filter((c): c is string => typeof c === "string") : [];
	return { differ: o.differ, note, cites };
}

const GRAMMAR_TERMS = [
	"aspect",
	"perfective",
	"imperfective",
	"case",
	"nominative",
	"genitive",
	"dative",
	"accusative",
	"locative",
	"instrumental",
	"vocative",
	"gender",
	"masculine",
	"feminine",
	"neuter",
	"plural",
	"singular",
	"formal",
	"informal",
	"colloquial",
	"slang",
	"literary",
	"archaic",
	"dialect",
	"register",
	"polite",
	"diminutive",
	"prefix",
	"suffix",
	"conjunction",
	"preposition",
	"pronoun",
	"particle",
];

const words = (text: string) => text.split(/[^\p{L}]+/u).filter(Boolean);

const NON_ASCII_LETTER = /[^\x00-\x7F]/;
const SHARED_SHORT_WORD = 2;

export function verifyMissNote(draft: MissNoteDraft, e: MissNoteEvidence, tag = "sk-SK"): MissNoteCheck {
	if (!draft.differ) return { ok: true };
	const note = draft.note;
	if (!note) return { ok: false, reason: "no note" };
	const count = words(note).length;
	if (count > NOTE_MAX_WORDS) return { ok: false, reason: `${count} words, over ${NOTE_MAX_WORDS}` };
	const key = (w: string) => foldDiacritics(w.toLocaleLowerCase(tag));
	const exact = (w: string) => w.toLocaleLowerCase(tag);
	const known = new Set<string>();
	for (const w of e.words) {
		for (const f of [w.lemma, ...w.forms]) for (const t of words(f)) known.add(exact(t));
		for (const s of w.sentences) for (const t of words(s.text)) known.add(exact(t));
	}
	const spans = [...note.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]!);
	for (const span of spans) {
		const unknown = words(span).find((t) => !known.has(exact(t)));
		if (unknown) return { ok: false, reason: `"${unknown}" is not in the evidence` };
	}
	const outside = note.replace(/\*[^*]+\*/g, " ");
	const englishText = e.words
		.map((w) => `${w.gloss} ${w.partOfSpeech ?? ""} ${w.sentences.map((s) => s.en).join(" ")}`)
		.join(" ")
		.toLowerCase();
	const evidenceWords = new Set(words(englishText));
	const slovakLooking = (t: string) =>
		NON_ASCII_LETTER.test(t) ||
		(t.length > SHARED_SHORT_WORD && known.has(exact(t)) && !evidenceWords.has(t.toLowerCase()));
	const loose = words(outside).find(slovakLooking);
	if (loose) return { ok: false, reason: `"${loose}" is outside the asterisks` };
	const phrase = (text: string) => ` ${words(text).map(key).join(" ")} `;
	const spanPhrases = spans.map(phrase);
	for (const w of e.words) {
		const named = [w.lemma, ...w.forms].some((f) => spanPhrases.some((s) => s.includes(phrase(f))));
		if (!named) return { ok: false, reason: `does not name ${w.lemma}` };
	}
	const term = words(outside.toLowerCase()).find((t) => GRAMMAR_TERMS.includes(t) && !evidenceWords.has(t));
	if (term) return { ok: false, reason: `names "${term}", which the evidence does not` };
	const ids = new Map(e.words.flatMap((w, i) => w.sentences.map((s) => [s.id, i] as const)));
	const bad = draft.cites.find((c) => !ids.has(c));
	if (bad) return { ok: false, reason: `cites ${bad}, which does not exist` };
	for (const [i, w] of e.words.entries()) {
		if (w.sentences.length && !draft.cites.some((c) => ids.get(c) === i))
			return { ok: false, reason: `cites no sentence of ${w.lemma}` };
	}
	return { ok: true };
}

export const MISS_NOTE_JUDGE_SYSTEM = (language: string) =>
	`You check notes written for adult learners of ${language} against the evidence they were written from. You answer with one JSON object and nothing else.`;

export function judgeMissNoteBrief(e: MissNoteEvidence, note: string, language: string): string {
	return [
		`This note was written to tell the ${language} words "${e.words[0].lemma}" and "${e.words[1].lemma}" apart, from the evidence below only.`,
		"",
		`Note: ${note}`,
		"",
		evidenceBlock(e),
		"",
		"Check that every statement in the note is shown by these glosses or sentences. The note need not cover every use of the two words. Mark it unsupported when it states something the evidence contradicts or does not show, or when the contrast it draws does not actually separate the two words in these sentences.",
		'Reply as {"supported": true or false, "problem": "one short sentence, empty when supported"}',
	].join("\n");
}

export function parseJudgement(text: string): MissNoteJudgement | null {
	const o = firstJson(text);
	if (!o || typeof o.supported !== "boolean") return null;
	const problem = typeof o.problem === "string" && o.problem.trim() ? o.problem.trim() : undefined;
	return { supported: o.supported, ...(problem ? { problem } : {}) };
}

export function missNoteRecord(
	e: MissNoteEvidence,
	draft: MissNoteDraft | null,
	raw: string,
	meta: { model: string; now: Date; cost?: number; ms?: number },
	tag = "sk-SK",
): MissNote {
	const base = {
		key: e.key,
		words: [e.words[0].lemma, e.words[1].lemma] as [string, string],
		raw,
		model: meta.model,
		created: meta.now.toISOString(),
		...(meta.cost !== undefined ? { cost: meta.cost } : {}),
		...(meta.ms !== undefined ? { ms: meta.ms } : {}),
	};
	if (!draft) return { ...base, status: "rejected", reason: "not the JSON asked for" };
	if (!draft.differ) return { ...base, status: "none" };
	const check = verifyMissNote(draft, e, tag);
	if (!check.ok) return { ...base, status: "rejected", note: draft.note, cites: draft.cites, reason: check.reason };
	return { ...base, status: "kept", note: draft.note, cites: draft.cites };
}

export function noteSpans(note: string): Array<{ text: string; word: boolean }> {
	return note
		.split(/(\*[^*]+\*)/g)
		.filter(Boolean)
		.map((part) => (/^\*[^*]+\*$/.test(part) ? { text: part.slice(1, -1), word: true } : { text: part, word: false }));
}
