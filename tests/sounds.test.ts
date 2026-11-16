/**
 * ZVUK PINS (phase 7): the sounds file's shape, the drop rule
 * (the twins differ in exactly one sound, every shadow line is a verified
 * example of one twin and holds only that twin), the listening check's
 * order, the shadowing verdict, and the clarity thresholds the verdict reads
 * (unchanged from Speak).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
	checkSound,
	getSound,
	getSoundsForLanguage,
	LISTEN_ITEMS,
	listenOrder,
	SHADOW_GAP_MS,
	SHADOW_MAX_MS,
	SHADOW_MAX_WORDS,
	SHADOW_TRIES,
	shadowVerdict,
	soundDistance,
	twinIn,
	type SoundDef,
} from "../src/core/sounds.ts";
import { PRON_CLEAR, PRON_GOOD } from "../src/core/pronounce.ts";
import { allChapters } from "../src/core/curriculum.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const lexicon = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] };
const bySlug = new Map(lexicon.words.map((e) => [e.slug, e]));
const examplesOf = (slug: string): string[] | undefined =>
	bySlug.get(slug)?.examples.flatMap((x) => (x.sk ? [x.sk] : []));

test("the sounds file: two sounds, each in a real chapter, with a rule, a bridge and two twins", () => {
	const sounds = getSoundsForLanguage("slovak");
	assert.equal(sounds.length, 2);
	const chapters = new Set(allChapters().map((c) => c.id));
	const ids = new Set<string>();
	for (const s of sounds) {
		assert.ok(!ids.has(s.id), `${s.id} appears twice`);
		ids.add(s.id);
		assert.ok(chapters.has(s.chapter), `${s.id} sits in an unknown chapter ${s.chapter}`);
		assert.ok(s.rule.length > 0 && s.bridge.length > 0, `${s.id} needs a rule and a bridge`);
		assert.equal(s.twins.length, 2);
	}
});

test("each pair differs in exactly one sound (the length of one vowel)", () => {
	for (const s of getSoundsForLanguage("slovak")) {
		const [a, b] = s.twins;
		assert.equal(soundDistance(a.sk, b.sk), 1, `${a.sk} / ${b.sk}`);
	}
	assert.equal(soundDistance("pas", "pás"), 1);
	assert.equal(soundDistance("rad", "rád"), 1);
	assert.equal(soundDistance("pas", "pas"), 0);
});

test("every sound passes the drop rule: twins in the lexicon, lines verified and holding one twin", () => {
	for (const s of getSoundsForLanguage("slovak")) {
		assert.deepEqual(checkSound(s, examplesOf), [], s.id);
	}
});

test("the drop rule catches a bad sound: an unverified line, a line with no twin, a line with both twins, a long line, a missing twin, twins one sound apart from none", () => {
	const good = getSound("slovak", "dlzka-a-cestovanie") as SoundDef;
	const bad = (over: Partial<SoundDef>) => ({ ...good, ...over });
	const reasonsFor = (over: Partial<SoundDef>) => checkSound(bad(over), examplesOf);
	assert.ok(
		reasonsFor({ lines: ["Stratil som svoj pas kedysi.", "Váš pas, prosím."] }).some((r) =>
			r.includes("not a verified example"),
		),
	);
	assert.ok(
		reasonsFor({ lines: ["Dobrý deň, pani.", "Váš pas, prosím."] }).some((r) => r.includes("exactly one of the twins")),
	);
	assert.ok(
		reasonsFor({ lines: ["Máš pas aj pás?", "Váš pas, prosím."] }).some((r) => r.includes("exactly one of the twins")),
	);
	assert.ok(
		reasonsFor({ lines: ["Máš sýrsky pas?", "Váš pas, prosím, a potom ešte chvíľu čakáme na pokladni."] }).some((r) =>
			r.includes("longer than"),
		),
	);
	assert.ok(
		reasonsFor({ twins: [{ slug: "neexistuje", sk: "pas", en: "x" }, good.twins[1]] }).some((r) =>
			r.includes("not in the lexicon"),
		),
	);
	assert.ok(
		reasonsFor({ twins: [good.twins[0], { slug: "pas", sk: "pome", en: "x" }] }).some((r) =>
			r.includes("exactly one sound"),
		),
	);
});

test("the shadow lines are short, verified, and split across both twins", () => {
	for (const s of getSoundsForLanguage("slovak")) {
		const holds = s.lines.map((l) => twinIn(l, s)?.sk);
		assert.ok(holds.includes(s.twins[0].sk) && holds.includes(s.twins[1].sk), `${s.id}: both twins need a line`);
		for (const l of s.lines) assert.ok(l.split(/\s+/).length <= SHADOW_MAX_WORDS, l);
	}
});

test("the listening check: four items, two of each twin, in an order the random source decides", () => {
	const s = getSound("slovak", "dlzka-a-cestovanie") as SoundDef;
	const order = listenOrder(s, () => 0.5);
	assert.equal(order.length, LISTEN_ITEMS);
	assert.equal(order.filter((w) => w === s.twins[0].sk).length, 2);
	assert.equal(order.filter((w) => w === s.twins[1].sk).length, 2);
	// A different random source gives a different order for the same two twins.
	const seq = [0.1, 0.9, 0.2, 0.7];
	let i = 0;
	const other = listenOrder(s, () => seq[i++ % seq.length] ?? 0);
	assert.equal(other.filter((w) => w === s.twins[0].sk).length, 2);
	assert.deepEqual(
		listenOrder(s, () => 0.5),
		order,
		"the same source gives the same order",
	);
});

test("the verdict reads the Speak clarity bar, and the bar is unchanged", () => {
	assert.equal(PRON_CLEAR, 70);
	assert.equal(PRON_GOOD, 85);
	assert.equal(shadowVerdict(PRON_CLEAR), "clear");
	assert.equal(shadowVerdict(PRON_CLEAR - 1), "again");
	assert.equal(shadowVerdict(100), "clear");
	assert.equal(shadowVerdict(0), "again");
});

test("the timing follows the tutorial's settings: a 700 ms gap, a 6 s cap, three tries", () => {
	assert.ok(SHADOW_GAP_MS >= 600 && SHADOW_GAP_MS <= 800, "Kjellin: 600 to 800 ms between repetitions");
	assert.equal(SHADOW_MAX_MS, 6_000);
	assert.equal(SHADOW_TRIES, 3);
});

test("a sound for an unknown language or id is empty or missing, never an error", () => {
	assert.deepEqual(getSoundsForLanguage("ru"), []);
	assert.equal(getSound("slovak", "neexistuje"), undefined);
});
