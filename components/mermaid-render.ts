/**
 * The app's ONE mermaid renderer (the chrome-melt wave, 2026-09-19): both the
 * in-chat block (components/md-blocks.tsx) and the session-scoped focus
 * overlay (components/session-overlay.tsx) render charts through this module
 * — one dark-theme config, one plugin instance, unique render ids. This
 * REPLACES streamdown's internal mermaid path entirely: its fullscreen portal
 * was hard-wired `fixed inset-0` (covering the window-drag bar, X landing in
 * drag territory) with no styling hook, which is what drove the custom
 * component in the first place.
 */

import { render } from "pele";

export const MERMAID_FONT_SIZE = 16;

/**
 * Render one chart source to an svg string using Pele (https://pele.run).
 * Pele parses and renders Mermaid syntax synchronously with zero dependencies.
 */
export async function renderMermaid(chart: string): Promise<string> {
	const { svg } = render(chart, {
		fontFamily: "ui-sans-serif, system-ui, sans-serif",
		fontSize: MERMAID_FONT_SIZE,
	});
	return svg;
}

