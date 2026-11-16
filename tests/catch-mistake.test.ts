/**
 * CATCH THE MISTAKE (LangHarness, 2026-11-06): the items the exercise is built from (src/core/catch-mistake.ts)
 * and the server that serves them (src/server/catch-mistake.ts). The pair comes from chooseCatch and the check
 * is verifyCatch, both from src/core/catch-pair.ts. One item is made on a scripted engine and kept; a second
 * visit gets the same item; an answer is graded once; the pair is held back after it. Runs under its own
 * scratch LH_DATA_DIR, never the real profile.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";
import type { Mixup, MixupRecord } from "../src/core/mixups.ts";
import { PAIRS } from "../src/core/pairs.ts";
import { chooseCatch, type CatchLexicon, type CatchTarget } from "../src/core/catch-pair.ts";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-catch-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { loadLexicon } = await import("../src/agent/lexicon.ts");
const core = await import("../src/core/catch-mistake.ts");
const server = await import("../src/server/catch-mistake.ts");
const { catchStore } = await import("../src/store/catch-mistake.ts");
const { progressStore } = await import("../src/store/progress.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const lexicon = loadLexicon()!;
const slipLexicon: CatchLexicon = { entries: lexicon.entries, bySlug: lexicon.bySlug };
const AT = new Date("2026-11-06T09:00:00Z");

/** A mix-up on record with the last miss as evidence: the sentence asked for "kam" and the learner gave "kde". */
function mixup(a: string, b: string, misses: number): Mixup {
	const at = "2026-11-02T10:00:00.000Z";
	return {
		a,
		b,
		words: [a, b],
		since: "2026-11-01T10:00:00.000Z",
		lastAt: at,
		misses,
		hits: 0,
		seen: [{ at, sentence: "Kam ideš?", answer: "Kam", given: "kde" }],
	};
}

/** The kam/kde target, chosen the way the server chooses it. */
function kamTarget(): CatchTarget {
	const record: MixupRecord = { "kam~kde": mixup("kam", "kde", 2) };
	const target = chooseCatch({ record, lexicon: slipLexicon, pairs: PAIRS, recentPairs: [], speaker: "item" });
	assert.ok(target, "kam and kde qualify with two misses");
	return target;
}

const GOOD = {
	sentences: [
		{ sk: "Ideme na výlet.", en: "We are going on a trip." },
		{ sk: "Kde ideme dnes?", en: "Where are we going today?" },
		{ sk: "Kam, nie kde! Ideme do centra.", en: "Where to, not where! We are going downtown." },
	],
	slip: { sentence: 1, wrong: "Kde", right: "Kam" },
};

function build(draft: {
	sentences: Array<{ sk: string; en: string }>;
	slip: { sentence: number; wrong: string; right: string };
}) {
	return core.buildCatchItem({
		id: "item-1",
		now: AT,
		model: "faux:catch",
		draft,
		target: kamTarget(),
		lexicon: slipLexicon,
		pairs: PAIRS,
	});
}

function goodItem() {
	const built = build(GOOD);
	assert.ok("item" in built, "the good draft is kept");
	return built.item;
}

describe("the model's reply", () => {
	it("reads the first JSON object, even inside a code fence", () => {
		const text =
			'Here it is:\n```json\n{"sentences":[{"sk":"A.","en":"a."},{"sk":"B.","en":"b."},{"sk":"C.","en":"c."}],"slip":{"sentence":1,"wrong":"Kde","right":"Kam"}}\n```';
		const d = core.parseCatchDraft(text);
		assert.ok(d);
		assert.equal(d.sentences.length, 3);
		assert.deepEqual(d.slip, { sentence: 1, wrong: "Kde", right: "Kam" });
	});

	it("refuses a reply with one sentence, no slip, or a slip index that is not a whole number", () => {
		assert.equal(
			core.parseCatchDraft('{"sentences":[{"sk":"A.","en":""}],"slip":{"sentence":0,"wrong":"A","right":"B"}}'),
			null,
		);
		assert.equal(core.parseCatchDraft('{"sentences":[{"sk":"A.","en":""},{"sk":"B.","en":""}]}'), null);
		assert.equal(
			core.parseCatchDraft(
				'{"sentences":[{"sk":"A.","en":""},{"sk":"B.","en":""}],"slip":{"sentence":1.5,"wrong":"A","right":"B"}}',
			),
			null,
		);
		assert.equal(core.parseCatchDraft("no json here"), null);
	});
});

