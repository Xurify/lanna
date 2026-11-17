/**
 * The curriculum (2026-10-28) — the whole road from A1 to B2
 * as one map, and the day's plan on it. Pure and browser-safe.
 *
 * Why a map: the path used to be the ten units a local lesson could drill,
 * which read as "this is all there is". Slovak to B2 is about 650 guided
 * hours, 3,000+ words and some fifty grammar points; the learner should see
 * that road, where they stand on it, and what today's step is.
 *
 * Shape: four STAGES (CEFR levels) → chapters of 5–8 units that end in a
 * can-do goal → units of four kinds:
 *   drill  — a local lesson over the lexicon (src/core/lesson.ts)
 *   words  — the same lesson shape, over one cluster of words or a
 *            frequency band
 *   tutor  — a point the lexicon cannot verify (aspect, word order…),
 *            run as a short practice session with the tutor
 *   goal   — a can-do milestone, reached when its chapter is done; it
 *            opens a Talk scene to prove it
 *
 * A chapter opens when the one before it is nearly done (at most two
 * units still open), so the map "grows" as the learner moves; a unit that
 * is aced in one go (≥95% on a full lesson) counts as done, so a learner
 * who reads ahead of their endings is not held in beginner vocabulary.
 *
 * Every number here is a planning estimate, shown as such in the UI.
 */

import { allUnits, unitDone, isUnitId, unitInfo, type UnitId } from "./lesson.ts";
import { LISTEN_MINUTES } from "./listen.ts";
import { perCourse, type Course } from "./course.ts";

// ─── Levels and stages ─────────────────────────────────────────────────────

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1";
export const CEFR_ORDER: Cefr[] = ["A1", "A2", "B1", "B2", "C1"];

/** Cumulative guided-learning hours to reach each level. A rough figure
 *  for a Slavic language learned by an adult who knows a language with
 *  grammatical cases: between the Cambridge/ALTE figures for English and
 *  the FSI category-III figures. Shown to the learner as an estimate. */
export const GUIDED_HOURS: Record<Cefr, number> = { A1: 90, A2: 200, B1: 400, B2: 650, C1: 950 };

export type StageId = "a1" | "a2" | "b1" | "b2";

export interface Stage {
	id: StageId;
	level: Cefr;
	title: string;
	/** What you can do once it is done. */
	blurb: string;
}

export const STAGES: Stage[] = [
	{
		id: "a1",
		level: "A1",
		title: "Foundations",
		blurb: "Introduce yourself, order, ask the way, talk about family and your day.",
	},
	{
		id: "a2",
		level: "A2",
		title: "Getting around",
		blurb: "Shop, make appointments, describe people and plans, tell what happened.",
	},
	{
		id: "b1",
		level: "B1",
		title: "Independence",
		blurb: "Tell stories, give opinions, deal with offices, read simple news.",
	},
	{
		id: "b2",
		level: "B2",
		title: "Argument",
		blurb: "Argue a point, follow film and news, write a formal email, feel the register.",
	},
];

// ─── Units ──────────────────────────────────────────────────────────────────

export type CurriculumKind = "drill" | "words" | "tutor" | "goal";

interface CurriculumUnit {
	id: string;
	kind: CurriculumKind;
	title: string;
	tagline: string;
	/** lucide icon name (components/lesson/unit-icon.tsx). */
	glyph: string;
	/** The seed graph node it practices (curriculum/slovak/seed.json). */
	node?: string;
	/** Units that must be done before this one opens (inside an open chapter). */
	requires?: string[];
	/** tutor: the brief sent as the first message of the practice session. */
	brief?: string;
	/** goal: the Talk scene that proves it (components/lesson/tutor.ts). */
	scene?: string;
	/** words bands: lessons needed before the band counts as done. */
	lessonsToComplete?: number;
	slovakTerm?: string;
	grammarTerm?: string;
}

const drill = (id: UnitId, extra: Partial<CurriculumUnit> = {}): CurriculumUnit => {
	const u = allUnits().find((x) => x.id === id);
	if (!u) throw new Error(`curriculum: no lesson unit "${id}"`);
	const prefix = u.kind === "words" ? "Words" : "Grammar";
	const rawTitle = u.title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
	return {
		id,
		kind: u.kind === "words" ? "words" : "drill",
		title: `${prefix}: ${rawTitle}`,
		tagline: u.tagline,
		glyph: u.glyph,
		node: u.node,
		...(u.band ? { lessonsToComplete: 20 } : {}),
		...(u.slovakTerm ? { slovakTerm: u.slovakTerm } : {}),
		...(u.grammarTerm ? { grammarTerm: u.grammarTerm } : {}),
		...extra,
	};
};

const tutor = (
	id: string,
	title: string,
	tagline: string,
	glyph: string,
	node: string | undefined,
	brief: string,
	extra: Partial<CurriculumUnit> = {},
): CurriculumUnit => {
	const rawTitle = title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
	return {
		id,
		kind: "tutor",
		title: `Tutor: ${rawTitle}`,
		tagline,
		glyph,
		node,
		brief,
		...extra,
	};
};

const goal = (
	id: string,
	title: string,
	tagline: string,
	node: string | undefined,
	scene: string | undefined,
	extra: Partial<CurriculumUnit> = {},
): CurriculumUnit => {
	const rawTitle = title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
	return {
		id,
		kind: "goal",
		title: `Goal: ${rawTitle}`,
		tagline,
		glyph: "flag",
		node,
		...(scene ? { scene } : {}),
		...extra,
	};
};

/** Slovak's map, in teaching order. Built only when Slovak runs: its
 *  units are not in a generated course. */
