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
 *     ending on the right word (grammar, not hearing), i for y or a consonant
 *     written as it sounds (spelling), or a one-letter slip (typing).
 *
 * A sentence typed with no marks at all is read without its marks: the learner
 * is not typing them, so a missing dĺžeň there says nothing about the ear. A
 * sentence typed after its text was shown is copied, not heard, and is not read.
 *
 * Picked meanings say whether the sentence was understood and not why, so they
 * count toward accuracy and effort but have no cause. Only the sessions from
 * 2026-11-03 on log the stretch word as it stood in the sentence; an older typed
 * miss cannot be told from a new word and is kept out of the causes.
 *
 * Nothing is called from a handful of sentences (docs/research/listening-trends.md,
 * "How much is enough"): the causes wait for LISTEN_MIN_TYPED read sentences over
 * LISTEN_MIN_SESSIONS sessions, a cause is listed from CAUSE_MIN_SENTENCES sentences
 * in CAUSE_MIN_SESSIONS sessions, and a trend needs enough sentences and expected
 * misses in both windows and must survive Holm's correction across every cause
 * tested, because a dozen tests at 5% each would call one change by chance about
 * half the time.
 */

import { countSyllables } from "./pace.ts";
import { TREND_DAYS, TREND_Z, wilson, type Trend } from "./mistakes.ts";

export type ListenCause = "new-word" | "length" | "palatal" | "hushing" | "voicing" | "small-word" | "word-missed" | "extra-word" | "mishear" | "ending" | "spelling" | "assimilation" | "slip";

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
	assimilation: { label: "Written as it sounds", kind: "spelling", line: "A consonant takes the voice of the next one, and loses it at the end of a word (had sounds like hat, v škole like fškole): the ear was right, the spelling rule is the gap." },
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
	/** "better" is fewer than before; "steady" is no change past chance, which is not the same as no change. */
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
	/** Too few sentences for the week's share to mean much. */
	few: boolean;
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
	/** Typed sentences read for causes, those with at least one difference, and the sessions they came from. */
	readable: number;
	read: number;
	readSessions: number;
	weeks: ListenWeek[];
	/** Most common first, only those seen often enough to list. */
	causes: CauseTrend[];
	/** Differences whose cause was seen too seldom to list. */
	rare: number;
	/** How much of the trouble is each kind, of all the differences read. */
	kinds: Array<{ kind: ListenKind; label: string; count: number; share: number }>;
	/** Effort: plays after the first, and how often the text was shown first, last window against before. */
	replays: { recent: number | null; earlier: number | null };
	peeked: { recent: number | null; earlier: number | null };
	/** Accuracy by how fast the clip was spoken, when each group has enough sentences. */
	pace: { slow: { reps: number; right: number }; fast: { reps: number; right: number }; slowBelow: number; fastAbove: number; fastHarder: boolean } | null;
	/** Accuracy by place in a session: the first half against the second. Null without enough sentences in each. */
	session: { first: { reps: number; right: number }; second: { reps: number; right: number }; tiring: boolean } | null;
	/** Accuracy by sentence length: short (up to SHORT_WORDS words) against long (LONG_WORDS and up). Null without enough in each. */
	length: { short: { reps: number; right: number }; long: { reps: number; right: number }; longHarder: boolean } | null;
	/** The last weeks, each with the typed sentences read and how many had each cause: the series the deep read follows (the page shows the two-window trend). */
	causeWeeks: Array<{ week: string; read: number; causes: Partial<Record<ListenCause, number>> }>;
	/** The latest typed misses, newest first. */
	misses: ListenMiss[];
	/** Enough typed sentences for the causes and trends to be read as more than chance. */
	ready: boolean;
}

/** Typed sentences read, sentences with a miss among them, and sessions they span,
 *  before any cause is shown: at 15% a cause's likely range over 50 sentences is
 *  about 7% to 28%, wide but past a guess, and three sessions keep one bad day
 *  from being the whole story. */
export const LISTEN_MIN_TYPED = 50;
export const LISTEN_MIN_MISSED = 15;
export const LISTEN_MIN_SESSIONS = 3;
/** A cause is listed once it has turned up in this many sentences over this many sessions. */
export const CAUSE_MIN_SENTENCES = 4;
export const CAUSE_MIN_SESSIONS = 2;
/** Each window of a cause's trend needs this many read sentences from this many
 *  sessions, and five expected sentences with the cause and five without (the
 *  usual floor for the normal approximation behind the z-test). */
