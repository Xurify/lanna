/**
 * Scenes with a date (LangHarness, 2026-11-05; creator-hooks proposal 3), on
 * the server. A dated scene is a custom milestone (src/server/milestones.ts)
 * with a date and, once the date has passed, the line the learner wrote about
 * it. Every write checks its date on the learner's own day before anything
 * else runs, so an invalid date never reaches a model.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import { datedDateProblem, isoDaysBetween, type DatedSceneView } from "../core/dated-scene.ts";
import { MAX_CUSTOM_LENGTH, estimateMilestone } from "../core/milestones.ts";
import { dayKey } from "../core/review.ts";
import { milestoneStore, type CustomMilestoneRecord } from "../store/milestones.ts";
import { addCustomMilestone, datedSceneViews, learnerFacts, type CustomOptions } from "./milestones.ts";

/** A write that the learner must fix: the message is shown as written. */
export class DatedSceneError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "DatedSceneError";
	}
}

interface DatedScenesToday {
	/** The nearest scene whose date has not come yet (today counts). */
	next: DatedSceneView | null;
	/** Scenes whose date has passed and that have no line yet. */
	awaitingOutcome: DatedSceneView[];
}

const todayOf = (now: Date, tz?: number) => dayKey(now, tz ?? now.getTimezoneOffset());

/** The scenes Today can show. Costs nothing when no scene has a date. */
export function datedScenesForToday(now = new Date(), tz?: number): DatedScenesToday {
	const dated = milestoneStore.active().filter((c) => c.date);
	if (dated.length === 0) return { next: null, awaitingOutcome: [] };
	const facts = learnerFacts(loadLexicon(), now, tz);
	const estimates = dated.map((c) => estimateMilestone(c.def, facts, { now }));
	const views = Object.values(datedSceneViews(estimates, todayOf(now, tz)));
	const upcoming = views.filter((v) => v.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
	return { next: upcoming[0] ?? null, awaitingOutcome: views.filter((v) => v.outcomeDue) };
}

/** A scene in the learner's words, on a day. The words are mapped once (the
 *  cheap model), then the day is kept with them. */
export async function addDatedScene(textRaw: string, date: string, opts: CustomOptions & { tz?: number } = {}): Promise<{ record: CustomMilestoneRecord; reused: boolean }> {
	const { tz, ...custom } = opts;
	const now = custom.now ?? new Date();
	const problem = datedDateProblem(date, todayOf(now, tz));
	if (problem) throw new DatedSceneError(problem, 400);
	const { record, reused } = await addCustomMilestone(textRaw, { ...custom, now });
	return { record: milestoneStore.schedule(record.def.id, date) ?? record, reused };
}

/** Move a scene to another day, from today on. */
export function scheduleScene(id: string, date: string, opts: { now?: Date; tz?: number } = {}): CustomMilestoneRecord {
	const problem = datedDateProblem(date, todayOf(opts.now ?? new Date(), opts.tz));
	if (problem) throw new DatedSceneError(problem, 400);
	const rec = milestoneStore.schedule(id, date);
	if (!rec) throw new DatedSceneError("That scene is not on your list.", 404);
	return rec;
}

/** The line written after a scene's date. Only once the date has passed. */
export function recordSceneOutcome(id: string, textRaw: string, opts: { now?: Date; tz?: number } = {}): CustomMilestoneRecord {
	const now = opts.now ?? new Date();
	const rec = milestoneStore.active().find((c) => c.def.id === id);
	if (!rec) throw new DatedSceneError("That scene is not on your list.", 404);
	if (!rec.date) throw new DatedSceneError("Give the scene a date first.", 409);
	if (isoDaysBetween(todayOf(now, opts.tz), rec.date) >= 0) throw new DatedSceneError("Write how it went once the date has passed.", 409);
	const text = textRaw.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_LENGTH);
	if (!text) throw new DatedSceneError("Write one line about how it went.", 400);
	const saved = milestoneStore.recordOutcome(id, { at: now.toISOString(), text });
	if (!saved) throw new DatedSceneError("That scene is not on your list.", 404);
	return saved;
}
