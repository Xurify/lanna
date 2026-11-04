import { cn } from "@/lib/utils";
import { ZONE_WORD, type FlowZone } from "@/src/core";

/** The ink a zone is read in: below it is the one muted red, in it is teal, above it is quiet. */
export const ZONE_INK: Record<FlowZone, string> = { new: "text-ink-3", easy: "text-ink-3", zone: "text-teal-2", hard: "text-miss" };

/** The zone as a word, plain text (E33: no pill). */
export function ZoneWord({ zone, className, lower = false }: { zone: FlowZone; className?: string; lower?: boolean }) {
	return (
		<span className={cn(ZONE_INK[zone], className)} data-zone={zone}>
			{lower ? ZONE_WORD[zone].toLowerCase() : ZONE_WORD[zone]}
		</span>
	);
}