export const CAUSE_TREND_MIN_SENTENCES = 30;
export const CAUSE_TREND_MIN_SESSIONS = 3;
export const MIN_EXPECTED = 5;
/** Family-wise error across all the causes tested at once (Holm). */
export const TREND_ALPHA = 0.05;
/** Sentences each pace group needs before the two are compared. */
export const PACE_MIN_REPS = 20;
/** Sentences each window needs before effort is compared. */
export const EFFORT_MIN_REPS = 30;
/** A week with fewer sentences is shown without its share. */
export const WEEK_MIN_REPS = 10;
/** Sentences each half of a session, and each length group, needs before the two are compared. */
export const CUT_MIN_REPS = 30;
/** Words: a short sentence has up to this many, a long one this many or more. */
export const SHORT_WORDS = 6;
export const LONG_WORDS = 9;
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

const hasMarks = (s: string) => fold(s) !== s.normalize("NFD");
const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

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
		const diff = [...ft].map((c, i) => [c, fg[i]!, i] as const).filter(([a, b]) => a !== b);
		if (diff.length > 0 && diff.every(([a, b]) => VOICING.some(([x, y]) => (a === x && b === y) || (a === y && b === x)))) {
			// At the end of a word or before another consonant the letter is said with its neighbor's voice, so it was heard right.
			const assimilated = diff.every(([, , i]) => i === ft.length - 1 || !VOWELS.has(ft[i + 1]!));
			return assimilated ? "assimilation" : "voicing";
		}
	}
	const stem = Math.max(3, Math.min(target.length, given.length) - 2);
	let common = 0;
	while (common < ft.length && common < fg.length && ft[common] === fg[common]) common++;
	if (common >= stem && ft.length >= 4 && fg.length >= 4) return "ending";
	return editDistance(ft, fg) <= 1 ? "slip" : "mishear";
}

/** Every difference between the sentence played and the one typed. A sentence
 *  typed with no marks at all is compared without them. */
