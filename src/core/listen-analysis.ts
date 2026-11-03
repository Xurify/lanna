/**
 * Listening trends (LangHarness, 2026-11-03): what the Listen task's log says
 * about why sentences were missed, and whether that is changing. Pure and
 * browser-safe, no model call: the page shows it from the saved snapshot, and
 * the guide may read it later.
 *
 * A typed sentence (dictation) is compared with the sentence that was played,
 * word by word, and every difference is given one cause:
 *
 *   - a word the learner had not met (the sentence's one stretch word) is a gap in
 *     vocabulary, whatever the difference looks like;
 *   - the rest are words the learner is counted as knowing, so a difference there is
 *     something else: a sound not caught (vowel length, ľ ň ď ť, š ž č, d/t b/p z/s),
 *     a short word dropped (v, z, s, sa, si), a different word heard, the wrong
 *     ending on the right word (grammar, not hearing), i for y (spelling: the two
 *     sound the same), or a one-letter slip (typing).
 *
 * Picked meanings say whether the sentence was understood and not why, so they
 * count toward accuracy and effort but have no cause. Only the sessions from
 * 2026-11-03 on log the stretch word as it stood in the sentence; an older typed
 * miss cannot be told from a new word and is kept out of the causes.
 *
 * Trends are the last TREND_DAYS days against the days before them, called only when
 * the difference is past chance (the same test as src/core/mistakes.ts).
 */

import { countSyllables } from "./pace.ts";
import { TREND_DAYS, TREND_MIN_REPS, trendOf, wilson, type Trend } from "./mistakes.ts";

export type ListenCause = "new-word" | "length" | "palatal" | "hushing" | "voicing" | "small-word" | "word-missed" | "extra-word" | "mishear" | "ending" | "spelling" | "slip";

/** The larger reading of a cause: what kind of trouble it is. */
export type ListenKind = "vocabulary" | "hearing" | "grammar" | "spelling" | "typing";

export const LISTEN_CAUSES: Record<ListenCause, { label: string; kind: ListenKind; line: string }> = {
	"new-word": { label: "A word you had not met", kind: "vocabulary", line: "The sentence's one new word. It is in your review deck now." },
	length: { label: "Long and short vowels", kind: "hearing", line: "á, é, í, ó, ú, ý, ô, ä heard as short, or the reverse: the length is the part that is easy to miss." },
	palatal: { label: "Soft ľ ň ď ť", kind: "hearing", line: "A soft consonant heard as a hard one (l, n, d, t), or the reverse." },
	hushing: { label: "š ž č against s z c", kind: "hearing", line: "A hushing sound heard as the plain one, or the reverse." },
	voicing: { label: "Voiced and unvoiced", kind: "hearing", line: "d and t, b and p, z and s, g and k, v and f: the same sound with and without voice." },
	"small-word": { label: "Short words dropped", kind: "hearing", line: "v, z, s, k, sa, si, je and the like are quick and unstressed, so they vanish." },
	"word-missed": { label: "A word not caught", kind: "hearing", line: "A word you know that did not register at all." },
	"extra-word": { label: "A word added", kind: "hearing", line: "A word written that was not said." },
	mishear: { label: "A different word heard", kind: "hearing", line: "A known word heard as another word: the sounds ran together." },
	ending: { label: "The right word, the wrong ending", kind: "grammar", line: "You caught the word and not its case or person ending: grammar, more than hearing." },
	spelling: { label: "i and y", kind: "spelling", line: "The two sound the same in Slovak, so this is spelling, not ear." },
	slip: { label: "A one-letter slip", kind: "typing", line: "One letter off in a way that sounds the same: usually a typing slip, not a hearing one." },
};

export const LISTEN_KIND_LABEL: Record<ListenKind, string> = {
	vocabulary: "Vocabulary",
	hearing: "Hearing",
	grammar: "Grammar",
	spelling: "Spelling",
	typing: "Typing",
};

/** The part of a logged Listen session this reads. */
export interface LoggedListen {
	at: string;
	mode: string;
	reps: Array<{
		kind: string;
		sentence: string;
		given: string;
		verdict: "exact" | "accents" | "wrong";
		ms?: number;
		heardMs?: number;
		replays?: number;
		peeked?: boolean;
		/** The words the learner had not met, as they stand in the sentence. */
		stretch?: string[];
	}>;
}

/** One difference between what was played and what was typed. */
export interface WordError {
	cause: ListenCause;
	/** The word that was said ("" for a word added). */
	target: string;
	/** The word that was typed ("" for a word dropped). */
	given: string;
}

