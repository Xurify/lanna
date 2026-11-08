/**
 * Milestones (LangHarness, 2026-10-28) — when will I understand most of a
 * Slovak YouTube video? Pure and browser-safe.
 *
 * Xurify's question (2026-10-28): "I want to know when I will be able to
 * understand most of what I hear when I watch a Slovak YouTube video.
 * Right now I get a lot of words, but I can't put them together into
 * meaning fast enough." That is two gaps, measured separately:
 *
 *   1. WORDS — lexical coverage. Comprehension rises in a straight line
 *      with the share of running words known (Schmitt, Jiang & Grabe
 *      2011). About 95% is enough for most listeners to follow (van
 *      Zeeland & Schmitt 2013), 98% for unassisted reading (Hu & Nation
 *      2000; Laufer & Ravenhorst-Kalovski 2010). How many words buy that
 *      coverage depends on the material: everyday talk needs the fewest,
 *      TV and film a little more, newspapers and novels the most (Nation
 *      2006; Webb & Rodgers 2009a, 2009b; Adolphs & Schmitt 2003). GENRES
 *      carries those published points; coverageAt() interpolates the
 *      Zipf-shaped tail between them.
 *   2. SPEED — parsing automaticity (Segalowitz 2010). Knowing a word is
 *      not the same as retrieving it inside the 400 ms the speaker gives
 *      you; speech does not wait. The Listen task measures how long the
 *      learner needs to get a sentence's meaning against how long the
 *      sentence took to say; the Watch task measures what is understood on
 *      the first pass. Both come out in words a minute of understanding,
 *      compared with the speaker's rate for the milestone, discounted for
 *      the support the situation gives (pictures, subtitles, the right to
 *      say "ešte raz?").
 *
 * The ETA is the later of the two. Words grow at the learner's measured
 * rate of new words a day; speed follows the guided-hours ladder
 * (src/core/curriculum.ts GUIDED_HOURS) anchored to the CEFR listening
 * descriptors ("B2: can understand the majority of films in standard
 * dialect"), until the learner's own Listen trend has enough points to
 * replace it. Every figure is an estimate and the page says what it rests
 * on.
 */

import { CEFR_ORDER, GUIDED_HOURS, MIN_PACE_DAYS, type Cefr } from "./curriculum.ts";
import type { DatedSceneView } from "./dated-scene.ts";
import type { OutsideSummary } from "./outside.ts";

// ─── Genres: the published coverage points ──────────────────────────────────

export type GenreId = "conversation" | "tv" | "film" | "news" | "fiction" | "formal" | "children" | "songs";

interface Genre {
	id: GenreId;
	title: string;
	/** English word families (plus proper nouns) for 95% and 98% of running words. */
	n95: number;
	n98: number;
	source: string;
}

export const GENRES: Record<GenreId, Genre> = {
	conversation: { id: "conversation", title: "everyday conversation", n95: 2500, n98: 6500, source: "Adolphs & Schmitt 2003 (CANCODE: 2,000 families ≈ 95%); Nation 2006 (spoken: 6,000–7,000 for 98%). The 2,500 for 95% is the app's own figure between that and Nation's roughly 3,000" },
	tv: { id: "tv", title: "TV and vlogs", n95: 3000, n98: 7000, source: "Webb & Rodgers 2009a, 88 TV programs: 3,000 families + proper nouns = 95.5%, 7,000 = 98.3%" },
	film: { id: "film", title: "films", n95: 3000, n98: 6000, source: "Webb & Rodgers 2009b, 318 films: 3,000 families + proper nouns = 95.8%, 6,000 = 98.2%" },
	news: { id: "news", title: "newspapers", n95: 4000, n98: 8000, source: "Nation 2006: newspapers need about 4,000 families for 95% and 8,000 for 98%" },
	fiction: { id: "fiction", title: "novels", n95: 4000, n98: 9000, source: "Nation 2006: novels need about 4,000 families for 95% and 8,000–9,000 for 98%" },
	formal: { id: "formal", title: "formal and official text", n95: 4500, n98: 9000, source: "Nation 2006 (academic and formal text sits above newspapers); Laufer & Ravenhorst-Kalovski 2010 (8,000 for 98%)" },
	children: { id: "children", title: "children's shows", n95: 2000, n98: 5000, source: "No study behind this row: the app's own estimate, lower than adult TV" },
	songs: { id: "songs", title: "songs", n95: 3000, n98: 6500, source: "Tegge 2017 (popular songs: about 3,000 families for 95%); 98% estimated between film and TV" },
};

