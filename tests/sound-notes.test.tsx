import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SoundDrawing } from "@/components/phonology/mouth";
import { lengthPaths, mouthPaths } from "@/components/phonology/mouth-paths";
import { getPhonologyData } from "../src/core/phonology.ts";
import { pronReport, type PronScore } from "../src/core/pronounce.ts";
import { LIP_SHAPES, MOUTH_MARKS, TONGUE_SHAPES, getSoundNote, getSoundNotes, soundNotesForPairs, type SoundNote, type SoundPicture } from "../src/core/sound-notes.ts";
import { featureById, sourceById } from "../src/core/sources.ts";

const LANGUAGES = ["slovak", "russian", "estonian"];
const JARGON = /alveol|palatal|velar|fricative|affricate|approximant|phoneme|\bdental|retroflex|labial|plosive|voiceless|\bvoiced|aspirat|\bnasal\b|\blateral|apical|laminal|articulat/i;
const SHORTENED = /\b(e\.g\.|i\.e\.|etc\.|vs\.|sg\.|pl\.|fem\.|masc\.|approx\.)/i;

const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

function checkPicture(picture: SoundPicture, where: string) {
	if (picture.kind === "length") {
		assert.ok([1, 2, 3].includes(picture.units), `${where}: a length picture has one, two or three units`);
		return;
	}
	assert.ok(TONGUE_SHAPES.includes(picture.mouth.tongue), `${where}: unknown tongue shape ${picture.mouth.tongue}`);
	assert.ok(LIP_SHAPES.includes(picture.mouth.lips), `${where}: unknown lip shape ${picture.mouth.lips}`);
	if (picture.mouth.mark) assert.ok(MOUTH_MARKS.includes(picture.mouth.mark), `${where}: unknown mark ${picture.mouth.mark}`);
}

describe("sound notes", () => {
	for (const language of LANGUAGES) {
		describe(language, () => {
			const data = getSoundNotes(language)!;

			it("loads, and its groups and symbols are each named once", () => {
				assert.equal(data.language, language);
				assert.ok(data.sounds.length >= 8, `${language} has ${data.sounds.length} sounds`);
				assert.equal(new Set(data.groups.map((g) => g.id)).size, data.groups.length);
				const names = data.sounds.flatMap((s) => [s.symbol, ...(s.aliases ?? [])]);
				assert.equal(new Set(names).size, names.length, "a symbol or alias is used twice");
				for (const g of data.groups) assert.ok(data.sounds.some((s) => s.group === g.id), `group ${g.id} has no sounds`);
			});

			it("every sound says how it is made, in plain words that fit the card", () => {
				for (const s of data.sounds) {
					const where = `${language} ${s.symbol}`;
					assert.ok(data.groups.some((g) => g.id === s.group), `${where}: group ${s.group} is not declared`);
					assert.ok(s.ipa.length > 0 && s.word.length > 0 && s.meaning.length > 0, `${where}: symbol, word or meaning is missing`);
					assert.ok(s.word.toLowerCase().includes([...s.symbol][0]!), `${where}: the word ${s.word} does not hold the sound`);
					assert.ok(s.how.length >= 40 && s.how.length <= 230, `${where}: "how" is ${s.how.length} characters`);
					assert.ok(s.slip.length >= 15 && s.slip.length <= 170, `${where}: "slip" is ${s.slip.length} characters`);
					assert.ok((s.writing ?? "").length <= 250, `${where}: "writing" is ${s.writing?.length} characters`);
					assert.ok(["high", "medium", "low"].includes(s.functionalLoad), `${where}: functionalLoad`);
					for (const text of [s.how, s.slip, s.writing ?? "", s.meaning]) {
						assert.ok(!JARGON.test(text), `${where}: a term a learner does not know in "${text}"`);
						assert.ok(!SHORTENED.test(text), `${where}: a shortened word in "${text}"`);
					}
				}
			});

			it("a picture always comes with the sound it is compared with, and the two differ", () => {
				for (const s of data.sounds) {
					const where = `${language} ${s.symbol}`;
					assert.equal(s.picture === undefined, s.next === undefined, `${where}: a picture and its neighbor come together`);
					if (!s.picture || !s.next) {
						assert.equal(s.also, undefined, `${where}: a third picture needs the first two`);
						continue;
					}
					for (const [name, picture] of [["picture", s.picture], ["next", s.next.picture], ...(s.also ? [["also", s.also.picture] as const] : [])] as const) {
						checkPicture(picture, `${where} ${name}`);
						assert.equal(picture.kind, s.picture.kind, `${where}: ${name} is another kind of picture`);
					}
					assert.notDeepEqual(s.next.picture, s.picture, `${where}: the two pictures are the same drawing`);
					assert.ok(s.next.word.length > 0 && s.next.meaning.length > 0, `${where}: the neighbor has no word`);
				}
			});

			it("a sound that names pairs names a group the ear gym has", () => {
				const families = getPhonologyData(language)!.families.map((f) => f.id);
				for (const s of data.sounds) if (s.pairs) assert.ok(families.includes(s.pairs), `${language} ${s.symbol}: no pairs group ${s.pairs}`);
				assert.ok(data.sounds.some((s) => s.pairs), `${language}: no sound leads to the ear gym`);
			});

			it("its sources are listed and the page cites them", () => {
				const cited = featureById("sound-notes")!.sources;
				assert.ok(data.sources.length > 0);
				for (const id of data.sources) {
					assert.ok(sourceById(id), `${language}: source ${id} is not listed`);
					assert.ok(cited.includes(id), `${language}: the page does not cite ${id}`);
				}
			});

			it("every picture draws", () => {
				for (const s of data.sounds) {
					for (const picture of [s.picture, s.next?.picture, s.also?.picture]) {
						if (!picture) continue;
						const svg = renderToStaticMarkup(<SoundDrawing picture={picture} seed={12} />);
						assert.ok(svg.startsWith("<svg") && !svg.includes("NaN"), `${language} ${s.symbol}`);
					}
				}
			});
		});
	}

	it("finds a note by its symbol or another name for it, in its own language only", () => {
		assert.equal(getSoundNote("Ť", "slovak")?.symbol, "ť");
		assert.equal(getSoundNote(" ô ", "slovak")?.symbol, "ô");
		assert.equal(getSoundNote("g", "estonian")?.symbol, "b");
		assert.equal(getSoundNote("ы", "russian")?.symbol, "ы");
		assert.equal(getSoundNote("ť", "russian"), null);
		assert.equal(getSoundNote("ы", "estonian"), null);
		assert.equal(getSoundNote("ť", undefined), null);
		assert.equal(getSoundNote("", "slovak"), null);
		assert.equal(getSoundNotes("unknown"), null);
	});

	it("gives the notes behind a group of pairs", () => {
		assert.deepEqual(
			soundNotesForPairs("palatals", "slovak").map((s: SoundNote) => s.symbol),
			["ť", "ď", "ň", "ľ"],
		);
		assert.deepEqual(
			soundNotesForPairs("u_umlaut", "estonian").map((s: SoundNote) => s.symbol),
			["ü"],
		);
		assert.deepEqual(soundNotesForPairs("palatals", "russian"), []);
	});

	it("the pronunciation report carries the note of the active language", () => {
		const weak = (p: string): PronScore => ({ engine: "azure", accuracy: 40, overall: 40, words: [{ word: "x", score: 30, error: "mispronunciation", phonemes: [{ p, score: 20 }] }] });
		const russian = pronReport([weak("ы"), weak("ы")], { languageId: "russian" });
		assert.equal(russian.sounds[0]?.cue, getSoundNote("ы", "russian")!.how);
		assert.equal(russian.sounds[0]?.functionalLoad, "high");
		assert.equal(pronReport([weak("ы"), weak("ы")], { languageId: "slovak" }).sounds[0]?.cue, undefined);
	});
});

