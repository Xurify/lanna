import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-slipping-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { buildSlippingLesson, reviewEntryWordVerdict, slippingSentenceTargets, slippingWords } =
	await import("../src/core/slipping.ts");
const { answerReview, reviewDigest, reviewStatus } = await import("../src/server/review.ts");
const { knownWords } = await import("../src/server/reading.ts");
const { knownWordStore } = await import("../src/store/known-words.ts");
const { reviewStore } = await import("../src/store/review.ts");

type LexiconEntry = import("../src/core/review.ts").LexiconEntry;
type ReviewCard = import("../src/core/review.ts").ReviewCard;
type ReviewLogEntry = import("../src/core/review.ts").ReviewLogEntry;
type Span = import("../src/core/review.ts").Span;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const BASE = "2026-11-01T10:00:00Z";

function makeCard(
	over: Partial<ReviewCard> & Pick<ReviewCard, "id" | "slug" | "lemma" | "sentence" | "answer">,
): ReviewCard {
	return {
		gloss: "meaning",
		translation: "English translation",
		at: over.sentence.indexOf(over.answer),
		state: "learning",
		due: BASE,
		reps: 2,
		lapses: 0,
		createdAt: BASE,
		...over,
	};
}

function makeLog(over: Partial<ReviewLogEntry> & Pick<ReviewLogEntry, "cardId" | "reviewedAt">): ReviewLogEntry {
	return {
		rating: 1,
		given: "",
		verdict: "wrong",
		elapsedDays: 0,
		...over,
	};
}

function makeEntry(
	slug: string,
	lemma: string,
	en: string,
	examples: Array<{ sk: string; en: string; answer?: string }>,
	forms: string[] = [],
): LexiconEntry {
	return {
		slug,
		sk: lemma,
		en,
		pos: "verb",
		cat: "general",
		rank: 100,
		related: [],
		forms: [lemma, ...forms],
		examples: examples.map((e) => ({
			sk: e.sk,
			en: e.en,
			src: "test",
			...(e.answer ? { cloze: { answer: e.answer, at: e.sk.indexOf(e.answer) } } : {}),
		})),
	};
}

