/**
 * Onboarding (LangHarness, 2026-10-28) — how the app learns what the
 * learner wants and where they stand, without a chat.
 *
 * Why: the first version asked for the goal and the level inside a paid
 * tutor session (a question card "What do you want Slovak for?", then
 * 5–15 graded questions). A 70-minute session spent 23 minutes on that.
 * It was slow, cost tokens, and still answered "why B1?" with a verdict
 * instead of evidence. Here the three things the plan needs are three
 * cheap, structured sources:
 *
 *   purposes  — what Slovak is FOR, picked from can-do sets that map onto
 *               the map's chapters, goals and Talk scenes; the target
 *               level is derived from them (and can be overridden)
 *   placement — a staircase drill of real lexicon sentences (tiers A1a,
 *               A1b, A2, B1; two reps per unit), climbed while the learner
 *               holds ≥75%; tested-out units are done, the chapters a
 *               passed tier covers are skipped, and the evidence (the
 *               sentences) is what the result screen shows
 *   the ledger — from then on the lesson screen measures continuously;
 *               "re-check my level" reruns the staircase from the current
 *               tier
 *
 * The tutor gets all of it as a compact profile block in its system
 * prompt (learnerProfileText), so a Learn session never has to ask.
 * Pure and browser-safe.
 */

import { CEFR_ORDER, CHAPTERS, curriculumUnit, GUIDED_HOURS, STAGES, type Cefr, type CurriculumState, type UnitEvidence } from "./curriculum.ts";
import { unitInfo, type UnitId } from "./lesson.ts";

// ─── What Slovak is for ─────────────────────────────────────────────────────

export type Purpose = "family" | "daily" | "work" | "offices" | "media" | "exam" | "curious" | "other";

export interface PurposeInfo {
	id: Purpose;
	title: string;
	blurb: string;
	/** lucide icon name (components/lesson/unit-icon.tsx). */
	glyph: string;
	/** The level this purpose needs, by the map's can-do goals. */
	level: Cefr;
	/** Can-do goals on the map (src/core/curriculum.ts) that serve it. */
	goals: string[];
	/** Talk scenes (components/lesson/tutor.ts) that prove it. */
	scenes: string[];
}

export const PURPOSES: PurposeInfo[] = [
	{
		id: "family",
		title: "Family and friends",
		blurb: "In-laws, a partner's family, friends who switch to Slovak",
		glyph: "users",
		level: "B1",
		goals: ["can-introduce", "can-family", "can-describe-day", "can-tell-day", "can-describe-people", "can-narrate", "can-opinion"],
		scenes: ["family", "colleague"],
	},
	{
		id: "daily",
		title: "Daily life in Slovakia",
		blurb: "Cafés, shops, the doctor, getting around",
		glyph: "coffee",
		level: "A2",
		goals: ["can-order", "can-directions", "can-shop", "can-appointment", "can-travel", "can-plan"],
		scenes: ["cafe", "way", "shop", "doctor"],
	},
	{
		id: "work",
		title: "Work",
		blurb: "Colleagues, meetings, emails, interviews",
		glyph: "briefcase",
		level: "B2",
		goals: ["can-interview", "can-opinion", "can-complain", "can-write-formal", "can-debate"],
		scenes: ["colleague"],
	},
	{
		id: "offices",
		title: "Offices and paperwork",
		blurb: "Forms, the foreigners' police, phone calls, complaints",
		glyph: "file-text",
		level: "B1",
		goals: ["can-appointment", "can-complain", "can-write-formal"],
		scenes: ["doctor", "shop"],
	},
	{
		id: "media",
		title: "News, books and film",
		blurb: "Read the news, follow a film, listen to a podcast",
		glyph: "newspaper",
		level: "B2",
		goals: ["can-read-news", "can-narrate", "can-follow-media"],
		scenes: ["colleague"],
	},
	{
		id: "exam",
		title: "An exam or citizenship",
		blurb: "A certificate at a set level, by a date",
		glyph: "graduation-cap",
		level: "B1",
		goals: ["can-interview", "can-opinion", "can-complain", "can-write-formal"],
		scenes: ["colleague", "family"],
	},
	{
		id: "curious",
		title: "Curiosity",
		blurb: "No deadline, the pleasure of a new language",
		glyph: "sparkles",
		level: "A2",
		goals: ["can-introduce", "can-order", "can-directions", "can-family"],
		scenes: ["cafe", "way", "family"],
	},
	{
		// Xurify (2026-10-28): "There should be an Other which gives people an
		// option to explain." The note goes to the tutor word for word; the
		// level is the learner's own pick (A2 until they say otherwise).
		id: "other",
		title: "Something else",
		blurb: "Say it in a sentence; the tutor reads it",
		glyph: "pen-line",
		level: "A2",
		goals: [],
		scenes: [],
	},
];

