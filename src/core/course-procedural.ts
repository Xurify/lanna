/**
 * A course built from the dictionary alone, with no model (2026-11-05): the
 * free choice in the add dialog. It is plainer than a written one. The
 * lessons are the grammar cells the dictionary's forms fill most often
 * (cases by number, verb forms by tense and person), in that order; a rule
 * is a template naming the cell, with a real Tatoeba sentence as its
 * example; a case that the dictionary's prepositions decide gets those
 * prepositions as its trigger words. There are no word themes (only the
 * frequency bands), the tutor sessions are general, and there is no story
 * bible.
 *
 * The result goes through the same check as a written course
 * (checkCourse), so a unit with too few sentences is dropped either way.
 */

import {
	courseUnitsFor,
	type Course,
	type CourseChapter,
	type CourseGoal,
	type CourseStage,
	type CourseTutor,
	type CourseUnit,
} from "./course.ts";
import type { LexiconEntry } from "./review.ts";

/** Case names across the catalog's languages, as Wiktionary tags them. */
const CASES = [
	"nominative",
	"accusative",
	"genitive",
	"dative",
	"locative",
	"instrumental",
	"partitive",
	"illative",
	"inessive",
	"elative",
	"allative",
	"adessive",
	"ablative",
	"translative",
	"terminative",
	"essive",
	"abessive",
	"comitative",
	"prepositional",
];
/** Verb forms worth a lesson each, most basic first. */
const VERB_FORMS: Array<{ tags: string[]; title: string; term: string }> = [
	{ tags: ["present", "first-person"], title: "I and we: the present", term: "Present tense, first person" },
	{ tags: ["present", "second-person"], title: "You: the present", term: "Present tense, second person" },
	{ tags: ["present", "third-person"], title: "He, she, they: the present", term: "Present tense, third person" },
	{ tags: ["past"], title: "What happened: the past", term: "Past tense" },
	{ tags: ["imperative"], title: "Asking and telling: the imperative", term: "Imperative" },
	{ tags: ["future"], title: "What will happen: the future", term: "Future tense" },
	{ tags: ["conditional"], title: "Would: the conditional", term: "Conditional mood" },
	{ tags: ["subjunctive"], title: "The subjunctive", term: "Subjunctive mood" },
];
const NUMBERS = ["singular", "plural"] as const;

