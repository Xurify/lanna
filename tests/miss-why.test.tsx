import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-miss-why-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

// ESM evaluates static imports before this module's body, so the app modules are imported after the env is set.

const { reviewMiss } = await import("../src/server/review.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { exampleText } = await import("../src/core/review.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { MissWhy } = await import("../components/miss-why.tsx");
type ReviewCard = import("../src/core/review.ts").ReviewCard;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = "2026-11-07T10:00:00Z";
const lexicon = loadLexicon()!;
const cards: Record<string, ReviewCard> = {};
const cardFor = (slug: string, sentence: string): string => {
	const entry = lexicon.bySlug.get(slug)!;
	const example = entry.examples.find((e) => exampleText(e) === sentence)!;
	const id = `${slug}#${sentence}`;
	cards[id] = {
		id,
		slug,
		lemma: entry.lemma ?? entry.sk ?? "",
		gloss: "",
		sentence,
		translation: example.en,
		answer: example.cloze!.answer,
		at: example.cloze!.at,
		state: "new",
		due: NOW,
		reps: 0,
		lapses: 0,
		createdAt: NOW,
	};
	return id;
};

const CASES: { why: string; slug: string; sentence: string; given: string; says: string[]; never?: string[] }[] = [
	{
		why: "two words for the same meaning: the two are set side by side, and the question word is shown asking",
		slug: "ked",
		sentence: "Keď bolo pekne, išli sme von.",
		given: "Kedy",
		says: [
			"You wrote Kedy when",
			"Needed here keď when (conjunction)",
			"Both can mean when.",
			"Kedy asks a question: Kedy prídeš? When will you come?",
		],
		never: ["a different word", "Here keď asks"],
	},
	{
		why: "the same pair the other way round: the card's own question is named",
		slug: "kedy",
		sentence: "Kedy prídeš?",
		given: "Keď",
		says: ["You wrote Keď when (conjunction)", "Needed here kedy when", "Here kedy asks a question."],
		never: ["Keď asks"],
	},
	{
		why: "a missing háček names the word the app read",
		slug: "kedy",
		sentence: "Kedy prídeš?",
		given: "Ked",
		says: ["You wrote Ked keď, when (conjunction)"],
		never: ["a form of"],
	},
	{
		why: "two question words: neither is said to ask",
		slug: "kto",
		sentence: "Kto je to?",
		given: "čo",
		says: ["You wrote čo what", "Needed here kto who", "Čo robíš?"],
		never: ["asks a question", "Both can mean"],
	},
	{
		why: "a curated pair rule replaces the example",
		slug: "kde",
		sentence: "Kde bývaš?",
		given: "Kam",
		says: [
			"You wrote Kam where to",
			"kam asks where TO (a destination: Kam ideš?); kde asks where AT (a place: Kde bývaš?).",
			"From Mix-ups, the app's word pairs.",
		],
		never: ["Kam ideš? Where are you going?"],
	},
	{
		why: "a family rule covers a pair the pair list does not",
		slug: "tu",
		sentence: "Som tu.",
		given: "sem",
		says: [
			"You wrote sem here (to)",
			"Needed here tu here (location — for motion use sem)",
			"Both can mean here.",
			"After a verb of motion the word says where to",
		],
	},
	{
		why: "a curated rule for two verbs of going, with the meaning they share",
		slug: "ist",
		sentence: "Idem do školy.",
		given: "chodím",
		says: [
			"You wrote chodím a form of chodiť, to go (habitually)",
			"Needed here idem ísť, to go I form",
			"ísť is one trip, now or planned; chodiť is repeated, a habit.",
		],
		never: ["Chodím do školy."],
	},
	{
		why: "an aspect pair from the reference says which is which, with the curated aspect rule",
		slug: "dostat",
		sentence: "Dostanem knihu.",
		given: "dostávam",
		says: [
			"You wrote dostávam a form of dostávať, to get Needed here",
			"Needed here dostanem dostať, to get I form",
			"dostávať · imperfective: the process, a habit or the act itself",
			"dostať · perfective: one act seen as finished, with a result",
			"From the reference: Aspect and Motion Verbs.",
		],
		never: ["Každý mesiac", "(imperfective)", "The English tense", "The sentence needs the"],
	},
	{
		why: "a reference table sets two prepositions side by side, one line each",
		slug: "v",
		sentence: "Som v meste.",
		given: "na",
		says: [
			"You wrote na on",
			"Needed here v at",
			"be inside/at a place: v/vo + locative — Som v škole.",
			"be on/at an event/institution: na + locative — Som na stanici.",
			"From the reference: Valency and Prepositions.",
		],
	},
	{
		why: "a reference row sets two verbs of living side by side",
		slug: "byvat",
		sentence: "Bývam v hoteli.",
		given: "žijem",
		says: [
			"live: reside at an address bývať (Bývam v Košiciach.)",
			"live: live a life, exist žiť (Žije v zahraničí.)",
			"From the reference: Lexical Choice and Interference.",
		],
	},
	{
		why: "a noun and an adjective with one meaning are named as such",
		slug: "voda",
		sentence: "Pijem veľa vody.",
		given: "vodný",
		says: ["You wrote vodný adjective · water", "Needed here vody noun · voda, water", "Both can mean water."],
	},
	{
		why: "the shared meaning comes from any sense, not only the first",
		slug: "iba",
		sentence: "Máme iba čaj.",
		given: "len",
		says: ["Both can mean only."],
	},
	{
		why: "a form of another word names its dictionary form",
		slug: "vecera",
		sentence: "Večera je o šiestej.",
		given: "večerom",
		says: ["You wrote večerom a form of večer, evening", "Needed here večera dinner", "Dobrý večer!"],
	},
	{
		why: "a missing accent on another word's dictionary form is not 'a form of' it",
		slug: "vecera",
		sentence: "Večera je o šiestej.",
		given: "vecer",
		says: ["You wrote vecer večer, evening"],
		never: ["a form of"],
	},
	{
		why: "an unknown word for a word that never takes an ending says which word it is",
		slug: "ked",
		sentence: "Keď bolo pekne, išli sme von.",
		given: "kedž",
		says: ["You wrote kedž not a word the dictionary knows", "Needed here keď when (conjunction)"],
		never: ["not a form", "(when (conjunction))"],
	},
	{
		why: "an extra ending on a word that never takes one is not 'another ending'",
		slug: "potom",
		sentence: "Tomáš nalial mlieko do pohára a potom ho podal Márii.",
		given: "potomx",
		says: ["You wrote potomx not a word the dictionary knows", "Needed here potom then"],
		never: ["another ending"],
	},
	{
		why: "an unknown word for a word with endings says it is not one of them",
		slug: "vecera",
		sentence: "Večera je o šiestej.",
		given: "xyz",
		says: ["You wrote xyz not a form of večera"],
	},
	{
		why: "another form of the card's own word is about the ending",
		slug: "vecera",
		sentence: "Večera je o šiestej.",
		given: "večeru",
		says: ["You wrote večeru večera with another ending", "Needed here večera dinner"],
		never: ["another word"],
	},
	{
		why: "no answer shows only the word the sentence needs",
		slug: "vecera",
		sentence: "Večera je o šiestej.",
		given: "",
		says: ["The word here večera dinner"],
		never: ["You wrote"],
	},
];

const ids = CASES.map((c) => cardFor(c.slug, c.sentence));
reviewStore.writeCards(cards);

const textOf = (html: string) =>
	html
		.replace(/<\/(p|div)>|<[a-z]+ [^>]*class="[^"]*\bblock\b[^"]*"[^>]*>/g, " ")
		.replace(/<[^>]+>/g, "")
		.replace(/&#x27;/g, "'")
		.replace(/\s+/g, " ")
		.trim();

CASES.forEach((c, i) => {
	test(c.why, () => {
		const reason = reviewMiss(ids[i]!, c.given);
		assert.ok(reason, `a wrong answer "${c.given}" has a reason`);
		const text = textOf(
			renderToStaticMarkup(<MissWhy reason={reason} given={c.given} answer={cards[ids[i]!]!.answer} />),
		);
		for (const s of c.says) assert.ok(text.includes(s), `"${s}" in: ${text}`);
		for (const s of c.never ?? []) assert.ok(!text.includes(s), `no "${s}" in: ${text}`);
	});
});
