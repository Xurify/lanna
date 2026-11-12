import assert from "node:assert/strict";
import { test } from "node:test";
import { aspectPairOf, referenceAspectPairs, referenceContrast, referenceUnits } from "../src/core/reference-contrast.ts";

const SPATIAL = `
| Situation             | Frame         | Example          |
| --------------------- | ------------- | ---------------- |
| enter/go to a place   | \`do + gen.\`   | \`Idem do školy.\` |
| be inside/at a place  | \`v/vo + loc.\` | \`Som v škole.\`   |
| be on/at an event     | \`na + loc.\`   | \`Som na stanici.\` |
`;

test("a small table pairs two words from different rows, with the rows' situations and examples", () => {
	const c = referenceContrast(referenceUnits(SPATIAL, "Prepositions"), "v", "na");
	assert.equal(c?.chapter, "Prepositions");
	assert.equal(c?.line, "be inside/at a place: v/vo + loc. — Som v škole.; be on/at an event: na + loc. — Som na stanici.");
});

test("a word inside an example sentence is not a match", () => {
	assert.equal(referenceContrast(referenceUnits(SPATIAL, "P"), "škole", "stanici"), undefined);
});

test("a big table pairs only within one row", () => {
	const rows = Array.from({ length: 11 }, (_, i) => `| sense ${i} | \`slovo${i}\` |`).join("\n");
	const big = `| English | Slovak |\n| --- | --- |\n${rows}\n| live | reside \`bývať\`; live a life \`žiť\` |\n| visit | \`navštíviť\` |`;
	const units = referenceUnits(big, "Lexical choice");
	assert.equal(referenceContrast(units, "bývať", "žiť")?.line, "live: reside bývať; live a life žiť");
	assert.equal(referenceContrast(units, "bývať", "navštíviť"), undefined);
});

test("a table whose rows are headed by words never pairs across rows", () => {
	const words = "| Base | Forms |\n| --- | --- |\n| `kto` | `koho`, `komu` |\n| `čo` | `čoho`, `čomu` |";
	assert.equal(referenceContrast(referenceUnits(words, "Pronouns"), "kto", "čo"), undefined);
});

test("a word that only opens a longer phrase is not the word", () => {
	const units = referenceUnits("| Type | Words |\n| --- | --- |\n| as soon as | `len čo` |\n| only when | `iba keď` |", "Conjunctions");
	assert.equal(referenceContrast(units, "len", "iba"), undefined);
	const plainList = referenceUnits("| restriction | `iba`, `len` — only |\n| --- | --- |", "Discourse");
	assert.ok(referenceContrast(plainList, "len", "iba"));
});

test("a reflexive verb and an explicit 'vs.' row still name their word", () => {
	const units = referenceUnits("| happen | `stať sa` (`Čo sa stalo?`); be going on `diať sa` |\n| --- | --- |\n| `čakať na` vs. `očakávať` | wait / expect |", "Lexical choice");
	assert.match(referenceContrast(units, "stať", "diať")?.line ?? "", /^happen: stať sa/);
	assert.match(referenceContrast(units, "čakať", "očakávať")?.line ?? "", /^čakať na vs\. očakávať/);
});

test("two spellings of one word written as alternants are not contrasted", () => {
	assert.equal(referenceContrast(referenceUnits("Use `s/so` for people and instruments.", "P"), "s", "so"), undefined);
});

test("a long list of words in one clause is not a contrast", () => {
	const list = "This covers `že`, `aby`, `keď`, `ak`, `lebo`, `pretože`, `keďže`, `hoci`, `kým`, `či`, `kedy`.";
	assert.equal(referenceContrast(referenceUnits(list, "Commas"), "keď", "kedy"), undefined);
});

test("aspect pairs come from tables whose columns are labeled perfective and imperfective", () => {
	const md = "| ipf. | pf. | ipf. | pf. |\n| --- | --- | --- | --- |\n| `písať` | `napísať` | `volať` | `zavolať` |\n\n| pf. | ipf. |\n| --- | --- |\n| `rozhodnúť sa` | `rozhodovať sa` |\n\n| Imperfective process | Perfective result |\n| --- | --- |\n| `liečenie (treatment)` | `vyliečenie (cure)` |";
	const pairs = referenceAspectPairs(md);
	assert.deepEqual(pairs, [
		{ perfective: "napísať", imperfective: "písať" },
		{ perfective: "zavolať", imperfective: "volať" },
		{ perfective: "rozhodnúť sa", imperfective: "rozhodovať sa" },
	]);
	assert.deepEqual(aspectPairOf(pairs, "rozhodovať", "rozhodnúť"), { perfective: "rozhodnúť sa", imperfective: "rozhodovať sa" });
	assert.deepEqual(aspectPairOf(pairs, "zavolať", "volať"), { perfective: "zavolať", imperfective: "volať" });
	assert.equal(aspectPairOf(pairs, "písať", "volať"), undefined);
});
