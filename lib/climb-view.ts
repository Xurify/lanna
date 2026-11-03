/**
 * The two ways to read /curriculum: "Path" (a calm list per level) and "Chapters" (each level as a
 * trail map beside its chapter cards). The choice lives in the URL (?view=) so a link opens the same
 * view, and in a cookie so the server draws the learner's last choice on the first frame.
 */

export const CLIMB_VIEW_COOKIE = "lh-climb-view";
export type ClimbView = "path" | "chapters";

export const CLIMB_VIEWS: readonly { id: ClimbView; label: string }[] = [
	{ id: "path", label: "Path" },
	{ id: "chapters", label: "Chapters" },
];

const isView = (v: unknown): v is ClimbView => v === "path" || v === "chapters";

/** The URL wins, then the saved choice, then Path. */
export function resolveClimbView(param: string | string[] | null | undefined, cookie: string | undefined): ClimbView {
	const fromUrl = Array.isArray(param) ? param[0] : param;
	if (isView(fromUrl)) return fromUrl;
	return isView(cookie) ? cookie : "path";
}

export function saveClimbView(view: ClimbView): void {
	try {
		document.cookie = `${CLIMB_VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// A blocked cookie only means the choice is not remembered.
	}
}
