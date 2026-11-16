/**
 * REJECTED EXAMPLES (2026-10-30): a Tatoeba sentence reviewed
 * and marked `rejected` stays in the lexicon so example positions (and card
 * ids) do not move, but no feature may use it: not a lesson, a listen item,
 * a fluency drill, a review card, or the agent's examples.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { allUnits, candidatesFor } from "../src/core/lesson.ts";
import { pickClozeExample } from "../src/core/review.ts";

const lexicon = JSON.parse(fs.readFileSync(new URL("../curriculum/slovak/lexicon.json", import.meta.url), "utf8"));

describe("rejected examples", () => {
	it("the lexicon has rejected examples to test against", () => {
		const count = lexicon.words.reduce((n: number, w: any) => n + w.examples.filter((x: any) => x.rejected).length, 0);
		assert.ok(count > 0);
	});

	it("are never a lesson candidate", () => {
		for (const unit of allUnits()) {
			for (const c of candidatesFor(lexicon.words, unit.id)) {
				assert.notEqual(c.entry.examples[c.index]!.rejected, true, `${unit.id}: ${c.entry.slug}#${c.index}`);
			}
		}
	});

	it("are never picked for a review card", () => {
		for (const entry of lexicon.words) {
			const i = pickClozeExample(entry);
			if (i !== undefined) assert.notEqual(entry.examples[i].rejected, true, `${entry.slug}#${i}`);
		}
	});

	it("pick the next sentence when the best one is rejected", () => {
		const entry = {
			examples: [
				{
					sk: "Dom je veľký.",
					en: "The house is big.",
					src: "tatoeba",
					cloze: { answer: "Dom", at: 0 },
					rejected: true,
				},
				{ sk: "Ten dom je malý.", en: "That house is small.", src: "tatoeba", cloze: { answer: "dom", at: 4 } },
			],
		} as any;
		assert.equal(pickClozeExample(entry), 1);
	});
});
