"use client";

import { useEffect } from "react";

/** Applies the saved theme after mount. The inline script in app/layout.tsx does it before paint,
 *  but a page that throws notFound() is served in a shell where that script never ran. */
export function ThemeSync() {
	useEffect(() => {
		try {
			const t = localStorage.getItem("lh:theme");
			const night = t === "night" || (t !== "day" && matchMedia("(prefers-color-scheme: dark)").matches);
			document.documentElement.classList.toggle("dark", night);
			document.documentElement.dataset.theme = night ? "night" : "day";
			document.documentElement.style.colorScheme = night ? "dark" : "light";
		} catch {
			// storage blocked: the page keeps the theme it has
		}
	}, []);
	return null;
}
