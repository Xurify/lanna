/**
 * CATCH THE MISTAKE (LangHarness, 2026-11-05; creator-hooks proposal 6):
 * the chooser and the checker for a deliberate wrong word
 * (src/core/reading-slip.ts), the brief's slip lines, the store round trip
 * (an older episode without a slip stays readable), and one episode written
 * on a scripted engine: no slip is planted, whatever pairs are on record.
 * Runs under an isolated LH_DATA_DIR (the scratch folder when one is set).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";
import type { Mixup, MixupRecord } from "../src/core/mixups.ts";
import { PAIRS } from "../src/core/pairs.ts";
import { chooseSlip, SLIP_MIN_MISSES, SLIP_RECENT_EPISODES, slipBrief, verifySlip, type SlipLexicon, type SlipTarget } from "../src/core/reading-slip.ts";
import { parseStoryDraft, tokenize, type StoryRecord, type StorySentence } from "../src/core/reading.ts";

const TMP_DATA = process.env.LH_DATA_DIR ? undefined : fs.mkdtempSync(path.join(os.tmpdir(), "lh-slip-"));
if (TMP_DATA) process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { loadLexicon } = await import("../src/agent/lexicon.ts");
const reading = await import("../src/server/reading.ts");
const { loadWorld } = await import("../src/server/world.ts");
const { storyStore } = await import("../src/store/stories.ts");
const { progressStore } = await import("../src/store/progress.ts");

after(() => {
	if (TMP_DATA) fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const lexicon = loadLexicon()!;
const slipLexicon: SlipLexicon = { entries: lexicon.entries, bySlug: lexicon.bySlug };

/** A mix-up on record, with the last miss as evidence: what the sentence asked for and what was given. */
function mixup(a: string, b: string, misses: number, opts: { answer?: string; given?: string; hits?: number; lastAt?: string } = {}): Mixup {
	const at = opts.lastAt ?? "2026-11-02T10:00:00.000Z";
	return {
		a,
		b,
		words: [a, b],
		since: "2026-11-01T10:00:00.000Z",
		lastAt: at,
		misses,
		hits: opts.hits ?? 0,
		seen: [{ at, sentence: "Kam ideš?", answer: opts.answer ?? "Kam", given: opts.given ?? "kde" }],
	};
}

const choice = (record: MixupRecord, recentPairs: string[] = [], speaker = "Robo") => ({ record, lexicon: slipLexicon, pairs: PAIRS, recentPairs, speaker });

/** A sentence as the reader holds it: its word tokens, and who says it. */
function line(sk: string, who?: string): StorySentence {
	return { sk, en: "", tokens: tokenize(sk).map((t) => ({ text: t.text, word: t.word })), ...(who ? { who } : {}) };
}

/** A short Robo episode: the slip in sentence 1, the repair in sentence 2. */
function episode(slipSentence = "Kde ideme dnes?", repair = "Kam, nie kde! Ideme do centra."): StorySentence[] {
	return [line("Robo je v Bratislave.", "Robo"), line(slipSentence, "Robo"), line(repair, "Robo"), line("Super.", "Robo")];
}

/** The kam/kde target, chosen from the record the chooser reads. */
function kamTarget(): SlipTarget {
	const target = chooseSlip(choice({ "kam~kde": mixup("kam", "kde", 2) }));
	assert.ok(target, "kam and kde qualify");
	return target;
}