describe("slippingWords", () => {
	test("catches learning-loop words with >= 2 wrongs even when lapses === 0", () => {
		const card = makeCard({
			id: "tvrdit#0",
			slug: "tvrdit",
			lemma: "tvrdiť",
			gloss: "claim",
			sentence: "On tvrdí, že má pravdu.",
			answer: "tvrdí",
			lapses: 0,
		});
		const log: ReviewLogEntry[] = [
			makeLog({ cardId: card.id, reviewedAt: "2026-11-01T10:00:00Z", given: "", verdict: "wrong", rating: 1 }),
			makeLog({ cardId: card.id, reviewedAt: "2026-11-02T10:00:00Z", given: "hovorí", verdict: "wrong", rating: 1 }),
		];
		const list = slippingWords([card], log, { langTag: "sk-SK", tz: 0 });
		assert.equal(list.length, 1);
		assert.equal(list[0]!.slug, "tvrdit");
		assert.equal(list[0]!.wrongs, 2);
		assert.equal(list[0]!.hasBlankMiss, true);
	});

	test("ignores suspended cards", () => {
		const card = makeCard({
			id: "tvrdit#0",
			slug: "tvrdit",
			lemma: "tvrdiť",
			sentence: "On tvrdí, že má pravdu.",
			answer: "tvrdí",
			suspended: true,
			lapses: 4,
		});
		const log: ReviewLogEntry[] = [
			makeLog({ cardId: card.id, reviewedAt: "2026-11-01T10:00:00Z" }),
			makeLog({ cardId: card.id, reviewedAt: "2026-11-02T10:00:00Z" }),
		];
		assert.deepEqual(slippingWords([card], log, { langTag: "sk-SK", tz: 0 }), []);
	});

	test("reconstructs target word verdict for multi-blank entries without blaming neighbor misses", () => {
		const sentence = "Ideme na dovolenku.";
		const card = makeCard({
			id: "ist#0",
			slug: "ist",
			lemma: "ísť",
			sentence,
			answer: "Ideme",
		});
		const spans: Span[] = [
			[sentence.indexOf("Ideme"), sentence.indexOf("Ideme") + "Ideme".length],
			[sentence.indexOf("na"), sentence.indexOf("na") + "na".length],
			[sentence.indexOf("dovolenku"), sentence.indexOf("dovolenku") + "dovolenku".length],
		];
		const neighborMiss = makeLog({
			cardId: card.id,
			reviewedAt: "2026-11-01T10:00:00Z",
			given: "Ideme na dovolenka",
			verdict: "wrong",
			rating: 1,
			words: 3,
			spans,
		});
		assert.equal(reviewEntryWordVerdict(card, neighborMiss, "sk-SK"), "exact");

		const neighborMiss2 = { ...neighborMiss, reviewedAt: "2026-11-02T10:00:00Z" };
		assert.deepEqual(slippingWords([card], [neighborMiss, neighborMiss2], { langTag: "sk-SK", tz: 0 }), []);

		const targetMiss = { ...neighborMiss, given: "Chodíme na dovolenku" };
		assert.equal(reviewEntryWordVerdict(card, targetMiss, "sk-SK"), "wrong");
	});

	test("requires two clean unassisted recalls on distinct days (>= 12h after last wrong) to graduate", () => {
		const card = makeCard({
			id: "oznamit#0",
			slug: "oznamit",
			lemma: "oznámiť",
			sentence: "Oznámil to všetkým.",
			answer: "Oznámil",
		});
		const wrongs: ReviewLogEntry[] = [
			makeLog({ cardId: card.id, reviewedAt: "2026-11-01T20:00:00Z", given: "" }),
			makeLog({ cardId: card.id, reviewedAt: "2026-11-02T20:00:00Z", given: "" }),
		];

		const notYet: ReviewLogEntry[] = [
			...wrongs,
			makeLog({ cardId: card.id, reviewedAt: "2026-11-02T21:00:00Z", given: "Oznámil", verdict: "exact", rating: 3 }),
			makeLog({ cardId: card.id, reviewedAt: "2026-11-03T06:00:00Z", given: "Oznámil", verdict: "exact", rating: 3 }),
			makeLog({
				cardId: card.id,
				reviewedAt: "2026-11-03T10:00:00Z",
				given: "Oznámil",
				verdict: "exact",
				rating: 3,
				hints: 1,
			}),
			makeLog({
				cardId: card.id,
				reviewedAt: "2026-11-04T10:00:00Z",
				given: "Oznámil",
				verdict: "exact",
				rating: 3,
				picked: true,
			}),
		];
		assert.equal(slippingWords([card], notYet, { langTag: "sk-SK", tz: 0 }).length, 1);

		const graduated: ReviewLogEntry[] = [
			...wrongs,
			makeLog({ cardId: card.id, reviewedAt: "2026-11-03T10:00:00Z", given: "Oznámil", verdict: "exact", rating: 3 }),
			makeLog({ cardId: card.id, reviewedAt: "2026-11-05T10:00:00Z", given: "Oznámil", verdict: "exact", rating: 3 }),
		];
		assert.equal(slippingWords([card], graduated, { langTag: "sk-SK", tz: 0 }).length, 0);

		const relapsed: ReviewLogEntry[] = [
			...graduated,
			makeLog({ cardId: card.id, reviewedAt: "2026-11-06T10:00:00Z", given: "povedal", verdict: "wrong", rating: 1 }),
		];
		assert.equal(slippingWords([card], relapsed, { langTag: "sk-SK", tz: 0 }).length, 1);
	});

	test("stable review card (stability >= 7) graduates after one clean recall on a later day", () => {
		const card = makeCard({
			id: "zaujem#0",
			slug: "zaujem",
			lemma: "záujem",
			sentence: "Mám o to záujem.",
			answer: "záujem",
			state: "review",
			memory: { stability: 9.5, difficulty: 5 },
		});
		const log: ReviewLogEntry[] = [
			makeLog({ cardId: card.id, reviewedAt: "2026-11-01T10:00:00Z" }),
			makeLog({ cardId: card.id, reviewedAt: "2026-11-02T10:00:00Z" }),
			makeLog({ cardId: card.id, reviewedAt: "2026-11-04T10:00:00Z", given: "záujem", verdict: "exact", rating: 3 }),
		];
		assert.equal(slippingWords([card], log, { langTag: "sk-SK", tz: 0 }).length, 0);
	});
});