const slovakCurriculum = (): CurriculumUnit[] => [
	// ── A1 · 1 Hello ──
	drill("words"),
	drill("lx-greetings"),
	tutor(
		"sounds",
		"Sounds and spelling",
		"dĺžeň, mäkčeň, stress on the first syllable",
		"ear",
		"n_seed_ph_spelling",
		"Slovak sounds and spelling: stress on the first syllable, the dĺžeň (length changes meaning: pas/pás), the mäkčeň and soft d t n l before e and i, and the rhythmic law. Read each example to me with say: spans and make me read some back.",
		{ slovakTerm: "Hláskoslovie a pravopis", grammarTerm: "Phonetics & orthography" },
	),
	drill("lx-questions"),
	drill("present"),
	tutor(
		"vykanie",
		"You and you: ty, vy",
		"Polite vy and dropping the pronoun",
		"handshake",
		"n_seed_pr_vykanie",
		"Personal pronouns and vykanie: when Slovak drops the pronoun (robím, not ja robím), and when to say ty or vy and the matching verb forms (Ako sa máš? vs Ako sa máte?), including Vy with a capital in writing.",
		{ slovakTerm: "Vykanie a tykanie", grammarTerm: "Formal vs informal address" },
	),
	goal(
		"can-introduce",
		"Can introduce myself",
		"Volám sa… Som z Estónska. Odkiaľ ste?",
		"n_seed_can_introduce",
		"colleague",
		{ slovakTerm: "Predstavenie sa", grammarTerm: "Can-Do: Introduce yourself" },
	),

	// ── A1 · 2 At the café ──
	tutor(
		"byt",
		"To be: som, si, je",
		"byť in the present, and nie som",
		"smile",
		"n_seed_cop_byt",
		"byť in the present: som, si, je, sme, ste, sú, the negative nie som / nie je, and dropping the pronoun (Som doma). Drill me with short sentences about where I am, what I am and what I am not.",
		{ slovakTerm: "Sloveso byť", grammarTerm: "Present copula 'byť'" },
	),
	drill("lx-core-verbs"),
	drill("acc-fem"),
	drill("lx-drinks"),
	drill("lx-cafe"),
	drill("lx-food"),
	drill("modal-inf", { requires: ["present"] }),
	tutor(
		"numbers-basic",
		"Numbers 1–100 and prices",
		"jeden, dva, tri… Koľko to stojí?",
		"hash",
		"n_seed_lx_numbers",
		"Numbers 1 to 100, prices in euros and cents (dve eurá, päť eur, jedno euro päťdesiat), and the question Koľko to stojí? Drill me on hearing and saying prices.",
		{ slovakTerm: "Základné číslovky", grammarTerm: "Numbers 1–100 & prices" },
	),
	goal("can-order", "Can order in a café", "Dám si kávu, prosím. Zaplatím.", "n_seed_can_order", "cafe", {
		slovakTerm: "Objednávka v kaviarni",
		grammarTerm: "Can-Do: Order in a café",
	}),

	// ── A1 · 3 In town ──
	drill("loc"),
	drill("pairs-town"),
	drill("lx-city"),
	drill("lx-directions"),
	drill("kam-kde", { requires: ["loc", "acc-fem"] }),
	drill("lx-transport"),
	tutor(
		"questions",
		"Asking questions",
		"Kde? Kedy? Prečo? and yes/no questions",
		"message-circle-question",
		"n_seed_questions",
		"Asking questions in Slovak: question words (kto, čo, kde, kam, kedy, prečo, ako, koľko, aký, ktorý), yes/no questions by intonation and word order, and short answers. Make me ask you questions about a picture you describe.",
		{ slovakTerm: "Tvorenie otázok", grammarTerm: "Interrogative syntax" },
	),
	goal("can-directions", "Can ask the way", "Prepáčte, kde je stanica?", "n_seed_can_directions", "way", {
		slovakTerm: "Pýtanie sa na cestu",
		grammarTerm: "Can-Do: Ask the way",
	}),

	// ── A1 · 4 Family ──
	drill("acc-people"),
	drill("pairs-family"),
	drill("gen"),
	tutor(
		"gender-this-my",
		"Gender, this and mine",
		"ten / tá / to, môj / moja / moje",
		"tag",
		"n_seed_gender",
		"Reading a noun's gender from its ending, and matching ten/tá/to and the possessives môj/moja/moje, tvoj, náš, váš (and the invariable jeho/jej/ich) to it. Drill me with mixed nouns.",
		{ slovakTerm: "Gramatický rod a zámená", grammarTerm: "Gender & possessives" },
	),
	drill("lx-family"),
	drill("lx-people"),
	drill("lx-home"),
	goal("can-family", "Can talk about family", "Mám brata a dve sestry.", "n_seed_can_family", "family", {
		slovakTerm: "Rodina a vzťahy",
		grammarTerm: "Can-Do: Talk about family",
	}),

	// ── A1 · 5 Every day ──
	drill("ins"),
	drill("pairs-everyday"),
	drill("adj"),
	drill("lx-time"),
	drill("lx-weekdays"),
	drill("lx-routine"),
	drill("lx-meals"),
	drill("lx-colours"),
	goal(
		"can-describe-day",
		"Can describe my day",
		"Ráno vstávam o siedmej, potom idem do práce…",
		undefined,
		"colleague",
		{ slovakTerm: "Denný režim", grammarTerm: "Can-Do: Describe your day" },
	),

	// ── A1 · 6 Yesterday ──
	drill("past"),
	drill("dat"),
	drill("lx-shopping"),
	tutor(
		"byt-past",
		"Was and were",
		"bol som, bola si, boli sme",
		"history",
		"n_seed_v_byt_past",
		"byť in the past: bol/bola/bolo/boli with som/si/sme/ste, and the negative nebol som. Then mix it with other past-tense verbs in short stories about yesterday.",
		{ slovakTerm: "Minulý čas slovesa byť", grammarTerm: "Past copula 'byť'" },
	),
	goal(
		"can-tell-day",
		"Can tell what I did",
		"Včera som išiel do práce a večer som čítal.",
		"n_seed_can_tell_day",
		"family",
		{ slovakTerm: "Rozprávanie o včerajšku", grammarTerm: "Can-Do: Tell what you did" },
	),

	// ── A2 · 7 Health and body ──
	drill("present-ujem"),
	drill("pairs-health"),
	drill("lx-body"),
	drill("lx-health"),
	tutor(
		"reflexive",
		"sa and si",
		"Volám sa, umývam si ruky",
		"repeat",
		"n_seed_v_reflexive",
		"Reflexive verbs with sa and si: which verbs take sa (volať sa, učiť sa, báť sa), when si marks doing something to oneself (umývam si ruky), and where sa/si sit in the sentence (second position). Estonian has no reflexive particle, so show me the contrast with ennast/endale.",
		{ slovakTerm: "Zvratné slovesá (sa / si)", grammarTerm: "Reflexive verbs" },
	),
	goal(
		"can-appointment",
		"Can make an appointment",
		"Máte čas v piatok o piatej?",
		"n_seed_can_appointment",
		"doctor",
		{ slovakTerm: "Dohodnutie termínu", grammarTerm: "Can-Do: Make an appointment" },
	),

	// ── A2 · 8 Shopping ──
	drill("numbers"),
	drill("pairs-shopping"),
	drill("plural"),
	drill("lx-clothes"),
	drill("cond"),
	goal("can-shop", "Can shop for food", "Prosím si kilo jabĺk. Koľko to stojí?", "n_seed_can_shop", "shop", {
		slovakTerm: "Nákup potravín",
		grammarTerm: "Can-Do: Shop for food",
	}),

	// ── A2 · 9 Plans and weather ──
	drill("present-em"),
	drill("pairs-plans"),
	drill("lx-seasons"),
	drill("lx-weather"),
	drill("lx-when"),
	tutor(
		"future",
		"Talking about later",
		"budem robiť / urobím",
		"calendar-clock",
		"n_seed_v_future",
		"The future: budem + imperfective infinitive (budem čítať) versus the perfective present with future meaning (prečítam). Compare with the Estonian present-for-future (homme loen). Drill me on choosing between budem robiť and urobím in plans for the weekend.",
		{ slovakTerm: "Budúci čas", grammarTerm: "Future tense" },
	),
	goal("can-plan", "Can make plans", "Cez víkend pôjdeme na výlet, ak bude pekne.", undefined, "colleague", {
		slovakTerm: "Plánovanie",
		grammarTerm: "Can-Do: Make plans",
	}),

	// ── A2 · 10 Moving around ──
	drill("motion"),
	drill("pairs-moving"),
	drill("core-verbs"),
	drill("lx-motion"),
	drill("lx-where"),
	tutor(
		"aspect",
		"Aspect: robiť vs urobiť",
		"The pair every verb comes in",
		"git-compare",
		"n_seed_aspect",
		"Verbal aspect: imperfective (process, habit: robiť, písať, čítať) versus perfective (one completed act: urobiť, napísať, prečítať), how perfectives are made (prefix, or a suffix change like dať/dávať), and how Estonian shows the same difference with total vs partial objects (lugesin raamatut / lugesin raamatu läbi). Drill me with pairs in the past tense.",
		{ slovakTerm: "Vid (dokonavý a nedokonavý)", grammarTerm: "Verbal aspect" },
	),
	tutor(
		"imperative",
		"Commands and requests",
		"Rob! Robte! Poď sem!",
		"megaphone",
		"n_seed_imperative",
		"The imperative: the ty form (rob, píš, poď), the vy/plural form (robte, píšte, poďte), the my form (poďme), negative commands with the imperfective (nerob to!), and the soft forms with prosím. Drill me with requests in a shop, at home and on the street.",
		{ slovakTerm: "Rozkazovací spôsob", grammarTerm: "Imperative mood" },
	),
	goal("can-travel", "Can travel by train", "Jeden lístok do Košíc, prosím. Mešká vlak?", undefined, "way", {
		slovakTerm: "Cestovanie vlakom",
		grammarTerm: "Can-Do: Travel by train",
	}),

	// ── A2 · 11 People and feelings ──
	drill("adj-cases", { requires: ["adj"] }),
	drill("pairs-people"),
	drill("lx-feelings"),
	drill("lx-describe-people"),
	drill("lx-describe-things"),
	drill("clitics"),
	tutor(
		"pron-cases",
		"Me, you, him: pronoun cases",
		"ma / mňa, mi / mne, ho / jeho",
		"user-round",
		"n_seed_pron_cases",
		"Personal pronouns in the cases: the short forms (ma, ťa, ho, ju, mi, ti, mu, jej, nás, vás, ich, im) in second position, the long forms (mňa, teba, jeho, mne, tebe) after prepositions and for emphasis. Drill me on choosing the form from the verb or preposition.",
		{ slovakTerm: "Pády osobných zámen", grammarTerm: "Pronoun cases" },
	),
	tutor(
		"liking",
		"Liking things",
		"mám rád, rada čítam, páči sa mi",
		"heart",
		"n_seed_rad",
		"Three ways to like: mám rád/rada + accusative (mám rád kávu), rád/rada + verb (rád čítam), and páči sa mi + nominative (páči sa mi Bratislava), with the gender of rád/rada. Drill me on all three.",
		{ slovakTerm: "Vyjadrovanie záľub", grammarTerm: "Expressing preferences" },
	),
	goal("can-describe-people", "Can describe people", "Môj brat je vysoký a trochu lenivý.", undefined, "family", {
		slovakTerm: "Opis osôb",
		grammarTerm: "Can-Do: Describe people",
	}),

	// ── A2 · 12 Work and school ──
	drill("lx-work"),
	drill("lx-school"),
	drill("lx-hobbies"),
	drill("words-300"),
	tutor(
		"negation",
		"Saying no",
		"ne- on the verb, nikto nič nikdy",
		"ban",
		"n_seed_v_neg",
		"Negation: ne- written together with the verb (nerobím, nemám), nie som / nie je for byť, and double negation with nikto, nič, nikdy, nikde (Nikto nič nevie). Drill me on turning sentences negative.",
		{ slovakTerm: "Zápor", grammarTerm: "Negation" },
	),
	tutor(
		"time-dates",
		"Time and dates",
		"o siedmej, v piatok, piateho mája",
		"clock",
		"n_seed_time",
		"Telling the time (Je sedem hodín. O pol ôsmej. O štvrť na deväť.), days (v pondelok), months and dates with the genitive (piateho mája), and the question Kedy? Drill me on hearing and saying times and dates.",
		{ slovakTerm: "Čas a dátumy", grammarTerm: "Time and dates" },
	),
	tutor(
		"word-order",
		"Word order",
		"New information last",
		"arrow-right-left",
		"n_seed_word_order",
		"Slovak word order: the sentence is free but not random — known information first, new information last, clitics in second position. Give me pairs of sentences that differ only in order and make me say which question each answers.",
		{ slovakTerm: "Slovosled", grammarTerm: "Word order" },
	),
	goal("can-interview", "Can talk about my work", "Pracujem ako… Študoval som…", undefined, "colleague", {
		slovakTerm: "Rozhovor o práci",
		grammarTerm: "Can-Do: Talk about work",
	}),

	// ── B1 · 13 Telling stories ──
	drill("cases-mix"),
	drill("pairs-stories"),
	drill("words-600"),
	tutor(
		"verb-prefixes",
		"Verb prefixes",
		"prísť, odísť, prejsť, vojsť",
		"route",
		"n_seed_motion",
		"Prefixes on verbs of motion and others: pri- (arrive), od- (leave), pre- (across/through), vy- (out), vo- (in), do- (reach), roz- (apart), and how a prefix also makes the verb perfective. Drill me with one scene told with ísť plus prefixes.",
		{ slovakTerm: "Slovesné predpony", grammarTerm: "Verb prefixes" },
	),
	tutor(
		"narration",
		"Telling what happened",
		"Past tense with aspect, step by step",
		"book-open",
		"n_seed_aspect",
		"Narrating in the past: perfective verbs move the story forward (prišiel, otvoril, povedal), imperfectives set the scene (svietilo slnko, ľudia sedeli). Give me a six-picture story in English and have me tell it in Slovak one line at a time, prompting the aspect before you correct.",
		{ slovakTerm: "Rozprávanie v minulosti", grammarTerm: "Narrating past events" },
	),
	goal("can-narrate", "Can tell a story", "Minulý víkend sa mi stalo niečo zvláštne…", undefined, "family", {
		slovakTerm: "Príbeh",
		grammarTerm: "Can-Do: Tell a story",
	}),

	// ── B1 · 14 Opinions ──
	drill("verbs-mix"),
	drill("pairs-opinions"),
	drill("lx-thinking"),
	drill("lx-speaking"),
	tutor(
		"relative",
		"Which and that: ktorý",
		"Relative clauses and commas",
		"link",
		undefined,
		"Relative clauses with ktorý/ktorá/ktoré, which take the case their own clause needs (muž, ktorého poznám; kniha, o ktorej hovoríš), plus čo and kde, and the comma rule. Drill me on joining two sentences into one.",
		{ slovakTerm: "Prívlastkové vety (ktorý)", grammarTerm: "Relative clauses" },
	),
	tutor(
		"reported",
		"že, aby, keby",
		"Saying what people said and wanted",
		"quote",
		undefined,
		"Subordinate clauses: že (that), aby (so that / want someone to, with the -l form), keby (if, unreal), či (whether). Drill me on turning quotes into reported speech and wishes.",
		{ slovakTerm: "Vedľajšie vety (že, aby, keby)", grammarTerm: "Reported speech & clauses" },
	),
	tutor(
		"comparatives",
		"More and most",
		"väčší, lepší, najkrajší",
		"trending-up",
		undefined,
		"Comparatives and superlatives of adjectives and adverbs: -ší/-ejší, naj-, the irregular ones (dobrý–lepší–najlepší, zlý–horší, veľký–väčší, malý–menší), and ako / než after a comparative. Drill me on comparing things.",
		{ slovakTerm: "Stupňovanie prídavných mien", grammarTerm: "Comparatives & superlatives" },
	),
	goal("can-opinion", "Can give an opinion", "Myslím si, že… Súhlasím, ale…", undefined, "colleague", {
		slovakTerm: "Vyjadrenie názoru",
		grammarTerm: "Can-Do: Express opinions",
	}),

	// ── B1 · 15 Dealing with offices ──
	tutor(
		"plural-cases",
		"Plural in every case",
		"s kamarátmi, v mestách, bez peňazí",
		"layers",
		"n_seed_gen_pl",
		"The plural across the cases: genitive (domov, žien, miest, peňazí), dative -om, locative -och, instrumental -ami/-mi, and the adjective plural endings -ých/-ým/-ými. Drill me with prepositions that pick the case.",
		{ slovakTerm: "Pády v množnom čísle", grammarTerm: "Plural in all cases" },
	),
	drill("lx-admin"),
	drill("lx-tech"),
	drill("lx-languages"),
	drill("words-1000"),
	tutor(
		"phone-email",
		"On the phone, in an email",
		"Dobrý deň, volám kvôli…",
		"phone",
		undefined,
		"Phone calls and short emails: opening and closing phrases, vykanie, asking for a person, leaving a message, and a formal email's shape (Vážená pani / S pozdravom). Run a phone call with me, then have me write a five-line email and correct it.",
		{ slovakTerm: "Telefonát a email", grammarTerm: "Formal phone & email" },
	),
	goal("can-complain", "Can sort out a problem", "Objednal som si…, ale prišlo niečo iné.", undefined, "shop", {
		slovakTerm: "Riešenie reklamácie",
		grammarTerm: "Can-Do: Solve problems",
	}),

	// ── B1 · 16 The wider world ──
	drill("lx-nature"),
	drill("lx-animals"),
	drill("words-1500"),
	tutor(
		"participles",
		"Participles and verbal nouns",
		"robený, robiac, robenie",
		"file-text",
		undefined,
		"Passive participles (-ný/-tý: napísaný, otvorený), the verbal noun (-nie/-tie: čítanie, bývanie), and the adverbial participle (-úc/-iac) you meet in writing. Show me each in real headlines and make me rewrite active sentences with them.",
		{ slovakTerm: "Príčastia a prechodníky", grammarTerm: "Participles & verbal nouns" },
	),
	goal("can-read-news", "Can read simple news", "A short article, understood and retold", undefined, undefined, {
		slovakTerm: "Čítanie správ",
		grammarTerm: "Can-Do: Read simple news",
	}),

	// ── B2 · 17 Nuance ──
	drill("words-2000"),
	tutor(
		"passive",
		"The passive and 'one does'",
		"Bolo rozhodnuté. Hovorí sa, že…",
		"shield",
		undefined,
		"The passive voice with byť + participle, the reflexive passive (hovorí sa, predáva sa), and impersonal constructions (treba, dá sa, možno). Drill me on turning active sentences into each kind and on choosing the natural one.",
	),
	tutor(
		"cond-past",
		"Would have",
		"Bol by som prišiel, keby…",
		"rewind",
		"n_seed_conditional",
		"The past conditional (bol by som prišiel) and unreal conditions with keby, plus the modal shades of mal by som / mohol by som. Drill me with regrets and advice.",
	),
	tutor(
		"numerals-full",
		"Numbers in every case",
		"s dvoma kamarátmi, o piatich hodinách",
		"calculator",
		"n_seed_numerals",
		"Numerals in the oblique cases (dvoch/dvom/dvoma, piatich/piatim/piatimi), ordinals and dates (dvadsiateho prvého), collective numerals (dvaja, traja for men), fractions and percentages. Drill me on prices, dates and statistics.",
	),
	goal("can-write-formal", "Can write a formal email", "Vážený pán…, obraciam sa na Vás…", undefined, undefined),

	// ── B2 · 18 Register and idiom ──
	tutor(
		"idioms",
		"Idioms and set phrases",
		"mať niečo na háku, byť v siedmom nebi",
		"sparkles",
		undefined,
		"Common Slovak idioms and collocations in context: give me ten at a time in short dialogues, check I can guess them, then have me use each in a sentence of my own.",
	),
	tutor(
		"colloquial",
		"Standard and street",
		"spisovná slovenčina vs hovorová",
		"mic",
		undefined,
		"Register: standard (spisovná) versus colloquial Slovak and Bratislava usage (čo robíš → čo robíš, že?, dobre → fajn, veľmi → strašne), when each is right, and words that mark a text as formal. Give me lines to shift between registers.",
	),
	tutor(
		"connectors",
		"Connecting ideas",
		"hoci, preto, napriek tomu, pokiaľ",
		"git-merge",
		undefined,
		"Connectors and conjunctions for argument: preto, lebo, hoci, napriek tomu, pokiaľ, kým, zatiaľ čo, teda, jednak… jednak, and how they shape word order. Make me argue a point for and against in eight sentences using them.",
	),
	drill("words-3000"),
	goal("can-debate", "Can argue a point", "Na jednej strane…, na druhej strane…", undefined, "colleague"),

	// ── B2 · 19 Media ──
	tutor(
		"reading",
		"Reading the news",
		"An article a day, discussed in Slovak",
		"newspaper",
		undefined,
		"Pick a short real-style Slovak news article (write one at B2 level, 150 words) on a topic I choose, let me read it, then ask me five comprehension and two opinion questions in Slovak, correcting form slips only after I answer.",
	),
	tutor(
		"listening-film",
		"Film and radio",
		"Following fast speech",
		"film",
		undefined,
		"Fast listening: read me, in say: spans at natural speed, a two-minute dialogue with colloquial speech and interruptions; then ask what happened, who wanted what, and the exact phrases used. Repeat the hard lines slower only on request.",
	),
	tutor(
		"writing",
		"Writing at length",
		"A 150-word text, corrected",
		"pen-line",
		undefined,
		"Writing: give me a prompt (a complaint, a story, an opinion piece), have me write about 150 words in Slovak, then correct it in three passes: cases and agreement, aspect and tense, then style and register, explaining each change in one line.",
	),
	goal("can-follow-media", "Can follow Slovak media", "News, film and a podcast, understood", undefined, undefined),
];