/**
 * The published counts are English WORD FAMILIES (nation, national,
 * nationally…). A Slovak lemma is finer: národ, národný and národne are
 * three lemmas, and every aspect pair is two verbs. Frequency
 * dictionaries of Slavic languages show the top 5,000 lemmas covering
 * about five points less of running text than the top 5,000 English
 * lemmas do. So the lemma counts here are the family counts raised by a
 * quarter — an assumption, shown on the page as one.
 */
export const INFLECTION_FACTOR = 1.25;

/** Lemmas (Slovak) needed for 95% / 98% in a genre. */
export function genreLemmas(genre: Genre): { n95: number; n98: number } {
	return { n95: Math.round(genre.n95 * INFLECTION_FACTOR), n98: Math.round(genre.n98 * INFLECTION_FACTOR) };
}

/** The coverage curve through the genre's two points: a Zipf tail,
 *  1 − a·V^−b. Below the smallest sensible vocabulary it flattens so a
 *  beginner reads 40%, not a negative number. */
function tail(genre: Genre): { a: number; b: number } {
	const { n95, n98 } = genreLemmas(genre);
	const b = Math.log(0.05 / 0.02) / Math.log(n98 / n95);
	const a = 0.05 * Math.pow(n95, b);
	return { a, b };
}

/** Share of running words known, given `lemmas` known in frequency order. */
export function coverageAt(genre: Genre, lemmas: number): number {
	if (lemmas <= 0) return 0;
	const { a, b } = tail(genre);
	const c = 1 - a * Math.pow(lemmas, -b);
	// Function words and names carry the first 40% or so (the top 100
	// lemmas alone are near that in any corpus), so the floor is not 0.
	return Math.max(0.4, Math.min(0.995, c));
}

/** Lemmas needed for `coverage` in a genre. */
export function lemmasFor(genre: Genre, coverage: number): number {
	const { a, b } = tail(genre);
	const c = Math.min(0.99, Math.max(0.5, coverage));
	return Math.round(Math.pow(a / (1 - c), 1 / b));
}

// ─── Vocabulary size by level ───────────────────────────────────────────────

/** Receptive vocabulary by CEFR level, in Slovak lemmas: Milton's X_Lex
 *  bands (Milton 2009: A1 under 1,500, A2 1,500–2,500, B1 2,750–3,250,
 *  B2 3,250–3,750, C1 3,750–4,500 lemmatised words, for English and
 *  French learners), raised by INFLECTION_FACTOR like the genre counts. */
export const LEVEL_VOCAB: Record<Cefr, number> = { A1: 1200, A2: 2400, B1: 3600, B2: 4400, C1: 5300 };

/** The words a learner WORKING at `level`, `progress` of the way through
 *  it, is credited: the band of the level completed plus that share of
 *  the way to the current level's band. (The calculator used to credit
 *  the whole band of the level being entered: 2,400 words for passing
 *  the A1 grammar tiers.) */
export function levelVocabulary(level: Cefr, progress: number): number {
	const i = CEFR_ORDER.indexOf(level);
	const below = i <= 0 ? 0 : LEVEL_VOCAB[CEFR_ORDER[i - 1]!];
	const p = Math.max(0, Math.min(1, progress));
	return Math.round(below + p * (LEVEL_VOCAB[level] - below));
}

/** The lemmas credited beyond the ones met: the word check's estimate when
 *  there was one, else the band of the level completed plus the progress
 *  through the current one. Watch's "expected" and the Milestones page both
 *  read this, so they never disagree. */
export function creditedWords(measured: { size: number } | undefined, level: Cefr, progress: number): number {
	return measured ? measured.size : levelVocabulary(level, progress);
}

// ─── Speed ──────────────────────────────────────────────────────────────────

export type Support = "none" | "visual" | "subtitles" | "interactive";

/** How much slower than the speaker a listener may be and still follow:
 *  pictures and action carry part of the meaning (CEFR B1: "films in
 *  which visuals and action carry much of the storyline"), subtitles let
 *  the eye catch what the ear missed, and in a conversation you can ask
 *  again. The factor scales the words a minute the milestone demands. */
const SUPPORT_FACTOR: Record<Support, number> = { none: 1, visual: 0.9, subtitles: 0.75, interactive: 0.7 };

export const SUPPORT_LINE: Record<Support, string> = {
	none: "no help from pictures or text",
	visual: "pictures and action carry part of the meaning",
	subtitles: "subtitles catch what the ear misses",
	interactive: "you can ask for it again, slower",
};

/** Words a minute of understanding that each level's listener manages,
 *  anchored to the CEFR descriptors: B1 follows clear speech "directed at
 *  me", B2 "the majority of films in standard dialect", C1 extended
 *  speech at natural pace. Natural Slovak speech runs about 150 words a
 *  minute (its words are longer than English ones, so fewer of them). */