export interface CauseTrend {
	cause: ListenCause;
	kind: ListenKind;
	/** Words this went wrong, all time. */
	count: number;
	/** Per 100 typed sentences, in the last TREND_DAYS days and before them (null without enough sentences). */
	recent: number | null;
	earlier: number | null;
	/** "better" is fewer than before. */
	trend: Trend;
}

export interface ListenMiss {
	at: string;
	sentence: string;
	given: string;
	errors: WordError[];
}

export interface ListenWeek {
	week: string;
	reps: number;
	right: number;
}

export interface ListenAnalysis {
	/** Sentences in the log, and how many of them were typed. */
	sentences: number;
	typed: number;
	/** Sessions and the days they cover. */
	sessions: number;
	from: string | null;
	to: string | null;
	/** Understood: the share that went exactly right, with its likely range. */
	right: number;
	range: { low: number; high: number } | null;
	/** Typed sentences with at least one difference, read for causes. */
	read: number;
	weeks: ListenWeek[];
	/** Most common first. */
	causes: CauseTrend[];
	/** How much of the trouble is each kind, of all the differences read. */
	kinds: Array<{ kind: ListenKind; label: string; count: number; share: number }>;
	/** Effort: plays after the first, and how often the text was shown first, last window against before. */
	replays: { recent: number | null; earlier: number | null };
	peeked: { recent: number | null; earlier: number | null };
	/** Accuracy by how fast the clip was spoken, when each group has enough sentences. */
	pace: { slow: { reps: number; right: number } | null; fast: { reps: number; right: number } | null; slowBelow: number; fastAbove: number } | null;
	/** The latest typed misses, newest first. */
	misses: ListenMiss[];
	/** Enough typed sentences for the causes and trends to be read as more than chance. */
	ready: boolean;
}

/** Typed sentences needed before the causes are shown as findings. */
export const LISTEN_MIN_TYPED = 20;
/** Sentences each pace group needs before the two are compared. */
export const PACE_MIN_REPS = 8;
/** Syllables a second below and above which a clip counts as slow or fast (the slovak.wiki clips run 2.3 to 5.4). */
export const SLOW_PACE = 3.5;
export const FAST_PACE = 4.6;
export const MISSES_KEPT = 8;
export const WEEKS_KEPT = 8;

const DAY_MS = 86_400_000;

// ─── Reading one typed sentence ─────────────────────────────────────────────

const LENGTH = new Set(["á", "é", "í", "ó", "ú", "ý", "ô", "ä", "ŕ", "ĺ"]);
const PALATAL = new Set(["ľ", "ň", "ď", "ť"]);
const HUSHING = new Set(["š", "ž", "č"]);
/** Pairs that differ only in voice (after the accents are folded). */
const VOICING: Array<[string, string]> = [["b", "p"], ["d", "t"], ["g", "k"], ["z", "s"], ["v", "f"]];
const SMALL_WORDS = new Set(["a", "i", "k", "o", "s", "u", "v", "z", "na", "do", "po", "od", "za", "sa", "si", "je", "to", "by", "že", "aj", "ma", "mi", "ti", "som", "si", "sme", "ste", "so", "zo", "ku", "vo", "ho", "ju", "ich"]);

function fold(s: string): string {
	return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Words of a sentence, lower-cased, without punctuation. */
export function listenWords(text: string): string[] {
	return text.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function editDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const cur = [i];
		for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
		prev = cur;
	}
	return prev[n]!;
}

type Op = { op: "match" | "sub" | "del" | "ins"; target?: string; given?: string };

/** The cheapest way from the played words to the typed ones: a similar word is a substitution, never a drop and an add. */
export function alignWords(target: string[], given: string[]): Op[] {
	const n = target.length;
	const m = given.length;
	const cost = (t: string, g: string) => (t === g ? 0 : Math.min(1, editDistance(fold(t), fold(g)) / Math.max(t.length, g.length) + (fold(t) === fold(g) ? 0 : 0.05)));
	const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = 1; i <= n; i++) d[i]![0] = i;
	for (let j = 1; j <= m; j++) d[0]![j] = j;
	for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost(target[i - 1]!, given[j - 1]!));
	const ops: Op[] = [];
	let i = n;
	let j = m;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && Math.abs(d[i]![j]! - (d[i - 1]![j - 1]! + cost(target[i - 1]!, given[j - 1]!))) < 1e-9) {
			ops.push({ op: target[i - 1] === given[j - 1] ? "match" : "sub", target: target[i - 1], given: given[j - 1] });
			i--;
			j--;
		} else if (i > 0 && Math.abs(d[i]![j]! - (d[i - 1]![j]! + 1)) < 1e-9) {
			ops.push({ op: "del", target: target[i - 1] });
			i--;
		} else {
			ops.push({ op: "ins", given: given[j - 1] });
			j--;
		}
	}
	return ops.reverse();
}

