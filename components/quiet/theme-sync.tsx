"use client";

import { useEffect } from "react";
import { applyTheme, readThemeChoice } from "@/lib/theme";

/**
 * Keeps <html> in step with the theme after the page is up. The first HTML already carries the
 * saved choice (app/layout.tsx reads the cookie); this adds what only the browser knows: the
 * dark class while the system is dark, an older localStorage choice moved into the cookie, the
 * Electron frame, and the system's own switch between Day and Night while the choice is "system".
 */
export function ThemeSync() {
	useEffect(() => {
		const choice = readThemeChoice();
		applyTheme(choice);
		if (choice !== "system") return;
		const mq = matchMedia("(prefers-color-scheme: dark)");
		const follow = () => applyTheme("system", false);
		mq.addEventListener("change", follow);
		return () => mq.removeEventListener("change", follow);
	}, []);
	return null;
}