export const SPEED_LADDER: Array<{ level: Cefr; wpm: number }> = [
	{ level: "A1", wpm: 35 },
	{ level: "A2", wpm: 60 },
	{ level: "B1", wpm: 95 },
	{ level: "B2", wpm: 135 },
	{ level: "C1", wpm: 160 },
];

/** Natural speech, words a minute, for a milestone that names no rate. The app's own round figure: English speech rates vary widely by genre (Tauroza & Allison 1990), and Slovak words are longer than English ones, so real Slovak speech may run lower. */
const NATURAL_WPM = 150;
/** When a Listen rep carries no audio length: 400 ms a word. */
const MS_PER_WORD = 60_000 / NATURAL_WPM;

/** Guided hours at which a listener reaches `wpm`, by the ladder; linear
 *  between rungs, 0 below the first. */
export function hoursForSpeed(wpm: number): number {
	const rungs = SPEED_LADDER.map((r) => ({ wpm: r.wpm, hours: GUIDED_HOURS[r.level] }));
	if (wpm <= rungs[0]!.wpm) return (wpm / rungs[0]!.wpm) * rungs[0]!.hours;
	for (let i = 1; i < rungs.length; i++) {
		const lo = rungs[i - 1]!;
		const hi = rungs[i]!;
		if (wpm <= hi.wpm) return lo.hours + ((wpm - lo.wpm) / (hi.wpm - lo.wpm)) * (hi.hours - lo.hours);
	}
	const last = rungs[rungs.length - 1]!;
	const prev = rungs[rungs.length - 2]!;
	return last.hours + ((wpm - last.wpm) / (last.wpm - prev.wpm)) * (last.hours - prev.hours);
}

/** The ladder read the other way: the speed a listener with `hours` has. */
export function speedForHours(hours: number): number {
	const rungs = SPEED_LADDER.map((r) => ({ wpm: r.wpm, hours: GUIDED_HOURS[r.level] }));
	if (hours <= 0) return 0;
	if (hours <= rungs[0]!.hours) return (hours / rungs[0]!.hours) * rungs[0]!.wpm;
	for (let i = 1; i < rungs.length; i++) {
		const lo = rungs[i - 1]!;
		const hi = rungs[i]!;
		if (hours <= hi.hours) return lo.wpm + ((hours - lo.hours) / (hi.hours - lo.hours)) * (hi.wpm - lo.wpm);
	}
	return rungs[rungs.length - 1]!.wpm;
}
/** One Listen rep as the speed model reads it. */
export interface SpeedSample {
	/** Words in the sentence. */
	words: number;
	/** Sentence shown (audio starts) → meaning picked. */
	ms: number;
	/** How long the audio took to play, when known. */
	heardMs?: number;
	replays?: number;
	correct: boolean;
	/** The learner read the text: the eye did the work, not the ear. */
	peeked?: boolean;
	at: string;
}

export interface SpeedReading {
	/** Words a minute of understanding (words / time to the right meaning). */
	wpm: number;
	/** Reps that counted. */
	samples: number;
	words: number;
	/** Share of counted reps understood within the time the audio took. */
	realtime: number;
	/** The audio's own rate, when the reps knew it. */
	audioWpm: number | null;
}

/** A sample is usable when it was heard, not read, answered right, and
 *  its timing is plausible (a tab left open overnight is not a thought). */
function usableSample(s: SpeedSample): boolean {
	return s.correct && !s.peeked && s.words >= 3 && s.ms >= 300 && s.ms <= 90_000;
}

/** Words a minute of understanding over a set of Listen reps: the words
 *  heard divided by the time to the right meaning, with the audio time
 *  inside it. A learner who picks the meaning as the sentence ends is at
 *  the speaker's pace; one who needs the sentence's length again is at
 *  half of it. Wrong and peeked reps do not count (they are not
 *  understanding), so the figure is "how fast when you get it". */
export function speedFromSamples(samples: readonly SpeedSample[]): SpeedReading | null {
	const used = samples.filter(usableSample);
	if (used.length === 0) return null;
	let words = 0;
	let ms = 0;
	let heard = 0;
	let heardWords = 0;
	let realtime = 0;
	for (const s of used) {
		const plausibleHeard = s.heardMs !== undefined && s.heardMs >= s.words * 150 && s.heardMs <= s.words * 1500;
		const audio = plausibleHeard ? s.heardMs! : s.words * MS_PER_WORD;
		words += s.words;
		// Time to understanding never counts as less than the audio itself.
		ms += Math.max(s.ms, audio);
		if (s.ms <= audio * 1.15) realtime++;
		if (plausibleHeard) {
			heard += s.heardMs!;
			heardWords += s.words;
		}
	}
	return {
		wpm: Math.round((words / ms) * 60_000),
		samples: used.length,
		words,
		realtime: used.length ? realtime / used.length : 0,
		audioWpm: heard > 0 ? Math.round((heardWords / heard) * 60_000) : null,
	};
}

