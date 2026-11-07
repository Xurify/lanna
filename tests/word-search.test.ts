import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareMatches, fold, matchWord, type SearchableWord } from "@/src/core/word-search";

const W = {
	clovek: { lemma: "človek", gloss: "person; human", forms: ["človeka", "ľudia"], examples: [{ sk: "Je to dobrý človek.", en: "He is a good person." }] },
	hovorit: { lemma: "hovoriť", gloss: "to speak; to talk; to say (imperfective)", forms: ["hovorím", "hovorí"], examples: [{ sk: "Hovorím po slovensky.", en: "I speak Slovak." }] },
	dom: { lemma: "dom", gloss: "house; home", forms: ["domy"], examples: [{ sk: "Môj dom je veľký.", en: "My house is big." }] },
	slovo: { lemma: "slovo", gloss: "word", forms: ["slová"], examples: [] },
	cas: { lemma: "čas", gloss: "time", forms: ["času"], examples: [] },
	chlieb: { lemma: "chlieb", gloss: "bread", forms: [], examples: [{ sk: "Kúpim chlieb.", en: "I will buy bread." }] },
	ludia: { lemma: "ľudia", gloss: "people", forms: [], examples: [] },
	ludovy: { lemma: "ľudový", gloss: "folk", forms: [], examples: [] },
} satisfies Record<string, SearchableWord>;

const ALL = Object.values(W);
const search = (q: string) => ALL.flatMap((w) => { const match = matchWord(q, w); return match ? [{ w, match }] : []; }).sort(compareMatches).map((r) => r.w.lemma);

describe("word search ranking", () => {
	it("folds case and diacritics one character at a time", () => {
		assert.equal(fold("Človek ĽUDIA ôsmy"), "clovek ludia osmy");
		assert.equal(fold("ä").length, 1);
	});

	it("a one-letter query shows only headwords that start with it", () => {
		assert.deepEqual(search("s"), ["slovo"]);
		assert.deepEqual(search("c").sort(), ["chlieb", "čas", "človek"].sort());
	});

	it("c finds čas and cas finds čas, in either direction", () => {
		assert.ok(search("c").includes("čas"));
		assert.deepEqual(search("cas"), ["čas"]);
		assert.ok(search("Č").includes("čas"));
	});

	it("never matches a one or two letter query through meaning or example", () => {
		assert.equal(matchWord("s", W.clovek), null);
		assert.equal(matchWord("s", W.hovorit), null);
		assert.equal(matchWord("pe", W.clovek)?.kind, "meaning");
		assert.equal(matchWord("ve", W.dom), null);
	});

	it("example sentences count only from three letters", () => {
		assert.equal(matchWord("po", W.hovorit), null);
		assert.equal(matchWord("pos", W.hovorit)?.kind, undefined);
		assert.equal(matchWord("kup", W.chlieb)?.kind, "example");
		assert.equal(matchWord("ku", W.chlieb), null);
	});

	it("ranks start, contains, form, meaning, example in that order", () => {
		const q = "lud";
		assert.deepEqual(search(q), ["ľudia", "ľudový", "človek"]);
		assert.equal(matchWord(q, W.clovek)?.kind, "form");
		assert.equal(matchWord("ovo", W.slovo)?.kind, "contains");
		assert.deepEqual(matchWord("ovo", W.slovo)?.span, [2, 5]);
	});

	it("bread finds chlieb through the meaning, with the matching word to show", () => {
		const m = matchWord("bread", W.chlieb)!;
		assert.equal(m.kind, "meaning");
		assert.equal(m.via, "bread");
	});

	it("a meaning match is at a word start, not inside a word", () => {
		assert.equal(matchWord("peak", W.hovorit)?.kind, undefined);
		assert.equal(matchWord("peak", W.hovorit), null);
		assert.equal(matchWord("speak", W.hovorit)?.kind, "meaning");
		assert.equal(matchWord("ouse", W.dom), null);
	});

	it("within a rank the commoner word comes first", () => {
		const rows = [
			{ match: matchWord("s", { lemma: "stôl", gloss: "table" })!, rank: 300 },
			{ match: matchWord("s", { lemma: "sa", gloss: "self" })!, rank: 2 },
		];
		assert.deepEqual(rows.sort(compareMatches).map((r) => r.rank), [2, 300]);
	});

	it("a phrase finds the sentence that has its words side by side", () => {
		const zaujem: SearchableWord = { lemma: "záujem", gloss: "interest", examples: [{ sk: "O kurz je veľký záujem medzi študentmi.", en: "There is great interest in the course among students." }] };
		assert.equal(matchWord("veľký záujem", zaujem)?.kind, "example");
		assert.equal(matchWord("velky zaujem medzi", zaujem)?.kind, "example");
		assert.equal(matchWord("je  veľký zauj", zaujem)?.kind, "example");
		assert.equal(matchWord("kurz je", zaujem)?.kind, "example");
		assert.equal(matchWord("O kurz je veľký záujem medzi študentmi.", zaujem)?.kind, "example");
	});

	it("a phrase needs its words in a row, from a word start", () => {
		const zaujem: SearchableWord = { lemma: "záujem", gloss: "interest", examples: [{ sk: "O kurz je veľký záujem medzi študentmi.", en: "" }] };
		assert.equal(matchWord("záujem veľký", zaujem), null);
		assert.equal(matchWord("kurz veľký", zaujem), null);
		assert.equal(matchWord("urz je", zaujem), null);
	});

	it("an empty query matches nothing and is the caller's cue to list everything", () => {
		assert.equal(matchWord("  ", W.dom), null);
	});
});
