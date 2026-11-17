/** The open sidebar's widest (what it always was) and narrowest, in px. Kept out of the client component so the server layout can read them too. */
export const SIDEBAR_MAX = 288;
export const SIDEBAR_MIN = 208;
/** The width is kept in this cookie, which the server reads so the first paint has it. */
export const SIDEBAR_WIDTH_COOKIE = "lanna-sidebar-w";
/** The chats section's own height, kept like the width; 0 means it fills the space the navigation leaves. */
export const CHATS_HEIGHT_COOKIE = "lanna-chats-h";
export const CHATS_MIN_HEIGHT = 208;
const CHATS_MAX_HEIGHT = 4000;
export const clampChatsHeight = (px: number) =>
	Number.isFinite(px) && px > 0 ? Math.min(CHATS_MAX_HEIGHT, Math.max(CHATS_MIN_HEIGHT, Math.round(px))) : 0;
export const clampSidebarWidth = (px: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(px)));
