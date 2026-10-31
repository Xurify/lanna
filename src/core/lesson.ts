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
import { WORD_CLUSTERS, WORD_CLUSTER_IDS, type WordClusterId } from "./word-clusters.ts";
import { chapterPairs, pairMembers, pairsWithSentences, type PairDef, type PairSentence } from "./pairs.ts";

// ─── Units ──────────────────────────────────────────────────────────────────

/** The grammar drills, in teaching order (the curriculum module groups
 *  them into chapters with the vocabulary and tutor units). */
export const GRAMMAR_UNIT_IDS = [
	"words",
	"present",
	"acc-fem",
	"loc",
	"acc-people",
	"gen",
	"ins",
	"adj",
	"past",
	"dat",
	"modal-inf",
	"kam-kde",
	"present-ujem",
	"present-em",
	"plural",
	"numbers",
	"cond",
	"core-verbs",
	"motion",
	"clitics",
	"adj-cases",
	"cases-mix",
	"verbs-mix",
] as const;

/** Vocabulary by frequency band (rank within the part of speech). */
export const BAND_UNIT_IDS = ["words-300", "words-600", "words-1000", "words-1500", "words-2000", "words-3000"] as const;

/** The contrast-pairs units (Dvojičky), one per chapter that teaches a
 *  pair (curriculum/slovak/pairs.json). Pinned as a literal so UnitId stays
 *  a literal union; tests/pairs.test.ts checks it against the file. */
export const PAIR_UNIT_IDS = [
	"pairs-town",
	"pairs-family",
	"pairs-everyday",
	"pairs-health",
	"pairs-shopping",
	"pairs-plans",
	"pairs-moving",
	"pairs-people",
	"pairs-stories",
	"pairs-opinions",
] as const;

export type UnitId = (typeof GRAMMAR_UNIT_IDS)[number] | (typeof BAND_UNIT_IDS)[number] | (typeof PAIR_UNIT_IDS)[number] | WordClusterId;

export type UnitKind = "grammar" | "words" | "pairs";

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
	/** "words": the blank is the word itself, so the hint is its meaning and
	 *  the distractors are other words; default "grammar": the blank is a
	 *  form of a word the learner is shown. */
	kind?: UnitKind;
	/** words: the lemmas of one cluster (src/core/word-clusters.ts). */
	lemmas?: readonly string[];
	/** words: a frequency band [from, to) by rank within the part of speech. */
	band?: readonly [number, number];
	/** A unit drawn from other units' examples (interleaved review). */
	union?: readonly UnitId[];
	/** The same word may come twice in a lesson (units over a few verbs). */
	repeat?: boolean;
	/** Word-order units: the reps rebuild the sentence. */
	pattern?: "build";
}

const WORD_RULE = "Learn the word with its sentence: the sentence is what you will hear.";

const CLUSTER_UNITS: UnitInfo[] = WORD_CLUSTER_IDS.map((id) => {
	const c = WORD_CLUSTERS[id];
	return { id, kind: "words", title: `Words: ${c.title}`, tagline: c.tagline, glyph: c.glyph, rule: WORD_RULE, node: `n_seed_${id.replace(/-/g, "_")}`, lemmas: c.lemmas, repeat: true };
});

const BAND_DEFS: Array<[UnitId, readonly [number, number], string, string]> = [
	["words-300", [150, 300], "Words: the next 300", "The commonest words after the first 150"],
	["words-600", [300, 600], "Words: up to 600", "Everyday words you will meet daily"],
	["words-1000", [600, 1000], "Words: up to 1,000", "Enough for most conversations"],
	["words-1500", [1000, 1500], "Words: up to 1,500", "The words of simple news and stories"],
	["words-2000", [1500, 2000], "Words: up to 2,000", "Opinions, work, feelings in detail"],
	["words-3000", [2000, 3000], "Words: up to 3,000", "Toward reading anything"],
];
const BAND_UNITS: UnitInfo[] = BAND_DEFS.map(([id, band, title, tagline]) => ({ id, band, title, tagline, kind: "words", glyph: "book-open", rule: WORD_RULE }));

/** One unit per chapter that teaches a pair: the reps choose between the
 *  twins (buildPairsLesson), the rule and bridge are per pair, carried by
 *  the item. */
const PAIR_UNITS: UnitInfo[] = PAIR_UNIT_IDS.map((id) => ({
	id,
	kind: "pairs" as const,
	title: "Dvojičky",
	tagline: chapterPairs(id.slice("pairs-".length)).map((p) => `${p.a} / ${p.b}`).join(" · "),
	glyph: "git-compare",
	rule: "Read the sentence and pick the twin it really uses — which of the two words fits.",
	repeat: true,
}));