describe("choosing the slip", () => {
	it("no candidate: nothing on record, one miss, a pair that is not verified, no lead, no evidence", () => {
		assert.equal(chooseSlip(choice({})), null);
		assert.equal(chooseSlip(choice({ "kam~kde": mixup("kam", "kde", 1) })), null);
		assert.equal(chooseSlip(choice({ "hovorit~oznamit": mixup("oznamit", "hovorit", 4, { answer: "Oznámil", given: "hovoril" }) })), null);
		assert.equal(chooseSlip(choice({ "kam~kde": mixup("kam", "kde", 2) }, [], "")), null);
		const noEvidence = { ...mixup("kam", "kde", 2), seen: undefined };
		assert.equal(chooseSlip(choice({ "kam~kde": noEvidence })), null);
	});

	it("one candidate: a pair missed twice, verified, with the sentence's form as the right word", () => {
		const target = kamTarget();
		assert.equal(SLIP_MIN_MISSES, 2);
		assert.equal(target.pair, "kam-vs-kde");
		assert.equal(target.speaker, "Robo");
		assert.equal(target.right.slug, "kam");
		assert.equal(target.wrong.slug, "kde");
		assert.equal(target.rule, PAIRS.find((p) => p.id === "kam-vs-kde")!.rule);
		assert.ok(target.wrong.forms.includes("kde"));
	});

	it("the direction is the learner's real mistake: the word they gave is the wrong one", () => {
		const target = chooseSlip(choice({ "kam~kde": mixup("kam", "kde", 2, { answer: "Kde", given: "kam" }) }));
		assert.equal(target?.wrong.slug, "kam");
		assert.equal(target?.right.slug, "kde");
	});

	it("five episodes: a pair one of the recent episodes used is left out, and the next candidate is taken", () => {
		assert.equal(SLIP_RECENT_EPISODES, 5);
		const record = { "kam~kde": mixup("kam", "kde", 2), "moj~svoj": mixup("moj", "svoj", 2, { answer: "svoj", given: "môj" }) };
		assert.equal(chooseSlip(choice(record, ["kam-vs-kde"]))?.pair, "svoj-vs-moj");
		assert.equal(chooseSlip(choice({ "kam~kde": mixup("kam", "kde", 2) }, ["kam-vs-kde"])), null);
	});

	it("open mix-ups come first, then the most misses, then the latest", () => {
		const open = mixup("kam", "kde", 2, { hits: 0 });
		const mended = { ...mixup("moj", "svoj", 5, { answer: "svoj", given: "môj" }), hits: 3 };
		assert.equal(chooseSlip(choice({ "kam~kde": open, "moj~svoj": mended }))?.pair, "kam-vs-kde");
		const older = mixup("kam", "kde", 2, { lastAt: "2026-11-01T10:00:00.000Z" });
		const newer = mixup("moj", "svoj", 2, { answer: "svoj", given: "môj", lastAt: "2026-11-03T10:00:00.000Z" });
		assert.equal(chooseSlip(choice({ "kam~kde": older, "moj~svoj": newer }))?.pair, "svoj-vs-moj");
	});
});

describe("checking the slip the model returned", () => {
	const target = kamTarget();

	it("accepts a correct slip and keeps what the record needs", () => {
		const check = verifySlip({ sentence: 1, wrong: "Kde", right: "Kam" }, target, episode(), slipLexicon, PAIRS);
		assert.ok("slip" in check, "accepted");
		assert.deepEqual(check.slip, { pair: "kam-vs-kde", sentence: 1, wrong: "Kde", right: "Kam", wrongSlug: "kde", rightSlug: "kam", rule: target.rule, speaker: "Robo" });
	});

	it("rejects a wrong form that is not a token of the slip sentence", () => {
		const check = verifySlip({ sentence: 1, wrong: "chodím", right: "Kam" }, target, episode(), slipLexicon, PAIRS);
		assert.ok("reason" in check);
		assert.match(check.reason, /not a form of kde/);
	});

	it("rejects the right twin's form given as the wrong word", () => {
		const check = verifySlip({ sentence: 1, wrong: "Kam", right: "Kam" }, target, episode("Kam ideme dnes?"), slipLexicon, PAIRS);
		assert.ok("reason" in check);
	});

	it("rejects a slip sentence that also holds the right word", () => {
		const check = verifySlip({ sentence: 1, wrong: "Kde", right: "Kam" }, target, episode("Kde ideme, kam?"), slipLexicon, PAIRS);
		assert.ok("reason" in check);
		assert.match(check.reason, /also holds the right word/);
	});

	it("rejects a missing repair: the slip is the last sentence, or the repair does not say the right word", () => {
		const last = verifySlip({ sentence: 3, wrong: "Kde", right: "Kam" }, target, episode(), slipLexicon, PAIRS);
		assert.ok("reason" in last);
		const noRight = verifySlip({ sentence: 1, wrong: "Kde", right: "Kam" }, target, episode("Kde ideme dnes?", "Ideme do centra, dobre."), slipLexicon, PAIRS);
		assert.ok("reason" in noRight);
		assert.match(noRight.reason, /does not say a form of kam/);
	});

	it("rejects a slip whose index was dropped (-1) or that the model never gave", () => {
		assert.ok("reason" in verifySlip({ sentence: -1, wrong: "Kde", right: "Kam" }, target, episode(), slipLexicon, PAIRS));
		assert.ok("reason" in verifySlip(undefined, target, episode(), slipLexicon, PAIRS));
	});

	it("rejects a slip that is not Robo's lines", () => {
		const narrated = episode();
		narrated[1] = line("Kde ideme dnes?");
		assert.ok("reason" in verifySlip({ sentence: 1, wrong: "Kde", right: "Kam" }, target, narrated, slipLexicon, PAIRS));
	});

	it("rejects a pair that is not one of the verified pairs", () => {
		const unverified: SlipTarget = { ...target, pair: "not-a-pair" };
		assert.ok("reason" in verifySlip({ sentence: 1, wrong: "Kde", right: "Kam" }, unverified, episode(), slipLexicon, PAIRS));
		const other: SlipTarget = { ...target, right: { slug: "ist", lemma: "ísť", forms: [] } };
		assert.ok("reason" in verifySlip({ sentence: 1, wrong: "Kde", right: "Kam" }, other, episode(), slipLexicon, PAIRS));
	});

	it("the brief names the words and asks for the JSON that the check reads", () => {
		const lines = slipBrief(target);
		assert.ok(lines[0]!.startsWith("Robo's slip"));
		assert.ok(lines.some((l) => l.includes('"kam"') && l.includes('"kde"')));
		assert.ok(lines.at(-1)!.includes('"slip": {"sentence"'));
	});
});

