import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-common-words-"));
process.env.LANNA_DATA_DIR = scratch;
process.env.LANNA_PROFILE = "slovak";

const { getCommonWords, markCommonWordsKnown } = await import("../src/server/common-words.ts");
const { knownWordStore } = await import("../src/store/known-words.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { savedPhraseStore } = await import("../src/store/saved-phrases.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { knownWords } = await import("../src/server/reading.ts");
const { wordEstimateReport } = await import("../src/server/word-estimate.ts");
const { learnerFacts, wordSets } = await import("../src/server/milestones.ts");
const { markedReach } = await import("../src/core/common-words.ts");
const { withProfile } = await import("../config.ts");
const { languageById } = await import("../src/core/language.ts");
const commonRoute = await import("../app/api/words/common/route.ts");
const knownRoute = await import("../app/api/words/known/route.ts");

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

test("top 200 then top 500 select exact prefixes, preserve marks, and leave Review untouched", () => {
	const initial = getCommonWords(501);
	assert.equal(initial.items.length, 501);
	assert.deepEqual(
		initial.items.map((w) => w.rank),
		Array.from({ length: 501 }, (_, i) => i + 1),
	);
	assert.equal(new Set(initial.items.map((w) => w.slug)).size, 501);
	const outside = initial.items[500]!;
	knownWordStore.set(outside.slug, outside.lemma, true, new Date("2026-11-16T10:00:00Z"));
	savedPhraseStore.setFavorite(outside.slug, true);
	assert.equal(getCommonWords(501).items[500]!.slug, outside.slug);
	const cards = reviewStore.readCards();
	assert.deepEqual(markCommonWordsKnown(200, new Date("2026-11-17T10:00:00Z")), { added: 200, selected: 200 });
	assert.equal(
		getCommonWords(200).items.every((w) => w.known),
		true,
	);
	assert.equal(getCommonWords(201).items[200]!.known, false);
	assert.deepEqual(markCommonWordsKnown(500, new Date("2026-11-17T11:00:00Z")), { added: 300, selected: 500 });
	assert.equal(knownWordStore.slugs().size, 501);
	assert.deepEqual([...knownWordStore.slugs()].sort(), initial.items.map((w) => w.slug).sort());
	assert.equal(knownWordStore.read().words[outside.slug]!.at, "2026-11-16T10:00:00.000Z");
	assert.equal(knownWordStore.read().words[initial.items[0]!.slug]!.at, "2026-11-17T10:00:00.000Z");
	assert.deepEqual(markCommonWordsKnown(500, new Date("2026-11-17T12:00:00Z")), { added: 0, selected: 500 });
	assert.equal(knownWordStore.updatedAt(), "2026-11-17T11:00:00.000Z");
	assert.deepEqual(reviewStore.readCards(), cards);
	const met = knownWords(loadLexicon()).met;
	for (const word of initial.items) assert.equal(met.has(word.slug), true);
	const report = wordEstimateReport();
	assert.equal(report.estimate!.parts.marked, 501);
	assert.equal(report.measured, false);
	const sets = wordSets(loadLexicon());
	assert.equal(sets.marked.size, 501, "Milestones counts the same marks as the Words page");
	for (const word of initial.items) assert.equal(sets.known.has(word.slug), true);
	const facts = learnerFacts(loadLexicon());
	assert.equal(facts.marked, 501);
	assert.ok(facts.vocabulary >= 501);
});

test("individual corrections use the existing API and survive reloading the common list", async () => {
	const word = getCommonWords(1).items[0]!;
	const response = await knownRoute.POST(
		new Request("http://localhost/api/words/known", {
			method: "POST",
			body: JSON.stringify({ slug: word.slug, known: false }),
		}),
	);
	assert.equal(response.status, 200);
	assert.equal(getCommonWords(1).items[0]!.known, false);
	assert.equal(markCommonWordsKnown(200).added, 1);
});

test("the API validates counts before writing and supports custom counts", async () => {
	const before = knownWordStore.read();
	for (const count of [0, -1, 1.5, "200", null, 100_001]) {
		const response = await commonRoute.POST(
			new Request("http://localhost/api/words/common", {
				method: "POST",
				body: JSON.stringify({ count }),
			}),
		);
		assert.equal(response.status, 400);
	}
	assert.equal(
		(await commonRoute.POST(new Request("http://localhost/api/words/common", { method: "POST", body: "{" }))).status,
		400,
	);
	assert.deepEqual(knownWordStore.read(), before);
	for (const count of ["0", "-1", "1.5", "NaN", "100001"]) {
		assert.equal((await commonRoute.GET(new Request(`http://localhost/api/words/common?count=${count}`))).status, 400);
	}
	const listed = await commonRoute.GET(new Request("http://localhost/api/words/common?count=237"));
	assert.equal(listed.status, 200);
	const data = (await listed.json()) as ReturnType<typeof getCommonWords>;
	assert.equal(data.items.length, 237);
	const marked = await commonRoute.POST(
		new Request("http://localhost/api/words/common", {
			method: "POST",
			body: JSON.stringify({ count: 537 }),
		}),
	);
	assert.deepEqual(await marked.json(), { added: 36, selected: 537 });
	assert.equal(getCommonWords(538).items[537]!.known, false);
});

test("a smaller dictionary is clamped and another profile's marks stay isolated", () => {
	const slovak = knownWordStore.slugs();
	const profile = "common-words-fixture";
	const folder = path.join(scratch, "languages", profile);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "language.json"), JSON.stringify({ ...languageById("slovak"), id: profile }));
	fs.writeFileSync(
		path.join(folder, "lexicon.json"),
		JSON.stringify({
			words: [
				{
					slug: "alpha",
					lemma: "alpha",
					en: "first",
					cat: "Nouns",
					rank: 1,
					examples: [{ sk: "alpha alpha beta", en: "first first second" }],
				},
				{ slug: "beta", lemma: "beta", en: "second", cat: "Nouns", rank: 2, examples: [] },
			],
		}),
	);
	withProfile(profile, () => {
		assert.equal(knownWordStore.slugs().size, 0);
		const report = getCommonWords(100_000);
		assert.equal(report.total, 2);
		assert.deepEqual(
			report.items.map((w) => w.lemma),
			["alpha", "beta"],
		);
		assert.deepEqual(markCommonWordsKnown(500), { added: 2, selected: 2 });
		assert.equal(
			getCommonWords(200).items.every((w) => w.known),
			true,
		);
	});
	assert.deepEqual(knownWordStore.slugs(), slovak);
	withProfile("common-words-empty", () => {
		assert.deepEqual(getCommonWords(200), { total: 0, items: [] });
		assert.deepEqual(markCommonWordsKnown(200), { added: 0, selected: 0 });
	});
});

