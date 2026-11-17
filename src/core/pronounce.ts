/**
 * Pronunciation (2026-10-28) — the accuracy side of speaking.
 * Saying a line fast is worth nothing if it cannot be followed, so a
 * spoken pass in "say it faster" and every spoken turn in a scene get a
 * score as well as a time.
 *
 * Two engines, same shape (src/server/pronounce.ts picks one):
 *
 *   azure — Azure Speech's pronunciation assessment, which covers Slovak
 *           at phoneme level: accuracy (how close each sound was to a
 *           native speaker's), fluency (pauses, hesitation) and
 *           completeness (words left out). Microsoft returns ProsodyScore
 *           (stress and rhythm) for en-US only, so a Slovak line has no
 *           accent measure. Needs AZURE_SPEECH_KEY + AZURE_SPEECH_REGION.
 *   match — intelligibility from speech-to-text alone: the words the
 *           engine heard against the words expected. A word that was
 *           recognized was said clearly enough; a missing one was not.
 *           No sound-level detail. Always available when STT is.
 *
 * Pure and browser-safe.
 */

import { foldedWords, wordMatch } from "./speak.ts";
import { getSoundNote } from "./sound-notes.ts";

export type PronEngine = "azure" | "match";

type PronError = "omission" | "insertion" | "mispronunciation";

interface PronPhoneme {
	p: string;
	/** 0..100 */
	score: number;
}

export interface PronWord {
	word: string;
	/** 0..100 */
	score: number;
	error?: PronError;
	phonemes?: PronPhoneme[];
}

export interface PronScore {
	engine: PronEngine;
	/** 0..100 — the headline: how closely the sounds matched. */
	accuracy: number;
	/** 0..100 — pauses and hesitation (azure only). */
	fluency?: number;
	/** 0..100 — share of the expected words said (azure only). */
	completeness?: number;
	/** 0..100 — stress, rhythm, intonation (azure, where the locale supports it). */
	prosody?: number;
	/** 0..100 — the one number: accuracy weighted with the rest. */
	overall: number;
	words: PronWord[];
	/** What the engine recognized. */
	heard?: string;
}

/** A pass or a turn at or above this is "Mostly clear" or better: it counts. */
export const PRON_CLEAR = 70;
/** At or above this the line was said like someone who knows the language. */
export const PRON_GOOD = 85;

export function pronLabel(overall: number): string {
	if (overall >= PRON_GOOD) return "Clear";
	if (overall >= PRON_CLEAR) return "Mostly clear";
	if (overall >= 50) return "Rough";
	return "Hard to follow";
}

/** A score read back from the wire: the shape, loosely, with numbers clamped. */
export function isPronScore(v: unknown): v is PronScore {
	if (!v || typeof v !== "object") return false;
	const o = v as Record<string, unknown>;
	return (
		(o.engine === "azure" || o.engine === "match") &&
		typeof o.accuracy === "number" &&
		typeof o.overall === "number" &&
		Array.isArray(o.words) &&
		o.words.every(
			(w) =>
				w &&
				typeof w === "object" &&
				typeof (w as PronWord).word === "string" &&
				typeof (w as PronWord).score === "number",
		)
	);
}

/** A fast pass counts when it was inside the window AND, when there is a
 *  score, the line was clear. Without a microphone there is no score and
 *  time alone decides, as before. */
export function passMade(inWindow: boolean, score?: Pick<PronScore, "overall"> | null): boolean {
	return inWindow && (score == null || score.overall >= PRON_CLEAR);
}

/** Intelligibility from a transcript: each expected word recognized
 *  scores 100, each missing one 0. */
