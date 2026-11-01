import type { MetadataRoute } from "next";

/**
 * The home-screen install (2026-11-01). On an iPhone or iPad, Share → Add to
 * Home Screen opens LangHarness full screen with this name, these colors and
 * these icons. The PNGs are rendered by scripts/make-pwa-icons.mjs from
 * build/mark.svg, so the icon and the in-app mark are the same drawing.
 */
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "LangHarness",
		short_name: "LangHarness",
		description: "A Slovak and Russian tutor: lessons, spaced review, reading and speaking, kept on your own computer.",
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "any",
		background_color: "#141414",
		theme_color: "#141414",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