interface Chapter {
	id: string;
	stage: StageId;
	title: string;
	tagline: string;
	/** Unit ids in order; the last is the chapter's goal. */
	units: string[];
}

function chapter(
	map: readonly CurriculumUnit[],
	id: string,
	stage: StageId,
	title: string,
	tagline: string,
	from: string,
	to: string,
): Chapter {
	const a = map.findIndex((u) => u.id === from);
	const b = map.findIndex((u) => u.id === to);
	if (a < 0 || b < a) throw new Error(`curriculum: bad chapter ${id}`);
	return { id, stage, title, tagline, units: map.slice(a, b + 1).map((u) => u.id) };
}

/** Slovak's chapters, in order. Each closes with a can-do goal. */
const slovakChapters = (map: readonly CurriculumUnit[]): Chapter[] => [
	chapter(map, "hello", "a1", "Hello", "Sounds, greetings and the present tense", "words", "can-introduce"),
	chapter(map, "cafe", "a1", "At the café", "To be, to want, the object case, ordering", "byt", "can-order"),
	chapter(map, "town", "a1", "In town", "Where and where to", "loc", "can-directions"),
	chapter(map, "family", "a1", "Family", "People and animals as objects, genitive, gender", "acc-people", "can-family"),
	chapter(map, "everyday", "a1", "Every day", "With, adjectives, time and routine", "ins", "can-describe-day"),
	chapter(map, "yesterday", "a1", "Yesterday", "The past tense and the dative", "past", "can-tell-day"),
	chapter(map, "health", "a2", "Health and body", "-ujem verbs, reflexives", "present-ujem", "can-appointment"),
	chapter(map, "shopping", "a2", "Shopping", "Numbers, plural, would like", "numbers", "can-shop"),
	chapter(map, "plans", "a2", "Plans and weather", "-em verbs and the future", "present-em", "can-plan"),
	chapter(map, "moving", "a2", "Moving around", "Motion, aspect, commands", "motion", "can-travel"),
	chapter(
		map,
		"people",
		"a2",
		"People and feelings",
		"Adjective cases, pronouns, clitics",
		"adj-cases",
		"can-describe-people",
	),
	chapter(map, "work", "a2", "Work and school", "Negation, time, word order", "lx-work", "can-interview"),
	chapter(map, "stories", "b1", "Telling stories", "All cases mixed, prefixes, narration", "cases-mix", "can-narrate"),
	chapter(
		map,
		"opinions",
		"b1",
		"Opinions",
		"Relative clauses, reported speech, comparison",
		"verbs-mix",
		"can-opinion",
	),
	chapter(
		map,
		"offices",
		"b1",
		"Dealing with offices",
		"Plural cases, forms, phone and email",
		"plural-cases",
		"can-complain",
	),
	chapter(map, "world", "b1", "The wider world", "Participles, nature, 1,500 words", "lx-nature", "can-read-news"),
	chapter(map, "nuance", "b2", "Nuance", "Passive, past conditional, numerals", "words-2000", "can-write-formal"),
	chapter(map, "register", "b2", "Register and idiom", "Idioms, street Slovak, connectors", "idioms", "can-debate"),
	chapter(map, "media", "b2", "Media", "Reading, listening, writing at length", "reading", "can-follow-media"),
];

