/**
 * LhMark — the app mark, inlined as JSX so it rides along with the
 * components (no network fetch, recolorable, crisp at any size).
 *
 * A text cursor waiting at an empty answer line: the cursor takes
 * currentColor, the line the teal accent, so it follows Day and Night.
 * The viewBox crops the 1024 icon box to the drawing, so a size-6 mark is
 * as tall as the wordmark beside it; sizing is the consumer's job.
 *
 * Source of truth for the geometry: build/mark.svg (also the flat app icon
 * build/icon-flat.svg, app/icon.svg and the Icon Composer layers). Keep them
 * in step. Rationale: docs/brand.md.
 */
export function LhMark({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="212 212 600 600" className={className} aria-hidden="true">
			<rect x="262" y="212" width="116" height="600" rx="22" fill="currentColor" />
			<rect x="418" y="696" width="344" height="116" rx="22" style={{ fill: "var(--q-teal)" }} />
		</svg>
	);
}
