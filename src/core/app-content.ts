import { curriculumUnit, STAGES, type CurriculumState, type UnitState } from "./curriculum.ts";

export interface AppContentInput {
	pages: ReadonlyArray<{ href: string; label: string; hint: string }>;
	state: CurriculumState | null;
	scenes: ReadonlyArray<{ id: string; title: string; blurb: string }>;
	sheets: ReadonlyArray<{ id: string; title: string }>;
	stories: ReadonlyArray<{ id: string; title: string }>;
}

export function unitHref(u: Pick<UnitState, "id" | "kind" | "scene">): string | null {
	if (u.kind === "goal") return u.scene ? `/speak/tutor?scene=${u.scene}` : null;
	return `/lesson?unit=${u.id}`;
}

export function tutorUnitAt(href: string): string | null {
	const m = /^\/lesson\?unit=([\w-]+)$/.exec(href);
	const unit = m ? curriculumUnit(m[1]!) : undefined;
	return unit?.kind === "tutor" ? unit.id : null;
}

export type ChatLinkTarget =
	| { kind: "app"; path: string }
	| { kind: "tutor"; unit: string }
	| { kind: "anchor"; href: string }
	| { kind: "web"; href: string }
	| { kind: "text" };

export function chatLinkTarget(href: string | undefined, origin: string): ChatLinkTarget {
	if (!href) return { kind: "text" };
	if (href.startsWith("#")) return { kind: "anchor", href };
	let url: URL;
	try {
		url = new URL(href, `${origin}/`);
	} catch {
		return { kind: "text" };
	}
	if (url.origin === origin) {
		if (/^\/(api|_next)\//.test(url.pathname)) return { kind: "text" };
		const path = `${url.pathname}${url.search}${url.hash}`;
		const unit = tutorUnitAt(path);
		return unit ? { kind: "tutor", unit } : { kind: "app", path };
	}
	return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:"
		? { kind: "web", href: url.href }
		: { kind: "text" };
}

const STATUS_WORD: Record<UnitState["status"], string> = {
	done: "done",
	skipped: "passed in placement",
	started: "started",
	open: "open",
	locked: "later on the path",
};

const STORIES_LISTED = 12;

const linkText = (title: string) => title.replace(/[[\]]/g, "");

function unitLine(u: UnitState, chapterOpen: boolean): string {
	const href = unitHref(u);
	const name = href ? `[${linkText(u.title)}](${href})` : u.title;
	const state = chapterOpen || u.status !== "locked" ? ` (${STATUS_WORD[u.status]})` : "";
	return `- ${name}: ${u.tagline}${state}`;
}

export function appContentText(input: AppContentInput): string {
	const lines: string[] = ["# What the app has", ""];
	lines.push("Pages: " + input.pages.map((p) => `[${linkText(p.label)}](${p.href}) (${p.hint})`).join(" · ") + ".");
	const { state } = input;
	if (state) {
		const current = state.chapters.find((c) => c.id === state.current);
		lines.push(
			"",
			`The course, chapter by chapter, with each unit's state for this learner${current ? ` (they are in "${current.title}")` : ""}:`,
		);
		for (const ch of state.chapters) {
			const level = STAGES.find((s) => s.id === ch.stage)?.level ?? "";
			const where =
				ch.id === state.current
					? "current chapter"
					: ch.done
						? "done"
						: ch.open
							? "open"
							: "opens later; its units are later on the path";
			lines.push("", `${level} · ${ch.title}: ${ch.tagline} (${where})`, ...ch.units.map((u) => unitLine(u, ch.open)));
		}
	}
	if (input.scenes.length)
		lines.push(
			"",
			"Spoken scenes: " +
				input.scenes.map((s) => `[${linkText(s.title)}](/speak/tutor?scene=${s.id}) (${s.blurb})`).join(" · ") +
				".",
		);
	if (input.sheets.length)
		lines.push(
			"",
			"The learner's cheatsheets: " +
				input.sheets
					.map((s) => `[${linkText(s.title)}](/words?tab=cheatsheets&sheet=${encodeURIComponent(s.id)})`)
					.join(" · ") +
				".",
		);
	const stories = input.stories.slice(-STORIES_LISTED);
	if (stories.length)
		lines.push(
			"",
			"Stories already in Read: " +
				stories.map((s) => `[${linkText(s.title)}](/read?id=${encodeURIComponent(s.id)})`).join(" · ") +
				".",
		);
	return lines.join("\n");
}