export function matchScore(expected: string, heard: string): PronScore {
	const m = wordMatch(expected, heard);
	const missing = new Set(m.missing);
	const seen = new Map<string, number>();
	const words: PronWord[] = expected
		.split(/\s+/)
		.map((w) => w.toLocaleLowerCase("sk-SK").replace(/[^\p{L}\p{N}']+/gu, ""))
		.filter(Boolean)
		.map((word) => {
			// Matching is on folded forms (wordMatch); the same word twice,
			// missing once, marks the first.
			const key = foldedWords(word)[0] ?? word;
			const n = (seen.get(key) ?? 0) + 1;
			seen.set(key, n);
			const miss = missing.has(key) && n <= m.missing.filter((x) => x === key).length;
			return miss ? { word, score: 0, error: "omission" as const } : { word, score: 100 };
		});
	const accuracy = Math.round(m.score * 100);
	return { engine: "match", accuracy, completeness: accuracy, overall: accuracy, words, heard };
}

/** Azure Speech's detailed recognition result with a Pronunciation-
 *  Assessment header (the parts read here). */
export interface AzureResult {
	RecognitionStatus?: string;
	DisplayText?: string;
	NBest?: Array<{
		Display?: string;
		Lexical?: string;
		PronunciationAssessment?: {
			AccuracyScore?: number;
			FluencyScore?: number;
			CompletenessScore?: number;
			ProsodyScore?: number;
			PronScore?: number;
		};
		Words?: Array<{
			Word?: string;
			PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
			Phonemes?: Array<{ Phoneme?: string; PronunciationAssessment?: { AccuracyScore?: number } }>;
		}>;
	}>;
}

const ERROR: Record<string, PronError | undefined> = {
	Omission: "omission",
	Insertion: "insertion",
	Mispronunciation: "mispronunciation",
};

const clamp = (n: unknown): number =>
	typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;

/** Read Azure's result. Null when nothing was recognized. */
export function parseAzure(result: AzureResult): PronScore | null {
	if (result.RecognitionStatus && result.RecognitionStatus !== "Success") return null;
	const best = result.NBest?.[0];
	if (!best) return null;
	const pa = best.PronunciationAssessment ?? {};
	const words: PronWord[] = (best.Words ?? []).map((w) => {
		const error = ERROR[w.PronunciationAssessment?.ErrorType ?? ""];
		const phonemes = (w.Phonemes ?? [])
			.filter((p) => p.Phoneme)
			.map((p) => ({ p: p.Phoneme!, score: clamp(p.PronunciationAssessment?.AccuracyScore) }));
		return {
			word: (w.Word ?? "").toLocaleLowerCase("sk-SK"),
			score: error === "omission" ? 0 : clamp(w.PronunciationAssessment?.AccuracyScore),
			...(error ? { error } : {}),
			...(phonemes.length ? { phonemes } : {}),
		};
	});
	const accuracy = clamp(pa.AccuracyScore);
	const out: PronScore = {
		engine: "azure",
		accuracy,
		overall: clamp(pa.PronScore ?? pa.AccuracyScore),
		words,
		heard: (best.Display ?? result.DisplayText ?? "").trim(),
	};
	if (typeof pa.FluencyScore === "number") out.fluency = clamp(pa.FluencyScore);
	if (typeof pa.CompletenessScore === "number") out.completeness = clamp(pa.CompletenessScore);
	if (typeof pa.ProsodyScore === "number") out.prosody = clamp(pa.ProsodyScore);
	return out;
}

export interface PronReport {
	/** Scored lines counted. */
	lines: number;
	/** Mean overall across them, or null. */
	average: number | null;
	/** Sounds that keep scoring low (azure only): worst first. */
	sounds: Array<{
		p: string;
		score: number;
		n: number;
		/** Words they were weak in, a few. */
		in: string[];
		/** Articulatory motor guidance cue (if available). */
		cue?: string;
		/** Functional load level ("high" | "medium" | "low"). */
		functionalLoad?: "high" | "medium" | "low";
	}>;
	/** Words that keep coming out wrong or missing: worst first. */
	words: Array<{ word: string; score: number; n: number }>;
}

const WEAK_SOUND = 60;
const WEAK_WORD = 60;

/** What to work on, across many scored lines: the sounds and the words
 *  that stay low. A sound counts once it was heard at least twice. */
export function pronReport(
	scores: readonly PronScore[],
	opts: { sounds?: number; words?: number; languageId?: string } = {},
): PronReport {
	const sounds = new Map<string, { sum: number; n: number; in: Set<string> }>();
	const words = new Map<string, { sum: number; n: number }>();
	let sum = 0;
	for (const s of scores) {
		sum += s.overall;
		for (const w of s.words) {
			if (w.error === "insertion" || !w.word) continue;
			const wo = words.get(w.word) ?? { sum: 0, n: 0 };
			wo.sum += w.score;
			wo.n++;
			words.set(w.word, wo);
			for (const p of w.phonemes ?? []) {
				const so = sounds.get(p.p) ?? { sum: 0, n: 0, in: new Set<string>() };
				so.sum += p.score;
				so.n++;
				if (p.score < WEAK_SOUND) so.in.add(w.word);
				sounds.set(p.p, so);
			}
		}
	}
	return {
		lines: scores.length,
		average: scores.length ? Math.round(sum / scores.length) : null,
		sounds: [...sounds.entries()]
			.map(([p, o]) => {
				const note = getSoundNote(p, opts.languageId);
				return {
					p,
					score: Math.round(o.sum / o.n),
					n: o.n,
					in: [...o.in].slice(0, 3),
					...(note ? { cue: note.how } : {}),
					...(note ? { functionalLoad: note.functionalLoad } : {}),
				};
			})
			.filter((o) => o.n >= 2 && o.score < WEAK_SOUND)
			.sort((a, b) => a.score - b.score || b.n - a.n)
			.slice(0, opts.sounds ?? 5),
		words: [...words.entries()]
			.map(([word, o]) => ({ word, score: Math.round(o.sum / o.n), n: o.n }))
			.filter((o) => o.score < WEAK_WORD)
			.sort((a, b) => a.score - b.score || b.n - a.n)
			.slice(0, opts.words ?? 6),
	};
}