/** A generated course's map: First words opens it, then each chapter's
 *  units, tutor sessions and goal in the course's order. */
function courseCurriculum(course: Course): CurriculumUnit[] {
	const units = new Set(course.units.map((u) => u.id));
	const tutors = new Map(course.tutors.map((t) => [t.id, t]));
	const goals = new Map(course.goals.map((g) => [g.id, g]));
	const out: CurriculumUnit[] = [drill("words")];
	for (const ch of course.chapters) {
		for (const id of ch.units) {
			const t = tutors.get(id);
			const g = goals.get(id);
			if (units.has(id)) out.push(drill(id as UnitId));
			else if (t) out.push(tutor(t.id, t.title, t.tagline, t.glyph, undefined, t.brief));
			else if (g) out.push(goal(g.id, g.title, g.tagline, undefined, g.scene));
		}
	}
	return out;
}

/** Every unit on the map, in teaching order: the running language's course (src/core/course.ts), else Slovak's. */
export const curriculumUnits = perCourse((course): CurriculumUnit[] =>
	course ? courseCurriculum(course) : slovakCurriculum(),
);

/** The map's chapters, in order. Each closes with a can-do goal. */
export const allChapters = perCourse((course): Chapter[] =>
	course
		? course.chapters.map((c, i) => ({
				id: c.id,
				stage: c.stage,
				title: c.title,
				tagline: c.tagline,
				units: i === 0 ? ["words", ...c.units] : [...c.units],
			}))
		: slovakChapters(curriculumUnits()),
);