/** The path, in teaching order. */
export const UNITS: UnitInfo[] = [
	{ id: "words", kind: "words", title: "First words", tagline: "Everyday words in real sentences", glyph: "book", rule: WORD_RULE },
	{ id: "present", title: "I, you, we", tagline: "Verbs in the present: -ám, -ím", glyph: "users", rule: "Present endings: ja -m, ty -š, on/ona -, my -me, vy -te, oni -ú/-ia/-jú.", node: "n_seed_v_present", bridge: "Like Estonian: my robíme ≈ me teeme, vy robíte ≈ te teete. Ja robím ≈ ma teen." },
	{ id: "acc-fem", title: "Objects: -a → -u", tagline: "What you have, see, drink", glyph: "coffee", rule: "A feminine noun in -a takes -u as the direct object: Pijem kávu. Mám sestru.", node: "n_seed_acc_fem", bridge: "The object case, like Estonian osastav: Pijem kávu ≈ Joon kohvi." },
	{ id: "loc", title: "Where? v, na, o", tagline: "Kde? The locative", glyph: "map-pin", rule: "After v / na / o / po / pri for place or topic, the noun takes the locative: v meste, na stole, o škole.", node: "n_seed_loc", bridge: "Like the Estonian place cases: v meste ≈ linnas (seesütlev), na stole ≈ laual (alalütlev)." },
	{ id: "acc-people", title: "People as objects", tagline: "Vidím brata", glyph: "user-round", rule: "A masculine person as the object takes -a: Mám brata. Poznáš učiteľa?", node: "n_seed_acc_anim", bridge: "A male person as the object, like osastav: Vidím brata ≈ Näen venda." },
	{ id: "gen", title: "From, to, without", tagline: "do, z, od, bez + genitive", glyph: "door-open", rule: "do / z / od / bez / u / okolo take the genitive: do školy, z práce, bez cukru.", node: "n_seed_gen", bridge: "do školy ≈ kooli (sisseütlev), zo školy ≈ koolist (seestütlev), bez cukru ≈ suhkruta (ilmaütlev)." },
	{ id: "ins", title: "With: s, pred, za", tagline: "The instrumental", glyph: "handshake", rule: "s / pred / za / nad / pod / medzi (for place) take the instrumental: s kamarátom, pred domom, so sestrou.", node: "n_seed_ins", bridge: "Like Estonian kaasaütlev -ga: s kamarátom ≈ sõbraga, autobusom ≈ bussiga." },
	{ id: "adj", title: "Describing words", tagline: "Adjectives agree: -ý, -á, -é", glyph: "palette", rule: "The adjective copies the noun's gender and number: nový dom, nová kniha, nové mesto, noví ľudia.", node: "n_seed_adj_agree", bridge: "Adjectives agree, as in Estonian: nová kniha → nové knihy ≈ uus raamat → uued raamatud." },
	{ id: "past", title: "What happened", tagline: "Past tense: -l, -la, -lo, -li", glyph: "history", rule: "Past tense = -l / -la / -lo / -li by the subject's gender and number, plus som/si for I/you: Robil som. Robila si.", node: "n_seed_v_past", bridge: "Built like the Estonian perfect: an -l form plus 'be' (robil som ~ olen teinud), with som/si only for I and you." },
	{ id: "dat", title: "To and for: k", tagline: "k, proti, vďaka + dative", glyph: "gift", rule: "k / ku / proti / vďaka / kvôli take the dative: k bratovi, ku škole, vďaka mame.", node: "n_seed_dat", bridge: "Like Estonian alaleütlev -le: k bratovi ≈ vennale, dal som mame ≈ andsin emale." },
	{ id: "modal-inf", title: "Want, can, must + verb", tagline: "chcem ísť, musím pracovať", glyph: "key", rule: "After chcieť, môcť, musieť, vedieť, smieť (and budem) the second verb stays in the infinitive -ť: Chcem ísť. Musím pracovať.", node: "n_seed_modals", bridge: "As in Estonian tahan minna, pean töötama: the second verb does not conjugate. Slovak has one infinitive where Estonian picks -da or -ma." },
	{ id: "kam-kde", title: "Kam? or Kde?", tagline: "v / na + accusative or locative", glyph: "signpost", rule: "v / na for a destination (kam?) take the accusative: idem na stanicu, do mesta; for a place (kde?) the locative: som na stanici, v meste.", node: "n_seed_kam_kde", bridge: "Exactly the Estonian pair jaama (sisseütlev, kuhu?) and jaamas (seesütlev, kus?)." },
	{ id: "present-ujem", title: "-ovať verbs: -ujem", tagline: "pracovať → pracujem", glyph: "briefcase", rule: "Verbs in -ovať swap -ova- for -uj-: pracujem, pracuješ, pracuje, pracujeme, pracujete, pracujú.", node: "n_seed_v_ujem", bridge: "A fixed stem change, like õppima → õpin: learn the stem once; the endings are the usual -m, -š, -, -me, -te, -ú." },
	{ id: "present-em", title: "-em / -iem verbs", tagline: "písať → píšem, niesť → nesiem", glyph: "pen", rule: "The -em class: píšem, píšeš, píše, píšeme, píšete, píšu; nesiem, nesieš, nesie … nesú. The stem often changes (písať → píš-).", node: "n_seed_v_em", bridge: "Like Estonian verbs whose stem shifts between forms (tulema → tulen): memorise the ja form and the rest follows." },
	{ id: "plural", title: "More than one", tagline: "domy, ženy, mestá, bratia", glyph: "copy", rule: "Nominative plural: masculine things -y (domy), feminine -y / -e (ženy, ulice), neuter -á (mestá), male people -i / -ia / -ovia (študenti, bratia, synovia).", node: "n_seed_plural_nom", bridge: "Estonian has one plural marker -d (majad, naised); Slovak picks the ending by gender, and male people get their own." },
	{ id: "numbers", title: "Counting things", tagline: "dve kávy, päť káv", glyph: "hash", rule: "After 2, 3, 4 the noun is nominative plural (dve kávy, tri domy); after 5 and up, and after veľa / málo / koľko, it is genitive plural (päť káv, veľa domov, koľko ľudí).", node: "n_seed_numerals", bridge: "Estonian puts every counted noun in the singular partitive (viis kohvi); Slovak counts 2–4 as a plural and 5+ as 'of' (genitive), like 'a lot of'." },
	{ id: "cond", title: "Would: by + -l", tagline: "Chcel by som…", glyph: "wand", rule: "The conditional is the past -l form plus by (with som / si for I / you): Chcel by som kávu. Išli by sme. Keby som mal čas…", node: "n_seed_conditional", bridge: "Estonian puts -ks on the verb (tahaksin, läheksime); Slovak keeps the -l form and adds the little word by in second position." },
	{ id: "core-verbs", title: "Irregular core verbs", tagline: "mať, ísť, chcieť, môcť, vedieť, jesť", glyph: "star", rule: "The commonest verbs follow no pattern: mám / máš / má, idem / ideš / ide, chcem / chceš / chce, môžem / môžeš / môže, viem / vieš / vie, jem / ješ / je.", node: "n_seed_v_irregular", bridge: "Like olema, minema, tulema in Estonian, which are irregular too: learn these by heart.", repeat: true },
	{ id: "motion", title: "Going: ísť vs chodiť", tagline: "idem (now) vs chodím (regularly)", glyph: "footprints", rule: "ísť = one trip, now or planned (idem do školy); chodiť = repeatedly, as a habit (chodím do školy). Prefixes add direction: prísť (arrive), odísť (leave).", node: "n_seed_motion", bridge: "Estonian uses one verb (lähen kooli / käin koolis); Slovak splits the single trip from the habit.", repeat: true },
	{ id: "clitics", title: "Little words in second place", tagline: "sa, som, mi, ho… always second", glyph: "move-horizontal", rule: "Short unstressed words (sa, si, som, si, mi, ti, mu, ho, ju, by) sit in second position in the clause: Včera som sa učil. Dal mi ho.", node: "n_seed_clitics", bridge: "Estonian has no such slot: in Slovak these words come right after the first stressed phrase, whatever else moves.", pattern: "build" },
	{ id: "adj-cases", title: "Adjectives in other cases", tagline: "v novej škole, s dobrým kamarátom", glyph: "paintbrush", rule: "The adjective takes its noun's case: -ej (fem. G/D/L), -ú (fem. A), -ou (fem. I), -ého / -ému / -om / -ým (masc. and neut.), -ých / -ým / -ými (plural).", node: "n_seed_adj_cases", bridge: "As in Estonian, where the adjective follows the noun into every case (uues koolis, hea sõbraga); only the endings differ by gender." },
	{ id: "cases-mix", title: "All six cases", tagline: "Mixed: read the trigger, pick the case", glyph: "shuffle", rule: "Read the word before the blank: the preposition or the verb decides the case.", node: "n_seed_case_system", union: ["acc-fem", "loc", "acc-people", "gen", "ins", "dat", "kam-kde", "plural", "numbers"] },
	{ id: "verbs-mix", title: "All verb forms", tagline: "Mixed: present, past, would", glyph: "dices", rule: "Read the time words and the subject: they decide tense, person and whether by is needed.", node: "n_seed_v_present", union: ["present", "present-em", "present-ujem", "past", "cond", "core-verbs", "motion", "modal-inf"] },
	...CLUSTER_UNITS,
	...BAND_UNITS,
	...PAIR_UNITS,
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
	return w.toLowerCase().replace(/^[„“"'(]+|[,.;:!?„“"')]+$/g, "");
}

const PLURAL_MARKERS = new Set(["sú", "dve", "tri", "štyri", "tieto", "moje", "tvoje", "naše", "vaše", "všetky", "mnohé", "niektoré", "boli", "obe", "oba", "aké", "také", "nové", "staré", "dobré", "malé", "veľké"]);
const COUNT_WORDS = /^(dva|dve|tri|štyri|dvaja|traja|štyria|päť|šesť|sedem|osem|deväť|desať|jedenásť|dvanásť|pätnásť|dvadsať|tridsať|päťdesiat|sto|tisíc|veľa|málo|koľko|niekoľko|pár|mnoho|dosť|trochu|viac|menej|\d+)$/;
const MODAL_FORMS = /^(ne)?(môžem|môžeš|môže|môžeme|môžete|môžu|chcem|chceš|chce|chceme|chcete|chcú|musím|musíš|musí|musíme|musíte|musia|viem|vieš|vie|vieme|viete|vedia|smiem|smieš|smie|smieme|smiete|smú|budem|budeš|bude|budeme|budete|budú)$/;
const CORE_VERBS = new Set(["byť", "mať", "ísť", "chcieť", "môcť", "vedieť", "jesť", "piť", "musieť", "spať", "stáť", "vidieť", "dať", "povedať", "smieť"]);
const MOTION_VERBS = new Set(["ísť", "chodiť", "prísť", "odísť", "prichádzať", "odchádzať", "prejsť", "vojsť", "vyjsť", "cestovať", "bežať", "letieť", "niesť", "nosiť", "viezť", "voziť"]);
const CLITICS = new Set(["sa", "si", "som", "ma", "mi", "ťa", "ti", "ho", "mu", "ju", "jej", "nás", "vás", "ich", "im", "by", "sme", "ste"]);
const CLEAN = /^[„“"'(]+|[,.;:!?„“"')]+$/g;

/** Nominative plural, read from the ending and the gender; only the
 *  unambiguous shapes (a feminine -y is also the genitive singular, so it
 *  needs a plural marker before it). */
function isNomPlural(lemma: string, gender: string, answer: string, prev: string): boolean {
	if (gender === "masculine-inanimate") return answer === `${lemma}y`;
	if (gender === "neuter") return lemma.endsWith("o") && answer === `${lemma.slice(0, -1)}á`;
	if (gender === "masculine-animate")
		return answer === `${lemma}i` || answer === `${lemma}ia` || answer === `${lemma}ovia` || (lemma.endsWith("k") && answer === `${lemma.slice(0, -1)}ci`) || (lemma.endsWith("h") && answer === `${lemma.slice(0, -1)}si`);
	if (gender === "feminine") return lemma.endsWith("a") && answer === `${lemma.slice(0, -1)}y` && PLURAL_MARKERS.has(prev);
	return false;
}

/** Every grammar unit one cloze example drills (an example can serve
 *  several: "v meste" is the locative and the kam/kde choice). Pure. */
export function classifyAll(entry: LexiconEntry, example: { sk: string; cloze?: { answer: string; at: number } }): UnitId[] {
	const out: UnitId[] = [];
	const c = example.cloze;
	if (!c) return out;
	const n = example.sk.split(/\s+/).length;
	if (n > MAX_WORDS) return out;
	const lemma = entry.sk.toLowerCase();
	const answer = c.answer.toLowerCase();
	const prev = wordBefore(example.sk, c.at);
	if (entry.cat === "Nouns") {
		if (answer === lemma) return out;
		const gender = entry.gender ?? "";
		const femAcc = gender === "feminine" && lemma.endsWith("a") && answer === `${lemma.slice(0, -1)}u`;
		if (COUNT_WORDS.test(prev)) out.push("numbers");
		if (GEN_PREPS.has(prev)) out.push("gen");
		else if (DAT_PREPS.has(prev)) out.push("dat");
		else if (INS_PREPS.has(prev)) {
			if (/(ou|om|ami|mi|ím)$/.test(answer)) out.push("ins");
		} else if (LOC_PREPS.has(prev)) {
			if (femAcc) out.push("kam-kde");
			else {
				out.push("loc");
				if (prev === "v" || prev === "vo" || prev === "na") out.push("kam-kde");
			}
		} else if (femAcc) out.push("acc-fem");
		else if (gender === "masculine-animate" && answer === `${lemma}a`) out.push("acc-people");
		if (!ALL_PREPS.has(prev) && isNomPlural(lemma, gender, answer, prev)) out.push("plural");
		return out;
	}
	if (entry.cat === "Verbs") {
		const toks = example.sk.split(/\s+/).map((t) => t.toLowerCase().replace(CLEAN, ""));
		if (answer === lemma) {
			if (MODAL_FORMS.test(prev)) out.push("modal-inf");
		} else {
			const past = /(l|la|lo|li)$/.test(answer);
			if (past) out.push(toks.some((t) => t === "by" || t === "keby" || t === "aby" || t === "kiežby") ? "cond" : "past");
			else {
				if (CORE_VERBS.has(lemma)) out.push("core-verbs");
				else if (lemma.endsWith("ovať") && /uj(em|eš|e|eme|ete|ú)$/.test(answer)) out.push("present-ujem");
				else if (/(iem|ieš|ie|ieme|iete|em|eš|e|eme|ete|ú)$/.test(answer) && !/(ám|áš|á|áme|áte|ajú|ím|íš|í|íme|íte|ia)$/.test(answer)) out.push("present-em");
				else out.push("present");
				if (MOTION_VERBS.has(lemma)) out.push("motion");
			}
		}
		if (n >= 3 && n <= 7 && toks.length > 1 && CLITICS.has(toks[1]!)) out.push("clitics");
		return out;
	}
	if (entry.cat === "Adjectives" && answer !== lemma) out.push(/(ej|ou|ého|ému|om|ých|ým|ými|ú|iu)$/.test(answer) ? "adj-cases" : "adj");
	return out;
}

/** The main unit one cloze example drills, or null. Pure, so tests pin it. */
export function classifyExample(entry: LexiconEntry, example: { sk: string; cloze?: { answer: string; at: number } }): UnitId | null {
	return classifyAll(entry, example)[0] ?? null;
}

/** "First words": the beginner set in its dictionary form. */
function isFirstWord(entry: LexiconEntry, example: { sk: string; cloze?: { answer: string } }): boolean {
	if (!example.cloze || example.cloze.answer.length < 3) return false;
	if (example.sk.split(/\s+/).length > 8) return false;
	if (entry.origin !== "curated" && (entry.rank ?? Infinity) > 150) return false;
	return example.cloze.answer.toLowerCase() === entry.sk.toLowerCase();
}

const WORD_POS = new Set(["Nouns", "Verbs", "Adjectives", "Adverbs"]);

/** A frequency band: the word in its dictionary form, in a short sentence. */
function inBand(entry: LexiconEntry, band: readonly [number, number], example: { sk: string; cloze?: { answer: string } }): boolean {
	if (!example.cloze || example.cloze.answer.length < 3 || !WORD_POS.has(entry.cat)) return false;
	if (entry.rank === undefined || entry.rank < band[0] || entry.rank >= band[1]) return false;
	if (example.sk.split(/\s+/).length > 9) return false;
	return example.cloze.answer.toLowerCase() === entry.sk.toLowerCase();
}

/** A cluster word in any short sentence; the dictionary form comes first
 *  (see candidatesFor), inflected forms only fill out a small cluster. */
function inCluster(lemmas: ReadonlySet<string>, entry: LexiconEntry, example: { sk: string; cloze?: { answer: string } }): boolean {
	if (!example.cloze || !lemmas.has(entry.sk.toLowerCase())) return false;
	return example.sk.split(/\s+/).length <= 9;
}

// ─── Items ──────────────────────────────────────────────────────────────────

/** meaning: the whole sentence, spoken, with the target form marked; the
 *  learner picks what it means. Input before output (comprehension
 *  precedes production): the first two reps of a new unit. */
export type ItemKind = "meaning" | "choose" | "type" | "build" | "listen";

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
	/** choose: four forms including the answer; meaning: three English
	 *  meanings including the translation. */
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
	/** What to show as the clue: the word's meaning for a vocabulary rep (the
	 *  blank is the word itself), else the dictionary form. */
	hint: string;
	/** Frequency rank within its part of speech (lower = commoner). */
	rank?: number;
	/** The dictionary's category, for the rank's label ("#68 of verbs"). */
	cat?: string;
	gender?: string;
	/** The answer's form in plain words: "he / she / it form of dávať",
	 *  "accusative of káva". */
	form?: string;
	/** pairs: the contrast pair behind this rep. The form in the sentence is
	 *  the pair member's (item.form); the rule and the Estonian bridge are
	 *  the pair's own, shown after a miss in place of the unit's. */
	pair?: { id: string; rule: string; bridge: string };
	/** The review deck's memory of this word, attached by the server. */
	known?: WordKnown | null;
}

/** What the review deck knows about a word (the client's "how well you
 *  know this" line after a right answer). */
export interface WordKnown {
	state: "new" | "learning" | "review";
	due: string;
	reps: number;
}

const CASE_OF_UNIT: Partial<Record<UnitId, string>> = {
	"acc-fem": "accusative",
	"acc-people": "accusative",
	loc: "locative",
	gen: "genitive",
	ins: "instrumental",
	dat: "dative",
};

/** The answer's form in plain words, from the ending and the unit: who is
 *  doing a verb, which case a noun is in. Undefined when nothing safe can
 *  be said (an adverb, a phrase, a form the unit does not name). */
export function describeForm(entry: Pick<LexiconEntry, "sk" | "pos" | "cat" | "forms" | "gender">, answer: string, unit: UnitId): string | undefined {
	const isVerb = entry.pos === "verb" || entry.cat === "Verbs";
	const a = answer.toLowerCase();
	if (a === entry.sk.toLowerCase()) return undefined;
	// A verb form the dictionary lists, or any form in a verb unit (the
	// dictionary's form lists are incomplete for prefixed verbs).
	const verbUnit = /^(present|past|cond|core-verbs|motion|verbs-mix)/.test(unit);
	if (isVerb && ((entry.forms ?? []).some((f) => f.toLowerCase() === a) || verbUnit)) {
		const past = a.endsWith("li") ? "they" : a.endsWith("la") ? "she" : a.endsWith("lo") ? "it" : a.endsWith("l") ? "he" : null;
		if (past) return `${past} (past) form of ${entry.sk}`;
		const who = a.endsWith("me") ? "we" : a.endsWith("te") ? "you (plural)" : a.endsWith("m") ? "I" : a.endsWith("š") ? "you" : /(ú|ia|jú|u)$/.test(a) ? "they" : "he / she / it";
		return `${who} form of ${entry.sk}`;
	}
	const kase = CASE_OF_UNIT[unit];
	if (kase && !isVerb) return `${kase} of ${entry.sk}${entry.gender ? ` (${entry.gender})` : ""}`;
	return undefined;
}

/** A frequency rank in words: how often the learner will meet this word. */
export function rankLabel(rank: number | undefined, cat?: string): string | undefined {
	if (rank === undefined) return undefined;
	const tier = rank <= 200 ? "very common" : rank <= 800 ? "common" : rank <= 2000 ? "fairly common" : "less common";
	const of = cat ? ` · #${rank} of ${cat.toLowerCase()}` : "";
	return `${tier}${of}`;
}

export interface Candidate {
	entry: LexiconEntry;
	index: number;
	unit: UnitId;
}

/** Every example in the lexicon that drills `unit`, commonest words first. */
export function candidatesFor(entries: readonly LexiconEntry[], unit: UnitId): Candidate[] {
	const info = unitInfo(unit);
	const out: Candidate[] = [];
	const lemmas = info.lemmas ? new Set(info.lemmas.map((l) => l.toLowerCase())) : null;
	const union = info.union ? new Set<UnitId>(info.union) : null;
	for (const entry of entries) {
		entry.examples.forEach((ex, index) => {
			if (ex.rejected) return;
			if (unit === "words") {
				if (isFirstWord(entry, ex)) out.push({ entry, index, unit });
			} else if (lemmas) {
				if (inCluster(lemmas, entry, ex)) out.push({ entry, index, unit });
			} else if (info.band) {
				if (inBand(entry, info.band, ex)) out.push({ entry, index, unit });
			} else if (union) {
				const hit = classifyAll(entry, ex).find((u) => union.has(u));
				if (hit) out.push({ entry, index, unit: hit });
			} else if (classifyAll(entry, ex).includes(unit)) out.push({ entry, index, unit });
		});
	}
	// Commoner words first, in bands of 300 ranks; inside a band, shorter
	// sentences first — a common word in a long legal sentence is not easy.
	// A cluster unit puts the dictionary form first: that is the word to learn.
	const band = (e: LexiconEntry) => (e.origin === "curated" ? -1 : Math.floor((e.rank ?? 1e9) / 300));
	const words = (c: Candidate) => c.entry.examples[c.index]!.sk.split(/\s+/).length;
	const inflected = (c: Candidate) => (lemmas && c.entry.examples[c.index]!.cloze!.answer.toLowerCase() !== c.entry.sk.toLowerCase() ? 1 : 0);
	return out.sort(
		(a, b) =>
			inflected(a) - inflected(b) ||
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

export function shuffle<T>(list: readonly T[], rand: () => number): T[] {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

const fold = (s: string) => foldDiacritics(s.toLowerCase());

function matchCase(form: string, like: string): string {
	const capital = like.charAt(0) !== like.charAt(0).toLowerCase();
	return capital ? form.charAt(0).toLocaleUpperCase("sk-SK") + form.slice(1) : form.toLowerCase();
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
			.map((w) => w.toLowerCase().replace(/^[„“"'(]+|[,.;:!?„“"')]+$/g, ""))
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
/** A new unit meets the form before it is asked for it: two reps that only
 *  ask what the sentence means (spoken, form marked), then recognition,
 *  then production. */
export const LESSON_PATTERN: ItemKind[] = ["meaning", "meaning", "choose", "type", "build", "type", "listen", "type", "choose", "build", "listen", "type"];

/** Once a unit is known: production almost throughout. Picking a form from
 *  four trains recognising it; typing it trains producing it, and producing
 *  endings is the gap (reading is ahead of production). */
export const PRACTISED_PATTERN: ItemKind[] = ["type", "type", "choose", "type", "listen", "type", "build", "type", "type", "listen", "type", "type"];

/** Once a unit is complete (unitDone): production only. No choose rep
 *  (recognition is done teaching), more of the lesson from the units it
 *  is confused with (see MIX_SLOTS), and the player hides the translation
 *  until the answer — desirable difficulties (docs/research/
 *  desirable-difficulties.md), difficulty that rises with mastery. */
export const STRONG_PATTERN: ItemKind[] = ["type", "type", "build", "type", "listen", "type", "type", "build", "type", "listen", "type", "type"];

/** The placement drill (src/core/onboarding.ts): two reps a unit that
 *  measure, so they ask for the form — recognise it, then produce it. */
export const PLACEMENT_PATTERN: ItemKind[] = ["choose", "type"];

/** Word-order units: rebuild the sentence, with a listening rep to vary it. */
export const BUILD_PATTERN: ItemKind[] = ["build", "build", "listen", "build", "build", "build", "listen", "build", "build", "build", "listen", "build"];

/** Slots (by position) that take an item from another unit. */
const MIX_SLOTS: Record<UnitStage, number[]> = { new: [5, 9], practised: [2, 5, 8, 11], strong: [1, 3, 5, 7, 9, 11] };

/** Units that are easy to confuse with each one: the mix comes from these
 *  first, so the learner has to read the trigger to choose the case. */
export const CONTRAST: Partial<Record<UnitId, UnitId[]>> = {
	present: ["past", "present-em", "present-ujem"],
	"acc-fem": ["loc", "gen"],
	loc: ["acc-fem", "gen"],
	"acc-people": ["acc-fem", "gen"],
	gen: ["loc", "acc-people"],
	ins: ["loc", "gen"],
	adj: ["acc-fem", "loc"],
	past: ["present", "cond"],
	dat: ["loc", "gen"],
	"modal-inf": ["present"],
	"kam-kde": ["loc", "acc-fem"],
	"present-ujem": ["present", "present-em"],
	"present-em": ["present", "present-ujem"],
	plural: ["gen", "acc-fem"],
	numbers: ["gen", "plural"],
	cond: ["past"],
	"core-verbs": ["present", "motion"],
	motion: ["core-verbs", "present"],
	"adj-cases": ["adj", "loc"],
};

export type UnitStage = "new" | "practised" | "strong";

/** Practised when a unit has two lessons at 60% or better; strong once it
 *  is complete (unitDone). Each stage asks for more: see LESSON_PATTERN,
 *  PRACTISED_PATTERN, STRONG_PATTERN and MIX_SLOTS. */
export function unitStage(lessons: number, accuracy: number | null): UnitStage {
	if (unitDone(lessons, accuracy)) return "strong";
	return lessons >= 2 && (accuracy ?? 0) >= 0.6 ? "practised" : "new";
}

/** The preposition before the blank, if it is one that picks a case. */
export function triggerOf(sentence: string, at: number): string | undefined {
	const w = wordBefore(sentence, at);
	return ALL_PREPS.has(w) ? w : undefined;
}

/** The first sense of a gloss: "to speak; to talk" → "to speak". */
export function shortGloss(en: string): string {
	return (en.split(";")[0] ?? en).replace(/\s*\((im)?perfective\)\s*$/, "").trim();
}

/** For a vocabulary rep: three other words of the unit (meaning distractors),
 *  so the choice is about the word, not its ending. `pool` holds the unit's
 *  dictionary forms; the word's own forms never appear. */
export function wordOptions(answer: string, lemma: string, pool: readonly string[], rand: () => number): string[] {
	const seen = new Set([fold(answer), fold(lemma)]);
	const picks: string[] = [];
	for (const f of shuffle([...pool], rand)) {
		if (picks.length >= 3) break;
		const k = fold(f);
		if (!f || seen.has(k)) continue;
		seen.add(k);
		picks.push(matchCase(f, answer));
	}
	return shuffle([answer, ...picks], rand);
}

/** Three meanings for a meaning rep: the sentence's own translation and
 *  two others of similar length from the unit, so length gives nothing
 *  away. (The Listen task's version, with a wider pool: core/listen.ts.) */
export function meaningChoices(translation: string, pool: readonly string[], rand: () => number): string[] {
	const own = translation.trim();
	const others = [...new Set(pool.map((p) => p.trim()).filter((p) => p && p.toLowerCase() !== own.toLowerCase()))];
	const near = shuffle(others, rand)
		.sort((a, b) => Math.abs(a.length - own.length) - Math.abs(b.length - own.length))
		.slice(0, 6);
	return shuffle([own, ...shuffle(near, rand).slice(0, 2)], rand);
}

export function buildItem(c: Candidate, kind: ItemKind, pool: readonly string[], rand: () => number): LessonItem {
	const ex = c.entry.examples[c.index]!;
	const { answer, at } = ex.cloze!;
	const info = unitInfo(c.unit);
	const vocabulary = info.kind === "words" || c.unit === "modal-inf";
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
		hint: vocabulary ? shortGloss(c.entry.en) : c.entry.sk,
	};
	if (c.entry.rank !== undefined) item.rank = c.entry.rank;
	if (c.entry.cat) item.cat = c.entry.cat;
	if (c.entry.gender) item.gender = c.entry.gender;
	const form = describeForm(c.entry, answer, c.unit);
	if (form) item.form = form;
	const trigger = vocabulary ? undefined : triggerOf(ex.sk, at);
	if (trigger) item.trigger = trigger;
	const options = () => (info.kind === "words" ? wordOptions(answer, c.entry.sk, pool, rand) : formOptions(c.entry, answer, pool, rand));
	if (kind === "choose") item.options = options();
	if (kind === "build") {
		const tokens = sentenceTokens(ex.sk);
		item.tokens = tokens;
		const extra = options()
			.filter((o) => fold(o) !== fold(answer))
			.slice(0, 2);
		item.bank = shuffle([...tokens, ...extra], rand);
	}
	return item;
}

export interface LessonPlan {
	unit: UnitId;
	items: LessonItem[];
	/** How far the learner is with the unit; the player hides the
	 *  translation before the answer from "practised" on. */
	stage?: UnitStage;
	/** The languages the hints show a bridge in (from the learner's profile;
	 *  src/core/unit-bridges.ts). Absent on a plan built without a profile. */
	bridges?: Array<"et" | "fi" | "ru" | "de">;
}

/**
 * Build one lesson. `recent` holds item ids from the last lessons: they are
 * skipped while fresher sentences remain. One sentence per word, so a
 * lesson never drills the same lemma twice — except in a unit over a
 * handful of words (byť, the core verbs, a word cluster), where the same
 * word may come back in another sentence.
 */
export function buildLesson(
	entries: readonly LexiconEntry[],
	unit: UnitId,
	opts: { seed: number; recent?: ReadonlySet<string>; length?: number; stage?: UnitStage; mix?: readonly UnitId[]; pattern?: readonly ItemKind[] },
): LessonPlan {
	const rand = rng(opts.seed);
	const info = unitInfo(unit);
	const stage = opts.stage ?? "new";
	const length = opts.length ?? LESSON_PATTERN.length;
	const base = opts.pattern ?? (info.pattern === "build" ? BUILD_PATTERN : stage === "strong" ? STRONG_PATTERN : stage === "practised" ? PRACTISED_PATTERN : LESSON_PATTERN);
	const pattern = base.slice(0, length);
	const sourceFor = (u: UnitId) => {
		const top = candidatesFor(entries, u).slice(0, unitInfo(u).kind === "words" ? 400 : 160);
		const fresh = top.filter((c) => !opts.recent?.has(`${c.entry.slug}#${c.index}`));
		return { top, list: shuffle(fresh.length >= length ? fresh : top, rand) };
	};
	const main = sourceFor(unit);
	const mixes = (opts.mix ?? []).filter((u) => u !== unit).map(sourceFor).filter((m) => m.list.length > 0);
	// Distractors: other answers of the unit (forms), or for a vocabulary
	// unit the other words themselves, in their dictionary form.
	const poolOf = (top: Candidate[], u: UnitId) => (unitInfo(u).kind === "words" ? [...new Set(top.map((c) => c.entry.sk))] : top.map((c) => c.entry.examples[c.index]!.cloze!.answer));
	const pool = poolOf(main.top, unit);
	const used = new Set<string>();
	const keyOf = (c: Candidate) => (info.repeat ? `${c.entry.slug}#${c.index}` : c.entry.slug);
	const items: LessonItem[] = [];
	pattern.forEach((kind, slot) => {
		// A word bank needs a short sentence; listening needs one worth hearing.
		const fits = (c: Candidate) => {
			const ex = c.entry.examples[c.index]!;
			const n = ex.sk.split(/\s+/).length;
			if (kind === "build") return n >= 3 && n <= 7;
			if (kind === "meaning") return n >= 3;
			// A vocabulary choice is between words, so the blank is the dictionary form.
			if (kind === "choose" && info.kind === "words") return fold(ex.cloze!.answer) === fold(c.entry.sk);
			return true;
		};
		const take = (list: Candidate[]) => list.find((c) => !used.has(keyOf(c)) && fits(c)) ?? list.find((c) => !used.has(keyOf(c)));
		const mix = MIX_SLOTS[stage].includes(slot) && mixes.length > 0 ? mixes[Math.floor(rand() * mixes.length)]! : null;
		const fromMix = mix ? take(mix.list) : undefined;
		const pick = fromMix ?? take(main.list);
		if (!pick) return;
		used.add(keyOf(pick));
		const item = buildItem(pick, kind, fromMix ? poolOf(mix!.top, pick.unit) : pool, rand);
		if (kind === "meaning") item.options = meaningChoices(item.translation, (fromMix ? mix!.top : main.top).filter((c) => c.entry.slug !== pick.entry.slug).map((c) => c.entry.examples[c.index]!.en), rand);
		if (fromMix) item.mixed = true;
		items.push(item);
	});
	return { unit, items, stage };
}

/** A Dvojičky lesson: twelve choose reps, each a verified sentence that
 *  uses exactly one twin of the chapter's pairs. The form stands in the
 *  sentence (item.form, marked by the player); the choice is between the
 *  two lemmas — recognising which twin the sentence really uses. Deck
 *  order is deterministic per seed; `recent` ids go to the back while
 *  fresher sentences remain; a short deck cycles (repeat: true). */
export function buildPairsLesson(entries: readonly LexiconEntry[], unit: UnitId, opts: { seed: number; length?: number; recent?: ReadonlySet<string> }): LessonPlan {
	const rand = rng(opts.seed);
	const length = opts.length ?? LESSON_PATTERN.length;
	const chapter = unit.startsWith("pairs-") ? unit.slice("pairs-".length) : unit;
	const deck = pairsWithSentences(entries, chapterPairs(chapter)).flatMap(({ pair, sentences }) => sentences.map((s) => ({ pair, s })));
	const shuffled = shuffle(deck, rand);
	const fresh = shuffled.filter((x) => !opts.recent?.has(`${x.s.entry.slug}#${x.s.index}`));
	const order = [...fresh, ...shuffled.filter((x) => opts.recent?.has(`${x.s.entry.slug}#${x.s.index}`))];
	const items: LessonItem[] = [];
	for (let k = 0; items.length < length && order.length > 0; k++) {
		const pick = order[k % order.length]!;
		items.push(pairItem(pick, unit, entries, rand));
	}
	return { unit, items };
}

function pairItem({ pair, s }: { pair: PairDef; s: PairSentence }, unit: UnitId, entries: readonly LexiconEntry[], rand: () => number): LessonItem {
	const ex = s.entry.examples[s.index]!;
	// The twins' own meanings, first sense, imperfective/perfective marker
	// kept — for a pair it is often the only difference the chip can show.
	const gloss = (lemma: string) => {
		const members = pairMembers(entries, pair);
		const e = members?.[pair.a === lemma ? 0 : 1];
		return e ? e.en.split(";")[0]!.trim() : lemma;
	};
	return {
		id: `${s.entry.slug}#${s.index}`,
		kind: "choose",
		unit,
		slug: s.entry.slug,
		lemma: s.entry.sk,
		gloss: s.entry.en,
		sentence: ex.sk,
		translation: ex.en,
		answer: s.member === "a" ? pair.a : pair.b,
		form: s.form,
		before: ex.sk.slice(0, s.at),
		after: ex.sk.slice(s.at + s.form.length),
		hint: `${pair.a} = ${gloss(pair.a)} · ${pair.b} = ${gloss(pair.b)}`,
		options: shuffle([pair.a, pair.b], rand),
		pair: { id: pair.id, rule: pair.rule, bridge: pair.bridge },
	};
}

/** Blitz: choose-only reps across the given units, as many as a minute holds. */
export function buildBlitz(entries: readonly LexiconEntry[], units: readonly UnitId[], seed: number, count = 40): LessonPlan & { units: UnitId[] } {
	const rand = rng(seed);
	const per = units.map((u) => {
		const top = candidatesFor(entries, u).slice(0, 120);
		return { u, top, pool: unitInfo(u).kind === "words" ? [...new Set(top.map((c) => c.entry.sk))] : top.map((c) => c.entry.examples[c.index]!.cloze!.answer) };
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

export const XP_FOR: Record<ItemKind, number> = { meaning: 4, choose: 5, type: 10, build: 10, listen: 12 };

/** XP for one rep: a typed answer earns more than a picked one; accents-only
 *  earns half, and so does an assisted answer (right on the second try
 *  after the cue, or with the meaning shown early — a priced hint, see
 *  docs/research/desirable-difficulties.md); a combo of 3+ adds 2 per
 *  step, capped. */
export function repXp(kind: ItemKind, verdict: RepVerdict, combo: number, assisted = false): number {
	if (verdict === "wrong") return 0;
	const base = verdict === "accents" || assisted ? Math.ceil(XP_FOR[kind] / 2) : XP_FOR[kind];
	const bonus = combo >= 3 ? Math.min(10, (combo - 2) * 2) : 0;
	return base + bonus;
}

export const LESSON_BONUS = 20;
export const PERFECT_BONUS = 15;

export interface LessonScore {
	xp: number;
	correct: number;
	total: number;
	perfect: boolean;
}

/** A finished lesson's score from its reps alone. The server records the
 *  same numbers (src/server/lesson.ts), so the end screen can show them the
 *  moment the last answer is given instead of waiting for the save. */
export function lessonScore(reps: readonly { kind: ItemKind; verdict: RepVerdict; assisted?: boolean }[], mode: "lesson" | "blitz"): LessonScore {
	let combo = 0;
	let xp = 0;
	let correct = 0;
	for (const r of reps) {
		if (r.verdict === "wrong") combo = 0;
		else {
			combo++;
			correct++;
		}
		xp += repXp(r.kind, r.verdict, combo, r.assisted);
	}
	const total = reps.length;
	const perfect = total > 0 && reps.every((r) => r.verdict === "exact");
	if (mode === "lesson" && total > 0) xp += LESSON_BONUS + (perfect ? PERFECT_BONUS : 0);
	return { xp, correct, total, perfect };
}

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

export const DAYS_IN_WEEK = 7;

/**
 * The streak: consecutive active days ending today (or yesterday, while
 * today is still open). A missed day is forgiven as a rest day when the
 * seven days ending on it hold no more misses than `restAllowance` — the
 * days the plan does not ask for (7 − daysPerWeek). A streak should reward
 * the habit, not punish a planned off day.
 */
export function streakOf(activeDays: ReadonlySet<string>, today: string, restAllowance = 1): { days: number; restUsed: boolean; activeToday: boolean } {
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
		let misses = 0;
		for (let k = 0; k < DAYS_IN_WEEK; k++) if (!activeDays.has(addDays(cursor, -k))) misses++;
		if (days > 0 && misses <= restAllowance) {
			restUsed = true;
			cursor = addDays(cursor, -1);
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