/** Why one word was typed as another. */
export function causeOfSub(target: string, given: string, stretch: ReadonlySet<string>): ListenCause {
	if (stretch.has(target)) return "new-word";
	const ft = fold(target);
	const fg = fold(given);
	if (ft === fg) {
		// Same letters, different marks: which mark?
		for (let i = 0; i < target.length; i++) {
			const t = target[i]!;
			const g = given[i];
			if (t === g) continue;
			if (PALATAL.has(t) || (g && PALATAL.has(g))) return "palatal";
			if (HUSHING.has(t) || (g && HUSHING.has(g))) return "hushing";
			return "length";
		}
		return "length";
	}
	if (ft.replace(/y/g, "i") === fg.replace(/y/g, "i")) return "spelling";
	if (ft.length === fg.length) {
		const diff = [...ft].map((c, i) => [c, fg[i]!] as const).filter(([a, b]) => a !== b);
		if (diff.length > 0 && diff.every(([a, b]) => VOICING.some(([x, y]) => (a === x && b === y) || (a === y && b === x)))) return "voicing";
	}
	const stem = Math.max(3, Math.min(target.length, given.length) - 2);
	let common = 0;
	while (common < ft.length && common < fg.length && ft[common] === fg[common]) common++;
	if (common >= stem && ft.length >= 4 && fg.length >= 4) return "ending";
	return editDistance(ft, fg) <= 1 ? "slip" : "mishear";
}

/** Every difference between the sentence played and the one typed. */
export function readTyped(sentence: string, given: string, stretch: readonly string[] = []): WordError[] {
	const known = new Set(stretch.map((w) => w.normalize("NFC").toLowerCase()));
	const errors: WordError[] = [];
	for (const o of alignWords(listenWords(sentence), listenWords(given))) {
		if (o.op === "match") continue;
		if (o.op === "sub") errors.push({ cause: causeOfSub(o.target!, o.given!, known), target: o.target!, given: o.given! });
		else if (o.op === "del") errors.push({ cause: known.has(o.target!) ? "new-word" : SMALL_WORDS.has(o.target!) ? "small-word" : "word-missed", target: o.target!, given: "" });
		else errors.push({ cause: "extra-word", target: "", given: o.given! });
	}
	return errors;
}

// ─── The trends ─────────────────────────────────────────────────────────────