export const MAX_PURPOSES = 3;
export const MAX_PURPOSE_NOTE = 240;

export function isPurpose(v: unknown): v is Purpose {
	return typeof v === "string" && PURPOSES.some((p) => p.id === v);
}

export function purposeInfo(id: Purpose): PurposeInfo {
	return PURPOSES.find((p) => p.id === id)!;
}

/** "Daily life in Slovakia" → "daily life in Slovakia": for mid-sentence use. */
export function purposePhrase(id: Purpose): string {
	const t = purposeInfo(id).title;
	return t.charAt(0).toLowerCase() + t.slice(1);
}

/** The target the purposes imply: the highest level any of them needs
 *  (an exam's own level wins when given). Nothing picked → A2: enough to
 *  get by, and the map says how far it is from there. */
export function suggestedLevel(purposes: readonly Purpose[], examLevel?: Cefr): Cefr {
	let best: Cefr = "A2";
	for (const id of purposes) {
		const lv = id === "exam" && examLevel ? examLevel : purposeInfo(id).level;
		if (CEFR_ORDER.indexOf(lv) > CEFR_ORDER.indexOf(best)) best = lv;
	}
	return best;
}

/** Goal unit ids the purposes serve (for the map's "your goal" marks). */
export function purposeGoals(purposes: readonly Purpose[]): Set<string> {
	return new Set(purposes.flatMap((p) => purposeInfo(p).goals));
}

/** Talk scenes the purposes call for, deduplicated, in purpose order. */
export function purposeScenes(purposes: readonly Purpose[]): string[] {
	return [...new Set(purposes.flatMap((p) => purposeInfo(p).scenes))];
}

// ─── What the learner brings ────────────────────────────────────────────────

/** A language the learner may know. The catalogue is what the setup
 *  offers as chips; anything else goes in `otherLanguages` as free text.
 *  Xurify (2026-10-28): knowing a language is a bridge, so the lessons and
 *  the tutor should draw on every one picked, not only the first. */
export type Lang =
	| "et" | "fi" | "ru" | "de"
	| "cs" | "pl" | "uk" | "sl" | "hr" | "bg"
	| "hu" | "lv" | "lt"
	| "en" | "sv" | "nl" | "fr" | "es" | "it" | "pt" | "tr" | "ja" | "zh";

/** The languages the lessons carry a bridge line for (src/core/unit-bridges.ts). */
export type Prior = "none" | "words" | "sentences" | "reading";

export type BridgeLang = "et" | "fi" | "ru" | "de";
export const BRIDGE_LANGS: readonly BridgeLang[] = ["et", "fi", "ru", "de"];

export interface KnownLanguageInfo {
	id: Lang;
	title: string;
	/** What it brings to Slovak, in a few words (the chip's tooltip and the tutor's note). */
	line: string;
}

