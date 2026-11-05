/**
 * ADDING A LANGUAGE FROM THE APP (2026-11-05): the word rules on a few
 * Wiktionary lines, and the background task end to end on a fake network,
 * in a throwaway data folder.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-language-add-"));
process.env.LH_DATA_DIR = dir;
delete process.env.LH_PROFILE;

const build = await import("../src/core/language-build.ts");
const { languageById, parseLanguageInfo, referenceLink } = await import("../src/core/language.ts");
const config = await import("../config.ts");
const startModule = await import("../src/server/language-add.ts");
const { languageCatalog, startLanguageAdd } = startModule;
const { profileLanguage } = await import("../src/server/active-language.ts");
const { profileStatus } = await import("../src/server/language.ts");
const { listTasks, resetTasks } = await import("../src/server/tasks.ts");

const TAG = "cs-CZ";

const kaikki = (o: object) => JSON.stringify(o);

describe("reading Wiktionary entries", () => {
	test("a lemma keeps its table forms, skips dated ones, romanizations and related words", () => {
		const { word } = build.readKaikkiEntry({
			word: "кошка",
			pos: "noun",
			senses: [{ glosses: ["cat"], tags: ["feminine", "animate"] }],
			forms: [
				{ form: "ко́шки", tags: ["genitive", "singular"], source: "declension" },
				{ form: "ко́шкѣ", tags: ["dated", "dative", "singular"], source: "declension" },
				{ form: "koški", tags: ["genitive", "singular"], source: "declension" },
				{ form: "ко́шечка", tags: ["diminutive"] },
				{ form: "ru-noun-table", tags: ["inflection-template"], source: "declension" },
			],
		});
		assert.deepEqual(word?.forms, ["кошки"]);
		assert.equal(word?.gender, "feminine");
		assert.deepEqual(word?.glosses, ["cat"]);
	});

	test("letter names, names and affixes are not words; a nested sense gives its own gloss", () => {
		assert.equal(build.readKaikkiEntry({ word: "я", pos: "noun", senses: [{ glosses: ["The name of the Cyrillic script letter Я."] }] }).word, null);
		assert.equal(build.readKaikkiEntry({ word: "Praha", pos: "name", senses: [{ glosses: ["Prague"] }] }).word, null);
		const v = build.readKaikkiEntry({ word: "в", pos: "prep", senses: [{ glosses: ["[with prepositional]", "in, at"] }] }).word;
		assert.deepEqual(v?.glosses, ["in, at"]);
	});

	test("a form-of entry names its lemma, but a diminutive does not", () => {
		assert.deepEqual(build.readKaikkiEntry({ word: "kun", pos: "noun", senses: [{ glosses: ["genitive plural of kuna"], tags: ["form-of"], form_of: [{ word: "kuna" }] }] }).formOf, [
			{ form: "kun", lemma: "kuna", pos: "noun", tags: [] },
		]);
		assert.deepEqual(build.readKaikkiEntry({ word: "kočička", pos: "noun", senses: [{ glosses: ["diminutive of kočka"], tags: ["diminutive", "form-of"], form_of: [{ word: "kočka" }] }] }).formOf, []);
	});

	test("the line filter looks only at word fields", () => {
		const wanted = new Set(["kočka"]);
		assert.equal(build.lineMayMatter(kaikki({ word: "Kočka", pos: "noun" }), wanted, TAG), true);
		assert.equal(build.lineMayMatter(kaikki({ word: "pes", pos: "noun", glosses: ["not a kočka"] }), wanted, TAG), false);
	});

	test("stress marks go only from Cyrillic", () => {
		assert.equal(build.stripStress("молоко́"), "молоко");
		assert.equal(build.stripStress("káva"), "káva");
	});
});

const word = (lemma: string, pos: string, forms: string[] = [], glosses = [lemma]): import("../src/core/language-build.ts").BuildWord => ({ key: `${lemma}\u0000${pos}`, lemma, pos, glosses, forms });

describe("ranking and sentences", () => {
	test("non-inflecting entries of one spelling become one row; a noun spelled the same stays apart and ranks by its own forms", () => {
		const merged = build.mergeHomographs([word("jak", "adv", [], ["how"]), word("jak", "conj", [], ["as"]), word("jak", "noun", ["jaka", "jaků"], ["yak"])], TAG);
		assert.equal(merged.length, 2);
		assert.deepEqual(merged.find((w) => w.pos === "adv")?.glosses, ["how", "as"]);
		const freq = new Map([["jak", 1], ["jaků", 900]]);
		const ranked = build.rankWords(merged, freq, TAG, 10);
		assert.deepEqual(ranked.map((w) => [w.lemma, w.pos, w.rank]), [["jak", "adv", 1], ["jak", "noun", 900]]);
	});

	test("a sentence goes to the word that alone owns the token, or whose dictionary form it is; the blank sits on the token", () => {
		const words = [
			{ ...word("kočka", "noun", ["kočku"]), rank: 3 },
			{ ...word("děkuji", "intj"), rank: 5 },
			{ ...word("děkovat", "verb", ["děkuji"]), rank: 9 },
		];
		const c = new build.ExampleCollector(words, TAG, 2);
		c.add({ id: 1, text: "Vidím kočku.", en: "I see the cat." });
		c.add({ id: 2, text: "Děkuji.", en: "Thank you." });
		const cat = c.examples.get("kočka\u0000noun")!;
		assert.deepEqual(cat[0], { text: "Vidím kočku.", en: "I see the cat.", src: "tatoeba", tatoebaId: 1, cloze: { answer: "kočku", at: 6 } });
		assert.equal(c.examples.get("děkuji\u0000intj")?.length, 1);
		assert.equal(c.examples.get("děkovat\u0000verb"), undefined);
	});

	test("usable sentences are short and have no digits", () => {
		assert.equal(build.sentenceUsable("Kočka spí."), true);
		assert.equal(build.sentenceUsable("Mám 3 kočky."), false);
		assert.equal(build.sentenceUsable("Ano."), false);
	});

	test("the letter bar gets Latin letters an English keyboard lacks, and nothing for another script", () => {
		assert.deepEqual(build.specialLettersOf(["čaj", "čas", "často", "řeka", "řád", "moře"], TAG), ["č", "ř"]);
		assert.deepEqual(build.specialLettersOf(["кошка", "кот", "кто"], "ru-RU"), []);
	});

	test("a frequency list ranks from 1 and skips numbers", () => {
		assert.deepEqual([...build.parseFrequency("to 100\n42 90\nJe 80\nto 70\n", TAG).entries()], [["to", 1], ["je", 2]]);
	});
});

describe("the grammar map draft", () => {
	test("keeps known keys, drops loops and unknown premises, and files odd strands under syntax", () => {
		const nodes = ["a", "b", "c", "d", "e"].map((k) => ({ key: k, strand: k === "e" ? "magic" : "verbs", name: k.toUpperCase(), statement: `Rule ${k}.` }));
		const seed = build.parseSeedDraft(
			`Here: ${JSON.stringify({ nodes, chains: [{ premises: ["a"], conclusion: "b" }, { premises: ["c"], conclusion: "a" }, { premises: ["x"], conclusion: "d" }] })}`,
			"czech",
		);
		assert.equal(seed?.nodes.length, 5);
		assert.equal(seed?.nodes[4]?.strand, "syntax");
		assert.deepEqual(seed?.chains, [{ premises: ["a"], conclusion: "b" }]);
		assert.equal(build.parseSeedDraft("no json here", "czech"), null);
	});
});

describe("reference links", () => {
	test("a site with a page per word links the lemma; slovak.wiki keeps its dictionary and search pages", () => {
		assert.equal(referenceLink({ label: "Wiktionary", baseUrl: "https://en.wiktionary.org", wordUrl: "https://en.wiktionary.org/wiki/{word}#Czech" }, { slug: "kocka", lemma: "kočka", query: "kočku" }), "https://en.wiktionary.org/wiki/ko%C4%8Dka#Czech");
		assert.equal(referenceLink({ label: "slovak.wiki", baseUrl: "https://www.slovak.wiki" }, { slug: "macka", query: "mačku" }), "https://www.slovak.wiki/dictionary/macka");
		assert.equal(referenceLink({ label: "slovak.wiki", baseUrl: "https://www.slovak.wiki" }, { query: "dobrý deň" }), "https://www.slovak.wiki/search?q=dobr%C3%BD%20de%C5%88");
	});
});

// ─── The task end to end, on a fake network ─────────────────────────────────

const bz2 = (b64: string) => Buffer.from(b64, "base64");
const FILES: Record<string, Buffer | string> = {
	// Five Czech sentences, their English links and translations, compressed
	// with bzip2 as Tatoeba serves them.
	"ces-eng_links.tsv.bz2": bz2("QlpoOTFBWSZTWdU7UTIAAAfIAAAwfgAgACGnqNGhDAjHvRNt5S6SldgAeLuSKcKEhqnaiZA="),
	"ces_sentences.tsv.bz2": bz2("QlpoOTFBWSZTWRTuqcYAAA3f9AAwQAE+AAQKBQAuOsoAAAIACCACDAAgAFQ0iaDI0BkMaNBlNIaeoGgGaQEyFsVVUiMpJuiceUxdEiJD82eRBpkURoXdIHA31Om4zHHgJ+DCQBCtin5JcXckU4UJAU7qnGA="),
	"eng_sentences.tsv.bz2": bz2("QlpoOTFBWSZTWXI+DxoAABdfgAAwQAF+IAAgBgAu7d8gIABoMkg0ek0HpDIAGgpiZAAeoD1DA33KqwUHRulcGOfYSyub32onkCJMQgEQ5gZAMGLlFLrBA9QW7KT0BQmC9M+xYc3UQjRkBOjsPoSiKxIgdqJ+LuSKcKEg5HweNA=="),
	"cs_50k.txt": "to 100\nje 90\nkočka 80\npes 70\nkočku 60\npsa 50\nděkuji 40\nmám 30\n",
	"kaikki.org-dictionary-Czech.jsonl": [
		kaikki({ word: "kočka", pos: "noun", senses: [{ glosses: ["cat"], tags: ["feminine"] }], forms: [{ form: "kočku", tags: ["accusative", "singular"], source: "declension" }] }),
		kaikki({ word: "pes", pos: "noun", senses: [{ glosses: ["dog"], tags: ["masculine", "animate"] }], forms: [{ form: "psa", tags: ["accusative", "singular"], source: "declension" }] }),
		kaikki({ word: "děkuji", pos: "intj", senses: [{ glosses: ["thank you"] }] }),
		kaikki({ word: "hrad", pos: "noun", senses: [{ glosses: ["castle"] }] }),
	].join("\n"),
};

let calls: string[] = [];
let failKaikki = false;
const fakeFetch = (async (input: string | URL | Request) => {
	const url = String(input);
	calls.push(url);
	const name = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
	if (failKaikki && name.startsWith("kaikki")) return new Response("busy", { status: 503 });
	const body = FILES[name];
	return body === undefined ? new Response("missing", { status: 404 }) : new Response(typeof body === "string" ? body : new Uint8Array(body));
}) as typeof fetch;

// The fixture has three words, so the course is three tiny chapters over
// the one cell its sentences have (accusative singular).
const COURSE = JSON.stringify({
	units: ["acc", "acc-objects", "acc-nouns"].map((id) => ({ id, kind: "grammar", title: id, tagline: "objects", rule: "The object takes the accusative: Vidím kočku.", glyph: "coffee", grammarTerm: "Accusative", cat: "Nouns", tags: ["accusative", "singular"] })),
	tutors: [{ id: "sounds", title: "Sounds", tagline: "č, ř", glyph: "ear", brief: "Teach the sounds." }],
	goals: ["can-a", "can-b", "can-c"].map((id) => ({ id, title: id, tagline: "x", scene: "cafe" })),
	chapters: [
		{ id: "one", stage: "a1", title: "One", tagline: "objects", units: ["acc", "sounds", "can-a"] },
		{ id: "two", stage: "a1", title: "Two", tagline: "more objects", units: ["acc-objects", "can-b"] },
		{ id: "three", stage: "a2", title: "Three", tagline: "still objects", units: ["acc-nouns", "can-c"] },
	],
});
const WORLD = JSON.stringify({
	series: "Jana in Brno",
	city: "Brno",
	logline: "Jana, who has just moved to Brno",
	cast: [
		{ id: "jana", name: "Jana", gender: "f", age: "young", role: "the lead" },
		{ id: "petr", name: "Petr", gender: "m", age: "adult", role: "a neighbor" },
		{ id: "eva", name: "Eva", gender: "f", age: "old", role: "the baker" },
	],
	places: ["Zelný trh", "Špilberk", "Kavárna"].map((name) => ({ id: name.toLowerCase(), name, note: "x" })),
	beats: { one: "Jana arrives", two: "Jana shops", three: "Jana works" },
	settings: { daily: ["the market"] },
	scenes: { cafe: { title: "V kavárně", blurb: "Order a coffee", brief: "a waiter in Brno", task: "Order a coffee." } },
});
let asked: string[] = [];
const fakeAsk = async (system: string) => {
	asked.push(system);
	return { text: system.includes("story bible") ? WORLD : COURSE, usage: { model: "faux:faux", steps: [] } };
};

describe("adding a language in the background", () => {
	beforeEach(() => {
		resetTasks();
		calls = [];
		failKaikki = false;
		asked = [];
	});

	test("a failed download ends the task with why, and keeps the steps already done", async () => {
		failKaikki = true;
		const { done } = startLanguageAdd("czech", { fetch: fakeFetch, ask: fakeAsk, minUnitSentences: 1 });
		await done;
		const [t] = listTasks();
		assert.equal(t?.kind, "language");
		assert.equal(t?.status, "error");
		assert.match(t?.error ?? "", /Could not download the Wiktionary word list \(HTTP 503\)/);
		assert.ok(fs.existsSync(path.join(dir, "languages", "czech", "build", "sentences.json")));
		assert.equal(fs.existsSync(path.join(dir, "languages", "czech", "language.json")), false);
		assert.equal(config.isLanguageProfile("czech"), false);
	});

	test("trying again continues where it stopped, writes the language and lists it as a profile", async () => {
		const { taskId, done } = startLanguageAdd("czech", { fetch: fakeFetch, ask: fakeAsk, minUnitSentences: 1 });
		assert.equal(taskId, "language:czech");
		assert.deepEqual(listTasks()[0]?.language, { id: "czech", english: "Czech" });
		await done;
		assert.ok(calls.every((u) => !u.includes("tatoeba")), "Tatoeba is not downloaded again");
		const [t] = listTasks();
		assert.equal(t?.status, "done");
		assert.equal(t?.title, "Czech is ready");
		// hrad is not in the frequency list; "Děkuji." is one word, too short to drill.
		assert.equal(t?.note, "3 chapters, 3 grammar lessons, 0 word themes, 1 tutor sessions; 3 words, 2 with example sentences.");
		assert.equal(asked.length, 2, "one call for the course, one for the story bible");

		const folder = path.join(dir, "languages", "czech");
		const lexicon = JSON.parse(fs.readFileSync(path.join(folder, "lexicon.json"), "utf-8")) as { words: Array<{ lemma: string; examples: Array<{ text: string; tatoebaId: number; cloze: { answer: string; at: number } }> }> };
		assert.deepEqual(lexicon.words.map((w) => w.lemma), ["kočka", "pes", "děkuji"]);
		const cat = lexicon.words[0]!;
		assert.deepEqual(cat.examples.map((e) => e.text), ["Kočka spí.", "Vidím kočku.", "Mám psa a kočku."]);
		for (const e of cat.examples) assert.equal(e.text.slice(e.cloze.at, e.cloze.at + e.cloze.answer.length), e.cloze.answer);
		const course = JSON.parse(fs.readFileSync(path.join(folder, "course.json"), "utf-8"));
		assert.deepEqual(course.chapters.map((c: { id: string }) => c.id), ["one", "two", "three"]);
		assert.equal(course.code, "cs");
		assert.equal(JSON.parse(fs.readFileSync(path.join(folder, "seed.json"), "utf-8")).nodes.length, 3, "one skill-map node per grammar unit");
		const world = JSON.parse(fs.readFileSync(path.join(folder, "world.json"), "utf-8"));
		assert.equal(world.city, "Brno");
		assert.equal(world.scenes.cafe.title, "V kavárně");
		assert.match(fs.readFileSync(path.join(folder, "prompt.md"), "utf-8"), /teaches \*\*Czech\*\* \(Čeština\)/);

		assert.deepEqual(config.addedLanguageIds(), ["czech"]);
		assert.equal(config.isLanguageProfile("czech"), true);
		assert.equal(config.curriculumFile("czech", "lexicon.json"), path.join(folder, "lexicon.json"));
		assert.equal(config.curriculumFile("slovak", "lexicon.json"), path.join(config.PATHS.root, "curriculum", "slovak", "lexicon.json"));
		const info = profileLanguage("czech");
		assert.equal(info?.tag, "cs-CZ");
		assert.deepEqual(info?.specialLetters, []);
		assert.equal(languageById("czech")?.english, "Czech", "registered for the browser-safe core");
		const listed = profileStatus().profiles.find((p) => p.id === "czech");
		assert.deepEqual(listed, { id: "czech", tag: "cs-CZ", endonym: "Čeština", english: "Czech", lexicon: true, seed: true, removable: true });
		assert.equal(languageCatalog().find((r) => r.id === "czech")?.ready, true);
		const { usageReport } = await import("../src/server/usage-report.ts");
		assert.equal(usageReport().languages?.count, 1, "the course and story calls show in Spending");
	});

	test("an added language cannot be added twice, and an unknown one not at all", () => {
		assert.throws(() => startLanguageAdd("czech", { fetch: fakeFetch }), /already added/);
		assert.throws(() => startLanguageAdd("klingon", { fetch: fakeFetch }), /not a language the app can add/);
	});

	test("removing an added language deletes its words, keeps the learner's progress, and undoes a waiting switch", () => {
		const { removeLanguage, languageRemovable } = startModule;
		const progress = path.join(dir, "profiles", "czech");
		fs.mkdirSync(progress, { recursive: true });
		fs.writeFileSync(path.join(progress, "progress.json"), "{}");
		fs.writeFileSync(path.join(dir, "profile.json"), JSON.stringify({ active: "czech" }));
		assert.equal(languageRemovable("czech"), true);
		assert.equal(profileStatus().profiles.find((p) => p.id === "czech")?.removable, true);
		assert.equal(languageRemovable(config.ACTIVE_PROFILE), false, "the running language is never removable");

		removeLanguage("czech");
		assert.equal(fs.existsSync(path.join(dir, "languages", "czech")), false);
		assert.ok(fs.existsSync(path.join(progress, "progress.json")), "progress stays");
		assert.equal(config.isLanguageProfile("czech"), false);
		assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "profile.json"), "utf-8")).active, config.ACTIVE_PROFILE, "the switch waiting for a restart is undone");
		assert.throws(() => removeLanguage("czech"), /nothing to remove/);
		assert.throws(() => removeLanguage(config.ACTIVE_PROFILE), /running now/);
	});

	test("a malformed language.json is not a language", () => {
		assert.equal(parseLanguageInfo({ id: "../etc", tag: "x", code: "x" }), null);
		assert.equal(parseLanguageInfo(null), null);
	});
});
