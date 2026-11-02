/**
 * The Slovak checker (src/core/slovak-check.ts): rules a program checks for
 * certain, and never a false alarm on the correct sentences the accuracy
 * eval saw models reject (docs/research/slovak-accuracy-eval.md).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkerNote, checkSlovak, type SlovakLookup } from "../src/core/slovak-check.ts";

const GENDERS: Record<string, string[]> = {
	ženy: ["feminine"],
	sestry: ["feminine"],
	okná: ["neuter"],
	deti: ["neuter"],
	stoly: ["masculine-inanimate"],
	psy: ["masculine-animate"],
	bratia: ["masculine-animate"],
	hodiny: ["feminine", "plural-only"],
};
const lookup: SlovakLookup = {
	genders: (form) => GENDERS[form] ?? [],
	isVerifiedExample: (text) => text === "Nevlastní auto, jazdí len na bicykli.",
};
const rules = (text: string) => checkSlovak(text, lookup).issues.map((i) => i.rule);

describe("the Slovak checker", () => {
	it("asks for so/zo/ku/vo before the sounds that need them, keeping the capital", () => {
		assert.deepEqual(checkSlovak("Išiel som s sestrou do mesta.").issues[0]?.fix, "so sestrou");
		assert.deepEqual(checkSlovak("Z školy idem domov.").issues[0]?.fix, "Zo školy");
		assert.deepEqual(checkSlovak("Idem k kamarátovi.").issues[0]?.fix, "ku kamarátovi");
		assert.deepEqual(checkSlovak("Bývam v Viedni.").issues[0]?.fix, "vo Viedni");
	});

	it("is silent on the forms that are right", () => {
		for (const ok of ["Stretli sme sa so susedmi.", "Idem zo školy.", "Som v škole.", "Idem s mamou.", "Idem k lekárovi.", "Bojím sa psov.", "Páči sa mi to."]) {
			assert.deepEqual(rules(ok), [], ok);
		}
	});

	it("knows nie je is two words and Slovak has no ř, ě, ů", () => {
		assert.deepEqual(checkSlovak("Môj brat nieje doma.").issues[0]?.fix, "nie je");
		assert.deepEqual(rules("To je řeka."), ["czech-letter"]);
		assert.deepEqual(rules("Počúvam Dvořáka."), [], "a Czech name is not a Czech word");
	});

	it("flags budem with a perfective infinitive, also after a clitic, but not a modal in between", () => {
		assert.deepEqual(rules("Zajtra budem napísať list."), ["budem-perfective"]);
		assert.deepEqual(rules("Budem to urobiť zajtra."), ["budem-perfective"]);
		assert.deepEqual(rules("Budem musieť urobiť úlohu."), []);
		assert.deepEqual(rules("Zajtra budem písať list."), []);
	});

	it("leaves bude alone: its infinitive can be the subject, or follow modal dať sa", () => {
		for (const ok of ["Najlepšie bude zavolať mu.", "Lepšie bude prísť skôr.", "Najjednoduchšie bude zobrať taxík.", "Bude sa to dať opraviť?"]) {
			assert.deepEqual(rules(ok), [], ok);
		}
	});

	it("checks dva/dve/dvaja against a gender the dictionary is sure of", () => {
		assert.deepEqual(checkSlovak("Mám dva sestry.", lookup).issues[0]?.fix, "dve sestry");
		assert.deepEqual(rules("Dvaja ženy prišli."), ["numeral-gender"]);
		assert.deepEqual(rules("Mám dve stoly."), ["numeral-gender"]);
		assert.deepEqual(rules("Dve deti sa hrajú."), []);
		assert.deepEqual(rules("Mám dva psy a dvaja bratia prišli."), []);
		assert.deepEqual(rules("Čakal som dve veľké hodiny."), [], "a form with two genders is left alone");
	});

	it("vouches for a curated example, and says so first", () => {
		const check = checkSlovak("Nevlastní auto, jazdí len na bicykli.", lookup);
		assert.equal(check.verified, true);
		assert.match(checkerNote(check)!, /verified dictionary example/);
	});

	it("reads the real Slovak lexicon: its curated examples and its noun genders", async () => {
		const { slovakLookup } = await import("../src/agent/lexicon.ts");
		const real = slovakLookup("slovak")!;
		assert.ok(real, "the bundled lexicon loads");
		assert.equal(checkSlovak("Čakali sme na vlak pol hodiny.", real).verified, true);
		assert.equal(checkSlovak("Čakali sme na vlak pol hodiny", real).verified, true, "the final full stop does not matter");
		assert.deepEqual(checkSlovak("Mám dva sestry.", real).issues.map((i) => i.fix), ["dve sestry"]);
		assert.deepEqual(checkSlovak("Mám dva psy.", real).issues, []);
	});

	it("has nothing to say about a sentence it cannot judge", () => {
		assert.equal(checkerNote(checkSlovak("Hlavnými aktérmi príbehu sú dve deti.", lookup)), null);
	});
});