/** Bridge languages first, then the Slavic family, then other case languages. */
export const KNOWN_LANGUAGES: readonly KnownLanguageInfo[] = [
	{ id: "et", title: "Estonian", line: "14 cases: the closest model for Slovak cases; the lessons show every form the Estonian way" },
	{ id: "fi", title: "Finnish", line: "15 cases: the lessons show every form the Finnish way" },
	{ id: "ru", title: "Russian", line: "The same six cases and aspect; cognates and false friends; the lessons show every form the Russian way" },
	{ id: "de", title: "German", line: "Four cases, gender and agreement; the lessons show every form the German way" },
	{ id: "cs", title: "Czech", line: "Nearly the same grammar, different sounds" },
	{ id: "pl", title: "Polish", line: "Cases and aspect carry over; cognates" },
	{ id: "uk", title: "Ukrainian", line: "Close vocabulary, the same case logic" },
	{ id: "sl", title: "Slovene", line: "Cases and aspect carry over; the dual is extra" },
	{ id: "hr", title: "Croatian", line: "Seven cases and aspect; many cognates" },
	{ id: "bg", title: "Bulgarian", line: "Aspect and vocabulary carry over; no cases to lean on" },
	{ id: "hu", title: "Hungarian", line: "Cases and agglutination: the idea of a case ending is familiar" },
	{ id: "lv", title: "Latvian", line: "Seven cases and gender" },
	{ id: "lt", title: "Lithuanian", line: "Seven cases, gender and aspect-like prefixes" },
	{ id: "en", title: "English", line: "The app explains in English" },
	{ id: "sv", title: "Swedish", line: "Gender and verb-second word order" },
	{ id: "nl", title: "Dutch", line: "Gender and verb-second word order" },
	{ id: "fr", title: "French", line: "Gender, agreement and verb endings" },
	{ id: "es", title: "Spanish", line: "Gender, agreement, verb endings and a perfective/imperfective past" },
	{ id: "it", title: "Italian", line: "Gender, agreement and verb endings" },
	{ id: "pt", title: "Portuguese", line: "Gender, agreement and verb endings" },
	{ id: "tr", title: "Turkish", line: "Cases and agglutination" },
	{ id: "ja", title: "Japanese", line: "Particles mark the role a case ending marks in Slovak" },
	{ id: "zh", title: "Chinese", line: "No endings at all: every Slovak ending is new" },
];

export const MAX_LANGUAGES = 8;
export const MAX_OTHER_LANGUAGES = 5;
export const MAX_OTHER_LANGUAGE_LENGTH = 40;

export function isLang(v: unknown): v is Lang {
	return typeof v === "string" && KNOWN_LANGUAGES.some((l) => l.id === v);
}
export function isBridgeLang(v: unknown): v is BridgeLang {
	return typeof v === "string" && (BRIDGE_LANGS as readonly string[]).includes(v);
}
export function languageInfo(id: Lang): KnownLanguageInfo {
	return KNOWN_LANGUAGES.find((l) => l.id === id)!;
}
export function languageName(id: Lang): string {
	return languageInfo(id).title;
}

/** Before 2026-10-28 evening the setup kept one first language and a few
 *  Slavic "bridges"; a profile written then is read as the same list. */
const LEGACY_FIRST: Record<string, Lang | undefined> = { et: "et", en: "en" };

/** Every language the learner knows, strongest first. A profile that never
 *  said (the app's first learner) reads as Estonian and English. */
export function knownLanguages(goal: Pick<LearnerGoal, "languages" | "firstLanguage" | "bridges"> | null | undefined): Lang[] {
	if (goal?.languages) return goal.languages;
	if (goal?.firstLanguage || goal?.bridges?.length) {
		const first = LEGACY_FIRST[goal.firstLanguage ?? ""];
		return [...new Set([...(first ? [first] : []), ...(goal.bridges ?? []).filter(isLang), "en" as Lang])];
	}
	return ["et", "en"];
}

/** The known languages the lessons can show a form in, in the learner's order. */
export function bridgeLanguages(goal: Pick<LearnerGoal, "languages" | "firstLanguage" | "bridges"> | null | undefined): BridgeLang[] {
	return knownLanguages(goal).filter(isBridgeLang);
}

/** The language explanations come in: the learner's pick, else English. */
export function explanationLanguage(goal: Pick<LearnerGoal, "explainIn"> | null | undefined): Lang {
	return goal?.explainIn ?? "en";
}

export const PRIORS: Array<{ id: Prior; title: string; line: string }> = [
	{ id: "none", title: "Nothing yet", line: "Start at the very beginning" },
	{ id: "words", title: "A few words", line: "Greetings, numbers, some food" },
	{ id: "sentences", title: "Simple sentences", line: "I can introduce myself and order" },
	{ id: "reading", title: "I read some Slovak", line: "I follow texts but my endings are shaky" },
];

