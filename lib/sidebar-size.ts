/** The open sidebar's widest (what it always was) and narrowest, in px. Kept out of the client component so the server layout can read them too. */
export const SIDEBAR_MAX = 288;
export const SIDEBAR_MIN = 208;
/** The width is kept in this cookie, which the server reads so the first paint has it. */
export const SIDEBAR_WIDTH_COOKIE = "lanna-sidebar-w";
export const clampSidebarWidth = (px: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(px)));
