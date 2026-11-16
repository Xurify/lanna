/**
 * The two ways to read /curriculum: "chapters" (a calm list per level) and "mountain" (each level as a
 * mountain with its chapters as stops on a trail, beside the chapter list). The choice lives in the URL
 * (?view=) so a link opens the same view, and in a cookie so the server draws the learner's last choice
 * on the first frame.
 */

export const CLIMB_VIEW_COOKIE = "lh-climb-view";
export type ClimbView = "chapters" | "mountain";

export const CLIMB_VIEWS: readonly { id: ClimbView; label: string }[] = [
	{ id: "chapters", label: "Chapters" },
	{ id: "mountain", label: "Mountain" },
];

/** Values an earlier build wrote: "path" was the list. */
const LEGACY: Record<string, ClimbView> = { path: "chapters" };

const toView = (v: unknown): ClimbView | undefined =>
	v === "chapters" || v === "mountain" ? v : typeof v === "string" ? LEGACY[v] : undefined;

/** The URL wins, then the saved choice, then the chapter list. */
export function resolveClimbView(param: string | string[] | null | undefined, cookie: string | undefined): ClimbView {
	return toView(Array.isArray(param) ? param[0] : param) ?? toView(cookie) ?? "chapters";
}

export function saveClimbView(view: ClimbView): void {
	try {
		document.cookie = `${CLIMB_VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// A blocked cookie only means the choice is not remembered.
	}
}
