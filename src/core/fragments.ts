/**
 * Fragments of a video (LangHarness, 2026-11-06) — the stretches of a long
 * video worth watching, found from its captions with no model call.
 *
 * Why: a 45-minute vlog the learner knows 70% of is noise, but two minutes
 * of it may sit at 94% — the range where listening works on its own and the
 * few new words can be picked up from context (docs/research/watch-picks.md,
 * "Fragments"). Watching only that stretch costs a tenth of the translation
 * and a tenth of the time.
 *
 * "Known" is what the learner has studied (plus grammar words, names and
 * numbers). A second share, "expected", adds the words the level is assumed
 * to know (what the Milestones page credits at this point); it is shown beside the first and never ranks.
 * Ranking by the assumed words made a beginner's 48 words read as 80–84%.
 *
 * A fragment is a run of whole caption lines. It scores well when
 *   - the share of words the learner knows is in the range where listening
 *     works (about 93–97%): below it the ear decodes, above it nothing is new;
 *   - its new words are worth learning (common ones) and come back inside the
 *     fragment, since a word met twice in two minutes sticks far better than
 *     two words met once;
 *   - there is speech all the way through (not music or silence under a title);
 *   - it is about two minutes long, and starts and ends at a pause.
 *
 * Browser-safe: the page draws the strip and measures a range the learner
 * drags with the same functions the server ranks with.
 */

import { LISTEN_FLOOR } from "./listen.ts";
import type { StoryToken } from "./reading.ts";
import { coverageBand } from "./watch.ts";

// ─── The facts of a line ────────────────────────────────────────────────────

/** What the measure needs of one caption line. */
export interface FragmentLine {
	start: number;
	end: number;
	/** Words in the line, and how many the learner has not studied. */
	words: number;
	fresh: number;
	/** How many of those are beyond what the level is expected to know (the
	 *  rest are words it assumes). Absent when it equals `fresh`. */
	beyond?: number;
	/** The new words of the line that have a dictionary entry, one slug a
	 *  time it is said (see `FragmentLex`). */
	u?: string[];
	/** The line ends a sentence (its text ends in . ! ? or …). */
	stop?: boolean;
}

/** The unknown words the lines mention, by slug. */
export type FragmentLex = Record<string, { lemma: string; gloss: string; rank?: number }>;

