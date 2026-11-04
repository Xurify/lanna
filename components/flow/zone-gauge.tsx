/**
 * The zone gauge (E42): a 0 to 100% track with the target band drawn as a
 * flat tonal block, the likely range of a unit's true rate as a teal bar and
 * the share you got as a dot. Where the dot or the range sits against the
 * block is the whole message, so nothing else is colored. Drawn, not
 * animated (E35); the numbers are in the text beside it.
 */

import { cn } from "@/lib/utils";
import { FLOW_HIGH, FLOW_LOW } from "@/src/core";

export function ZoneGauge({ accuracy, low, high, className }: { accuracy: number | null; low?: number; high?: number; className?: string }) {
	const lo = (low ?? accuracy ?? 0) * 100;
	const hi = (high ?? accuracy ?? 0) * 100;
	return (
		<span className={cn("relative block h-5 w-full", className)} aria-hidden="true" data-testid="zone-gauge">
			<span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-2" />
			<span className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-[4px] bg-well-2" style={{ left: `${FLOW_LOW * 100}%`, width: `${(FLOW_HIGH - FLOW_LOW) * 100}%`, boxShadow: "inset 0 0 0 1px var(--q-line-2)" }} />
			{low !== undefined && high !== undefined && (
				<span className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-teal-wash" style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%`, boxShadow: "inset 0 0 0 1px var(--q-teal-line)" }} />
			)}
			{accuracy !== null && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal" style={{ left: `${accuracy * 100}%`, boxShadow: "0 0 0 2px var(--q-bg)" }} />}
		</span>
	);
}
