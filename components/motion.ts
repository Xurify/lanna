/** Small Web Animations helpers. WAAPI runs on the compositor like CSS and
 *  plays without a remount, so a typed answer or a focused input survives. */

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/** A miss: a short, damped side-to-side shake. */
export function shake(el: Element | null | undefined) {
	if (!el || reduced()) return;
	el.animate?.(
		[
			{ transform: "translateX(0)" },
			{ transform: "translateX(-8px)" },
			{ transform: "translateX(7px)" },
			{ transform: "translateX(-4px)" },
			{ transform: "translateX(2px)" },
			{ transform: "translateX(0)" },
		],
		{ duration: 320, easing: "ease-in-out" },
	);
}

/** New content in the same place: a quick fade and a 4 px settle. */
export function settle(el: Element | null | undefined) {
	if (!el || reduced()) return;
	el.animate?.(
		[
			{ opacity: 0, transform: "translateY(4px)" },
			{ opacity: 1, transform: "none" },
		],
		{ duration: 200, easing: EASE_OUT },
	);
}
