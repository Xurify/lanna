"use client";

import { useEffect } from "react";

/**
 * Shows the keyboard focus ring only while the keyboard is driving focus.
 * A Tab press sets `data-keyboard` on <html>; the next pointer press clears
 * it. Arrow keys do not set it, so a control the mouse clicked never lights
 * up when an arrow key is pressed (the 2026-10-01 no-ring bug). Styled in
 * globals.css (`html[data-keyboard] :focus-visible`).
 */
export function KeyboardFocusMode() {
	useEffect(() => {
		const root = document.documentElement;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Tab") root.setAttribute("data-keyboard", "");
		};
		const onPointer = () => root.removeAttribute("data-keyboard");
		window.addEventListener("keydown", onKey, true);
		window.addEventListener("pointerdown", onPointer, true);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			window.removeEventListener("pointerdown", onPointer, true);
			root.removeAttribute("data-keyboard");
		};
	}, []);
	return null;
}