describe("building an item from a draft", () => {
	it("keeps the item, finds the wrong word's token, and shows only the sentences up to it", () => {
		const item = goodItem();
		assert.equal(item.slip.token, 0, "Kde is the first token of sentence 1");
		assert.equal(item.slip.wrongSlug, kamTarget().wrong.slug);
		const view = core.viewOf(item);
		assert.equal(view.sentences.length, 2, "the context and the wrong sentence, not the correction");
		assert.equal(
			view.sentences.flat().some((t) => t.text === "Kam"),
			false,
			"the right word is not shown before the answer",
		);
		assert.equal("slip" in view, false, "the view carries no answer");
	});

	it("refuses a draft where the right word is in the wrong sentence", () => {
		const built = build({
			...GOOD,
			sentences: [GOOD.sentences[0]!, { sk: "Kde ideme, kam?", en: "" }, GOOD.sentences[2]!],
		});
		assert.ok("reason" in built);
		assert.match(built.reason, /right word/);
	});

	it("refuses a wrong sentence that holds the wrong word twice", () => {
		const built = build({
			...GOOD,
			sentences: [GOOD.sentences[0]!, { sk: "Kde ideme, kde?", en: "" }, GOOD.sentences[2]!],
		});
		assert.ok("reason" in built);
		assert.match(built.reason, /2 times/);
	});

	it("refuses a wrong word that is not in the wrong sentence", () => {
		const built = build({ ...GOOD, slip: { sentence: 1, wrong: "Kam", right: "Kam" } });
		assert.ok("reason" in built);
		assert.match(built.reason, /not a form/);
	});

	it("refuses an item with no correction after the wrong sentence", () => {
		const built = build({
			sentences: [GOOD.sentences[0]!, GOOD.sentences[1]!],
			slip: { sentence: 1, wrong: "Kde", right: "Kam" },
		});
		assert.ok("reason" in built);
		assert.match(built.reason, /correction/);
	});
});

describe("tapping and typing", () => {
	it("a tap is right only on the wrong word itself", () => {
		const item = goodItem();
		assert.equal(core.isTapRight(item, { sentence: 1, token: 0 }), true);
		assert.equal(core.isTapRight(item, { sentence: 1, token: 2 }), false, "another word in the sentence");
		assert.equal(core.isTapRight(item, { sentence: 0, token: 0 }), false, "the same token in the context sentence");
	});

	it("the typed word is graded like a lesson answer: exact, accents, or wrong", () => {
		assert.equal(core.gradeTyped("Kam", "kam", "sk-SK"), "exact");
		assert.equal(core.gradeTyped("Kam", "  Kam ", "sk-SK"), "exact");
		assert.equal(core.gradeTyped("kam", "kám", "sk-SK"), "accents");
		assert.equal(core.gradeTyped("Kam", "kde", "sk-SK"), "wrong");
		assert.equal(core.gradeTyped("Kam", "", "sk-SK"), "wrong");
	});
});