export function isPrior(v: unknown): v is Prior {
	return typeof v === "string" && PRIORS.some((p) => p.id === v);
}

// ─── The learner's goal record ──────────────────────────────────────────────

/** What progress.json keeps under `goal` (src/store/progress.ts). The
 *  first two fields predate onboarding; the rest is what the setup writes. */
export interface LearnerGoal {
	level: Cefr;
	minutesPerDay: number;
	daysPerWeek?: number;
	purposes?: Purpose[];
	/** The learner's own words for "other" (or anything the cards miss). */
	purposeNote?: string;
	/** Languages the learner knows (catalogue ids, strongest first) and any
	 *  others as free text. `knownLanguages()` reads either shape. */
	languages?: Lang[];
	otherLanguages?: string[];
	/** The language the tutor explains in; English unless chosen. */
	explainIn?: Lang;
	/** @deprecated The setup before 2026-10-28 evening wrote these; read through `knownLanguages()`. */
	firstLanguage?: string;
	/** @deprecated See `firstLanguage`. */
	bridges?: string[];
	prior?: Prior;
	/** ISO time the setup was completed (or skipped). Absent = first run. */
	onboardedAt?: string;
	/** The last placement: when, the level it found, and the first chapter
	 *  the learner works in (every chapter before it is skipped on the map). */
	placedAt?: string;
	placedLevel?: Cefr;
	startChapter?: string;
}

export const DEFAULT_DAYS_PER_WEEK = 6;
/** Quick picks; the setup's stepper takes any number up to MAX_MINUTES
 *  (a power learner's three hours a day is a plan, not an outlier). */
export const MINUTE_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120] as const;
export const MAX_MINUTES = 600;

/** Guided hours a week at the planned minutes and days. */
export function weeklyHours(minutesPerDay: number, daysPerWeek = DEFAULT_DAYS_PER_WEEK): number {
	return (minutesPerDay / 60) * daysPerWeek;
}

/** The month the target is reached from zero, at the planned pace. */
export function etaFromScratch(level: Cefr, minutesPerDay: number, daysPerWeek: number, hoursDone: number, now: Date): string | null {
	const weekly = weeklyHours(minutesPerDay, daysPerWeek);
	if (weekly <= 0) return null;
	const left = Math.max(0, GUIDED_HOURS[level] - hoursDone);
	const d = new Date(now.getTime() + Math.round((left / weekly) * 7) * 86_400_000);
	return d.toISOString().slice(0, 10);
}

// ─── Placement: the staircase ───────────────────────────────────────────────

export interface PlacementTier {
	id: string;
	level: Cefr;
	title: string;
	/** Drill units probed, two reps each (choose, then type). */
	units: UnitId[];
	/** Chapters the tier stands for: passing it skips them on the map. */
	chapters: string[];
}

/** Four tiers, each the grammar of a stretch of the map. A tier is
 *  passed at PASS_SHARE of its reps; the staircase stops at the first
 *  tier not passed, and the level found is the last tier passed. */
export const PLACEMENT_TIERS: PlacementTier[] = [
	{ id: "a1a", level: "A1", title: "First steps", units: ["words", "present", "acc-fem", "loc"], chapters: ["hello", "cafe", "town"] },
	{ id: "a1b", level: "A1", title: "Everyday A1", units: ["acc-people", "gen", "ins", "past"], chapters: ["family", "everyday", "yesterday"] },
	{ id: "a2", level: "A2", title: "Getting around", units: ["present-ujem", "plural", "cond", "motion"], chapters: ["health", "shopping", "plans", "moving", "people", "work"] },
	{ id: "b1", level: "B1", title: "Independence", units: ["adj-cases", "numbers", "cases-mix", "verbs-mix"], chapters: ["stories", "opinions", "offices", "world"] },
];

export const REPS_PER_UNIT = 2;
export const PASS_SHARE = 0.75;

export function placementTier(id: string): PlacementTier | undefined {
	return PLACEMENT_TIERS.find((t) => t.id === id);
}

/** The tier to start a re-check from: the one whose chapters hold the
 *  learner's current chapter (or the first). */
