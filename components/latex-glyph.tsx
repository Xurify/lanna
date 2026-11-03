"use client";

import { useEffect, useState } from "react";

/**
 * THE LaTeX glyph seam (owner ruling, 2026-09-30): UI connectors that
 * want math symbols render the REAL LaTeX glyphs through KaTeX — the
 * app's math engine, already shipped (app/layout.tsx carries the
 * katex stylesheet) — never hand-rolled SVGs or font-dependent
 * unicode. Born for the chain table's logical connectives: premises
 * join with \land (∧), the conclusion separates with \implies (⟹) —
 * `A ∧ B ⟹ C`, not the misleading `A → B → C`.
 *
 * Prominent by the same ruling: the connectives render in the
 * theme's FOREGROUND (white in the dark theme) — the chain line's
 * logic is the payload, not decoration. Callers pass the class.
 *
 * KaTeX is loaded on first use (a dynamic import, about 75 KB gzipped), so the
 * map page does not ship it until a chain row is on screen. Until it arrives,
 * and in server HTML, the glyph is the plain Unicode character, which is the
 * same width, so nothing shifts when the typeset one replaces it.
 */

/** The plain character shown until KaTeX has loaded. */
const FALLBACK: Record<string, string> = {
	"\\land": "∧",
	"\\implies": "⟹",
	"\\Rightarrow": "⇒",
	"\\neg": "¬",
};

/** Cached katex HTML per command: the glyph set is tiny and renderToString is
 *  pure, so there is one render per command per page load. */
const cache = new Map<string, string>();

/** The raw katex HTML for a LaTeX command; loads KaTeX the first time. */
export async function loadLatexGlyphHtml(cmd: string): Promise<string> {
	let html = cache.get(cmd);
	if (html === undefined) {
		const katex = (await import("katex")).default;
		html = katex.renderToString(cmd, { throwOnError: false, output: "html" });
		cache.set(cmd, html);
	}
	return html;
}

/** One LaTeX glyph. `cmd` is the LaTeX command ("\\land", "\\implies"); the
 *  output is aria-hidden: callers carry the textual aria-label
 *  (formatChainLine keeps the plain-text form). */
export function LatexGlyph({ cmd, testid, className }: { cmd: string; testid?: string; className?: string }) {
	const [html, setHtml] = useState<string | undefined>(undefined);
	useEffect(() => {
		let live = true;
		void loadLatexGlyphHtml(cmd).then((h) => live && setHtml(h));
		return () => {
			live = false;
		};
	}, [cmd]);
	return html === undefined ? (
		<span data-testid={testid} aria-hidden="true" className={className}>
			{FALLBACK[cmd] ?? cmd}
		</span>
	) : (
		<span
			data-testid={testid}
			aria-hidden="true"
			className={className}
			// katex.renderToString is the library's own trusted output (the same thing rehype-katex injects for markdown math).
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