export function curriculumUnit(id: string): CurriculumUnit | undefined {
	return curriculumUnits().find((u) => u.id === id);
}
// ─── State ──────────────────────────────────────────────────────────────────

/** What progress.json knows about a unit: lessons (or tutor sessions),
 *  reps and the share right. */
export interface UnitEvidence {
	lessons: number;
	reps: number;
	correct: number;
	/** The reps came from the placement drill (src/core/onboarding.ts):
	 *  every rep right = tested out of the unit. */
	placed?: boolean;
}

/** skipped: behind the chapter placement started in — counted as passed,
 *  open to revisit any time. */
export type UnitStatus = "locked" | "open" | "started" | "skipped" | "done";

export interface UnitState {
	id: string;
	kind: CurriculumKind;
	title: string;
	tagline: string;
	glyph: string;
	status: UnitStatus;
	lessons: number;
	reps: number;
	accuracy: number | null;
	/** 0..1 toward done. */
	progress: number;
	scene?: string;
	/** Why it is locked, for the UI. */
	needs?: string;
	slovakTerm?: string;
	grammarTerm?: string;
}

export interface ChapterState {
	id: string;
	stage: StageId;
	title: string;
	tagline: string;
	open: boolean;
	done: boolean;
	doneCount: number;
	/** Units that count toward opening the next chapter (everything but the goal). */
	total: number;
	units: UnitState[];
}

export interface CurriculumState {
	chapters: ChapterState[];
	/** The chapter the learner is working in: the first open, unfinished one. */
	current: string;
	/** The level the learner is working at, and the share of it done. */
	level: Cefr;
	levelProgress: number;
	/** Units done, over every unit up to the target level (goals included). */
	done: number;
	total: number;
}

/** Tutor sessions a tutor unit needs. */
export const TUTOR_SESSIONS = 2;
/** One full lesson (at least 10 reps) at this accuracy tests out of a unit.
 *  The 95% and the 10 reps are the app's own policy, not figures from a study. */
const TEST_OUT_ACCURACY = 0.95;
/** A chapter opens when the one before has at most this many units undone. */
const CHAPTER_SLACK = 2;

function unitProgressOf(
	u: CurriculumUnit,
	e: UnitEvidence | undefined,
	lessonsToComplete: number,
): { done: boolean; progress: number } {
	const lessons = e?.lessons ?? 0;
	const accuracy = e && e.reps > 0 ? e.correct / e.reps : null;
	if (u.kind === "tutor") return { done: lessons >= TUTOR_SESSIONS, progress: Math.min(1, lessons / TUTOR_SESSIONS) };
	if (u.lessonsToComplete)
		return { done: lessons >= lessonsToComplete, progress: Math.min(1, lessons / lessonsToComplete) };
	// Placement: both of the drill's reps right tests the unit out.
	if (e?.placed && lessons === 0 && e.reps >= 2 && e.correct === e.reps) return { done: true, progress: 1 };
	const aced = lessons >= 1 && (e?.reps ?? 0) >= 10 && (accuracy ?? 0) >= TEST_OUT_ACCURACY;
	const done = aced || unitDone(lessons, accuracy);
	// Toward three lessons at the bar; an aced unit is simply done.
	const progress = done ? 1 : Math.min(0.9, lessons / 3);
	return { done, progress };
}

/** The whole map's state from the progress ledger. Pure. `startChapter`
 *  (from placement) skips every chapter before it: their undone units
 *  count as passed and stay open to revisit. */
export function curriculumState(
	evidence: Record<string, UnitEvidence | undefined>,
	target: Cefr = "B2",
	opts: { startChapter?: string } = {},
): CurriculumState {
	const targetIdx = CEFR_ORDER.indexOf(target);
	const startIdx = Math.max(
		0,
		allChapters().findIndex((c) => c.id === opts.startChapter),
	);
	const doneSet = new Set<string>();
	const chapters: ChapterState[] = [];
	let prevOpenSlack: boolean = true; // the first chapter is always open
	let current: string | undefined;
	let done = 0;
	let total = 0;
	for (const [chIdx, ch] of allChapters().entries()) {
		const stage = STAGES.find((s) => s.id === ch.stage)!;
		const inTarget = CEFR_ORDER.indexOf(stage.level) <= targetIdx;
		const skippedChapter = chIdx < startIdx;
		const open: boolean = prevOpenSlack || skippedChapter;
		const units: UnitState[] = [];
		let doneCount = 0;
		const countable = ch.units.filter((id) => curriculumUnit(id)!.kind !== "goal").length;
		for (const id of ch.units) {
			const u = curriculumUnit(id)!;
			const e = evidence[id];
			const lessons = e?.lessons ?? 0;
			const accuracy = e && e.reps > 0 ? e.correct / e.reps : null;
			let status: UnitStatus;
			let progress: number;
			let needs: string | undefined;
			if (u.kind === "goal") {
				// A goal is reached when the chapter's other units are done.
				const reached = open && doneCount >= countable;
				status = reached ? (units.some((x) => x.status === "skipped") ? "skipped" : "done") : "locked";
				progress = countable > 0 ? Math.min(1, doneCount / countable) : 0;
				if (!reached)
					needs = open
						? `Finish the chapter's ${countable - doneCount} open unit${countable - doneCount === 1 ? "" : "s"}`
						: `Opens when “${ch.title}” opens`;
			} else {
				const p = unitProgressOf(u, e, u.lessonsToComplete ?? 0);
				const missing = (u.requires ?? []).filter((r) => !doneSet.has(r));
				if (p.done) status = "done";
				else if (skippedChapter) status = "skipped";
				else if (!open) status = "locked";
				else if (missing.length) status = "locked";
				else status = lessons > 0 ? "started" : "open";
				progress = p.progress;
				if (status === "locked")
					needs = !open
						? `Opens when “${ch.title}” opens`
						: `After ${missing.map((m) => curriculumUnit(m)?.title ?? m).join(" and ")}`;
			}
			if (status === "done" || status === "skipped") {
				doneSet.add(id);
				if (u.kind !== "goal") doneCount++;
			}
			const slovakTerm = u.slovakTerm ?? (isUnitId(id) ? unitInfo(id as UnitId)?.slovakTerm : undefined);
			const grammarTerm = u.grammarTerm ?? (isUnitId(id) ? unitInfo(id as UnitId)?.grammarTerm : undefined);
			units.push({
				id,
				kind: u.kind,
				title: u.title,
				tagline: u.tagline,
				glyph: u.glyph,
				status,
				lessons,
				reps: e?.reps ?? 0,
				accuracy,
				progress,
				...(slovakTerm ? { slovakTerm } : {}),
				...(grammarTerm ? { grammarTerm } : {}),
				...(u.scene ? { scene: u.scene } : {}),
				...(needs ? { needs } : {}),
			});
		}
		const chapterDone = doneCount >= countable;
		if (inTarget) {
			total += ch.units.length;
			done += units.filter((u) => u.status === "done" || u.status === "skipped").length;
		}
		if (open && !chapterDone && !current && !skippedChapter) current = ch.id;
		chapters.push({
			id: ch.id,
			stage: ch.stage,
			title: ch.title,
			tagline: ch.tagline,
			open,
			done: chapterDone,
			doneCount,
			total: countable,
			units,
		});
		prevOpenSlack = open && countable - doneCount <= CHAPTER_SLACK;
	}
	const cur = chapters.find((c) => c.id === (current ?? chapters[chapters.length - 1]!.id))!;
	const level = STAGES.find((s) => s.id === cur.stage)!.level;
	const levelChapters = chapters.filter((c) => c.stage === cur.stage);
	const lv = levelChapters.reduce((n, c) => n + c.doneCount, 0);
	const lt = levelChapters.reduce((n, c) => n + c.total, 0);
	return { chapters, current: cur.id, level, levelProgress: lt ? lv / lt : 0, done, total };
}