const GLYPHS: Record<string, string> = {
	nominative: "copy",
	accusative: "coffee",
	genitive: "door-open",
	dative: "gift",
	locative: "map-pin",
	instrumental: "handshake",
	partitive: "layers",
	illative: "door-open",
	inessive: "map-pin",
	elative: "route",
	allative: "signpost",
	adessive: "map-pin",
	ablative: "route",
	translative: "repeat",
	essive: "user",
	comitative: "handshake",
	abessive: "ban",
	terminative: "flag",
	prepositional: "map-pin",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Candidate {
	unit: CourseUnit;
	sentences: number;
	example?: { text: string; answer: string; lemma: string; words: number; rank: number };
}

/** How many sentences a unit would drill, and an example: a sentence of
 *  three to eight words on the commonest word that has one (the shortest
 *  sentences are often a stray form such as "ok" read as a form of "oko"). */
function measure(unit: CourseUnit, entries: readonly LexiconEntry[], tag: string): Candidate {
	let sentences = 0;
	let example: Candidate["example"];
	for (const e of entries) {
		for (const ex of e.examples) {
			if (ex.rejected || !courseUnitsFor([unit], e, ex, tag).length) continue;
			sentences++;
			const text = ex.text ?? ex.sk ?? "";
			const words = text.split(/\s+/).length;
			const fits = (n: number) => n >= 3 && n <= 8;
			const better = !example || (fits(words) && (!fits(example.words) || (e.rank ?? Infinity) < example.rank));
			if (better)
				example = { text, answer: ex.cloze!.answer, lemma: e.lemma ?? e.sk ?? "", words, rank: e.rank ?? Infinity };
		}
	}
	return { unit, sentences, ...(example ? { example } : {}) };
}

/** Which case each preposition takes, read from the sentences: the case of
 *  the unambiguous noun forms right after it, when one case has at least
 *  two thirds of them and three sentences. ("útoku" is genitive, dative
 *  and locative alike, so it says nothing about the "do" before it.) */
function prepositionCases(
	entries: readonly LexiconEntry[],
	preps: ReadonlySet<string>,
	tag: string,
): Map<string, string> {
	const tally = new Map<string, Map<string, number>>();
	for (const e of entries) {
		if (e.cat !== "Nouns") continue;
		for (const ex of e.examples) {
			const c = ex.cloze;
			const text = ex.text ?? ex.sk ?? "";
			if (!c) continue;
			const cells =
				Object.entries(e.formTags ?? {}).find(
					([f]) => f.toLocaleLowerCase(tag) === c.answer.toLocaleLowerCase(tag),
				)?.[1] ?? [];
			const cases = new Set(
				cells.flatMap((cell) => cell.split(" ").filter((t) => CASES.includes(t) && t !== "vocative")),
			);
			if (cases.size !== 1) continue;
			const prev = (text.slice(0, c.at).trim().split(/\s+/).pop() ?? "")
				.toLocaleLowerCase(tag)
				.replace(/[^\p{L}]/gu, "");
			if (!preps.has(prev)) continue;
			const kase = [...cases][0]!;
			const t = tally.get(prev) ?? new Map<string, number>();
			t.set(kase, (t.get(kase) ?? 0) + 1);
			tally.set(prev, t);
		}
	}
	const out = new Map<string, string>();
	for (const [prep, t] of tally) {
		const total = [...t.values()].reduce((x, y) => x + y, 0);
		const [kase, n] = [...t.entries()].sort((x, y) => y[1] - x[1])[0]!;
		if (n >= 3 && n / total >= 2 / 3) out.set(prep, kase);
	}
	return out;
}

/** The prepositions that take this case, commonest first. */
function triggersFor(kase: string, byPrep: ReadonlyMap<string, string>): string[] {
	return [...byPrep.entries()]
		.filter(([, k]) => k === kase)
		.map(([p]) => p)
		.slice(0, 6);
}

const TUTORS = (language: string): CourseTutor[] => [
	{
		id: "sounds",
		title: "Sounds and spelling",
		tagline: "How it is written and said",
		glyph: "ear",
		brief: `${language} sounds and spelling: the letters an English speaker lacks, where the stress falls, and the spellings that trip learners. Give every example as a say: span so I can hear it, then test me on hearing and spelling them.`,
	},
	{
		id: "address",
		title: "Formal and informal you",
		tagline: "Who you say what to",
		glyph: "handshake",
		brief: `How ${language} speakers address a stranger, a colleague and a friend, and the verb forms and greetings that go with each. Give me short exchanges and have me pick the right form.`,
	},
	{
		id: "questions",
		title: "Asking questions",
		tagline: "Question words and yes/no",
		glyph: "message-circle-question",
		brief: `Asking questions in ${language}: the question words and how a yes/no question is built. Ask me to turn statements into questions and answer yours.`,
	},
	{
		id: "numbers",
		title: "Numbers, time and dates",
		tagline: "Counting, the clock, the calendar",
		glyph: "hash",
		brief: `Numbers in ${language} and what they do to the noun after them, telling the time, days and dates. Drill me with prices, times and appointments.`,
	},
	{
		id: "word-order",
		title: "Word order",
		tagline: "What comes first, and why",
		glyph: "arrow-right-left",
		brief: `${language} word order: where the verb goes, where the little words go, and what moves for emphasis. Give me jumbled sentences to put in order and explain each fix in one line.`,
	},
	{
		id: "storytelling",
		title: "Telling what happened",
		tagline: "A story in the past",
		glyph: "book-open",
		brief: `Telling a short story in ${language} in the past: sequence words and the past forms. Have me tell you about my weekend in five sentences and correct them one at a time.`,
	},
	{
		id: "opinions",
		title: "Giving an opinion",
		tagline: "I think, because, but",
		glyph: "megaphone",
		brief: `Giving and defending an opinion in ${language}: I think, because, but, on the other hand. Ask me questions about everyday topics and push back on my answers.`,
	},
	{
		id: "register",
		title: "Formal and everyday",
		tagline: "Writing an email, talking to friends",
		glyph: "pen-line",
		brief: `Register in ${language}: the formal email against everyday speech. Have me write a short formal email, then say the same thing to a friend, and correct both.`,
	},
];

const GOALS: CourseGoal[] = [
	{ id: "can-introduce", title: "Can introduce myself", tagline: "Name, origin, work", scene: "colleague" },
	{ id: "can-order", title: "Can order in a café", tagline: "Coffee, cake, the bill", scene: "cafe" },
	{ id: "can-directions", title: "Can ask the way", tagline: "Where is the station?", scene: "way" },
	{ id: "can-family", title: "Can talk about family", tagline: "Who is who", scene: "family" },
	{ id: "can-shop", title: "Can shop at the market", tagline: "Prices and amounts", scene: "shop" },
	{ id: "can-doctor", title: "Can see a doctor", tagline: "What hurts and since when", scene: "doctor" },
	{ id: "can-travel", title: "Can buy a ticket", tagline: "Trains and platforms", scene: "station" },
	{ id: "can-eat-out", title: "Can eat out", tagline: "Ordering a meal", scene: "restaurant" },
	{ id: "can-stay", title: "Can check into a hotel", tagline: "A room for two nights", scene: "hotel" },
	{ id: "can-tell-story", title: "Can tell what happened", tagline: "A story in the past" },
	{ id: "can-opinion", title: "Can give an opinion", tagline: "And defend it" },
	{ id: "can-write-formal", title: "Can write a formal email", tagline: "The right register" },
];

/** The free course: lessons from the dictionary's grammar, in the order a
 *  learner meets forms most, spread over chapters with general tutor
 *  sessions and the Speak scenes as goals. */
export function proceduralCourse(
	entries: readonly LexiconEntry[],
	language: string,
	english: string,
	tag: string,
): Course {
	const preps = new Set(
		entries.filter((e) => e.cat === "Prepositions").map((e) => (e.lemma ?? e.sk ?? "").toLocaleLowerCase(tag)),
	);
	const byPrep = prepositionCases(entries, preps, tag);
	const present = new Set<string>();
	for (const e of entries)
		for (const cells of Object.values(e.formTags ?? {}))
			for (const c of cells) for (const t of c.split(" ")) present.add(t);

	const candidates: Candidate[] = [];
	// Verb forms first: the present by person, then the other tenses.
	const indicative = present.has("indicative");
	for (const v of VERB_FORMS) {
		if (!v.tags.every((t) => present.has(t))) continue;
		const id = `v-${v.tags.join("-")}`;
		// Wiktionary tags some imperatives "present" too; "indicative" keeps them out of the tenses.
		const tags = indicative && ["present", "future"].includes(v.tags[0]!) ? [...v.tags, "indicative"] : v.tags;
		candidates.push(
			measure(
				{
					id,
					kind: "grammar",
					title: v.title,
					tagline: v.term,
					rule: "",
					glyph: v.tags.includes("past") ? "history" : v.tags.includes("imperative") ? "megaphone" : "users",
					grammarTerm: v.term,
					cat: "Verbs",
					tags,
				},
				entries,
				tag,
			),
		);
	}
	// Cases by number; a case that its prepositions decide gets them as triggers.
	for (const kase of CASES) {
		if (!present.has(kase) || kase === "nominative") continue;
		const after = triggersFor(kase, byPrep);
		for (const number of NUMBERS) {
			const id = `${kase}-${number}`;
			const unit: CourseUnit = {
				id,
				kind: "grammar",
				title: `${cap(kase)} ${number}`,
				tagline: after.length ? `After ${after.slice(0, 3).join(", ")}` : `The ${kase} ${number}`,
				rule: "",
				glyph: GLYPHS[kase] ?? "book",
				grammarTerm: `${cap(kase)} case, ${number}`,
				cat: "Nouns",
				tags: [kase, number],
			};
			const plain = measure(unit, entries, tag);
			const triggered = after.length ? measure({ ...unit, after }, entries, tag) : null;
			// The preposition is a cue the learner can see: keep it when it still
			// leaves a lesson (it also lets in forms a case shares with another).
			candidates.push(
				triggered && triggered.sentences >= 12 && triggered.sentences >= 0.6 * plain.sentences ? triggered : plain,
			);
		}
	}
	if (present.has("nominative") && present.has("plural")) {
		candidates.push(
			measure(
				{
					id: "nominative-plural",
					kind: "grammar",
					title: "More than one",
					tagline: "The plural",
					rule: "",
					glyph: "copy",
					grammarTerm: "Nominative plural",
					cat: "Nouns",
					tags: ["nominative", "plural"],
				},
				entries,
				tag,
			),
		);
	}

	const kept = candidates.filter((c) => c.sentences >= 12 && c.example);
	// Verbs keep their order; cases go most common first, singular before plural.
	const verbs = kept.filter((c) => c.unit.cat === "Verbs");
	const nouns = kept.filter((c) => c.unit.cat !== "Verbs").sort((a, b) => b.sentences - a.sentences);
	const ordered: Candidate[] = [];
	while (verbs.length || nouns.length) {
		if (verbs.length) ordered.push(verbs.shift()!);
		if (nouns.length) ordered.push(nouns.shift()!);
		if (nouns.length) ordered.push(nouns.shift()!);
	}
	const units: CourseUnit[] = ordered.map(({ unit, example }) => {
		const eg = `${example!.text} (${example!.answer}, from ${example!.lemma})`;
		const name = unit.grammarTerm ?? unit.title;
		return {
			...unit,
			rule: unit.after?.length
				? `After ${unit.after.join(", ")}, a noun takes the ${unit.tags!.filter((t) => CASES.includes(t)).join(" ")}: ${eg}.`
				: `${name}: ${eg}.`,
		};
	});

	// Chapters: two or three lessons, a tutor session, a goal.
	const tutors = TUTORS(english);
	const chapterCount = Math.max(3, Math.min(GOALS.length, Math.ceil(units.length / 2)));
	const stageOf = (i: number): CourseStage => {
		const share = i / chapterCount;
		return share < 0.45 ? "a1" : share < 0.8 ? "a2" : share < 0.95 ? "b1" : "b2";
	};
	const chapters: CourseChapter[] = [];
	const usedTutors: CourseTutor[] = [];
	const usedGoals: CourseGoal[] = [];
	let u = 0;
	for (let i = 0; i < chapterCount; i++) {
		const left = chapterCount - i;
		const take = Math.ceil((units.length - u) / left);
		const ids = units.slice(u, u + take).map((x) => x.id);
		u += take;
		const tutor = tutors[i % tutors.length]!;
		if (i < tutors.length) {
			ids.push(tutor.id);
			usedTutors.push(tutor);
		}
		const goal = GOALS[i]!;
		ids.push(goal.id);
		usedGoals.push(goal);
		chapters.push({
			id: `chapter-${i + 1}`,
			stage: stageOf(i),
			title: goal.title.replace(/^Can /, ""),
			tagline:
				units
					.filter((x) => ids.includes(x.id))
					.map((x) => x.title)
					.join(", ") || tutor.title,
			units: ids,
		});
	}
	return {
		language,
		code: tag.split("-")[0]!,
		tag,
		version: 1,
		draft: true,
		units,
		tutors: usedTutors,
		goals: usedGoals,
		chapters,
	};
}