describe("buildSlippingLesson and slippingSentenceTargets", () => {
	test("builds meaning -> mix-up contrast -> fresh-sentence typed cloze without leaking lemma", () => {
		const entries: LexiconEntry[] = [
			makeEntry(
				"tvrdit",
				"tvrdiť",
				"to claim, assert",
				[
					{ sk: "On tvrdí, že má pravdu.", en: "He claims he is right.", answer: "tvrdí" },
					{ sk: "Nemôžem to tvrdiť s istotou.", en: "I cannot claim that for sure.", answer: "tvrdiť" },
					{ sk: "Lekár tvrdil, že to prejde.", en: "The doctor claimed it would pass.", answer: "tvrdil" },
				],
				["tvrdí", "tvrdil"],
			),
			makeEntry(
				"hovorit",
				"hovoriť",
				"to speak, say",
				[
					{ sk: "Hovorí pomaly po slovensky.", en: "He speaks slowly in Slovak.", answer: "Hovorí" },
					{ sk: "Chcem hovoriť s tebou.", en: "I want to speak with you.", answer: "hovoriť" },
				],
				["hovorí", "hovorila"],
			),
			makeEntry(
				"oznamit",
				"oznámiť",
				"to announce",
				[
					{ sk: "Oznámil to všetkým.", en: "He announced it to everyone.", answer: "Oznámil" },
					{ sk: "Škola oznámila nový termín.", en: "The school announced a new date.", answer: "oznámila" },
				],
				["oznámil", "oznámila"],
			),
			makeEntry("zaujem", "záujem", "interest", [
				{ sk: "Mám o to záujem.", en: "I am interested in that.", answer: "záujem" },
			]),
			makeEntry(
				"voda",
				"voda",
				"water",
				[{ sk: "Pijem čistú vodu.", en: "I drink clean water.", answer: "vodu" }],
				["vodu"],
			),
		];
		const tvrditCard = makeCard({
			id: "tvrdit#0",
			slug: "tvrdit",
			lemma: "tvrdiť",
			gloss: "to claim, assert",
			sentence: "On tvrdí, že má pravdu.",
			answer: "tvrdí",
			translation: "He claims he is right.",
		});
		const slipping = [
			{
				id: tvrditCard.id,
				slug: tvrditCard.slug,
				lemma: tvrditCard.lemma,
				gloss: tvrditCard.gloss,
				sentence: tvrditCard.sentence,
				wrongs: 4,
				lapses: 1,
				missDays: 2,
				stability: 0.4,
				hasBlankMiss: true,
				cleanAfterLastWrong: 0,
				lastWrongAt: "2026-11-05T10:00:00Z",
				due: "2026-11-06T10:00:00Z",
				card: tvrditCard,
			},
		];
		const mixups = {
			"hovorit::tvrdit": {
				a: "hovorit",
				b: "tvrdit",
				words: ["hovoriť", "tvrdiť"] as [string, string],
				since: "2026-11-01T10:00:00Z",
				lastAt: "2026-11-05T10:00:00Z",
				misses: 2,
				hits: 0,
			},
		};
		const plan = buildSlippingLesson(slipping, entries, mixups, { seed: 42 });
		const kinds = plan.items.map((i) => i.kind);
		assert.ok(kinds.includes("meaning"));
		assert.ok(plan.items.some((i) => i.pair?.id === "hovorit::tvrdit"));
		assert.ok(kinds.includes("type"));

		const meaningItem = plan.items.find((i) => i.kind === "meaning")!;
		assert.equal(meaningItem.hint, "tvrdiť");
		assert.ok((meaningItem.options?.length ?? 0) >= 2);
		assert.ok(meaningItem.options!.includes(meaningItem.translation));

		const typeItem = plan.items.find((i) => i.kind === "type" && !i.pair)!;
		assert.notEqual(typeItem.sentence, "On tvrdí, že má pravdu.");
		assert.equal(typeItem.unit, "words");
		assert.notEqual(typeItem.hint, "tvrdiť");
	});

	test("slippingSentenceTargets puts missed words first, deduplicates, and caps at 3", () => {
		const items = [
			{ slug: "tvrdit", lemma: "tvrdiť", gloss: "claim" },
			{ slug: "oznamit", lemma: "oznámiť", gloss: "announce" },
			{ slug: "zaujem", lemma: "záujem", gloss: "interest" },
			{ slug: "voda", lemma: "voda", gloss: "water" },
			{ slug: "voda", lemma: "voda", gloss: "water" },
		] as unknown as import("../src/core/lesson.ts").LessonItem[];
		const targets = slippingSentenceTargets(items, ["voda", "zaujem"]);
		assert.deepEqual(
			targets.map((t) => t.slug),
			["zaujem", "voda", "tvrdit"],
		);
	});

	test("keeps item ids unique even when meaning, mix-up, and type share one example", () => {
		const entries: LexiconEntry[] = [
			makeEntry(
				"tvrdit",
				"tvrdiť",
				"to claim",
				[{ sk: "Tvrdiť to je ľahké.", en: "Claiming that is easy.", answer: "Tvrdiť" }],
				["tvrdim"],
			),
			makeEntry(
				"hovorit",
				"hovoriť",
				"to speak",
				[{ sk: "Hovoriť pravdu je dobré.", en: "Speaking the truth is good.", answer: "Hovoriť" }],
				["hovorim"],
			),
		];
		const card = makeCard({
			id: "tvrdit#0",
			slug: "tvrdit",
			lemma: "tvrdiť",
			gloss: "to claim",
			sentence: "Tvrdiť to je ľahké.",
			answer: "Tvrdiť",
			translation: "Claiming that is easy.",
		});
		const slipping = [
			{
				id: card.id,
				slug: card.slug,
				lemma: card.lemma,
				gloss: card.gloss,
				wrongs: 4,
				lapses: 1,
				missDays: 2,
				stability: 0.4,
				hasBlankMiss: true,
				lastWrongAt: "2026-11-05T10:00:00Z",
				card,
			},
		];
		const mixups = {
			"hovorit::tvrdit": {
				a: "hovorit",
				b: "tvrdit",
				words: ["hovoriť", "tvrdiť"] as [string, string],
				since: "2026-11-01T10:00:00Z",
				lastAt: "2026-11-05T10:00:00Z",
				misses: 2,
				hits: 0,
			},
		};
		const plan = buildSlippingLesson(slipping, entries, mixups, { seed: 7 });
		const ids = plan.items.map((i) => i.id);
		assert.equal(new Set(ids).size, ids.length);
	});
});

