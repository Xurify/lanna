/** Space kept between the word card and the window's edge, and between the card and the word. */
export const POPOVER_EDGE = 12;
export const POPOVER_GAP = 14;

/**
 * The top of a word card, in window pixels. Above the word whenever the whole
 * card fits there; else below it when it fits there; else on the side with more
 * room, held inside the window (it may then cover the word, and scrolls inside
 * itself if the window is shorter than the card).
 */
export function fitPopoverTop(selTop: number, selBottom: number, height: number, viewport: number): number {
	const above = selTop - POPOVER_GAP - height;
	const below = selBottom + POPOVER_GAP;
	if (above >= POPOVER_EDGE) return above;
	if (below + height <= viewport - POPOVER_EDGE) return below;
	const roomAbove = selTop - POPOVER_GAP - POPOVER_EDGE;
	const roomBelow = viewport - POPOVER_EDGE - below;
	const top = roomAbove > roomBelow ? above : below;
	return Math.max(POPOVER_EDGE, Math.min(top, viewport - POPOVER_EDGE - height));
}
