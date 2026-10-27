/**
 * Lessons (LangHarness redesign, 2026-10-27) — the fast local drill loop.
 * Browser-safe and pure: the server (src/server/lesson.ts) hands in the
 * lexicon's entries, this module picks sentences and builds the items.
 *
 * Why local: the tutor wrote every question as a model turn, so each rep
 * cost a 3–10 s wait and a 300-character English stem. A lesson here is
 * 12 reps built from the dictionary's own sentences (slovak.wiki +
 * Tatoeba), so the next item is already on screen. The tutor is still one
 * click away ("Why?") for the explanation a rule line cannot give.
 *
 * Units are grammar strands, each a filter over the cloze examples: the
 * noun's gender, its dictionary form against the blanked form, and the
 * word right before the blank (the preposition that triggers the case).
 * The filters are heuristics over verified forms, never generated forms:
 * the answer is always the token the sentence really has.
 */

import type { LexiconEntry } from "./review.ts";
import { foldDiacritics } from "./language.ts";

// ─── Units ──────────────────────────────────────────────────────────────────

export type UnitId = "words" | "present" | "acc-fem" | "loc" | "acc-people" | "gen" | "ins" | "adj" | "past" | "dat";

export interface UnitInfo {
	id: UnitId;
	title: string;
	/** The question the unit answers, in a few words. */
	tagline: string;
	/** One line shown after a miss: the rule behind the right form. */
	rule: string;
	/** The path icon's name (a lucide icon, resolved in the Today page). */
	glyph: string;
	/** The seed grammar node this unit practises (curriculum/slovak). */
	node?: string;
	/** The Estonian bridge (spec D3): the same idea in his first language. */
	bridge?: string;
}

/** The path, in teaching order. */
export const UNITS: UnitInfo[] = [
	{ id: "words", title: "First words", tagline: "Everyday words in real sentences", glyph: "book", rule: "Learn the word with its sentence: the sentence is what you will hear." },
	{ id: "present", title: "I, you, we", tagline: "Verbs in the present", glyph: "users", rule: "Present endings: ja -m, ty -š, on/ona -, my -me, vy -te, oni -ú/-ia/-jú.", node: "n_seed_v_present", bridge: "Like Estonian: my robíme ≈ me teeme, vy robíte ≈ te teete. Ja robím ≈ ma teen." },
	{ id: "acc-fem", title: "Objects: -a → -u", tagline: "What you have, see, drink", glyph: "coffee", rule: "A feminine noun in -a takes -u as the direct object: Pijem kávu. Mám sestru.", node: "n_seed_acc_fem", bridge: "The object case, like Estonian osastav: Pijem kávu ≈ Joon kohvi." },
	{ id: "loc", title: "Where? v, na, o", tagline: "Kde? The locative", glyph: "map-pin", rule: "After v / na / o / po / pri for place or topic, the noun takes the locative: v meste, na stole, o škole.", node: "n_seed_loc", bridge: "Like the Estonian place cases: v meste ≈ linnas (seesütlev), na stole ≈ laual (alalütlev)." },
	{ id: "acc-people", title: "People as objects", tagline: "Vidím brata", glyph: "user-round", rule: "A masculine person as the object takes -a: Mám brata. Poznáš učiteľa?", node: "n_seed_acc_anim", bridge: "A male person as the object, like osastav: Vidím brata ≈ Näen venda." },
	{ id: "gen", title: "From, to, without", tagline: "do, z, od, bez + genitive", glyph: "door-open", rule: "do / z / od / bez / u / okolo take the genitive: do školy, z práce, bez cukru.", node: "n_seed_gen", bridge: "do školy ≈ kooli (sisseütlev), zo školy ≈ koolist (seestütlev), bez cukru ≈ suhkruta (ilmaütlev)." },
	{ id: "ins", title: "With: s, pred, za", tagline: "The instrumental", glyph: "handshake", rule: "s / pred / za / nad / pod / medzi (for place) take the instrumental: s kamarátom, pred domom, so sestrou.", node: "n_seed_ins", bridge: "Like Estonian kaasaütlev -ga: s kamarátom ≈ sõbraga, autobusom ≈ bussiga." },
	{ id: "adj", title: "Describing words", tagline: "Adjectives agree", glyph: "palette", rule: "The adjective copies the noun's gender, case and number: nová kniha, novú knihu, v novej knihe.", node: "n_seed_adj_cases", bridge: "Adjectives agree, as in Estonian: nová kniha → novú knihu ≈ uus raamat → uut raamatut." },
	{ id: "past", title: "What happened", tagline: "Past tense: -l, -la, -lo, -li", glyph: "history", rule: "Past tense = -l / -la / -lo / -li by the subject's gender and number, plus som/si for I/you: Robil som. Robila si.", node: "n_seed_v_past", bridge: "Built like the Estonian perfect: an -l form plus 'be' (robil som ~ olen teinud), with som/si only for I and you." },
	{ id: "dat", title: "To and for: k", tagline: "k, proti, vďaka + dative", glyph: "gift", rule: "k / ku / proti / vďaka / kvôli take the dative: k bratovi, ku škole, vďaka mame.", node: "n_seed_dat", bridge: "Like Estonian alaleütlev -le: k bratovi ≈ vennale, dal som mame ≈ andsin emale." },
];