export function tierForChapter(chapter: string | undefined): number {
	const i = PLACEMENT_TIERS.findIndex((t) => t.chapters.includes(chapter ?? ""));
	return i < 0 ? 0 : i;
}

export interface PlacementRep {
	tier: string;
	unit: UnitId;
	verdict: "exact" | "accents" | "wrong";
}

export interface TierResult {
	id: string;
	level: Cefr;
	title: string;
	reps: number;
	correct: number;
	passed: boolean;
}

export interface PlacementOutcome {
	/** The level the learner works at now: the stage of the first chapter
	 *  after the tiers passed (A1 when none was). */
	level: Cefr;
	tiers: TierResult[];
	/** The first chapter to work in. */
	startChapter: string;
	/** Per probed unit: its reps and hits; `placed` marks it as evidence
	 *  from placement (both right = tested out). */
	units: Record<string, UnitEvidence & { placed: true }>;
	testedOut: UnitId[];
	weak: UnitId[];
}

/** Does a verdict count as right? Accent slips do, as in lessons. */
export const isHit = (v: PlacementRep["verdict"]) => v !== "wrong";

/** Fold answered reps into the outcome. Pure: the server records it. */
export function placementOutcome(reps: readonly PlacementRep[]): PlacementOutcome {
	const tiers: TierResult[] = [];
	const units: PlacementOutcome["units"] = {};
	for (const t of PLACEMENT_TIERS) {
		const mine = reps.filter((r) => r.tier === t.id);
		if (mine.length === 0) break;
		const correct = mine.filter((r) => isHit(r.verdict)).length;
		tiers.push({ id: t.id, level: t.level, title: t.title, reps: mine.length, correct, passed: mine.length >= t.units.length && correct / mine.length >= PASS_SHARE });
		for (const u of t.units) {
			const ours = mine.filter((r) => r.unit === u);
			if (ours.length === 0) continue;
			units[u] = { lessons: 0, reps: ours.length, correct: ours.filter((r) => isHit(r.verdict)).length, placed: true };
		}
	}
	let lastPassed = -1;
	for (let i = 0; i < tiers.length; i++) {
		if (tiers[i]!.passed) lastPassed = i;
		else break;
	}
	const startChapter = lastPassed >= 0 ? (CHAPTERS[CHAPTERS.findIndex((c) => c.id === PLACEMENT_TIERS[lastPassed]!.chapters.at(-1)) + 1]?.id ?? CHAPTERS.at(-1)!.id) : CHAPTERS[0]!.id;
	const level: Cefr = STAGES.find((st) => st.id === CHAPTERS.find((c) => c.id === startChapter)!.stage)!.level;
	const testedOut = Object.entries(units)
		.filter(([, e]) => e.reps >= REPS_PER_UNIT && e.correct === e.reps)
		.map(([id]) => id as UnitId);
	const weak = Object.entries(units)
		.filter(([, e]) => e.correct < e.reps)
		.map(([id]) => id as UnitId);
	return { level, tiers, startChapter, units, testedOut, weak };
}

/** Should the staircase climb after this tier's reps? */
export function tierPassed(tier: PlacementTier, reps: readonly PlacementRep[]): boolean {
	const mine = reps.filter((r) => r.tier === tier.id);
	return mine.length >= tier.units.length && mine.filter((r) => isHit(r.verdict)).length / mine.length >= PASS_SHARE;
}

// ─── The profile the tutor reads ────────────────────────────────────────────

const PRIOR_LINE: Record<Prior, string> = {
	none: "started from nothing",
	words: "started with a few words",
	sentences: "started with simple sentences",
	reading: "started able to read some Slovak, with shaky endings",
};

/**
 * The learner, in ten lines, for the tutor's system prompt: what Slovak is
 * for, the target and the pace, the first language and the bridges, how
 * they started, what placement and the lessons have measured since. The
 * prober fragment tells the agent to treat this as the goal and the
 * level already found. Null when nothing is known yet (first run).
 */