describe("server integration: known unmark and reading exclusion", () => {
	test("answerReview auto-unmarks known word on lapse and knownWords excludes active slipping slugs", () => {
		const card = makeCard({
			id: "tvrdit#0",
			slug: "tvrdit",
			lemma: "tvrdiť",
			gloss: "claim",
			sentence: "On tvrdí, že má pravdu.",
			answer: "tvrdí",
			state: "review",
			memory: { stability: 4, difficulty: 5 },
		});
		reviewStore.writeCards({ [card.id]: card });
		knownWordStore.set("tvrdit", "tvrdiť", true, new Date("2026-11-01T10:00:00Z"));
		assert.equal(knownWordStore.has("tvrdit"), true);

		answerReview({ cardId: card.id, given: "", rating: 1 }, new Date("2026-11-02T10:00:00Z"));
		assert.equal(knownWordStore.has("tvrdit"), false);

		// Second wrong puts it into active slipping; even if marked known again, knownWords() excludes it.
		answerReview({ cardId: card.id, given: "", rating: 1 }, new Date("2026-11-03T10:00:00Z"));
		knownWordStore.set("tvrdit", "tvrdiť", true, new Date("2026-11-03T11:00:00Z"));
		const kw = knownWords();
		assert.equal(kw.known.has("tvrdit"), false);
		assert.equal(kw.expected.has("tvrdit"), false);

		const status = reviewStatus(new Date("2026-11-03T12:00:00Z"), 0);
		assert.ok(status.leeches.some((l) => l.slug === "tvrdit" && l.wrongs >= 2));
		assert.match(reviewDigest(new Date("2026-11-03T12:00:00Z")), /tvrdiť/);
	});
});