function weekOf(at: number): string {
	const d = new Date(at);
	const back = (d.getUTCDay() + 6) % 7;
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

const mean = (v: number[]): number | null => (v.length >= TREND_MIN_REPS ? v.reduce((a, b) => a + b, 0) / v.length : null);

export function analyzeListening(lessons: readonly LoggedListen[], now: Date): ListenAnalysis {
	const cut = now.getTime() - TREND_DAYS * DAY_MS;
	type Rep = { at: number; day: string; typed: boolean; right: boolean; replays: number; peeked: boolean; pace: number | null; errors: WordError[] | null; sentence: string; given: string; atIso: string };
	const reps: Rep[] = [];
	let sessions = 0;
	for (const lesson of lessons) {
		if (lesson.mode !== "listen") continue;
		const at = Date.parse(lesson.at);
		if (!Number.isFinite(at)) continue;
		sessions++;
		for (const r of lesson.reps) {
			const typed = r.kind === "dictation";
			const right = r.verdict === "exact";
			// Causes need the stretch word as logged; an older typed miss without it is not read.
			const errors = typed && !right && r.stretch !== undefined ? readTyped(r.sentence, r.given, r.stretch) : typed && right ? [] : null;
			const syl = countSyllables(r.sentence);
			reps.push({ at, day: lesson.at.slice(0, 10), typed, right, replays: r.replays ?? 0, peeked: !!r.peeked, pace: r.heardMs && r.heardMs >= 800 && syl >= 3 ? syl / (r.heardMs / 1000) : null, errors, sentence: r.sentence, given: r.given, atIso: lesson.at });
		}
	}
	reps.sort((a, b) => a.at - b.at);
	const typedReps = reps.filter((r) => r.typed);
	const readable = typedReps.filter((r) => r.errors !== null);
	const recentTyped = readable.filter((r) => r.at >= cut);
	const earlierTyped = readable.filter((r) => r.at < cut);

	// Causes, per 100 typed sentences in each window.
	const tally = new Map<ListenCause, { count: number; recent: number; earlier: number; recentSent: number; earlierSent: number }>();
	for (const r of readable) {
		const seen = new Set<ListenCause>();
		for (const e of r.errors!) {
			const t = tally.get(e.cause) ?? { count: 0, recent: 0, earlier: 0, recentSent: 0, earlierSent: 0 };
			t.count++;
			if (!seen.has(e.cause)) {
				seen.add(e.cause);
				if (r.at >= cut) t.recentSent++;
				else t.earlierSent++;
			}
			tally.set(e.cause, t);
		}
	}
	const causes: CauseTrend[] = [...tally.entries()]
		.map(([cause, t]) => {
			const recentN = recentTyped.length;
			const earlierN = earlierTyped.length;
			// A sentence without this cause counts as "right" for the trend test, so "better" means it happens less.
			const trend = trendOf({ reps: recentN, right: recentN - t.recentSent }, { reps: earlierN, right: earlierN - t.earlierSent });
			return {
				cause,
				kind: LISTEN_CAUSES[cause].kind,
				count: t.count,
				recent: recentN >= TREND_MIN_REPS ? Math.round((t.recentSent / recentN) * 100) : null,
				earlier: earlierN >= TREND_MIN_REPS ? Math.round((t.earlierSent / earlierN) * 100) : null,
				trend,
			};
		})
		.sort((a, b) => b.count - a.count);
	const total = causes.reduce((n, c) => n + c.count, 0);
	const kinds = (Object.keys(LISTEN_KIND_LABEL) as ListenKind[])
		.map((kind) => {
			const count = causes.filter((c) => c.kind === kind).reduce((n, c) => n + c.count, 0);
			return { kind, label: LISTEN_KIND_LABEL[kind], count, share: total ? count / total : 0 };
		})
		.filter((k) => k.count > 0)
		.sort((a, b) => b.count - a.count);

	// Weeks of accuracy over every sentence, typed or picked.
	const weekMap = new Map<string, { reps: number; right: number }>();
	for (const r of reps) {
		const w = weekMap.get(weekOf(r.at)) ?? { reps: 0, right: 0 };
		w.reps++;
		if (r.right) w.right++;
		weekMap.set(weekOf(r.at), w);
	}
	const weeks = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-WEEKS_KEPT).map(([week, v]) => ({ week, ...v }));

	const recentAll = reps.filter((r) => r.at >= cut);
	const earlierAll = reps.filter((r) => r.at < cut);
	const slow = reps.filter((r) => r.pace !== null && r.pace < SLOW_PACE);
	const fast = reps.filter((r) => r.pace !== null && r.pace > FAST_PACE);
	const paceOk = slow.length >= PACE_MIN_REPS && fast.length >= PACE_MIN_REPS;
	const rightN = reps.filter((r) => r.right).length;
	return {
		sentences: reps.length,
		typed: typedReps.length,
		sessions,
		from: reps[0]?.day ?? null,
		to: reps[reps.length - 1]?.day ?? null,
		right: reps.length ? rightN / reps.length : 0,
		range: reps.length ? wilson(rightN, reps.length) : null,
		read: readable.filter((r) => r.errors!.length > 0).length,
		weeks,
		causes,
		kinds,
		replays: { recent: mean(recentAll.map((r) => r.replays)), earlier: mean(earlierAll.map((r) => r.replays)) },
		peeked: { recent: mean(recentAll.map((r) => (r.peeked ? 1 : 0))), earlier: mean(earlierAll.map((r) => (r.peeked ? 1 : 0))) },
		pace: paceOk
			? { slow: { reps: slow.length, right: slow.filter((r) => r.right).length }, fast: { reps: fast.length, right: fast.filter((r) => r.right).length }, slowBelow: SLOW_PACE, fastAbove: FAST_PACE }
			: null,
		misses: reps
			.filter((r) => r.typed && !r.right && r.errors && r.errors.length > 0)
			.slice(-MISSES_KEPT)
			.reverse()
			.map((r) => ({ at: r.atIso, sentence: r.sentence, given: r.given, errors: r.errors! })),
		ready: readable.length >= LISTEN_MIN_TYPED,
	};
}