/** The unit the Continue button opens: the first open drill in the
 *  current chapter, then a words unit, then the same in later chapters;
 *  with nothing open, the weakest drill done so far (so Continue never
 *  dead-ends). */
export function nextLessonUnit(state: CurriculumState): UnitId {
	const pick = (kinds: CurriculumKind[], statuses: UnitStatus[]) => {
		for (const ch of state.chapters) {
			if (!ch.open) continue;
			const u = ch.units.find((x) => kinds.includes(x.kind) && statuses.includes(x.status));
			if (u) return u.id as UnitId;
		}
		return undefined;
	};
	const next =
		pick(["drill"], ["started", "open"]) ??
		pick(["words"], ["started", "open"]) ??
		[...state.chapters.flatMap((c) => c.units)]
			.filter((u) => (u.kind === "drill" || u.kind === "words") && u.status === "done")
			.sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))[0]?.id;
	return (next ?? "words") as UnitId;
}

// ─── Hours and projection ───────────────────────────────────────────────────

export interface Projection {
	target: Cefr;
	/** Guided hours the map credits so far (stage share × stage hours). */
	hoursDone: number;
	hoursTarget: number;
	/** Hours per week at the planned minutes/day, six days a week. */
	plannedWeekly: number;
	/** Minutes actually studied in the last 14 days, per day. */
	paceMinutes: number;
	/** Days of the last 14 with any study in them. */
	paceDays: number;
	/** ISO date the target is reached at the planned pace, or null when the plan is 0 minutes. */
	etaPlanned: string | null;
	/** The same at the measured pace, or null until MIN_PACE_DAYS of the last 14 days have study in them. */
	etaPace: string | null;
}

/** A real pace is only quoted once this many of the last 14 days have study
 *  in them: a week of one minute a day is a start, not a rate, and
 *  extrapolating it dates the goal in the next century. */
export const MIN_PACE_DAYS = 7;
/** The window the measured pace is averaged over. */
export const PACE_WINDOW_DAYS = 14;

/** ISO date `hoursLeft` of study lands at the measured pace (minutes a day
 *  over the last 14 days), or null while the evidence is too thin. */
export function paceEta(hoursLeft: number, paceMinutes: number, paceDays: number, now: Date): string | null {
	if (paceDays < MIN_PACE_DAYS || paceMinutes <= 0) return null;
	return addDaysIso(now, hoursLeft / (paceMinutes / 60));
}

function addDaysIso(from: Date, days: number): string {
	const d = new Date(from.getTime() + Math.round(days) * 86_400_000);
	return d.toISOString().slice(0, 10);
}

/** How far along the hours road the map says the learner is. Each stage's
 *  hours are credited in proportion to its units done; the first chapter
 *  of A1 counts from zero, so a fresh learner starts at 0. */
export function hoursDone(state: CurriculumState): number {
	let hours = 0;
	let prev = 0;
	for (const s of STAGES) {
		const span = GUIDED_HOURS[s.level] - prev;
		prev = GUIDED_HOURS[s.level];
		const chapters = state.chapters.filter((c) => c.stage === s.id);
		const done = chapters.reduce((n, c) => n + c.doneCount, 0);
		const total = chapters.reduce((n, c) => n + c.total, 0);
		if (total > 0) hours += span * (done / total);
	}
	return hours;
}

/** Study days a week when the goal does not say (DEFAULT_DAYS_PER_WEEK in onboarding.ts). */
const DAYS_PER_WEEK = 6;

export function projection(
	state: CurriculumState,
	opts: { target: Cefr; minutesPerDay: number; daysPerWeek?: number; recentMinutes: number[]; now: Date },
): Projection {
	const done = hoursDone(state);
	const targetHours = GUIDED_HOURS[opts.target];
	const left = Math.max(0, targetHours - done);
	const plannedWeekly = (opts.minutesPerDay / 60) * (opts.daysPerWeek ?? DAYS_PER_WEEK);
	const paceMinutes = opts.recentMinutes.length
		? opts.recentMinutes.reduce((a, b) => a + b, 0) / opts.recentMinutes.length
		: 0;
	const etaPlanned = plannedWeekly > 0 ? addDaysIso(opts.now, (left / plannedWeekly) * 7) : null;
	const paceDays = opts.recentMinutes.filter((m) => m > 0).length;
	const etaPace = opts.recentMinutes.length >= 14 ? paceEta(left, paceMinutes, paceDays, opts.now) : null;
	return {
		target: opts.target,
		hoursDone: Math.round(done),
		hoursTarget: targetHours,
		plannedWeekly: Math.round(plannedWeekly * 10) / 10,
		paceMinutes: Math.round(paceMinutes),
		paceDays,
		etaPlanned,
		etaPace,
	};
}

// ─── The daily plan ─────────────────────────────────────────────────────────

export type TaskKind =
	| "review"
	| "listen"
	| "lesson"
	| "strengthen"
	| "words"
	| "read"
	| "watch"
	| "speak"
	| "fluency"
	| "blitz";

export interface PlanTask {
	id: TaskKind;
	title: string;
	/** One line under the title: what and why. */
	line: string;
	minutes: number;
	done: boolean;
	/** lesson/strengthen/words: the unit; speak: a tutor unit id or a scene id. */
	unit?: string;
	/** speak: how to start it — a tutor chat or a spoken scene (/speak). */
	via?: "tutor" | "speak";
	href?: string;
	/** The day this unfinished task was planned on (carry-over). */
	from?: string;
}

export interface DailyPlan {
	minutes: number;
	tasks: PlanTask[];
	done: number;
	total: number;
}

/** What today's ledger says was done. */
interface DayEvidence {
	/** lessons finished today, per unit id. */
	units: Record<string, number>;
	reviews: number;
	blitz: number;
	/** Mix-ups lessons finished today (src/core/mixups.ts). */
	mixups?: number;
	/** Personal lessons finished today (src/core/personal.ts). */
	personal?: number;
	talks: number;
	stories: number;
	tutors: number;
	/** Story episodes read today (the Read task). */
	reads?: number;
	/** Listening sessions finished today (the Listen task). */
	listens?: number;
	/** Videos watched today (the Watch task). */
	watches?: number;
	/** Spoken scenes finished today (the Speak task). */
	speaks?: number;
	/** Timed re-reads and "say it faster" rounds today (the fluency strand). */
	rereads?: number;
	fasts?: number;
}

interface PlanInput {
	state: CurriculumState;
	evidence: Record<string, UnitEvidence | undefined>;
	day: DayEvidence;
	review: { due: number; newLeft: number; available: boolean };
	minutesPerDay: number;
	/** The Continue unit (nextLessonUnit). */
	next: UnitId;
	/** For alternating Talk and Story: the day of the year. */
	dayOfYear: number;
	/** Talk scenes the learner's purposes call for (src/core/onboarding.ts);
	 *  they rotate with the chapter's own scene. */
	scenes?: string[];
	/** Units on record as weak spots (src/core/weak-spots.ts), most urgent
	 *  first: the Strengthen task takes the first one that can be drilled. */
	weak?: UnitId[];
	/** Pairs of words the learner mixes up and has not mended (src/core/mixups.ts),
	 *  latest first: with no weak spot to drill, Strengthen practices them. */
	mixups?: Array<[string, string]>;
	/** Units whose first-try accuracy fell lately (src/core/mistakes.ts), worst
	 *  first: with no weak spot on record, Strengthen takes the first one that
	 *  can be drilled before it falls back to the weakest overall. */
	worse?: UnitId[];
	/** A personal lesson from a recent guide (src/core/personal.ts): with no
	 *  weak spot on record, Strengthen takes it before anything else. */
	personal?: { focus: string };
	/** A video the learner added and has not watched yet (src/core/watch.ts):
	 *  it joins the plan as input until it is watched. */
	/** A video with captions in another language: coverage is an estimate (`estimated`), or absent with the language's name when none was made. */
	watch?: { id: string; title: string; minutes: number; coverage?: number; estimated?: boolean; captionLang?: string };
	/** An episode read before today exists, so a timed re-read is possible. */
	reread?: boolean;
	/** The story's title: the one read today, else the one /read opens next; absent while none is written. */
	story?: string;
	/** Unfinished tasks from earlier days (src/core/carry-over.ts): the ones
	 *  this plan offers again move to the top, labeled with their day. */
	carried?: Array<{ id: string; from: string }>;
}