describe("mouth drawings", () => {
	it("every tongue and lip shape draws inside the sheet, the same way for the same seed", () => {
		for (const tongue of TONGUE_SHAPES) {
			for (const lips of LIP_SHAPES) {
				const paths = mouthPaths({ tongue, lips }, 5);
				assert.deepEqual(paths, mouthPaths({ tongue, lips }, 5));
				for (const d of [paths.face, paths.chin, paths.upperLip, paths.lowerLip, paths.upperTeeth, paths.lowerTeeth, paths.roof, paths.throat, paths.gum, paths.tongue, paths.tongueBody, ...paths.taps, ...paths.air, ...paths.folds]) {
					const values = numbers(d);
					assert.ok(values.length > 0 && values.every((n) => Number.isFinite(n) && n >= -4 && n <= 204), `${tongue} ${lips}: ${d}`);
				}
			}
		}
	});

	it("no two tongue shapes are the same drawing", () => {
		const drawn = TONGUE_SHAPES.filter((t) => t !== "tip-ridge-trill").map((tongue) => mouthPaths({ tongue, lips: "neutral" }, 5).tongue);
		assert.equal(new Set(drawn).size, drawn.length);
	});

	it("a tongue that leaves a gap shows the air going through, a tongue that closes does not", () => {
		assert.equal(mouthPaths({ tongue: "back-near-roof", lips: "neutral" }, 5).air.length, 2);
		assert.equal(mouthPaths({ tongue: "back-roof", lips: "neutral" }, 5).air.length, 0);
	});

	it("only the tapping r has tap marks, and the highlight goes where the note says", () => {
		assert.equal(mouthPaths({ tongue: "tip-ridge-trill", lips: "neutral" }, 5).taps.length, 2);
		assert.equal(mouthPaths({ tongue: "tip-ridge", lips: "neutral" }, 5).taps.length, 0);
		const tongue = mouthPaths({ tongue: "back-mid", lips: "round" }, 5);
		const lips = mouthPaths({ tongue: "back-mid", lips: "round", mark: "lips" }, 5);
		const throat = mouthPaths({ tongue: "rest", lips: "neutral", mark: "throat" }, 5);
		assert.ok(lips.place!.cx < 50 && tongue.place!.cx > 100 && throat.place!.cy > 140);
		assert.deepEqual([tongue.accent, lips.accent, throat.accent], ["tongue", "lips", "throat"]);
		assert.equal(mouthPaths({ tongue: "rest", lips: "lip-to-teeth" }, 5).accent, "lips");
		assert.equal(throat.folds.length, 2);
		assert.equal(tongue.folds.length, 0);
		assert.equal(mouthPaths({ tongue: "rest", lips: "neutral" }, 5).place, null);
	});

	it("a longer sound is a longer wave", () => {
		const end = (units: number) => Math.max(...numbers(lengthPaths(units, 3).wave).filter((_, i) => i % 2 === 0));
		assert.ok(end(1) < end(2) && end(2) < end(3));
		assert.ok(end(2) / end(1) > 1.6);
	});
});
