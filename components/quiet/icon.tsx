import { ICON_PATHS, type QIconName } from "./icon-paths";
import { cn } from "@/lib/utils";

/** An icon from the Quiet tool set: 16px, 1.6 stroke, round caps, as in the mockup's `.ico`. */
export function QIcon({ name, className }: { name: QIconName; className?: string }) {
	return <svg className={cn("q-ico", className)} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

/** Things-style progress pie from the mockup's build.mjs: a thin ring with a filled wedge. */
export function QPie({ frac, size = 36, className }: { frac: number; size?: number; className?: string }) {
	const f = Math.max(0, Math.min(1, frac));
	const c = size / 2;
	const r = c - 1.25;
	const ir = c - 4;
	const a = f * 2 * Math.PI - Math.PI / 2;
	const x = (c + ir * Math.cos(a)).toFixed(2);
	const y = (c + ir * Math.sin(a)).toFixed(2);
	const large = f > 0.5 ? 1 : 0;
	return (
		<svg className={cn("q-pie", className)} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
			<circle cx={c} cy={c} r={r} fill="none" stroke="var(--q-teal)" strokeWidth="1.5" />
			{f >= 1 ? <circle cx={c} cy={c} r={ir} fill="var(--q-teal)" /> : f > 0 ? <path d={`M${c} ${c}L${c} ${c - ir}A${ir} ${ir} 0 ${large} 1 ${x} ${y}Z`} fill="var(--q-teal)" /> : null}
		</svg>
	);
}

/** The mockup's tick, drawn in a checkbox or a pill. */
export function QCheck({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" aria-hidden="true">
			<path d="M5.5 12.5l4 4L18.5 7.5" />
		</svg>
	);
}