/** Which tasks survive a tight budget first (lower keeps): the must-haves,
 *  then one task of each strand, then the second form-focused ones. */
const BUDGET_ORDER: Record<TaskKind, number> = {
	review: 0,
	lesson: 1,
	listen: 2,
	speak: 3,
	read: 4,
	watch: 4,
	fluency: 5,
	strengthen: 6,
	blitz: 6,
	words: 7,
};

const TASK_MINUTES = {
	listen: LISTEN_MINUTES,
	lesson: 3,
	strengthen: 3,
	words: 3,
	read: 4,
	speak: 6,
	fluency: 3,
	blitz: 1,
} as const;

/**
 * The day's plan, from the research on what actually moves a learner:
 * spaced retrieval first (the review deck), then input before anything is
 * asked of you (ten sentences to listen to and understand), new ground on
 * the path (one lesson on the Continue unit), interleaved strengthening of
 * the weakest practiced unit, new words in context, an episode to read at
 * the learner's level, output with feedback (a tutor unit, else a spoken
 * scene from the learner's goals), and three minutes of speed on what is
 * already known (a timed re-read of an episode, or "say it faster"). The
 * order follows comprehension-before-production; the mix follows
 * Nation's four strands (src/core/strands.ts). The list is cut to the
 * planned minutes, never below review + the lesson.
 */
