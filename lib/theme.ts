/**
 * The theme choice, shared by the server (app/layout.tsx reads the cookie into the first
 * HTML, so the right mode is painted from the first frame) and the browser (the Settings
 * control and ThemeSync write it). "day" and "night" are explicit choices; no cookie means
 * follow the system, which CSS does with a media query and no script.
 */

export const THEME_COOKIE = "lanna-theme";
export type ThemeChoice = "system" | "day" | "night";

export function themeFromCookie(value: string | undefined): ThemeChoice {
	return value === "day" || value === "night" ? value : "system";
}

/** The saved choice in this browser: the cookie, else the older localStorage key (moved to the cookie on the first read). */
export function readThemeChoice(): ThemeChoice {
	try {
		const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
		const fromCookie = themeFromCookie(m?.[1]);
		if (fromCookie !== "system") return fromCookie;
		const legacy = localStorage.getItem("lanna:theme");
		return legacy === "day" || legacy === "night" ? legacy : "system";
	} catch {
		return "system";
	}
}

/** Saves the choice and puts it on <html>: the dark class (the Tailwind dark: variant), data-theme for an explicit choice, and the Electron frame. */
export function applyTheme(choice: ThemeChoice, persist = true): void {
	const root = document.documentElement;
	if (persist) {
		try {
			document.cookie =
				choice === "system"
					? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
					: `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
			localStorage.removeItem("lanna:theme");
		} catch {
			// cookies blocked: the choice still applies for this page view
		}
	}
	const night = choice === "night" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
	root.classList.toggle("dark", night);
	if (choice === "system") root.removeAttribute("data-theme");
	else root.dataset.theme = choice;
	window.lanna?.setTheme?.(night);
}
