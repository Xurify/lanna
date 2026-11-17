import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slovakFormCells } from "../src/core/slovak-form-note.ts";

const adjective = (lemma: string) => ({ lemma, pos: "adjective" });
const noun = (lemma: string, gender?: string) => ({ lemma, pos: "noun", gender });

describe("slovakFormCells", () => {
	it("reads the hard adjective pattern pekný", () => {
		assert.equal(slovakFormCells("strednom", adjective("stredný")), "masculine or neuter locative singular");
		assert.equal(slovakFormCells("strednej", adjective("stredný")), "feminine genitive, dative or locative singular");
		assert.equal(slovakFormCells("strední", adjective("stredný")), "masculine personal nominative plural");
		assert.equal(slovakFormCells("strednými", adjective("stredný")), "instrumental plural");
	});

	it("reads the short endings after a long syllable", () => {
		assert.equal(slovakFormCells("krásneho", adjective("krásny")), slovakFormCells("dobrého", adjective("dobrý")));
	});

	it("reads the soft adjective pattern cudzí", () => {
		assert.equal(slovakFormCells("cudzia", adjective("cudzí")), "feminine nominative singular");
		assert.equal(slovakFormCells("cudzím", adjective("cudzí")), slovakFormCells("dobrým", adjective("dobrý")));
		assert.equal(slovakFormCells("cudzích", adjective("cudzí")), slovakFormCells("dobrých", adjective("dobrý")));
	});

	it("reads dlaň nouns through the dropped e", () => {
		assert.equal(slovakFormCells("kaviarni", noun("kaviareň", "feminine")), "dative or locative singular");
		assert.equal(slovakFormCells("kaviarní", noun("kaviareň", "feminine")), "genitive plural");
		assert.equal(slovakFormCells("kaviarňou", noun("kaviareň", "feminine")), "instrumental singular");
	});

	it("reads masculine animate nouns", () => {
		assert.equal(slovakFormCells("Martinovi", noun("Martin", "masculine-animate")), "dative or locative singular");
		assert.equal(slovakFormCells("psa", noun("pes", "masculine-animate")), "genitive or accusative singular");
		assert.equal(slovakFormCells("hrdinu", noun("hrdina", "masculine-animate")), "genitive or accusative singular");
	});

	it("tells mesto from miesto by the rhythmic law", () => {
		assert.equal(slovakFormCells("mesta", noun("mesto", "neuter")), "genitive singular");
		assert.equal(
			slovakFormCells("miesta", noun("miesto", "neuter")),
			"genitive singular, or nominative or accusative plural",
		);
	});

	it("reads endings shared by every pattern when the gender is unknown", () => {
		assert.equal(slovakFormCells("mestách", { lemma: "mesto" }), "locative plural");
	});

	it("leaves an ambiguous ending unnamed", () => {
		assert.equal(slovakFormCells("žene", noun("žena", "feminine")), undefined);
		assert.equal(slovakFormCells("stredný", adjective("stredný")), undefined);
		assert.equal(slovakFormCells("robím", { lemma: "robiť", pos: "verb" }), undefined);
	});
});