/** A point on the learner's own speed trend: a session's reading at the
 *  study hours they had by then. */
export interface TrendPoint {
	hours: number;
	wpm: number;
	at: string;
}

const TREND_MIN_POINTS = 8;
const TREND_MIN_DAYS = 7;

/** Least-squares slope of words a minute per study hour, when there are
 *  enough sessions spread over enough days; null otherwise. The
 *  guided-hours ladder is the prior; this is the learner's own evidence. */
export function speedTrend(points: readonly TrendPoint[]): { slope: number; intercept: number; points: number } | null {
	if (points.length < TREND_MIN_POINTS) return null;
	const days = new Set(points.map((p) => p.at.slice(0, 10)));
	if (days.size < TREND_MIN_DAYS) return null;
	const n = points.length;
	const mx = points.reduce((s, p) => s + p.hours, 0) / n;
	const my = points.reduce((s, p) => s + p.wpm, 0) / n;
	let sxx = 0;
	let sxy = 0;
	for (const p of points) {
		sxx += (p.hours - mx) ** 2;
		sxy += (p.hours - mx) * (p.wpm - my);
	}
	if (sxx === 0) return null;
	const slope = sxy / sxx;
	return { slope, intercept: my - slope * mx, points: n };
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export interface MilestoneDef {
	id: string;
	title: string;
	/** What "most of it" means here, in one line. */
	line: string;
	/** lucide icon name (components/milestones). */
	icon: string;
	genre: GenreId;
	/** Share of running words that must be known: 0.95 to follow, 0.98 to
	 *  be comfortable without help, 0.9 where you can ask again. */
	coverage: number;
	/** The speaker's words a minute; 0 when the learner sets the pace (reading). */
	wpm: number;
	support: Support;
	/** Can-do goals on the map (src/core/curriculum.ts) that prove the situation. */
	goals?: string[];
	/** The learner's own words, for a custom milestone. */
	custom?: string;
	/** The CEFR descriptor the milestone matches, for the evidence panel. */
	cefr?: string;
}

export const MILESTONES: MilestoneDef[] = [
	{
		id: "vlog",
		title: "Follow a casual YouTube vlog",
		line: "Someone talking to a camera about their day: most of what they say, without subtitles.",
		icon: "monitor-play",
		genre: "tv",
		coverage: 0.95,
		wpm: NATURAL_WPM,
		support: "visual",
		goals: ["can-follow-media"],
		cefr: "B2 listening: can understand most TV programs on familiar topics",
	},
	{
		id: "news",
		title: "Read the news",
		line: "An article on aktuality.sk or SME, at your own pace, looking up a word now and then.",
		icon: "newspaper",
		genre: "news",
		coverage: 0.95,
		wpm: 0,
		support: "none",
		goals: ["can-read-news"],
		cefr: "B2 reading: can read articles and reports on contemporary problems",
	},
	{
		id: "cafe",
		title: "A café or shop exchange",
		line: "Order, pay, ask for something, understand the question that comes back.",
		icon: "coffee",
		genre: "conversation",
		coverage: 0.9,
		wpm: 100,
		support: "interactive",
		goals: ["can-order", "can-shop"],
		cefr: "A2 interaction: can handle simple transactions in shops and cafés",
	},
	{
		id: "family",
		title: "A conversation with the in-laws",
		line: "Dinner-table talk about family, work and plans, asking for a repeat now and then.",
		icon: "users",
		genre: "conversation",
		coverage: 0.95,
		wpm: NATURAL_WPM,
		support: "interactive",
		goals: ["can-family", "can-describe-day", "can-narrate"],
		cefr: "B1–B2 listening: can follow clearly articulated speech directed at me in everyday conversation",
	},
	{
		id: "film-subs",
		title: "A film with subtitles in the language",
		line: "Follow the story with the text under it, not translating in your head.",
		icon: "captions",
		genre: "film",
		coverage: 0.95,
		wpm: NATURAL_WPM,
		support: "subtitles",
		cefr: "B1–B2: can follow films in which the pictures and the action carry part of the storyline",
	},
	{
		id: "film",
		title: "A film without subtitles",
		line: "Standard dialect, normal pace, no text: comfortable, not just following the plot.",
		icon: "clapperboard",
		genre: "film",
		coverage: 0.98,
		wpm: 160,
		support: "visual",
		cefr: "B2–C1 listening: can understand the majority of films in standard dialect",
	},
];
// ─── What the app knows about the learner ───────────────────────────────────

export interface LearnerFacts {
	/** The level the map has the learner working at (placement set its
	 *  start; every lesson since moved it), and how far through it. */
	level: Cefr;
	levelProgress: number;
	/** A placement check was done at some point. */
	placed: boolean;
	/** Where the credited words come from: the word check (measured) or
	 *  the level completed (level). */
	words: { basis: "measured" | "level"; credited: number; measuredAt?: string; reliable?: boolean };
	/** Words the learner has met in the deck or in word lessons. */
	met: number;
	/** Of those, stable for a week or more in the deck. */
	solid: number;
	/** Words the level implies (LEVEL_VOCAB) beyond the ones met. */
	assumed: number;
	/** The working vocabulary: met, or the level's figure when that is larger. */
	vocabulary: number;
	/** New words a day the plan introduces when followed. */
	wordsPerDayPlanned: number;
	/** New words a day over the last 14 days; null without 14 days of history. */
	wordsPerDayReal: number | null;
	minutesPerDay: number;
	daysPerWeek: number;
	/** Minutes a day actually studied over the last 14 days. */
	paceMinutes: number;
	/** Days of those 14 with any study; a real-pace date needs MIN_PACE_DAYS. */
	paceDays: number;
	/** Guided hours the map credits. */
	hoursDone: number;
	/** Hours actually logged (every day's minutes). */
	hoursLogged: number;
	listen: {
		sessions: number;
		reading: SpeedReading | null;
		trend: { slope: number; points: number } | null;
		/** The sentences built only from words the app counts as known, and how many were understood. */
		knownSentences: { total: number; right: number };
	};
	watch: { videos: number; segments: number; gotFirst: number; reading: SpeedReading | null } | null;
	/** Listening logged by hand outside the app (src/core/outside.ts); kept out of every measured figure above. */
	outside?: OutsideSummary;
	/** Words a minute the learner is credited with, and where it comes from. */
	speed: { wpm: number; basis: "listen" | "watch" | "both" | "level" };
}

/** The speed the facts support: the measured readings when there are
 *  enough, else the ladder at the learner's hours (an assumption, said so). */
export function creditedSpeed(facts: Omit<LearnerFacts, "speed">): LearnerFacts["speed"] {
	const l = facts.listen.reading;
	const w = facts.watch?.reading ?? null;
	const lOk = l && l.samples >= 6;
	const wOk = w && w.samples >= 6;
	if (lOk && wOk) return { wpm: Math.round((l.wpm * l.words + w.wpm * w.words) / (l.words + w.words)), basis: "both" };
	if (lOk) return { wpm: l.wpm, basis: "listen" };
	if (wOk) return { wpm: w.wpm, basis: "watch" };
	// A listener at the level's rung at least: a placed B1 reader has not
	// "1 word a minute" because the map has credited few hours yet.
	const rung = SPEED_LADDER.find((r) => r.level === facts.level)?.wpm ?? 0;
	return { wpm: Math.round(Math.max(speedForHours(facts.hoursDone), rung)), basis: "level" };
}

// ─── The estimate ───────────────────────────────────────────────────────────

export type MilestoneStatus = "reached" | "close" | "on-the-way" | "far";
export type Binding = "words" | "speed" | "none";

export interface Eta {
	/** ISO date at the planned minutes, or null when nothing is planned. */
	planned: string | null;
	/** ISO date at the real 14-day pace, or null without two weeks of evidence. */
	pace: string | null;
	/** Days to go at the planned pace (0 when reached). */
	daysPlanned: number | null;
	daysPace: number | null;
}

export interface MilestoneEstimate {
	def: MilestoneDef;
	status: MilestoneStatus;
	/** Which gap decides the date. */
	binding: Binding;
	words: {
		have: number;
		need: number;
		toGo: number;
		coverageNow: number;
		coverageTarget: number;
		eta: Eta;
	};
	speed: {
		have: number;
		need: number;
		basis: LearnerFacts["speed"]["basis"];
		hoursToGo: number;
		/** "ladder": the guided-hours ladder; "trend": the learner's own Listen slope. */
		hoursBasis: "ladder" | "trend";
		eta: Eta;
		/** The real-pace date with outside listening added at its weight; null with none logged.
		 *  On the learner's own trend it adds nothing: the slope is per hour in the app, so
		 *  whatever the outside listening did is in it already. */
		outside?: { basis: "added"; measuredPerDay: number; creditedPerDay: number; days: number; date: string } | { basis: "in-trend" } | null;
	};
	eta: Eta;
	/** The one line under the title. */
	verdict: string;
	/** What is missing, as the page lists it. */
	missing: string[];
}

interface EstimateOptions {
	now: Date;
}

/** One dictionary word the learner is not yet credited with. */
export interface NextWord {
	slug: string;
	lemma: string;
	gloss: string;
	cat: string;
	/** Position in the unified frequency order (1 = commonest). */
	rank: number;
}

/** What /milestones and /plan render (built by src/server/milestones.ts). */
export interface MilestonesReport {
	facts: LearnerFacts;
	milestones: MilestoneEstimate[];
	/** The commonest dictionary words the learner is not credited with. */
	nextWords: NextWord[];
	/** The map's can-do goals, by id: title and whether they are done. */
	goals: Record<string, { title: string; done: boolean; open: boolean }>;
	guidedHours: Record<Cefr, number>;
	generatedAt: string;
	/** The learner's day key as the server counts it: the day a scene's date is measured from. */
	today: string;
	/** Each dated scene's standing, by milestone id (src/core/dated-scene.ts). */
	scenes: Record<string, DatedSceneView>;
}

function addDaysIso(from: Date, days: number): string {
	return new Date(from.getTime() + Math.round(days) * 86_400_000).toISOString().slice(0, 10);
}

function etaFrom(now: Date, daysPlanned: number | null, daysPace: number | null): Eta {
	return {
		planned: daysPlanned === null ? null : addDaysIso(now, daysPlanned),
		pace: daysPace === null ? null : addDaysIso(now, daysPace),
		daysPlanned,
		daysPace,
	};
}

/** The later of two dates (null when either is unknown). */
function later(a: Eta, b: Eta): Eta {
	const pick = (x: number | null, y: number | null) => (x === null || y === null ? null : Math.max(x, y));
	const daysPlanned = pick(a.daysPlanned, b.daysPlanned);
	const daysPace = pick(a.daysPace, b.daysPace);
	return {
		daysPlanned,
		daysPace,
		planned: daysPlanned === null ? null : (a.daysPlanned ?? 0) >= (b.daysPlanned ?? 0) ? a.planned : b.planned,
		pace: daysPace === null ? null : (a.daysPace ?? 0) >= (b.daysPace ?? 0) ? a.pace : b.pace,
	};
}

/** Speed the milestone demands: the speaker's rate, discounted for support. */
export function speedNeeded(def: MilestoneDef): number {
	return def.wpm > 0 ? Math.round(def.wpm * SUPPORT_FACTOR[def.support]) : 0;
}

export function estimateMilestone(def: MilestoneDef, facts: LearnerFacts, opts: EstimateOptions): MilestoneEstimate {
	const genre = GENRES[def.genre];
	const need = lemmasFor(genre, def.coverage);
	const have = facts.vocabulary;
	const toGo = Math.max(0, need - have);
	const coverageNow = coverageAt(genre, have);
	// Words: at the plan's new words a day (study days only) and at the
	// real rate of the last two weeks.
	const plannedPerDay = (facts.wordsPerDayPlanned * facts.daysPerWeek) / 7;
	const wordsEta = etaFrom(
		opts.now,
		toGo === 0 ? 0 : plannedPerDay > 0 ? toGo / plannedPerDay : null,
		toGo === 0 ? 0 : facts.wordsPerDayReal !== null && facts.wordsPerDayReal > 0 ? toGo / facts.wordsPerDayReal : null,
	);

	// Speed: hours to the needed words a minute, by the ladder or by the
	// learner's own trend when it has enough points (clamped to half and
	// twice the ladder, because eight sessions can say anything).
	const speedNeed = speedNeeded(def);
	const speedHave = facts.speed.wpm;
	let hoursToGo = speedNeed > 0 ? Math.max(0, hoursForSpeed(speedNeed) - hoursForSpeed(speedHave)) : 0;
	let hoursBasis: MilestoneEstimate["speed"]["hoursBasis"] = "ladder";
	const trend = facts.listen.trend;
	if (speedNeed > 0 && speedHave < speedNeed && trend && trend.slope > 0 && facts.speed.basis !== "level") {
		const own = (speedNeed - speedHave) / trend.slope;
		hoursToGo = Math.min(hoursToGo * 2, Math.max(hoursToGo * 0.5, own));
		hoursBasis = "trend";
	}
	const plannedWeekly = (facts.minutesPerDay / 60) * facts.daysPerWeek;
	const speedEta = etaFrom(
		opts.now,
		hoursToGo === 0 ? 0 : plannedWeekly > 0 ? (hoursToGo / plannedWeekly) * 7 : null,
		hoursToGo === 0 ? 0 : facts.paceMinutes > 0 && facts.paceDays >= MIN_PACE_DAYS ? hoursToGo / (facts.paceMinutes / 60) : null,
	);

	const credited = facts.outside?.creditedPerDay ?? 0;
	let outside: MilestoneEstimate["speed"]["outside"] = null;
	if (credited > 0 && hoursToGo > 0) {
		if (hoursBasis === "trend") outside = { basis: "in-trend" };
		else {
			const app = facts.paceMinutes > 0 && facts.paceDays >= MIN_PACE_DAYS ? facts.paceMinutes : 0;
			const days = hoursToGo / ((app + credited) / 60);
			outside = { basis: "added", measuredPerDay: Math.round(app), creditedPerDay: Math.round(credited * 10) / 10, days, date: addDaysIso(opts.now, days) };
		}
	}

	const eta = later(wordsEta, speedEta);
	const wordsDone = toGo === 0;
	const speedDone = speedNeed === 0 || speedHave >= speedNeed;
	const binding: Binding = wordsDone && speedDone ? "none" : (wordsEta.daysPlanned ?? Infinity) >= (speedEta.daysPlanned ?? Infinity) ? (wordsDone ? "speed" : "words") : speedDone ? "words" : "speed";
	const days = eta.daysPlanned;
	const status: MilestoneStatus = wordsDone && speedDone ? "reached" : days !== null && days <= 120 ? "close" : days !== null && days <= 400 ? "on-the-way" : "far";

	const pct = (x: number) => `${Math.round(x * 100)}%`;
	const missing: string[] = [];
	if (!wordsDone) missing.push(`About ${toGo.toLocaleString("en-GB")} more words: the words you know cover about ${pct(coverageNow)} of ${genre.title}; this needs ${pct(def.coverage)} (≈${need.toLocaleString("en-GB")} lemmas).`);
	if (!speedDone) {
		const who = facts.speed.basis === "level" ? "a listener at your level" : "you";
		missing.push(`Speed: ${who} understand${facts.speed.basis === "level" ? "s" : ""} about ${speedHave} word${speedHave === 1 ? "" : "s"} a minute; this needs about ${speedNeed} (${def.wpm} spoken, ${SUPPORT_LINE[def.support]}).`);
	}
	let verdict: string;
	if (status === "reached") verdict = "The words and the speed are both there by this estimate. Go and try it; what you miss is the next lesson.";
	else if (binding === "speed") verdict = wordsDone ? "You know the words for this. What is missing is speed: hearing them as meaning before the next ones arrive." : "Speed is the longer road here; the words will be there first.";
	else verdict = speedDone ? "You hear fast enough for this. What is missing is words." : "Words are the longer road here; your speed will be ready first.";

	return {
		def,
		status,
		binding,
		words: { have, need, toGo, coverageNow, coverageTarget: def.coverage, eta: wordsEta },
		speed: { have: speedHave, need: speedNeed, basis: facts.speed.basis, hoursToGo: Math.round(hoursToGo), hoursBasis, eta: speedEta, outside },
		eta,
		verdict,
		missing,
	};
}

// ─── Custom milestones ──────────────────────────────────────────────────────

export const MAX_CUSTOM_LENGTH = 200;

/** What the cheap model fills in for a milestone in the learner's words. */
export interface CustomMapping {
	title: string;
	line: string;
	genre: GenreId;
	coverage: 0.9 | 0.95 | 0.98;
	/** 0 when the learner sets the pace. */
	wpm: number;
	support: Support;
	icon?: string;
	cefr?: string;
}

const ICONS = new Set(["monitor-play", "video", "headphones", "newspaper", "coffee", "users", "captions", "clapperboard", "radio", "book-open", "message-circle", "briefcase", "music", "phone", "mail", "landmark", "tv", "mic", "sparkles", "baby", "gamepad-2", "map"]);

/** The model's answer, checked field by field; anything odd falls back to
 *  a sensible default rather than failing the whole milestone. */
export function parseCustomMapping(text: string, fallbackTitle: string): CustomMapping {
	let raw: Record<string, unknown> = {};
	const m = text.match(/\{[\s\S]*\}/);
	if (m) {
		try {
			raw = JSON.parse(m[0]) as Record<string, unknown>;
		} catch {
			raw = {};
		}
	}
	const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
	const genre = typeof raw.genre === "string" && raw.genre in GENRES ? (raw.genre as GenreId) : "conversation";
	const cov = Number(raw.coverage);
	const coverage: CustomMapping["coverage"] = cov >= 0.975 ? 0.98 : cov >= 0.925 ? 0.95 : cov > 0 ? 0.9 : 0.95;
	const wpmRaw = Number(raw.wpm);
	const wpm = Number.isFinite(wpmRaw) ? Math.max(0, Math.min(220, Math.round(wpmRaw))) : NATURAL_WPM;
	const support: Support = raw.support === "visual" || raw.support === "subtitles" || raw.support === "interactive" || raw.support === "none" ? raw.support : "none";
	const icon = str(raw.icon, 24);
	return {
		title: str(raw.title, 60) || fallbackTitle.slice(0, 60),
		line: str(raw.line, 160) || "In your own words.",
		genre,
		coverage,
		wpm,
		support,
		icon: ICONS.has(icon) ? icon : "sparkles",
		cefr: str(raw.cefr, 120) || undefined,
	};
}

/** A stable id for a custom milestone from its text. */
export function normalizeCustomText(text: string): string {
	return text.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_LENGTH);
}