export function readTyped(sentence: string, given: string, stretch: readonly string[] = []): WordError[] {
	const known = new Set(stretch.map((w) => w.normalize("NFC").toLowerCase()));
	const marks = hasMarks(given);
	const errors: WordError[] = [];
	for (const o of alignWords(listenWords(sentence), listenWords(given))) {
		if (o.op === "match") continue;
		if (o.op === "sub" && !marks && fold(o.target!) === fold(o.given!)) continue;
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

const mean = (v: number[]): number | null => (v.length >= EFFORT_MIN_REPS ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error under 1.5e-7). */
function normalCdf(z: number): number {
	const x = Math.abs(z) / Math.SQRT2;
	const t = 1 / (1 + 0.3275911 * x);
	const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
	return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Two-proportion z of hits a/n against b/m, or null when either window is too
 *  small for the normal approximation (fewer than MIN_EXPECTED expected hits or misses). */
export function twoProportionZ(a: number, n: number, b: number, m: number): number | null {
	if (n === 0 || m === 0) return null;
	// In counts, not shares: 40/50 leaves 1 - 0.8 a hair under 0.2 and would refuse 25 × 0.2 = 5.
	if (Math.min(n, m) * Math.min(a + b, n + m - a - b) < MIN_EXPECTED * (n + m)) return null;
	const pooled = (a + b) / (n + m);
	const se = Math.sqrt(pooled * (1 - pooled) * (1 / n + 1 / m));
	return se === 0 ? null : (a / n - b / m) / se;
}

/** Holm's step-down: which of these two-sided p-values are past chance with the
 *  family-wise error held at alpha. */
export function holm(ps: readonly number[], alpha = TREND_ALPHA): boolean[] {
	const order = ps.map((p, i) => [p, i] as const).sort((x, y) => x[0] - y[0]);
	const pass = ps.map(() => false);
	for (let k = 0; k < order.length; k++) {
		if (order[k]![0] > alpha / (order.length - k)) break;
		pass[order[k]![1]] = true;
	}
	return pass;
}

export function analyzeListening(lessons: readonly LoggedListen[], now: Date): ListenAnalysis {
	const cut = now.getTime() - TREND_DAYS * DAY_MS;
	type Rep = { at: number; day: string; session: number; half: 0 | 1 | null; words: number; typed: boolean; right: boolean; replays: number; peeked: boolean; pace: number | null; errors: WordError[] | null; sentence: string; given: string; atIso: string };
	const reps: Rep[] = [];
	let sessions = 0;
	for (const lesson of lessons) {
		if (lesson.mode !== "listen") continue;
		const at = Date.parse(lesson.at);
		if (!Number.isFinite(at)) continue;
		const session = sessions++;
		for (const [i, r] of lesson.reps.entries()) {
			const typed = r.kind === "dictation";
			// The words were heard: only the marks are off. Understood by ear, as long as the text was not shown first.
			const right = r.verdict !== "wrong" && !r.peeked;
			// Causes need the stretch word as logged; an older typed miss without it, or a copied one, is not read.
			const errors = typed && !r.peeked && r.stretch !== undefined ? (r.verdict === "exact" ? [] : readTyped(r.sentence, r.given, r.stretch)) : null;
			const syl = countSyllables(r.sentence);
			// A session of under six sentences has no first and second half worth comparing.
			const half = lesson.reps.length >= 6 ? (i < lesson.reps.length / 2 ? 0 : 1) : null;
			reps.push({ at, day: lesson.at.slice(0, 10), session, half, words: listenWords(r.sentence).length, typed, right, replays: r.replays ?? 0, peeked: !!r.peeked, pace: r.heardMs && r.heardMs >= 800 && syl >= 3 ? syl / (r.heardMs / 1000) : null, errors, sentence: r.sentence, given: r.given, atIso: lesson.at });
		}
	}
	reps.sort((a, b) => a.at - b.at);
	const typedReps = reps.filter((r) => r.typed);
	const readable = typedReps.filter((r) => r.errors !== null);
	const missed = readable.filter((r) => r.errors!.length > 0);
	const sessionsOf = (rs: readonly Rep[]) => new Set(rs.map((r) => r.session)).size;
	const readSessions = sessionsOf(readable);
	const recentTyped = readable.filter((r) => r.at >= cut);
	const earlierTyped = readable.filter((r) => r.at < cut);
	const windowsOk = [recentTyped, earlierTyped].every((w) => w.length >= CAUSE_TREND_MIN_SENTENCES && sessionsOf(w) >= CAUSE_TREND_MIN_SESSIONS);

	// Causes: words, and sentences with the cause in each window.
	const tally = new Map<ListenCause, { count: number; sentences: number; sessions: Set<number>; recent: number; earlier: number }>();
	for (const r of readable) {
		const seen = new Set<ListenCause>();
		for (const e of r.errors!) {
			const t = tally.get(e.cause) ?? { count: 0, sentences: 0, sessions: new Set<number>(), recent: 0, earlier: 0 };
			t.count++;
			if (!seen.has(e.cause)) {
				seen.add(e.cause);
				t.sentences++;
				t.sessions.add(r.session);
				if (r.at >= cut) t.recent++;
				else t.earlier++;
			}
			tally.set(e.cause, t);
		}
	}
	const listed = [...tally.entries()].filter(([, t]) => t.sentences >= CAUSE_MIN_SENTENCES && t.sessions.size >= CAUSE_MIN_SESSIONS);
	const rare = [...tally.values()].reduce((n, t) => n + t.count, 0) - listed.reduce((n, [, t]) => n + t.count, 0);
	// Every listed cause is tested at once, so the bar is held across all of them.
	const zs = listed.map(([, t]) => (windowsOk ? twoProportionZ(t.recent, recentTyped.length, t.earlier, earlierTyped.length) : null));
	const tested = zs.flatMap((z, i) => (z === null ? [] : [i]));
	const passed = holm(tested.map((i) => 2 * (1 - normalCdf(Math.abs(zs[i]!)))));
	const causes: CauseTrend[] = listed
		.map(([cause, t], i) => {
			const z = zs[i];
			const at = tested.indexOf(i);
			const trend: Trend = z === null || z === undefined ? "new" : passed[at] ? (z < 0 ? "better" : "worse") : "steady";
			return {
				cause,
				kind: LISTEN_CAUSES[cause].kind,
				count: t.count,
				recent: windowsOk ? Math.round((t.recent / recentTyped.length) * 100) : null,
				earlier: windowsOk ? Math.round((t.earlier / earlierTyped.length) * 100) : null,
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
	const weeks = [...weekMap.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(-WEEKS_KEPT)
		.map(([week, v]) => ({ week, ...v, few: v.reps < WEEK_MIN_REPS }));

	const recentAll = reps.filter((r) => r.at >= cut);
	const earlierAll = reps.filter((r) => r.at < cut);
	const slow = reps.filter((r) => r.pace !== null && r.pace < SLOW_PACE);
	const fast = reps.filter((r) => r.pace !== null && r.pace > FAST_PACE);
	const slowRight = slow.filter((r) => r.right).length;
	const fastRight = fast.filter((r) => r.right).length;
	const paceZ = twoProportionZ(slowRight, slow.length, fastRight, fast.length);
	const rightN = reps.filter((r) => r.right).length;
	const rate = (rs: readonly Rep[]) => ({ reps: rs.length, right: rs.filter((r) => r.right).length });
	const firstHalf = rate(reps.filter((r) => r.half === 0));
	const secondHalf = rate(reps.filter((r) => r.half === 1));
	const halfZ = twoProportionZ(firstHalf.right, firstHalf.reps, secondHalf.right, secondHalf.reps);
	const shortS = rate(reps.filter((r) => r.words > 0 && r.words <= SHORT_WORDS));
	const longS = rate(reps.filter((r) => r.words >= LONG_WORDS));
	const lengthZ = twoProportionZ(shortS.right, shortS.reps, longS.right, longS.reps);
	const causeWeeks = [...new Set(readable.map((r) => weekOf(r.at)))]
		.sort()
		.slice(-WEEKS_KEPT)
		.map((week) => {
			const inWeek = readable.filter((r) => weekOf(r.at) === week);
			const causes: Partial<Record<ListenCause, number>> = {};
			for (const r of inWeek) for (const c of new Set(r.errors!.map((e) => e.cause))) causes[c] = (causes[c] ?? 0) + 1;
			return { week, read: inWeek.length, causes };
		});
	return {
		sentences: reps.length,
		typed: typedReps.length,
		sessions,
		from: reps[0]?.day ?? null,
		to: reps[reps.length - 1]?.day ?? null,
		right: reps.length ? rightN / reps.length : 0,
		range: reps.length ? wilson(rightN, reps.length) : null,
		readable: readable.length,
		read: missed.length,
		readSessions,
		weeks,
		causes,
		rare,
		kinds,
		replays: { recent: mean(recentAll.map((r) => r.replays)), earlier: mean(earlierAll.map((r) => r.replays)) },
		peeked: { recent: mean(recentAll.map((r) => (r.peeked ? 1 : 0))), earlier: mean(earlierAll.map((r) => (r.peeked ? 1 : 0))) },
		pace:
			slow.length >= PACE_MIN_REPS && fast.length >= PACE_MIN_REPS
				? { slow: { reps: slow.length, right: slowRight }, fast: { reps: fast.length, right: fastRight }, slowBelow: SLOW_PACE, fastAbove: FAST_PACE, fastHarder: paceZ !== null && paceZ >= TREND_Z }
				: null,
		session: firstHalf.reps >= CUT_MIN_REPS && secondHalf.reps >= CUT_MIN_REPS ? { first: firstHalf, second: secondHalf, tiring: halfZ !== null && halfZ >= TREND_Z } : null,
		length: shortS.reps >= CUT_MIN_REPS && longS.reps >= CUT_MIN_REPS ? { short: shortS, long: longS, longHarder: lengthZ !== null && lengthZ >= TREND_Z } : null,
		causeWeeks,
		misses: missed
			.slice(-MISSES_KEPT)
			.reverse()
			.map((r) => ({ at: r.atIso, sentence: r.sentence, given: r.given, errors: r.errors! })),
		ready: readable.length >= LISTEN_MIN_TYPED && missed.length >= LISTEN_MIN_MISSED && readSessions >= LISTEN_MIN_SESSIONS,
	};
}
