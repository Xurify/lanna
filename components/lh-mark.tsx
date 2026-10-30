/**
 * LhMark — the app mark, inlined as JSX so it rides along with the
 * components (no network fetch, recolorable, crisp at any size).
 *
 * Two voices: a filled speech bubble answered by an outlined one. The ring is
 * an open path that stops short of the filled bubble, so the gap between them
 * is transparent and the mark works on any surface. One ink, currentColor.
 * 1024 viewBox, no padding: sizing/padding is the consumer's job.
 *
 * Source of truth for the geometry: build/mark.svg (also the flat app icon
 * build/icon-flat.svg and the Icon Composer layers). Keep them in step.
 */
const FILLED = "M191 683 A220 220 0 1 1 297 789 L165 825 Z";
const RING = "M471.7 350.6 A185 185 0 1 1 817.7 478.2 L875 610 L756.1 551.5 A185 185 0 0 1 643 584.9";

export function LhMark({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 1024 1024" className={className} aria-hidden="true">
			<g transform="translate(-13.5 -2.5)" strokeLinejoin="round">
				<path d={FILLED} fill="currentColor" stroke="currentColor" strokeWidth={20} />
				<path d={RING} fill="none" stroke="currentColor" strokeWidth={42} strokeLinecap="round" />
			</g>
		</svg>
	);
}