/** A line's facts from its glossed tokens. */
export function lineFacts(segments: readonly { start: number; end: number; sk: string; tokens: readonly StoryToken[] }[], rankOf: (slug: string) => number | undefined = () => undefined): { lines: FragmentLine[]; lex: FragmentLex } {
	const lex: FragmentLex = {};
	const lines = segments.map((s): FragmentLine => {
		const words = s.tokens.filter((t) => t.word);
		const fresh = words.filter((t) => t.fresh || t.assumed);
		const beyond = fresh.filter((t) => t.fresh).length;
		const u: string[] = [];
		for (const t of fresh) {
			if (!t.slug || !t.lemma || !t.gloss) continue;
			u.push(t.slug);
			if (!lex[t.slug]) {
				const rank = rankOf(t.slug);
				lex[t.slug] = { lemma: t.lemma, gloss: t.gloss, ...(rank !== undefined ? { rank } : {}) };
			}
		}
		return { start: s.start, end: s.end, words: words.length, fresh: fresh.length, ...(beyond !== fresh.length ? { beyond } : {}), ...(u.length ? { u } : {}), ...(/[.!?…]["')»]*\s*$/.test(s.sk.trim()) ? { stop: true } : {}) };
	});
	return { lines, lex };
}

// ─── Measuring a run of lines ───────────────────────────────────────────────

export interface NewWord {
	slug: string;
	lemma: string;
	gloss: string;
	/** Times it is said in the fragment. */
	count: number;
}

export interface FragmentStats {
	/** The first and last line (indexes into the lines), and their times. */
	from: number;
	to: number;
	start: number;
	end: number;
	sec: number;
	words: number;
	/** Words not studied, counting every time one is said. */
	fresh: number;
	/** Share of the words the learner knows (1 when there are none). */
	coverage: number;
	/** Share a learner at the level is expected to know: `coverage` plus the
	 *  words the level assumes. Shown, never ranked on. */
	expected: number;
	/** Words a minute of the fragment, pauses included. */
	wpm: number;
	/** The new words worth learning, the most worth first. */
	newWords: NewWord[];
	/** New words that come back inside the fragment. */
	recurring: number;
	/** What learning the new words is worth (see `wordValue`). */
	value: number;
}

/** A fragment is at least this long, and at most this. */
export const FRAGMENT_MIN_SEC = 45;
export const FRAGMENT_MAX_SEC = 180;
/** What a learner picking a stretch by hand may take: more than the best
 *  stretches run, less than a sitting. */
export const FRAGMENT_PICK_MAX_SEC = 480;
export const FRAGMENT_PICK_MIN_SEC = 20;
/** The longest video whose fragments are looked for: its captions are one
 *  download, and the page draws a line per caption line. */
export const FRAGMENT_SOURCE_MAX_SEC = 3 * 3600;
const IDEAL_SEC = 110;
/** The pause (seconds) that makes a good place to start or stop. */
const PAUSE_SEC = 0.7;
const MAX_VALUE_WORDS = 14;

/** What meeting a word is worth: the commoner it is the more it will come up
 *  again after the video. A word with no known rank is middling. */
export function wordWeight(rank: number | undefined): number {
	if (rank === undefined) return 0.35;
	if (rank <= 1500) return 1;
	if (rank <= 4000) return 0.75;
	if (rank <= 8000) return 0.5;
	return 0.3;
}

/** What a new word is worth by how often it is said in the fragment: the
 *  second meeting counts for most, then it tails off. */
export function recurrenceFactor(count: number): number {
	return 1 + 0.35 * (Math.min(count, 4) - 1);
}

function statsOf(lines: readonly FragmentLine[], lex: FragmentLex, from: number, to: number, counts: ReadonlyMap<string, number>, words: number, fresh: number, beyond: number): FragmentStats {
	const start = lines[from]!.start;
	const end = lines[to]!.end;
	const sec = Math.max(1, end - start);
	const ranked = [...counts]
		.map(([slug, count]) => ({ slug, lemma: lex[slug]?.lemma ?? slug, gloss: lex[slug]?.gloss ?? "", count, w: wordWeight(lex[slug]?.rank) * recurrenceFactor(count) }))
		.sort((a, b) => b.w - a.w || b.count - a.count || a.slug.localeCompare(b.slug));
	let value = 0;
	ranked.slice(0, MAX_VALUE_WORDS).forEach((w, i) => {
		value += w.w * 0.92 ** i;
	});
	return {
		from,
		to,
		start,
		end,
		sec,
		words,
		fresh,
		coverage: words === 0 ? 1 : (words - fresh) / words,
		expected: words === 0 ? 1 : (words - beyond) / words,
		wpm: Math.round((words / sec) * 60),
		newWords: ranked.map(({ w: _w, ...rest }): NewWord => rest),
		recurring: ranked.filter((w) => w.count >= 2).length,
		value: Math.round(value * 100) / 100,
	};
}

/** The facts of lines `from`..`to` (inclusive). */
export function rangeStats(lines: readonly FragmentLine[], lex: FragmentLex, from: number, to: number): FragmentStats | null {
	if (!lines.length || from < 0 || to < from || to >= lines.length) return null;
	const counts = new Map<string, number>();
	let words = 0;
	let fresh = 0;
	let beyond = 0;
	for (let i = from; i <= to; i++) {
		const l = lines[i]!;
		words += l.words;
		fresh += l.fresh;
		beyond += l.beyond ?? l.fresh;
		for (const s of l.u ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
	}
	return statsOf(lines, lex, from, to, counts, words, fresh, beyond);
}

// ─── Scoring ────────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** How well the known-word share suits listening: 1 across 93–97%, a ramp
 *  down to noise at 85%, and down to a fifth at 100% (nothing new). Under
 *  85% a sliver is kept, rising with the share, so that when nothing is in
 *  reach the stretches still sort by how near they are. */
export function comprehension(coverage: number): number {
	const near = 0.05 * clamp01(coverage / 0.85);
	if (coverage < 0.85) return near;
	if (coverage < 0.9) return Math.max(near, 0.6 * clamp01((coverage - 0.85) / 0.05));
	if (coverage < LISTEN_FLOOR) return 0.6 + 0.4 * clamp01((coverage - 0.9) / (LISTEN_FLOOR - 0.9));
	if (coverage <= 0.97) return 1;
	if (coverage <= 0.99) return 1 - 0.5 * clamp01((coverage - 0.97) / 0.02);
	return 0.2;
}

/** A stretch within reach of the ear (88% known and over); under it the
 *  picks are only the nearest there is. */
export const IN_REACH = 0.88;

/** Speech all the way through: under 40 words a minute is music or a title
 *  card; fast speech is a little harder to follow. */
export function density(wpm: number): number {
	if (wpm < 40) return 0;
	if (wpm < 90) return (wpm - 40) / 50;
	if (wpm <= 200) return 1;
	return 0.8;
}

/** About two minutes is best; the factor never drops under 0.7. */
export function lengthFactor(sec: number): number {
	return Math.max(0.7, 1 - (0.3 * Math.abs(sec - IDEAL_SEC)) / 70);
}

/** The worth of a stretch for learning: 0 when it has no speech, a sliver
 *  when it is too hard. Even with no new word it keeps a little (listening
 *  practice at a comfortable share), so a fragment of all-known words ranks
 *  last, not out. */
export function fragmentScore(s: FragmentStats): number {
	return Math.round(comprehension(s.coverage) * density(s.wpm) * lengthFactor(s.sec) * Math.sqrt(0.4 + s.value) * 1000) / 1000;
}

export interface Fragment extends FragmentStats {
	score: number;
	/** coverageBand's title for the share ("Comfortable", "A stretch"). */
	band: string;
}

export interface FragmentOptions {
	/** How many to give back (default 5). */
	max?: number;
	minSec?: number;
	maxSec?: number;
}

/** The best non-overlapping fragments of a video, best first. */
export function bestFragments(lines: readonly FragmentLine[], lex: FragmentLex, opts: FragmentOptions = {}): Fragment[] {
	const minSec = opts.minSec ?? FRAGMENT_MIN_SEC;
	const maxSec = opts.maxSec ?? FRAGMENT_MAX_SEC;
	const n = lines.length;
	if (!n) return [];
	const pauseBefore = (i: number) => i === 0 || lines[i]!.start - lines[i - 1]!.end >= PAUSE_SEC || lines[i - 1]!.stop === true;
	const pauseAfter = (i: number) => i === n - 1 || lines[i + 1]!.start - lines[i]!.end >= PAUSE_SEC || lines[i]!.stop === true;
	// Captions that never pause (automatic ones run on) give too few places to cut: then any line will do.
	const starts = lines.map((_, i) => pauseBefore(i));
	const ends = lines.map((_, i) => pauseAfter(i));
	const loose = starts.filter(Boolean).length < n / 12 || ends.filter(Boolean).length < n / 12;
	const found: Fragment[] = [];
	for (let i = 0; i < n; i++) {
		if (!loose && !starts[i]) continue;
		const counts = new Map<string, number>();
		let words = 0;
		let fresh = 0;
		let beyond = 0;
		for (let j = i; j < n; j++) {
			const l = lines[j]!;
			if (l.end - lines[i]!.start > maxSec) break;
			words += l.words;
			fresh += l.fresh;
			beyond += l.beyond ?? l.fresh;
			for (const s of l.u ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
			if (l.end - lines[i]!.start < minSec || (!loose && !ends[j])) continue;
			const stats = statsOf(lines, lex, i, j, counts, words, fresh, beyond);
			const score = fragmentScore(stats);
			if (score > 0) found.push({ ...stats, score, band: coverageBand(stats.coverage).title });
		}
	}
	found.sort((a, b) => b.score - a.score || a.start - b.start);
	const out: Fragment[] = [];
	for (const f of found) {
		if (out.length >= (opts.max ?? 5)) break;
		if (out.some((o) => f.from <= o.to && o.from <= f.to)) continue;
		out.push(f);
	}
	return out;
}

// ─── The strip ──────────────────────────────────────────────────────────────

/** The known-word share along the video, in `buckets` equal slices: null
 *  where nobody speaks. The page draws it as the strip a stretch is picked on. */
export function heatStrip(lines: readonly FragmentLine[], totalSec: number, buckets: number): Array<number | null> {
	const words = new Array<number>(buckets).fill(0);
	const fresh = new Array<number>(buckets).fill(0);
	if (totalSec <= 0) return words.map(() => null);
	for (const l of lines) {
		const b = Math.min(buckets - 1, Math.max(0, Math.floor((((l.start + l.end) / 2) / totalSec) * buckets)));
		words[b]! += l.words;
		fresh[b]! += l.fresh;
	}
	return words.map((w, i) => (w < 3 ? null : (w - fresh[i]!) / w));
}

/** The lines a time range covers: the first line that starts at or after
 *  `startSec` through the last that ends at or before `endSec`. Null when none. */
export function linesIn(lines: readonly FragmentLine[], startSec: number, endSec: number): { from: number; to: number } | null {
	let from = -1;
	let to = -1;
	lines.forEach((l, i) => {
		if (l.start >= startSec - 0.25 && l.end <= endSec + 0.25) {
			if (from < 0) from = i;
			to = i;
		}
	});
	return from < 0 ? null : { from, to };
}

/** The lines a time range touches: from the line still being said at
 *  `startSec` to the one being said at `endSec`. Null when none. */
export function linesTouching(lines: readonly FragmentLine[], startSec: number, endSec: number): { from: number; to: number } | null {
	let from = -1;
	let to = -1;
	lines.forEach((l, i) => {
		if (l.end > startSec && l.start < endSec) {
			if (from < 0) from = i;
			to = i;
		}
	});
	return from < 0 ? null : { from, to };
}

// ─── What the page gets ─────────────────────────────────────────────────────

/** GET /api/watch/fragments: a video's lines and its best stretches. */
export interface FragmentAnalysis {
	id: string;
	title: string;
	channel?: string;
	durationSec: number;
	trackLang: string;
	/** Whether the known-word share can be measured: the captions are in the
	 *  language (not Czech for Slovak, whose spellings would read as unknown). */
	measurable: boolean;
	message?: string;
	lines: FragmentLine[];
	lex: FragmentLex;
	picks: Fragment[];
	/** The known-word share of the whole video, and the share a learner at
	 *  the level is expected to know. */
	coverage: number;
	expected: number;
	/** The learner's level the share was measured at, and how many words the
	 *  Milestones page credits at this point (the "expected" share counts them). */
	level: string;
	expectedWords: number;
	/** What the library holds of this video: the whole of it, or a stretch. */
	prepared?: { whole: true } | { startSec: number; endSec: number };
}

// ─── What a prepared fragment records ───────────────────────────────────────

/** Where in its video a prepared fragment sits (VideoRecord.fragment). */
export interface FragmentRange {
	startSec: number;
	endSec: number;
}