describe("the server makes, keeps and grades items", () => {
	/** A scripted engine that answers with the same draft each time it is asked. */
	function scripted(draft: object) {
		const steps: FauxResponseStep[] = [
			fauxAssistantMessage(JSON.stringify(draft)),
			fauxAssistantMessage(JSON.stringify(draft)),
		];
		const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		faux.setResponses(steps);
		return { model: faux.getModel(), streamFn: faux.streamSimple };
	}

	it("a visit with no AI key and no waiting item says so, and makes nothing", async () => {
		catchStore.write({ items: [] });
		progressStore.write({ ...progressStore.read(), mixups: { "kam~kde": mixup("kam", "kde", 2) } });
		const next = await server.nextCatchItem({ now: AT });
		assert.equal(next.view, null);
		assert.match(next.reason ?? "", /AI key/);
		assert.equal(catchStore.list().length, 0);
	});

	it("the first visit makes an item and keeps it; a second visit gets the same item", async () => {
		catchStore.write({ items: [] });
		const first = await server.nextCatchItem({ engine: scripted(GOOD), model: "faux:catch", now: AT });
		assert.ok(first.view, first.reason);
		assert.equal(catchStore.list().length, 1);
		const again = await server.nextCatchItem({
			engine: scripted({ ...GOOD, slip: { sentence: 1, wrong: "Kde", right: "Kam" } }),
			model: "faux:catch",
			now: AT,
		});
		assert.equal(again.view?.id, first.view.id, "the waiting item is served, not a new one");
		assert.equal(catchStore.list().length, 1);
	});

	it("an answer is graded once, and the pair is held back for the next item", async () => {
		catchStore.write({ items: [] });
		progressStore.write({ ...progressStore.read(), mixups: { "kam~kde": mixup("kam", "kde", 2) } });
		const made = await server.nextCatchItem({ engine: scripted(GOOD), model: "faux:catch", now: AT });
		assert.ok(made.view);
		const id = made.view.id;

		const answered = server.answerCatch(id, { sentence: 1, token: 0, typed: "kam" }, AT);
		assert.equal(answered.ok, true);
		if (answered.ok) {
			assert.equal(answered.result.tapOk, true);
			assert.equal(answered.result.verdict, "exact");
			assert.equal(answered.result.right, "Kam");
			assert.equal(answered.result.sentences.length, 3, "the whole item is shown after the answer");
		}

		const twice = server.answerCatch(id, { sentence: 1, token: 0, typed: "kam" }, AT);
		assert.equal(twice.ok, false);
		if (!twice.ok) assert.equal(twice.status, 409);

		const next = await server.nextCatchItem({ engine: scripted(GOOD), model: "faux:catch", now: AT });
		assert.equal(next.view, null, "kam and kde were just used, so no other pair qualifies");
		assert.match(next.reason ?? "", /No pair/);
	});

	it("a wrong tap and a wrong word are both marked", async () => {
		catchStore.write({ items: [] });
		progressStore.write({ ...progressStore.read(), mixups: { "kam~kde": mixup("kam", "kde", 2) } });
		const made = await server.nextCatchItem({ engine: scripted(GOOD), model: "faux:catch", now: AT });
		assert.ok(made.view);
		const answered = server.answerCatch(made.view.id, { sentence: 1, token: 2, typed: "kde" }, AT);
		assert.equal(answered.ok, true);
		if (answered.ok) {
			assert.equal(answered.result.tapOk, false);
			assert.equal(answered.result.verdict, "wrong");
		}
	});

	it("an answer counts toward the pair in the mix-up record", async () => {
		const read = () => progressStore.read().mixups?.["kam~kde"];
		const fresh = async () => {
			catchStore.write({ items: [] });
			progressStore.write({ ...progressStore.read(), mixups: { "kam~kde": mixup("kam", "kde", 2) } });
			const made = await server.nextCatchItem({ engine: scripted(GOOD), model: "faux:catch", now: AT });
			assert.ok(made.view);
			return made.view.id;
		};

		const caught = await fresh();
		server.answerCatch(caught, { sentence: 1, token: 0, typed: "kam" }, AT);
		assert.equal(read()?.hits, 1, "the wrong word caught and the right one typed is a right first try");
		assert.equal(read()?.misses, 2);

		const swapped = await fresh();
		server.answerCatch(swapped, { sentence: 1, token: 0, typed: "kde" }, AT);
		assert.equal(read()?.misses, 3, "typing the other word of the pair is a miss on it");
		assert.equal(read()?.hits, 0);

		const passed = await fresh();
		server.answerCatch(passed, { sentence: 1, token: 2, typed: "kam" }, AT);
		assert.equal(read()?.misses, 3, "letting the wrong word pass is a miss, even with the right word typed");
	});

	it("a draft the check refuses is not kept, and the page is told why", async () => {
		catchStore.write({ items: [] });
		progressStore.write({ ...progressStore.read(), mixups: { "kam~kde": mixup("kam", "kde", 2) } });
		const bad = { ...GOOD, sentences: [GOOD.sentences[0]!, { sk: "Kde ideme, kam?", en: "" }, GOOD.sentences[2]!] };
		const next = await server.nextCatchItem({ engine: scripted(bad), model: "faux:catch", now: AT });
		assert.equal(next.view, null);
		assert.match(next.reason ?? "", /not kept/);
		assert.equal(catchStore.list().length, 0);
	});
});