export function learnerProfileText(goal: LearnerGoal | undefined, state: CurriculumState | null, evidence: Record<string, UnitEvidence | undefined>): string | null {
	if (!goal?.onboardedAt && !state) return null;
	const lines: string[] = [];
	const purposes = goal?.purposes ?? [];
	const note = goal?.purposeNote?.trim();
	if (purposes.length || note) {
		const named = purposes.filter((p) => p !== "other").map(purposePhrase);
		const goals = [...purposeGoals(purposes)].map((g) => `"${curriculumUnit(g)?.title ?? g}"`).slice(0, 5);
		lines.push(`- Slovak is for: ${[...named, ...(note ? [`in the learner's own words, "${note}"`] : purposes.includes("other") ? ["something the cards did not cover"] : [])].join("; ")}.${goals.length ? ` The goal is concrete: the map's can-do goals ${goals.join(", ")}.` : ""}${note ? " Shape examples and scenes around those words." : ""}`);
	}
	if (goal) lines.push(`- Target: ${goal.level} (about ${GUIDED_HOURS[goal.level]} guided hours), at ${goal.minutesPerDay} minutes a day, ${goal.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK} days a week.`);
	if (goal) {
		const known = knownLanguages(goal);
		const other = (goal.otherLanguages ?? []).filter(Boolean);
		const names = [...known.map(languageName), ...other];
		const notes = known.filter((l) => l !== "en").map((l) => `${languageName(l)}: ${languageInfo(l).line.replace(/; the lessons show every form the \w+ way$/, "")}`);
		const explain = explanationLanguage(goal);
		lines.push(
			`- Knows: ${names.join(", ")}.${notes.length ? ` ${notes.join(". ")}.` : ""} When a form has a parallel in one of these, show it that way too, not only in English.${known.includes("et") ? "" : " Do not lean on Estonian bridges."}`,
		);
		lines.push(explain === "en" ? "- Explanations in English." : `- Explain in ${languageName(explain)} (the learner's choice): prose and rules in ${languageName(explain)}, Slovak examples in Slovak, English only when asked.`);
	}
	if (goal?.prior) lines.push(`- Before the app: ${PRIOR_LINE[goal.prior]}.`);
	if (goal?.placedAt && goal.placedLevel) {
		const placed = Object.entries(evidence).filter(([, e]) => e?.placed);
		const out = placed.filter(([, e]) => e!.reps > 0 && e!.correct === e!.reps).map(([id]) => unitInfo(id as UnitId).title);
		const missed = placed.filter(([, e]) => e!.correct < e!.reps).map(([id, e]) => `${unitInfo(id as UnitId).title} (${e!.correct}/${e!.reps})`);
		lines.push(`- Placement drill on ${goal.placedAt.slice(0, 10)}: ${goal.placedLevel}${out.length ? `; tested out of ${out.join(", ")}` : ""}${missed.length ? `; missed ${missed.join(", ")}` : ""}.`);
	}
	if (state) {
		const cur = state.chapters.find((c) => c.id === state.current);
		const stage = STAGES.find((s) => s.id === cur?.stage);
		if (cur && stage) lines.push(`- Working now at ${stage.level}, chapter "${cur.title}" (${cur.doneCount}/${cur.total} units done; ${state.done}/${state.total} on the road to the target).`);
		const weak = state.chapters
			.flatMap((c) => c.units)
			.filter((u) => (u.kind === "drill" || u.kind === "words") && u.reps >= 6 && u.accuracy !== null && u.accuracy < 0.85)
			.sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
			.slice(0, 5);
		if (weak.length) lines.push(`- Measured weak points (lesson accuracy): ${weak.map((u) => `${u.title} ${Math.round((u.accuracy ?? 0) * 100)}%`).join(", ")}.`);
		const done = state.chapters.flatMap((c) => c.units).filter((u) => u.status === "done" && (u.kind === "drill" || u.kind === "words"));
		if (done.length) lines.push(`- Holds (units done on the map): ${done.slice(0, 12).map((u) => u.title).join(", ")}${done.length > 12 ? `, and ${done.length - 12} more` : ""}.`);
	}
	if (lines.length === 0) return null;
	return ["# This learner (from the app's profile and the lesson ledger)", ...lines, "Treat the goal as concrete and the level as measured: do not ask for either. Build from the units held, work on the weak points, and keep the purposes in the examples you choose."].join("\n");
}
