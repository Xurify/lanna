/**
 * MIX-UPS ON DISK (LangHarness, 2026-11-01): a lesson answer that gives
 * another word lands in progress.json, shows on the summary and in the
 * Strengthen task, a Mix-ups lesson moves no unit, a review answer counts
 * too, and the tutor's block names the pair. Runs under an isolated
 * LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-mixups-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { recordLesson, mixupsFor } = await import("../src/server/lesson.ts");
const { noteReviewMixup } = await import("../src/server/mixups.ts");
const { progressStore } = await import("../src/store/progress.ts");
const corpus = await import("../src/store/corpus.ts");
const { learnerProfileSegment } = await import("../src/agent/learner-profile.ts");
const { mixupKey } = await import("../src/core/mixups.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const NIKTO = mixupKey("nikto", "niekto");
const NOW = new Date("2026-11-01T10:00:00Z");

const rep = (given: string, verdict: "exact" | "wrong", over: Record<string, unknown> = {}) => ({
	itemId: "nikto#0",
	slug: "nikto",
	kind: "type" as const,
	verdict,
	first: { given, verdict },
	detail: {
		unit: "words",
		lemma: "nikto",
		gloss: "no one",
		sentence: "Nikto mi nezavolal.",
		translation: "Nobody called me.",
		answer: "Nikto",
		given,
	},
	...over,
});

describe("mix-ups on record", () => {
	it("a lesson's wrong first try that gives another word opens the pair, on the summary and in the plan", () => {
		const out = recordLesson({ unit: "words", mode: "lesson", reps: [rep("Niekto", "wrong")], tz: 0 }, NOW);
		const m = progressStore.read().mixups?.[NIKTO];
		assert.ok(m, "the pair is on record");
		assert.equal(m.misses, 1);
		assert.equal(out.summary.mixups[0]?.key, NIKTO);
		assert.equal(out.summary.mixups[0]?.status, "active");
		const task = out.summary.plan.tasks.find((t) => t.id === "strengthen");
		assert.equal(task?.href, "/lesson?mode=mixups");
		assert.match(task?.title ?? "", /Mix-ups · nikto \/ niekto/);
		assert.equal(task?.done, false);
	});

	it("the Mix-ups lesson drills the pair and its probe", () => {
		const plan = mixupsFor(3);
		assert.equal(plan.focus, "mixups");
		assert.ok(plan.items.some((i) => i.slug === "nikto" || i.slug === "niekto"));
		assert.ok(
			plan.items.every((i) => i.pair),
			"every rep carries the pair's rule",
		);
	});

	it("finishing a Mix-ups lesson counts the day and the mix-ups, not a unit", () => {
		const before = progressStore.read().units.words?.lessons ?? 0;
		const out = recordLesson(
			{
				unit: "words",
				mode: "lesson",
				focus: "mixups",
				reps: [
					rep("Nikto", "exact"),
					rep("Niekto", "exact", {
						itemId: "niekto#0",
						slug: "niekto",
						detail: { unit: "words", sentence: "Niekto volal.", answer: "Niekto", given: "Niekto" },
					}),
				],
				tz: 0,
			},
			NOW,
		);
		const p = progressStore.read();
		assert.equal(p.units.words?.lessons ?? 0, before, "no unit moves");
		assert.equal(p.days["2026-11-01"]?.mixups, 1);
		assert.equal(p.mixups?.[NIKTO]?.hits, 2);
		assert.equal(out.summary.plan.tasks.find((t) => t.id === "strengthen")?.done, true);
		const last = corpus.readLessonLog().at(-1)!;
		assert.equal(last.mode, "mixups");
		assert.equal(last.unit, "mixups");
	});

	it("a review answer counts, unless a hint came first", () => {
		const card = {
			id: "niekto#1",
			slug: "niekto",
			lemma: "niekto",
			gloss: "someone",
			sentence: "Niekto klope.",
			translation: "",
			answer: "Niekto",
			at: 0,
			state: "review" as const,
			due: NOW.toISOString(),
			reps: 1,
			lapses: 0,
			createdAt: NOW.toISOString(),
		};
		noteReviewMixup(card, "Nikto", "wrong", 1, NOW);
		assert.equal(progressStore.read().mixups?.[NIKTO]?.misses, 1, "a hinted answer is not a first try");
		noteReviewMixup(card, "Nikto", "wrong", undefined, NOW);
		assert.equal(progressStore.read().mixups?.[NIKTO]?.misses, 2);
	});

	it("the tutor's learner block names the pair", () => {
		const block = learnerProfileSegment() ?? "";
		assert.match(block, /Words they mix up .*nikto \/ niekto \(2 misses/);
	});
});