export function dailyPlan(input: PlanInput): DailyPlan {
	const { state, evidence, day, review } = input;
	const all = state.chapters.flatMap((c) => c.units);
	const byId = new Map(all.map((u) => [u.id, u]));
	const lessonsBeforeToday = (id: string) => (evidence[id]?.lessons ?? 0) - (day.units[id] ?? 0);
	const tasks: PlanTask[] = [];

	// 1. Review: what is due is due.
	if (review.available && (review.due > 0 || day.reviews > 0 || review.newLeft > 0)) {
		const minutes = Math.max(2, Math.min(10, Math.ceil((review.due + Math.min(review.newLeft, 10)) / 4)));
		const done = review.due === 0 && (day.reviews > 0 || review.newLeft === 0);
		tasks.push({
			id: "review",
			title: "Review",
			line:
				review.due > 0
					? `${review.due} card${review.due === 1 ? "" : "s"} due — recall them before anything new`
					: review.newLeft > 0 && !done
						? `${review.newLeft} new word${review.newLeft === 1 ? "" : "s"} waiting`
						: "All caught up",
			minutes,
			done,
			href: "/review",
		});
	}

	// 2. Listen: meaning-focused input before any production. Ten real
	//    sentences of mostly known words, heard first and typed
	//    (src/core/listen.ts).
	tasks.push({
		id: "listen",
		title: "Listen",
		line:
			(day.listens ?? 0) > 0
				? "Ten sentences heard and typed"
				: "Ten sentences you can follow — hear each, then type what you heard",
		minutes: TASK_MINUTES.listen,
		done: (day.listens ?? 0) > 0,
		href: "/listen",
	});

	// 3. New ground: a lesson on the Continue unit.
	const next = byId.get(input.next);
	const nextUnitInfo = isUnitId(input.next) ? unitInfo(input.next) : undefined;
	const slovakLabel = next?.slovakTerm ?? nextUnitInfo?.slovakTerm;
	const grammarLabel = next?.grammarTerm ?? nextUnitInfo?.grammarTerm;
	const isWords = next?.kind === "words" || nextUnitInfo?.kind === "words";
	const prefix = isWords ? "Words" : "Grammar";
	const termSuffix = slovakLabel ? ` · ${slovakLabel}` : "";
	const lineGrammar = grammarLabel ? `${grammarLabel} — ` : "";
	const newGroundDone = Object.keys(day.units).some((id) => {
		const u = byId.get(id);
		return !!u && (u.kind === "drill" || u.kind === "words") && lessonsBeforeToday(id) < 3 && (day.units[id] ?? 0) > 0;
	});
	const nextClean = next ? next.title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "") : "";
	tasks.push({
		id: "lesson",
		title: next ? `${prefix}: ${nextClean}${termSuffix}` : "Grammar lesson",
		line: next
			? next.lessons > 0
				? `Lesson ${next.lessons + 1} · ${lineGrammar}${next.tagline}`
				: `New · ${lineGrammar}${next.tagline}`
			: "The next step on your path",
		minutes: TASK_MINUTES.lesson,
		done: newGroundDone,
		unit: input.next,
		href: `/lesson?unit=${input.next}`,
	});

	// 4. Strengthen: a weak spot on record first (the check or the deck
	//    flagged it, even with no lesson yet), else the weakest practiced
	//    drill (not the Continue unit), else a blitz across the units started.
	const spot = (input.weak ?? [])
		.map((id) => byId.get(id))
		.find((u) => u && (u.kind === "drill" || u.kind === "words") && u.id !== input.next && u.status !== "locked");
	const worseUnit = spot
		? undefined
		: (input.worse ?? [])
				.map((id) => byId.get(id))
				.find((u) => u && (u.kind === "drill" || u.kind === "words") && u.id !== input.next && u.status !== "locked");
	const weak =
		spot ??
		worseUnit ??
		all
			.filter(
				(u) => u.kind === "drill" && u.id !== input.next && lessonsBeforeToday(u.id) >= 1 && (u.accuracy ?? 1) < 0.85,
			)
			.sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))[0];
	const strengthenDone =
		Object.keys(day.units).some(
			(id) => id !== input.next && (lessonsBeforeToday(id) >= 1 || id === spot?.id) && (day.units[id] ?? 0) > 0,
		) ||
		day.blitz > 0 ||
		(day.mixups ?? 0) > 0 ||
		(day.personal ?? 0) > 0;
	const mixups = input.mixups ?? [];
	if (!spot && input.personal) {
		tasks.push({
			id: "strengthen",
			title: `Strengthen: Your plan · ${input.personal.focus}`,
			line: "Built from your own mistakes — the words, pairs and units your guide picked",
			minutes: TASK_MINUTES.strengthen,
			done: strengthenDone,
			href: "/lesson?mode=personal",
		});
	} else if (!spot && mixups.length > 0) {
		tasks.push({
			id: "strengthen",
			title: `Strengthen: Mix-ups · ${mixups[0]!.join(" / ")}`,
			line: `${mixups.length === 1 ? "A pair of words you mix up" : `${mixups.length} pairs of words you mix up`} — typed, both sides in turn, plus the look-alikes they predict`,
			minutes: TASK_MINUTES.strengthen,
			done: strengthenDone,
			href: "/lesson?mode=mixups",
		});
	} else if (weak) {
		const weakInfo = isUnitId(weak.id) ? unitInfo(weak.id) : undefined;
		const weakSlovak = weak.slovakTerm ?? weakInfo?.slovakTerm;
		const weakClean = weak.title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
		tasks.push({
			id: "strengthen",
			title: `Strengthen: ${weakClean}${weakSlovak ? ` · ${weakSlovak}` : ""}`,
			line: spot
				? `A weak spot on record — a typed lesson, mixed with related units`
				: worseUnit
					? `Slipping lately: ${Math.round((worseUnit.accuracy ?? 0) * 100)}% right — a typed lesson, mixed with related units`
					: `${Math.round((weak.accuracy ?? 0) * 100)}% right so far — a typed lesson, mixed with related units`,
			minutes: TASK_MINUTES.strengthen,
			done: strengthenDone,
			unit: weak.id,
			href: `/lesson?unit=${weak.id}`,
		});
	} else if (all.some((u) => u.kind === "drill" && lessonsBeforeToday(u.id) >= 1 && u.id !== "words")) {
		tasks.push({
			id: "blitz",
			title: "Blitz",
			line: "60 seconds across everything you have started",
			minutes: TASK_MINUTES.blitz,
			done: strengthenDone,
			href: "/lesson?mode=blitz",
		});
	}

	// 5. Words: the first open words unit that is not already the lesson.
	//    A words unit that Strengthen already takes is left to it.
	const wordsUnit = all.find(
		(u) =>
			u.kind === "words" && u.id !== input.next && u.id !== spot?.id && (u.status === "open" || u.status === "started"),
	);
	if (wordsUnit) {
		const wordsDone = Object.keys(day.units).some(
			(id) => byId.get(id)?.kind === "words" && id !== input.next && id !== spot?.id && (day.units[id] ?? 0) > 0,
		);
		const wordsInfo = isUnitId(wordsUnit.id) ? unitInfo(wordsUnit.id) : undefined;
		const wordsSlovak = wordsUnit.slovakTerm ?? wordsInfo?.slovakTerm;
		const wordsClean = wordsUnit.title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
		tasks.push({
			id: "words",
			title: `Words: ${wordsClean}${wordsSlovak ? ` · ${wordsSlovak}` : ""}`,
			line: wordsUnit.tagline,
			minutes: TASK_MINUTES.words,
			done: wordsDone,
			unit: wordsUnit.id,
			href: `/lesson?unit=${wordsUnit.id}`,
		});
	}

	// 6. Read: an episode at the learner's level (src/core/reading.ts) —
	//    easy graded reading at ~97% known words, the input the plan had
	//    none of, where words are met again between lessons.
	const readDone = (day.reads ?? 0) > 0;
	tasks.push({
		id: "read",
		title: input.story ? `Read: ${input.story}` : "Read",
		line: input.story
			? readDone
				? "Read today"
				: "Tap any word for its meaning"
			: readDone
				? "Read today's part of the story"
				: "Read the next part of the story — tap any word for its meaning",
		minutes: TASK_MINUTES.read,
		done: readDone,
		href: "/read",
	});

	// 6b. Watch: a YouTube video the learner pasted in (src/core/watch.ts),
	//     both subtitles, one line at a time. Only while one waits: the
	//     learner chooses the videos, the plan keeps them in view.
	if (input.watch) {
		tasks.push({
			id: "watch",
			title: `Watch: ${input.watch.title}`,
			line:
				(day.watches ?? 0) > 0
					? "Watched today"
					: input.watch.coverage === undefined
						? `${input.watch.captionLang ?? "Other-language"} captions — listen first, then reveal`
						: `${input.watch.estimated ? "About " : ""}${Math.round(input.watch.coverage * 100)} of every 100 words known — listen first, then reveal`,
			minutes: input.watch.minutes,
			done: (day.watches ?? 0) > 0,
			href: `/watch?id=${input.watch.id}`,
		});
	}

	// 7. Speak: output with feedback. A tutor unit in the current chapter
	//    first; else a spoken scene (src/core/speak.ts): the chapter's own
	//    scene and the ones the learner's purposes ask for, rotating day
	//    by day, said out loud with the tutor answering in voice.
	const current = state.chapters.find((c) => c.id === state.current);
	const tutorUnit = current?.units.find((u) => u.kind === "tutor" && (u.status === "open" || u.status === "started"));
	const chapterScene = current?.units.find((u) => u.kind === "goal")?.scene;
	const scenes = [...new Set([chapterScene, ...(input.scenes ?? [])].filter((s): s is string => !!s))];
	const scene = scenes.length ? scenes[input.dayOfYear % scenes.length] : undefined;
	const speakDone = (day.speaks ?? 0) + (tutorUnit ? day.tutors : 0) > 0;
	if (tutorUnit) {
		const tutorClean = tutorUnit.title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
		tasks.push({
			id: "speak",
			title: `With the tutor: ${tutorClean}`,
			line: `${tutorUnit.tagline} · ${tutorUnit.lessons}/${TUTOR_SESSIONS} sessions`,
			minutes: TASK_MINUTES.speak,
			done: speakDone,
			unit: tutorUnit.id,
			via: "tutor",
		});
	} else if (scene) {
		tasks.push({
			id: "speak",
			title: "Speak",
			line:
				scene === chapterScene
					? "Say the chapter's scene out loud — the tutor answers and asks you to fix your slips"
					: "Say a scene from your goals out loud — the tutor answers and asks you to fix your slips",
			minutes: TASK_MINUTES.speak,
			done: speakDone,
			unit: scene,
			via: "speak",
			href: `/speak?scene=${scene}`,
		});
	} else {
		tasks.push({
			id: "speak",
			title: "Speak",
			line: "A scene out loud — the tutor answers and asks you to fix your slips",
			minutes: TASK_MINUTES.speak,
			done: speakDone,
			via: "speak",
			href: "/speak",
		});
	}

	// 8. Speed: fluency on what is already known (src/core/fluency.ts). A
	//    timed re-read of an episode read before, alternating with "say it
	//    faster" on known sentences; the latter alone until an episode has
	//    been read.
	const fluencyDone = (day.rereads ?? 0) + (day.fasts ?? 0) > 0;
	const rereadDay = input.reread && input.dayOfYear % 2 === 1;
	tasks.push(
		rereadDay
			? {
					id: "fluency",
					title: "Read it faster",
					line: "An episode you have read, against the clock — words a minute, then one question",
					minutes: TASK_MINUTES.fluency,
					done: fluencyDone,
					href: "/speed?mode=reread",
				}
			: {
					id: "fluency",
					title: "Speed",
					line: "Six sentences you know, each said three times in a shrinking window",
					minutes: TASK_MINUTES.fluency,
					done: fluencyDone,
					href: "/speed?mode=fast",
				},
	);

	// Cut to the planned minutes, keeping review and the lesson. A tight
	// budget keeps one task per strand before a second form-focused one
	// (input, speaking and speed before strengthen and words), so a short day
	// is still balanced rather than all drills (src/core/strands.ts).
	const budget = Math.max(5, input.minutesPerDay);
	const keep = new Set<TaskKind>();
	let used = 0;
	for (const t of [...tasks].sort((a, b) => BUDGET_ORDER[a.id] - BUDGET_ORDER[b.id])) {
		const must = t.id === "review" || t.id === "lesson";
		if (must || used + t.minutes <= budget || t.done) {
			keep.add(t.id);
			used += t.minutes;
		}
	}
	const kept = tasks.filter((t) => keep.has(t.id));
	const carried = new Map((input.carried ?? []).map((c) => [c.id, c.from]));
	const marked = kept.map((t) => (carried.has(t.id) && !t.done ? { ...t, from: carried.get(t.id) } : t));
	const ordered = [...marked.filter((t) => t.from), ...marked.filter((t) => !t.from)];
	return {
		minutes: kept.reduce((n, t) => n + t.minutes, 0),
		tasks: ordered,
		done: kept.filter((t) => t.done).length,
		total: kept.length,
	};
}

/** A tutor unit's first message: the brief plus the doctrine the practice
 *  prompt already follows (answer first, hint before reveal). */
export function tutorUnitPrompt(unit: CurriculumUnit): string {
	const cleanTitle = unit.title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
	return [
		`Lesson with the tutor: ${cleanTitle}. ${unit.brief ?? unit.tagline}`,
		"Keep it answer-first: explain in at most four short lines (with a bridge to a language I know where one helps), then give me eight quick problems one at a time, answered in the language I am learning.",
		"On a miss, name the trigger and let me try once more before you give the form. Use say: spans for every example in the language I am learning. End with the three forms to remember.",
	].join(" ");
}