describe("the brief", () => {
	const k = reading.knownWords(lexicon);
	const world = loadWorld();

	it("asks for the slip only when a target exists", () => {
		const with_ = reading.storyBrief(k, [], [], new Date("2026-11-05T10:00:00Z"), "robo", world, undefined, kamTarget());
		assert.match(with_.prompt, /Robo's slip \(this episode only\)/);
		assert.match(with_.prompt, /"slip": \{"sentence"/);
		assert.ok(with_.slip);
		const without = reading.storyBrief(k, [], [], new Date("2026-11-05T10:00:00Z"), "robo", world);
		assert.doesNotMatch(without.prompt, /slip/i);
		assert.equal("slip" in without, false);
	});
});

describe("the model's answer", () => {
	it("maps the slip's index onto the sentences kept after a blank one is dropped", () => {
		const d = parseStoryDraft(
			JSON.stringify({
				title: "Robo ide",
				cast: [{ name: "Robo", gender: "m", age: "young" }],
				sentences: [
					{ sk: "Prvá veta.", en: "First." },
					{ sk: "", en: "", who: "narrator" },
					{ sk: "Kde ideme dnes?", en: "Where are we going today?", who: "Robo" },
					{ sk: "Kam, nie kde! Ideme do centra.", en: "Where to, not where! Let's go downtown.", who: "Robo" },
					{ sk: "Dobre.", en: "Good." },
				],
				slip: { sentence: 2, wrong: "Kde", right: "Kam" },
			}),
		);
		assert.deepEqual(d.slip, { sentence: 1, wrong: "Kde", right: "Kam" });
		assert.equal(d.sentences.length, 4);
	});

	it("a slip on a dropped sentence is kept as -1 (the check drops it), and a slip that is not shaped as asked is left out", () => {
		const base = { title: "T", cast: [{ name: "Robo", gender: "m", age: "young" }], sentences: [{ sk: "A.", en: "" }, { sk: "", en: "" }, { sk: "B.", en: "" }, { sk: "C.", en: "" }] };
		assert.equal(parseStoryDraft(JSON.stringify({ ...base, slip: { sentence: 1, wrong: "Kde", right: "Kam" } })).slip?.sentence, -1);
		assert.equal(parseStoryDraft(JSON.stringify({ ...base, slip: { sentence: "2", wrong: "Kde", right: "Kam" } })).slip?.sentence, 1);
		assert.equal(parseStoryDraft(JSON.stringify({ ...base, slip: { sentence: 2, wrong: "", right: "Kam" } })).slip, undefined);
		assert.equal(parseStoryDraft(JSON.stringify(base)).slip, undefined);
	});
});

/** A record with the fields the store and the library read, and the slip when the test gives one. */
function record(id: string, extra: Partial<StoryRecord> = {}): StoryRecord {
	return {
		id,
		lang: "sk",
		series: "robo",
		episode: 1,
		title: "Robo ide do centra",
		level: "A1",
		chapter: "hello",
		theme: "a day in the city",
		createdAt: "2026-11-05T10:00:00.000Z",
		sentences: episode(),
		questions: [],
		newWords: [],
		recap: "Robo goes downtown.",
		coverage: 1,
		wordCount: 14,
		usage: { model: "faux:story", steps: [] },
		drafts: 1,
		...extra,
	};
}

describe("the store", () => {
	it("keeps the slip on the episode, and an episode written before the slip stays readable", () => {
		const slip = { pair: "store-test-pair", sentence: 1, wrong: "Kde", right: "Kam", wrongSlug: "kde", rightSlug: "kam", rule: "kam asks where TO.", speaker: "Robo" };
		storyStore.put(record("ep-001-robo-ide-do-centra", { slip }));
		storyStore.put(record("ep-002-robo-ide-domov", { episode: 2, title: "Robo ide domov", createdAt: "2026-11-05T11:00:00.000Z" }));
		assert.deepEqual(storyStore.get("ep-001-robo-ide-do-centra")?.slip, slip);
		const older = storyStore.get("ep-002-robo-ide-domov");
		assert.ok(older);
		assert.equal(older.slip, undefined);
		assert.deepEqual(storyStore.list().map((s) => s.id), ["ep-001-robo-ide-do-centra", "ep-002-robo-ide-domov"]);
	});
});

describe("one episode on a scripted engine", () => {
	/** Two responses, so a draft under the coverage floor is written again the same way. */
	function scripted(draft: object) {
		const steps: FauxResponseStep[] = [fauxAssistantMessage(JSON.stringify(draft)), fauxAssistantMessage(JSON.stringify(draft))];
		const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		faux.setResponses(steps);
		return { model: faux.getModel(), streamFn: faux.streamSimple };
	}

	const draftWith = (slip: object | undefined, title: string) => ({
		title,
		topic: "a walk downtown",
		cast: [
			{ name: "Robo", gender: "m", age: "young" },
			{ name: "Zuzka", gender: "f", age: "young" },
		],
		sentences: [
			{ who: "narrator", sk: "Robo je v Bratislave.", en: "Robo is in Bratislava." },
			{ who: "Robo", sk: "Kde ideme dnes?", en: "Where are we going today?" },
			{ who: "Robo", sk: "Kam, nie kde! Ideme do centra.", en: "Where to, not where! We are going downtown." },
			{ who: "Zuzka", sk: "Dobre, poďme.", en: "Good, let's go." },
			{ who: "narrator", sk: "Ideli spolu.", en: "They went together." },
		],
		newWords: [],
		questions: [{ q: "Kam idú?", options: ["Do centra", "Domov", "Do kina"], answer: 0 }],
		recap: "Robo and Zuzka go downtown.",
		...(slip ? { slip } : {}),
	});

	const at = (day: string) => new Date(`2026-11-${day}T10:00:00Z`);

	it("with a pair on record the episode is written with no slip", () => {
		progressStore.write({ ...progressStore.read(), mixups: { "kam~kde": mixup("kam", "kde", 2) } });
		const engine = scripted(draftWith({ sentence: 1, wrong: "Kde", right: "Kam" }, "Robo ide do centra"));
		return reading.generateStory({ engine, model: "faux:slip", now: at("10") }).then((story) => {
			assert.equal(story.slip, undefined);
			assert.equal(storyStore.get(story.id)?.slip, undefined);
			assert.ok(storyStore.get(story.id), "the episode is kept");
		});
	});

	it("a slip the model returns anyway is ignored, and the episode is kept", () => {
		progressStore.write({ ...progressStore.read(), mixups: { "moj~svoj": mixup("moj", "svoj", 2, { answer: "svoj", given: "môj" }) } });
		const engine = scripted(draftWith({ sentence: 1, wrong: "chodím", right: "Kam" }, "Robo a centrum"));
		return reading.generateStory({ engine, model: "faux:slip", now: at("11") }).then((story) => {
			assert.equal(story.slip, undefined);
			assert.ok(storyStore.get(story.id), "the episode is kept");
		});
	});

	it("with no pair on record the episode is written with no slip", () => {
		progressStore.write({ ...progressStore.read(), mixups: {} });
		const engine = scripted(draftWith(undefined, "Robo ide znova"));
		return reading.generateStory({ engine, model: "faux:slip", now: at("12") }).then((story) => {
			assert.equal(story.slip, undefined);
			assert.ok(storyStore.get(story.id));
		});
	});
});
