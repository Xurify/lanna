/**
 * The stage sentence (LangHarness, 2026-11-05; docs/research/creator-hooks.md,
 * proposal 4): one line on Today that names what limits the learner right now,
 * in the app's own numbers. The words gap and the speed gap are already
 * measured by the milestones (src/core/milestones.ts); this only says which
 * one binds and how far it is, and when a number is an estimate instead of a
 * measure it says so (docs/DECISIONS.md P8). The two meters under the line
 * carry the same numbers, so the eye can read the gap without the sentence.
 *
 * Pure and browser-safe.
 */

import type { MilestoneEstimate } from "./milestones.ts";

export interface StageMeter {
	have: number;
	need: number;
	/** The number comes from the level's ladder, not from the learner's own sessions. */
	estimated: boolean;
}

export interface StageView {
	/** The milestone the sentence is about, or null when there is none. */
	title: string | null;
	line: string;
	/** A second line when a number is an estimate, or null. */
	detail: string | null;
	/** The gap that decides the date, or null when no milestone is open. */
	binding: "words" | "speed" | null;
	words: StageMeter | null;
	speed: StageMeter | null;
}

/** The milestone the learner is working toward: the unreached one whose date
 *  is nearest at their pace (or at their planned minutes when there is no pace). */
export function nearestOpen(milestones: readonly MilestoneEstimate[]): MilestoneEstimate | null {
	const open = milestones.filter((m) => m.status !== "reached");
	if (open.length === 0) return null;
	const days = (m: MilestoneEstimate) => m.eta.daysPace ?? m.eta.daysPlanned ?? Number.POSITIVE_INFINITY;
	return open.reduce((best, m) => (days(m) < days(best) ? m : best));
}

const none: Pick<StageView, "binding" | "words" | "speed"> = { binding: null, words: null, speed: null };

export function stageSentence(milestones: readonly MilestoneEstimate[]): StageView {
	if (milestones.length === 0) return { title: null, line: "Nothing to measure yet.", detail: null, ...none };
	const target = nearestOpen(milestones);
	if (!target) return { title: null, line: "Every milestone the app tracks is reached by this estimate.", detail: null, ...none };
	const title = `"${target.def.title}"`;
	const estimated = target.speed.basis === "level";
	const meters = {
		words: { have: target.words.have, need: target.words.need, estimated: false },
		// A milestone read at the learner's own pace has no speed to meet.
		speed: target.speed.need > 0 ? { have: target.speed.have, need: target.speed.need, estimated } : null,
	};
	if (target.binding === "speed") {
		return {
			title: target.def.title,
			line: `Speed limits ${title}: about ${target.speed.have} words a minute are understood, and this needs about ${target.speed.need}.`,
			detail: estimated ? "The speed is the level's estimate until a few Listen or Watch sessions measure it." : "Speed grows with hours of Listen and Watch, not with learning words alone.",
			binding: "speed",
			...meters,
		};
	}
	if (target.binding === "words") {
		return {
			title: target.def.title,
			line: `Words limit ${title}: you know ${target.words.have} of the ${target.words.need} the speech needs.`,
			detail: target.words.toGo > 0 ? `${target.words.toGo} more to go.` : null,
			binding: "words",
			...meters,
		};
	}
	return { title: target.def.title, line: `Words and speed both have a way to go for ${title}.`, detail: null, binding: null, ...meters };
}