export function isUnitId(v: unknown): v is UnitId {
	return typeof v === "string" && UNITS.some((u) => u.id === v);
}

export function unitInfo(id: UnitId): UnitInfo {
	return UNITS.find((u) => u.id === id)!;
}

const GEN_PREPS = new Set(["do", "z", "zo", "od", "bez", "u", "okolo", "vedľa", "blízko", "počas", "podľa", "namiesto", "vrátane"]);
const LOC_PREPS = new Set(["v", "vo", "na", "o", "po", "pri"]);
const INS_PREPS = new Set(["s", "so", "pred", "za", "nad", "pod", "medzi"]);
const DAT_PREPS = new Set(["k", "ku", "proti", "vďaka", "kvôli", "napriek", "oproti"]);
const ALL_PREPS = new Set([...GEN_PREPS, ...LOC_PREPS, ...INS_PREPS, ...DAT_PREPS]);

const MAX_WORDS = 10;

/** The word right before position `at`, lowercased, punctuation stripped. */
export function wordBefore(sentence: string, at: number): string {
	const words = sentence.slice(0, at).trim().split(/\s+/);
	const w = words[words.length - 1] ?? "";
	return w.toLocaleLowerCase("sk-SK").replace(/^[„“"'(]+|[,.;:!?„“"')]+$/g, "");
}

/** Which unit (if any) one cloze example drills. Pure, so tests pin it. */
export function classifyExample(entry: LexiconEntry, example: { sk: string; cloze?: { answer: string; at: number } }): UnitId | null {
	const c = example.cloze;
	if (!c) return null;
	if (example.sk.split(/\s+/).length > MAX_WORDS) return null;
	const lemma = entry.sk.toLocaleLowerCase("sk-SK");
	const answer = c.answer.toLocaleLowerCase("sk-SK");
	const prev = wordBefore(example.sk, c.at);
	if (entry.cat === "Nouns") {
		if (answer === lemma) return null;
		const gender = entry.gender ?? "";
		const femAcc = gender === "feminine" && lemma.endsWith("a") && answer === `${lemma.slice(0, -1)}u`;
		if (GEN_PREPS.has(prev)) return "gen";
		if (DAT_PREPS.has(prev)) return "dat";
		if (INS_PREPS.has(prev)) return /(ou|om|ami|mi|ím)$/.test(answer) ? "ins" : null;
		if (LOC_PREPS.has(prev)) return femAcc ? null : "loc";
		if (femAcc) return "acc-fem";
		if (gender === "masculine-animate" && answer === `${lemma}a` && !ALL_PREPS.has(prev)) return "acc-people";
		return null;
	}
	if (entry.cat === "Verbs") {
		if (answer === lemma) return null;
		return /(l|la|lo|li)$/.test(answer) ? "past" : "present";
	}
	if (entry.cat === "Adjectives") return answer === lemma ? null : "adj";
	return null;
}

/** "First words": the beginner set in its dictionary form. */
function isFirstWord(entry: LexiconEntry, example: { sk: string; cloze?: { answer: string } }): boolean {
	if (!example.cloze || example.cloze.answer.length < 3) return false;
	if (example.sk.split(/\s+/).length > 8) return false;
	if (entry.origin !== "curated" && (entry.rank ?? Infinity) > 150) return false;
	return example.cloze.answer.toLocaleLowerCase("sk-SK") === entry.sk.toLocaleLowerCase("sk-SK");
}

// ─── Items ──────────────────────────────────────────────────────────────────

export type ItemKind = "choose" | "type" | "build" | "listen";

export interface LessonItem {
	/** "<slug>#<exampleIndex>" — the same id the review deck uses. */
	id: string;
	kind: ItemKind;
	unit: UnitId;
	slug: string;
	lemma: string;
	gloss: string;
	sentence: string;
	translation: string;
	answer: string;
	before: string;
	after: string;
	/** choose: four forms including the answer. */
	options?: string[];
	/** build: the sentence's words in order (what must be rebuilt). */
	tokens?: string[];
	/** build: the shuffled bank, tokens plus two distractors. */
	bank?: string[];
	/** The preposition right before the blank, when one decides the case. */
	trigger?: string;
	/** Mixed in from another unit, so the lesson cannot be passed by
	 *  ignoring the trigger (interleaving). */
	mixed?: boolean;
	/** A missed rep asked again at the end of the lesson. */
	again?: boolean;
}

export interface Candidate {
	entry: LexiconEntry;
	index: number;
	unit: UnitId;
}

/** Every example in the lexicon that drills `unit`, commonest words first. */
export function candidatesFor(entries: readonly LexiconEntry[], unit: UnitId): Candidate[] {
	const out: Candidate[] = [];
	for (const entry of entries) {
		entry.examples.forEach((ex, index) => {
			if (unit === "words" ? isFirstWord(entry, ex) : classifyExample(entry, ex) === unit) out.push({ entry, index, unit });
		});
	}
	// Commoner words first, in bands of 300 ranks; inside a band, shorter
	// sentences first — a common word in a long legal sentence is not easy.
	const band = (e: LexiconEntry) => (e.origin === "curated" ? -1 : Math.floor((e.rank ?? 1e9) / 300));
	const words = (c: Candidate) => c.entry.examples[c.index]!.sk.split(/\s+/).length;
	return out.sort(
		(a, b) =>
			band(a.entry) - band(b.entry) ||
			words(a) - words(b) ||
			(a.entry.rank ?? 1e9) - (b.entry.rank ?? 1e9) ||
			a.entry.slug.localeCompare(b.entry.slug),
	);
}

/** Small deterministic PRNG (mulberry32) — lessons vary per seed, tests pin a seed. */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(list: T[], rand: () => number): T[] {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

const fold = (s: string) => foldDiacritics(s.toLocaleLowerCase("sk-SK"));

function matchCase(form: string, like: string): string {
	const capital = like.charAt(0) !== like.charAt(0).toLocaleLowerCase("sk-SK");
	return capital ? form.charAt(0).toLocaleUpperCase("sk-SK") + form.slice(1) : form.toLocaleLowerCase("sk-SK");
}

/** Other forms of the same word: the best distractors for a form drill,
 *  because only the ending differs — so a word with two other forms gets a
 *  three-way choice rather than a padded one. Falls back to `pool` (answers
 *  of other items in the unit) only when the word has no other form. */
export function formOptions(entry: LexiconEntry, answer: string, pool: readonly string[], rand: () => number): string[] {
	const seen = new Set([fold(answer)]);
	const picks: string[] = [];
	const own = [entry.sk, ...(entry.forms ?? []), ...(entry.declension?.singular ?? []), ...(entry.declension?.plural ?? [])];
	const add = (f: string) => {
		if (!f || f.includes(" ")) return;
		const k = fold(f);
		if (seen.has(k)) return;
		seen.add(k);
		picks.push(matchCase(f, answer));
	};
	for (const f of shuffle(own, rand)) if (picks.length < 3) add(f);
	// Another word's form is a give-away (only one option is this word), so
	// the pool only tops up a word with no other verified form at all.
	if (picks.length === 0) for (const f of shuffle([...pool], rand)) if (picks.length < 3) add(f);
	return shuffle([answer, ...picks], rand);
}

/** A sentence's words for the word bank: punctuation stays on the word. */
export function sentenceTokens(sentence: string): string[] {
	return sentence.trim().split(/\s+/).filter(Boolean);
}

/** Compare a rebuilt sentence with the original — case and end punctuation
 *  do not count, word order and every form do. */
export function sameSentence(expected: string[], given: string[]): boolean {
	const norm = (ws: string[]) =>
		ws
			.map((w) => w.toLocaleLowerCase("sk-SK").replace(/^[„“"'(]+|[,.;:!?„“"')]+$/g, ""))
			.filter(Boolean)
			.join(" ");
	return norm(expected) === norm(given);
}

/** Grade a listening rep. The learner hears the whole sentence, so typing
 *  the whole sentence is as right as typing only the missing word
 *  (dictation): case and punctuation never count, accents are "accents". */
export function gradeListen(item: Pick<LessonItem, "answer" | "sentence">, given: string, tag = "sk-SK"): "exact" | "accents" | "wrong" {
	const words = (s: string) =>
		s
			.normalize("NFC")
			.toLocaleLowerCase(tag)
			.split(/\s+/)
			.map((w) => w.replace(/^[„“"'(¿¡]+|[,.;:!?„“"')…]+$/gu, ""))
			.filter(Boolean);
	const g = words(given);
	if (g.length === 0) return "wrong";
	const target = g.length > 1 ? words(item.sentence) : words(item.answer);
	const a = target.join(" ");
	const b = g.join(" ");
	if (a === b) return "exact";
	if (foldDiacritics(a) === foldDiacritics(b)) return "accents";
	return "wrong";
}

/** The rhythm of a first lesson on a unit: recognise first, then produce,
 *  a word bank and a listening rep to vary the work. */
export const LESSON_PATTERN: ItemKind[] = ["choose", "type", "choose", "type", "build", "type", "listen", "type", "choose", "build", "listen", "type"];

/** Once a unit is known: production almost throughout. Picking a form from
 *  four trains recognising it; typing it trains producing it, and producing
 *  endings is the gap (reading is ahead of production). */
export const PRACTISED_PATTERN: ItemKind[] = ["type", "type", "choose", "type", "listen", "type", "build", "type", "type", "listen", "type", "type"];

/** Slots (by position) that take an item from another unit. */
const MIX_SLOTS: Record<"new" | "practised", number[]> = { new: [5, 9], practised: [2, 5, 8, 11] };

/** Units that are easy to confuse with each one: the mix comes from these
 *  first, so the learner has to read the trigger to choose the case. */
export const CONTRAST: Record<UnitId, UnitId[]> = {
	words: [],
	present: ["past"],
	"acc-fem": ["loc", "gen"],
	loc: ["acc-fem", "gen"],
	"acc-people": ["acc-fem", "gen"],
	gen: ["loc", "acc-people"],
	ins: ["loc", "gen"],
	adj: ["acc-fem", "loc"],
	past: ["present"],
	dat: ["loc", "gen"],
};

/** Ready when a unit has two lessons at 60% or better. */
export function unitStage(lessons: number, accuracy: number | null): "new" | "practised" {
	return lessons >= 2 && (accuracy ?? 0) >= 0.6 ? "practised" : "new";
}

/** The preposition before the blank, if it is one that picks a case. */
export function triggerOf(sentence: string, at: number): string | undefined {
	const w = wordBefore(sentence, at);
	return ALL_PREPS.has(w) ? w : undefined;
}

export function buildItem(c: Candidate, kind: ItemKind, pool: readonly string[], rand: () => number): LessonItem {
	const ex = c.entry.examples[c.index]!;
	const { answer, at } = ex.cloze!;
	const item: LessonItem = {
		id: `${c.entry.slug}#${c.index}`,
		kind,
		unit: c.unit,
		slug: c.entry.slug,
		lemma: c.entry.sk,
		gloss: c.entry.en,
		sentence: ex.sk,
		translation: ex.en,
		answer,
		before: ex.sk.slice(0, at),
		after: ex.sk.slice(at + answer.length),
	};
	const trigger = c.unit === "words" ? undefined : triggerOf(ex.sk, at);
	if (trigger) item.trigger = trigger;
	if (kind === "choose") item.options = formOptions(c.entry, answer, pool, rand);
	if (kind === "build") {
		const tokens = sentenceTokens(ex.sk);
		item.tokens = tokens;
		const extra = formOptions(c.entry, answer, pool, rand)
			.filter((o) => fold(o) !== fold(answer))
			.slice(0, 2);
		item.bank = shuffle([...tokens, ...extra], rand);
	}
	return item;
}

export interface LessonPlan {
	unit: UnitId;
	items: LessonItem[];
}

/**
 * Build one lesson. `recent` holds item ids from the last lessons: they are
 * skipped while fresher sentences remain. One sentence per word, so a
 * lesson never drills the same lemma twice.
 */
export function buildLesson(
	entries: readonly LexiconEntry[],
	unit: UnitId,
	opts: { seed: number; recent?: ReadonlySet<string>; length?: number; stage?: "new" | "practised"; mix?: readonly UnitId[] },
): LessonPlan {
	const rand = rng(opts.seed);
	const stage = opts.stage ?? "new";
	const length = opts.length ?? LESSON_PATTERN.length;
	const pattern = (stage === "practised" ? PRACTISED_PATTERN : LESSON_PATTERN).slice(0, length);
	const sourceFor = (u: UnitId) => {
		const top = candidatesFor(entries, u).slice(0, 160);
		const fresh = top.filter((c) => !opts.recent?.has(`${c.entry.slug}#${c.index}`));
		return { top, list: shuffle(fresh.length >= length ? fresh : top, rand) };
	};
	const main = sourceFor(unit);
	const mixes = (opts.mix ?? []).filter((u) => u !== unit).map(sourceFor).filter((m) => m.list.length > 0);
	const pool = main.top.map((c) => c.entry.examples[c.index]!.cloze!.answer);
	const used = new Set<string>();
	const items: LessonItem[] = [];
	pattern.forEach((kind, slot) => {
		// A word bank needs a short sentence; listening needs one worth hearing.
		const fits = (c: Candidate) => {
			const n = c.entry.examples[c.index]!.sk.split(/\s+/).length;
			return kind === "build" ? n >= 3 && n <= 7 : true;
		};
		const take = (list: Candidate[]) => list.find((c) => !used.has(c.entry.slug) && fits(c)) ?? list.find((c) => !used.has(c.entry.slug));
		const mix = MIX_SLOTS[stage].includes(slot) && mixes.length > 0 ? mixes[Math.floor(rand() * mixes.length)]! : null;
		const pick = (mix && take(mix.list)) || take(main.list);
		if (!pick) return;
		used.add(pick.entry.slug);
		const fromMix = mix !== null && pick.unit !== unit;
		const item = buildItem(pick, kind, fromMix ? mix.top.map((c) => c.entry.examples[c.index]!.cloze!.answer) : pool, rand);
		if (fromMix) item.mixed = true;
		items.push(item);
	});
	return { unit, items };
}

/** Blitz: choose-only reps across the given units, as many as a minute holds. */
export function buildBlitz(entries: readonly LexiconEntry[], units: readonly UnitId[], seed: number, count = 40): LessonPlan & { units: UnitId[] } {
	const rand = rng(seed);
	const per = units.map((u) => {
		const top = candidatesFor(entries, u).slice(0, 120);
		return { u, top, pool: top.map((c) => c.entry.examples[c.index]!.cloze!.answer) };
	});
	const items: LessonItem[] = [];
	const used = new Set<string>();
	for (let i = 0; i < count * 3 && items.length < count; i++) {
		const group = per[Math.floor(rand() * per.length)];
		if (!group || group.top.length === 0) continue;
		const c = group.top[Math.floor(rand() * group.top.length)]!;
		const id = `${c.entry.slug}#${c.index}`;
		if (used.has(id)) continue;
		used.add(id);
		items.push(buildItem(c, "choose", group.pool, rand));
	}
	return { unit: units[0] ?? "acc-fem", units: [...units], items };
}

// ─── Scoring, streaks, levels ──────────────────────────────────────────────

export type RepVerdict = "exact" | "accents" | "wrong";

export const XP_FOR: Record<ItemKind, number> = { choose: 5, type: 10, build: 10, listen: 12 };

/** XP for one rep: a typed answer earns more than a picked one; accents-only
 *  earns half, and so does a right answer on the second try (after the
 *  hint); a combo of 3+ adds 2 per step, capped. */
export function repXp(kind: ItemKind, verdict: RepVerdict, combo: number, assisted = false): number {
	if (verdict === "wrong") return 0;
	const base = verdict === "accents" || assisted ? Math.ceil(XP_FOR[kind] / 2) : XP_FOR[kind];
	const bonus = combo >= 3 ? Math.min(10, (combo - 2) * 2) : 0;
	return base + bonus;
}

export const LESSON_BONUS = 20;
export const PERFECT_BONUS = 15;

/** Lessons finished → the unit's level (0–5), the ring on the skill path. */
/** When a unit counts as complete: LESSONS_TO_COMPLETE finished lessons with
 *  at least COMPLETE_ACCURACY of the reps right, or twice that many lessons
 *  whatever the accuracy (so a unit can never trap the learner). The path
 *  ring fills toward this, and "Continue" is the first unit not yet done. */
export const LESSONS_TO_COMPLETE = 3;
export const COMPLETE_ACCURACY = 0.8;
export function unitDone(lessons: number, accuracy: number | null): boolean {
	if (lessons >= LESSONS_TO_COMPLETE * 2) return true;
	return lessons >= LESSONS_TO_COMPLETE && (accuracy ?? 0) >= COMPLETE_ACCURACY;
}
/** 0..1 toward completion: lessons out of LESSONS_TO_COMPLETE; a unit at the
 *  count but under the accuracy bar holds just short of full. */
export function unitProgress(lessons: number, accuracy: number | null): number {
	if (unitDone(lessons, accuracy)) return 1;
	return Math.min(lessons / LESSONS_TO_COMPLETE, 0.9);
}

export const LEVEL_STEPS = [1, 3, 6, 10, 15];
export function unitLevel(lessons: number): number {
	return LEVEL_STEPS.filter((s) => lessons >= s).length;
}
/** Progress toward the next level, 0..1. */
export function levelProgress(lessons: number): number {
	const level = unitLevel(lessons);
	if (level >= LEVEL_STEPS.length) return 1;
	const lo = level === 0 ? 0 : LEVEL_STEPS[level - 1]!;
	const hi = LEVEL_STEPS[level]!;
	return (lessons - lo) / (hi - lo);
}

function addDays(key: string, n: number): string {
	const d = new Date(`${key}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/**
 * The streak: consecutive active days ending today (or yesterday, while
 * today is still open). One missed day is forgiven as a rest day when the
 * six days before it were all active — a streak should reward the habit,
 * not punish a single off day.
 */
export function streakOf(activeDays: ReadonlySet<string>, today: string): { days: number; restUsed: boolean; activeToday: boolean } {
	const activeToday = activeDays.has(today);
	let cursor = activeToday ? today : addDays(today, -1);
	let days = 0;
	let restUsed = false;
	for (let guard = 0; guard < 3660; guard++) {
		if (activeDays.has(cursor)) {
			days++;
			cursor = addDays(cursor, -1);
			continue;
		}
		const before = addDays(cursor, -1);
		let run = 0;
		for (let k = 0; k < 6; k++) if (activeDays.has(addDays(before, -k))) run++;
		if (days > 0 && run === 6 && !restUsed) {
			restUsed = true;
			cursor = before;
			continue;
		}
		break;
	}
	return { days, restUsed, activeToday };
}

/** Learner level from total XP: each level costs 50 XP more than the last. */
export function xpLevel(xp: number): { level: number; into: number; span: number } {
	let level = 1;
	let need = 100;
	let left = Math.max(0, xp);
	while (left >= need) {
		left -= need;
		level++;
		need += 50;
	}
	return { level, into: left, span: need };
}
