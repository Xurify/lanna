/**
 * What the app has, written for the chat tutor: every page, the course unit
 * by unit with where the learner stands on it, the spoken scenes, the
 * cheatsheets and the stories already read, each with the link that opens
 * it. Pure; src/server/app-content.ts gathers the input.
 */

import { curriculumUnit, STAGES, type CurriculumState, type UnitState } from "./curriculum.ts";

export interface AppContentInput {
	pages: ReadonlyArray<{ href: string; label: string; hint: string }>;
	state: CurriculumState | null;
	scenes: ReadonlyArray<{ id: string; title: string; blurb: string }>;
	sheets: ReadonlyArray<{ id: string; title: string }>;
	stories: ReadonlyArray<{ id: string; title: string }>;
}

/** The link that opens a unit: a lesson, a tutor session (the chat opens it from the same address) or the scene a goal is proved in. */
export function unitHref(u: Pick<UnitState, "id" | "kind" | "scene">): string | null {
	if (u.kind === "goal") return u.scene ? `/speak?scene=${u.scene}` : null;
	return `/lesson?unit=${u.id}`;
}

/** The tutor unit a lesson address names, if it names one: a tutor unit runs as its own chat, so its link opens that chat instead of a lesson. */
export function tutorUnitAt(href: string): string | null {
	const m = /^\/lesson\?unit=([\w-]+)$/.exec(href);
	const unit = m ? curriculumUnit(m[1]!) : undefined;
	return unit?.kind === "tutor" ? unit.id : null;
}

const STATUS_WORD: Record<UnitState["status"], string> = {
	done: "done",
	skipped: "passed in placement",
	started: "started",
	open: "open",
	locked: "later on the path",
};

/** The most stories listed: the latest ones, which the learner remembers. */
const STORIES_LISTED = 12;

/** A unit's line; its state is written only where it differs from its chapter's (every unit of a chapter that opens later is later too). */
function unitLine(u: UnitState, chapterOpen: boolean): string {
	const href = unitHref(u);
	const name = href ? `[${u.title}](${href})` : u.title;
	const state = chapterOpen || u.status !== "locked" ? ` (${STATUS_WORD[u.status]})` : "";
	return `- ${name}: ${u.tagline}${state}`;
}

export function appContentText(input: AppContentInput): string {
	const lines: string[] = ["# What the app has", ""];
	lines.push("Pages: " + input.pages.map((p) => `[${p.label}](${p.href}) (${p.hint})`).join(" · ") + ".");
	const { state } = input;
	if (state) {
		const current = state.chapters.find((c) => c.id === state.current);
		lines.push("", `The course, chapter by chapter, with each unit's state for this learner${current ? ` (they are in "${current.title}")` : ""}:`);
		for (const ch of state.chapters) {
			const level = STAGES.find((s) => s.id === ch.stage)?.level ?? "";
			const where = ch.id === state.current ? "current chapter" : ch.done ? "done" : ch.open ? "open" : "opens later; its units are later on the path";
			lines.push("", `${level} · ${ch.title}: ${ch.tagline} (${where})`, ...ch.units.map((u) => unitLine(u, ch.open)));
		}
	}
	if (input.scenes.length) lines.push("", "Spoken scenes: " + input.scenes.map((s) => `[${s.title}](/speak?scene=${s.id}) (${s.blurb})`).join(" · ") + ".");
	if (input.sheets.length) lines.push("", "The learner's cheatsheets: " + input.sheets.map((s) => `[${s.title}](/words?tab=cheatsheets&sheet=${encodeURIComponent(s.id)})`).join(" · ") + ".");
	const stories = input.stories.slice(-STORIES_LISTED);
	if (stories.length) lines.push("", "Stories already in Read: " + stories.map((s) => `[${s.title}](/read?id=${encodeURIComponent(s.id)})`).join(" · ") + ".");
	return lines.join("\n");
}
