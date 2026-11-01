/**
 * THE PERSONAL LESSON ON DISK (LangHarness, 2026-11-01), end to end with a
 * scripted model: the guide's reply is read, its targets are kept with the
 * guide, its pairs become probes, the plan offers the lesson, and finishing
 * it counts the day and moves no unit. Runs under an isolated LH_DATA_DIR.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-personal-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { recordLesson, personalFor } = await import("../src/server/lesson.ts");
const { analyseNow, writeGuide } = await import("../src/server/mistakes.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");
const { mixupKey } = await import("../src/core/mixups.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

function fauxEngine(reply: string) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses([fauxAssistantMessage(reply)]);
	return { model: faux.getModel(), streamFn: faux.streamSimple } as never;
}

const NOW = new Date("2026-11-01T10:00:00Z");
const rep = (given: string, verdict: "exact" | "wrong") => ({
	itemId: "nikto#0",
	slug: "nikto",
	kind: "type" as const,
	verdict,
	first: { given, verdict },
	detail: { unit: "words", lemma: "nikto", gloss: "no one", sentence: "Nikto mi nezavolal.", translation: "Nobody called me.", answer: "Nikto", given },
});

describe("the personal lesson on disk", () => {
	it("a guide's targets are kept, its pairs become probes, and the plan offers the lesson", async () => {
const many = [...Array.from({ length: 30 }, () => rep("Nikto", "exact")), ...Array.from({ length: 5 }, () => rep("Niekto", "wrong"))];
		recordLesson({ unit: "words", mode: "lesson", reps: many, tz: 0 }, new Date("2026-11-01T09:00:00Z"));
		analyseNow(NOW);
		const reply = JSON.stringify({
			patterns: [{ title: "ni- and nie- words", evidence: '"Niekto" for "Nikto"', why: "Both start the same.", fix: "Check for ne- on the verb." }],
			next: [{ what: "kam / kde", why: "A guess." }],
			plan: [{ step: "Practise the pairs", kind: "mixups" }],
			practice: { words: ["nikto"], units: ["loc"], pairs: [["nikto", "niekto"], ["kam", "kde"]] },
		});
		const r = await writeGuide({ now: NOW, engine: fauxEngine(`Here it is:\n${reply}`), model: "faux:faux" });
		assert.equal(r.guide?.data?.patterns[0]?.title, "ni- and nie- words");
		assert.deepEqual(r.guide?.practice?.units, ["loc"]);
		assert.equal(r.guide?.practice?.pairs.length, 2);
		const probe = progressStore.read().mixups?.[mixupKey("kam", "kde")];
		assert.equal(probe?.from, "guide", "kam / kde is a probe the guide suggested");
		assert.equal(probe?.misses, 0);
		const plan = recordLesson({ unit: "words", mode: "lesson", reps: [rep("Nikto", "exact")], tz: 0 }, new Date("2026-11-01T10:30:00Z")).summary.plan;
		const task = plan.tasks.find((t) => t.id === "strengthen");
		assert.equal(task?.href, "/lesson?mode=personal");
		assert.match(task?.title ?? "", /Your plan · ni- and nie- words/);
	});

	it("the personal lesson is built from the targets and finishing it moves no unit", () => {
		const plan = personalFor(9);
		assert.equal(plan.focus, "personal");
		assert.ok(plan.items.length >= 8, `${plan.items.length} reps`);
		const loc = progressStore.read().units.loc;
		const out = recordLesson({ unit: "words", mode: "lesson", focus: "personal", reps: [rep("Nikto", "exact")], tz: 0 }, new Date("2026-11-01T11:00:00Z"));
		assert.deepEqual(progressStore.read().units.loc, loc, "no unit moves");
		assert.equal(progressStore.read().days["2026-11-01"]?.personal, 1);
		assert.equal(out.summary.plan.tasks.find((t) => t.id === "strengthen")?.done, true);
		const last = readLessonLog().at(-1)!;
		assert.equal(last.mode, "personal");
		assert.equal(last.unit, "personal");
	});

	it("the plan stops offering it a week after the guide", () => {
		const plan = recordLesson({ unit: "words", mode: "lesson", reps: [rep("Nikto", "exact")], tz: 0 }, new Date("2026-11-09T10:00:00Z")).summary.plan;
		assert.notEqual(plan.tasks.find((t) => t.id === "strengthen")?.href, "/lesson?mode=personal");
	});
});
