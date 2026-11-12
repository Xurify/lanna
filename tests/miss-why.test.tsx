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
	cards[id] = { id, slug, lemma: entry.lemma ?? entry.sk ?? "", gloss: "", sentence, translation: example.en, answer: example.cloze!.answer, at: example.cloze!.at, state: "new", due: NOW, reps: 0, lapses: 0, createdAt: NOW };
	return id;
};

const CASES: { why: string; slug: string; sentence: string; given: string; says: string[]; never?: string[] }[] = [
	{
		why: "two words for the same meaning: the question word is shown asking, in its own sentence",
		slug: "ked",
		sentence: "Keď bolo pekne, išli sme von.",
		given: "Kedy",
		says: ["“Kedy” also means when, but it is another word.", "“Kedy” asks a question: Kedy prídeš? When will you come?", "This one is keď, when (conjunction)."],
		never: ["a different word", "means when:", "Here it asks"],
	},
	{ why: "the same pair the other way round: the gloss's note and the card's question are named", slug: "kedy", sentence: "Kedy prídeš?", given: "Keď", says: ["“Keď” also means when (conjunction), but it is another word.", "This one is kedy, when. Here it asks a question."], never: ["“Keď” asks"] },
	{ why: "a missing háček names the word the app read", slug: "kedy", sentence: "Kedy prídeš?", given: "Ked", says: ["“Ked” is keď, which also means when (conjunction)"], never: ["a form of"] },
	{ why: "two question words: neither is said to ask", slug: "kto", sentence: "Kto je to?", given: "čo", says: ["“čo” means what. It is another word.", "Čo robíš?"], never: ["asks a question"] },
	{ why: "a curated pair rule replaces the example", slug: "kde", sentence: "Kde bývaš?", given: "Kam", says: ["“Kam” means where to. It is another word.", "kam asks where TO (a destination: Kam ideš?); kde asks where AT (a place: Kde bývaš?).", "This one is kde, where."] },
	{ why: "a family rule covers a pair the pair list does not", slug: "tu", sentence: "Som tu.", given: "sem", says: ["“sem” also means here (to), but it is another word.", "After a verb of motion the word says where to", "This one is tu, here (location — for motion use sem)."] },
	{ why: "a curated rule for two verbs of going, with the gloss's note", slug: "ist", sentence: "Idem do školy.", given: "chodím", says: ["“chodím” is a form of chodiť, which also means to go (habitually)", "ísť is one trip, now or planned; chodiť is repeated, a habit.", "This one is ísť, to go."], never: ["Chodím do školy."] },
	{ why: "an aspect marked on the whole entry is named", slug: "dostat", sentence: "Dostanem knihu.", given: "dostávam", says: ["“dostávam” is a form of dostávať, which also means to get (imperfective)", "This one is dostať, to get."] },
	{ why: "a noun and an adjective with one meaning are named as such", slug: "voda", sentence: "Pijem veľa vody.", given: "vodný", says: ["“vodný” is an adjective, which also means water, but it is another word.", "This one is the noun voda, water."] },
	{ why: "the shared meaning comes from any sense, not only the first", slug: "iba", sentence: "Máme iba čaj.", given: "len", says: ["“len” also means only"] },
	{ why: "a form of another word names its dictionary form", slug: "vecera", sentence: "Večera je o šiestej.", given: "večerom", says: ["“večerom” is a form of večer, evening. It is another word.", "Dobrý večer!", "This one is večera, dinner."] },
	{ why: "a missing accent on another word's dictionary form is not 'a form of' it", slug: "vecera", sentence: "Večera je o šiestej.", given: "vecer", says: ["“vecer” is večer, evening."], never: ["a form of"] },
	{ why: "an unknown word for a word that never takes an ending says which word it is", slug: "ked", sentence: "Keď bolo pekne, išli sme von.", given: "kedž", says: ["The word here is keď, when (conjunction)."], never: ["not a form", "(when (conjunction))"] },
	{ why: "an extra ending on a word that never takes one is not 'another ending'", slug: "potom", sentence: "Tomáš nalial mlieko do pohára a potom ho podal Márii.", given: "potomx", says: ["The word here is potom, then."], never: ["another ending"] },
	{ why: "an unknown word for a word with endings says it is not one of them", slug: "vecera", sentence: "Večera je o šiestej.", given: "xyz", says: ["“xyz” is not a form of večera, dinner."] },
	{ why: "another form of the card's own word is about the ending", slug: "vecera", sentence: "Večera je o šiestej.", given: "večeru", says: ["“večeru” is večera with another ending."], never: ["another word"] },
	{ why: "no answer names the word", slug: "vecera", sentence: "Večera je o šiestej.", given: "", says: ["The word here is večera, dinner."] },
];

const ids = CASES.map((c) => cardFor(c.slug, c.sentence));
reviewStore.writeCards(cards);

const textOf = (html: string) =>
	html
		.replace(/<\/p>/g, " ")
		.replace(/<[^>]+>/g, "")
		.replace(/&#x27;/g, "'")
		.replace(/\s+/g, " ")
		.trim();

CASES.forEach((c, i) => {
	test(c.why, () => {
		const reason = reviewMiss(ids[i]!, c.given);
		assert.ok(reason, `a wrong answer "${c.given}" has a reason`);
		const text = textOf(renderToStaticMarkup(<MissWhy reason={reason} given={c.given} />));
		for (const s of c.says) assert.ok(text.includes(s), `"${s}" in: ${text}`);
		for (const s of c.never ?? []) assert.ok(!text.includes(s), `no "${s}" in: ${text}`);
	});
});