test("invalid service counts fail without reading a huge range", () => {
	for (const count of [NaN, Infinity, -1, 0, 1.5, 100_001]) {
		assert.throws(() => getCommonWords(count));
		assert.throws(() => markCommonWordsKnown(count));
	}
});

test("a band marks only its own ranks and the API rejects a bad start", async () => {
	const words = getCommonWords(1_100).items;
	for (const word of words.slice(1_000, 1_100)) knownWordStore.set(word.slug, word.lemma, false);
	assert.deepEqual(markCommonWordsKnown(1_100, new Date(), 1_001), { added: 100, selected: 100 });
	const after = getCommonWords(1_101).items;
	assert.equal(
		after.slice(1_000, 1_100).every((w) => w.known),
		true,
	);
	assert.equal(after[1_100]!.known, false);
	for (const from of [0, 1.5, "1", 1_101]) {
		const response = await commonRoute.POST(
			new Request("http://localhost/api/words/common", {
				method: "POST",
				body: JSON.stringify({ count: 1_100, from }),
			}),
		);
		assert.equal(response.status, 400);
	}
	assert.throws(() => markCommonWordsKnown(10, new Date(), 11));
});

test("the slider opens at the edge of what is marked", () => {
	const stops = [200, 500, 1000, 2000];
	const marked = (n: number, of: number) => Array.from({ length: of }, (_, i) => i < n);
	assert.equal(markedReach(marked(0, 3000), stops), 0);
	assert.equal(markedReach(marked(1000, 3000), stops), 1000);
	assert.equal(markedReach(marked(600, 3000), stops), 1000);
	const withGaps = marked(1000, 3000).map((known, i) => known && i % 20 !== 5);
	assert.equal(markedReach(withGaps, stops), 1000, "a few un-marked words keep the prefix");
	const stray = Array.from({ length: 3000 }, (_, i) => i === 2500);
	assert.equal(markedReach(stray, stops), 0, "one rare word marked is not a prefix");
	assert.equal(markedReach(marked(2500, 2600), stops), 2500, "past the last stop: the reach itself");
});

test("sliding back and un-marking keeps the top and the words marked further down", async () => {
	markCommonWordsKnown(1000);
	const far = getCommonWords(3000).items[2999]!;
	knownWordStore.set(far.slug, far.lemma, true);
	const response = await commonRoute.POST(
		new Request("http://localhost/api/words/common", {
			method: "POST",
			body: JSON.stringify({ from: 701, count: 1000, known: false }),
		}),
	);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { removed: 300, selected: 300 });
	const after = getCommonWords(1000).items;
	assert.equal(
		after.slice(0, 700).every((w) => w.known),
		true,
	);
	assert.equal(
		after.slice(700).some((w) => w.known),
		false,
	);
	assert.equal(knownWordStore.has(far.slug), true, "a word tapped far down is outside the range");
	assert.equal(
		markedReach(
			after.map((w) => w.known),
			[],
		),
		700,
	);
});