export function customId(text: string): string {
	let h = 0;
	for (const ch of normalizeCustomText(text).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return `custom-${h.toString(36)}`;
}

/** The milestone a mapping describes. */
export function customMilestone(text: string, mapping: CustomMapping): MilestoneDef {
	return {
		id: customId(text),
		title: mapping.title,
		line: mapping.line,
		icon: mapping.icon ?? "sparkles",
		genre: mapping.genre,
		coverage: mapping.coverage,
		wpm: mapping.wpm,
		support: mapping.support,
		custom: normalizeCustomText(text),
		...(mapping.cefr ? { cefr: mapping.cefr } : {}),
	};
}

/** The studies the page cites, in the order the numbers appear. */
export const MILESTONE_SOURCES: Array<{ who: string; what: string; line: string }> = [
	{ who: "van Zeeland & Schmitt (2013), Applied Linguistics", what: "How much of the words you need to follow speech", line: "Listeners followed informal narratives adequately at 95% of the words known, and many did at 90%; conversation here asks 90–95%. A film without subtitles is held to 98%: that is our own cautious choice, because the study used short narratives, not films." },
	{ who: "Hu & Nation (2000); Laufer & Ravenhorst-Kalovski (2010)", what: "The reading thresholds", line: "Unassisted reading for pleasure needs about 98% of the words; 95% is the minimum where comprehension holds with some help, such as a dictionary tap." },
	{ who: "Schmitt, Jiang & Grabe (2011), Modern Language Journal", what: "Coverage and comprehension", line: "Comprehension rises roughly in a straight line with the share of words known: there is no cliff, so every hundred words bought moves the needle." },
	{ who: "Webb & Rodgers (2009a, 2009b)", what: "The vocabulary of TV and film", line: "Across 88 TV programs and 318 films, 3,000 word families plus proper nouns gave about 95% of the words, and 6,000–7,000 gave 98%. The vlog and film milestones take their counts from here." },
	{ who: "Nation (2006), Canadian Modern Language Review", what: "How large a vocabulary for reading and listening", line: "Newspapers and novels need about 4,000 families for 95% and 8,000–9,000 for 98%; everyday speech about 3,000 and 6,000–7,000. The news and in-laws milestones take their counts from here." },
	{ who: "Adolphs & Schmitt (2003), Applied Linguistics", what: "Everyday conversation", line: "In the CANCODE corpus of spoken English, 2,000 word families covered about 95% of the words, and 3,000 about 96%; conversation is the least demanding material there is." },
	{ who: "Milton (2009), Measuring Second Language Vocabulary Acquisition", what: "Vocabulary size by CEFR level", line: "Learners placed at A2 know about 1,500–2,500 lemmas, at B1 2,750–3,250, at B2 3,250–3,750. The app uses these, raised by the same quarter as the word-family counts, to credit words your level implies but the deck has not tested. Milton's counts may already be lemma-based, so this can credit more words than you know." },
	{ who: "Segalowitz (2010), Cognitive Bases of Second Language Fluency", what: "Why knowing a word is not hearing it", line: "Fluent comprehension is automatic retrieval: fast and stable, not just correct. That recalling a word slowly is not yet hearing it at speech pace is the app's reading of this, not Segalowitz's finding; his measure is how steady reaction times are, not words a minute. The speed column measures the pace directly." },
	{ who: "DeKeyser (1997), Studies in Second Language Acquisition", what: "How speed grows", line: "Processing speed improves with practice along a power law: fast gains at first, then slower ones, over weeks of practice. The app's projections use straight lines, which overstate late gains. The speed dates use the guided-hours ladder until your own Listen trend has enough sessions to replace it." },
	{ who: "Council of Europe, CEFR Companion Volume (2020)", what: "What each level can follow", line: "B1: clearly articulated speech directed at me, and films where pictures carry the story. B2: the majority of films in standard dialect, most TV on familiar topics. The speed ladder is anchored to these descriptors." },
];
