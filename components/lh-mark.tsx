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
		<svg viewBox="232 232 560 560" className={className} aria-hidden="true">
			<rect x="282" y="252" width="72" height="520" rx="8" fill="currentColor" />
			<rect x="402" y="700" width="340" height="72" rx="8" style={{ fill: "var(--q-teal)" }} />
		</svg>
	);
}
