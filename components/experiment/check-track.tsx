import { cn } from "@/lib/utils";
import type { CheckItemRecord } from "@/src/core";

export type TrackMark = "right" | "partly" | "miss";

export const CLEAR_SCORE = 0.8;
export const PARTIAL_SCORE = 0.5;

export function markOf(record: CheckItemRecord): TrackMark {
	if (record.type === "probe") return record.score === 1 ? "right" : "miss";
	return record.score >= CLEAR_SCORE ? "right" : record.score >= PARTIAL_SCORE ? "partly" : "miss";
}

interface Part {
	count: number;
	caption?: string;
}

export function CheckTrack({ parts, marks, current = -1, large = false, className }: { parts: Part[]; marks: TrackMark[]; current?: number; large?: boolean; className?: string }) {
	const total = parts.reduce((sum, part) => sum + part.count, 0);
	const tally = (mark: TrackMark) => marks.filter((m) => m === mark).length;
	const label = marks.length === 0 ? `${total} sentences, none answered yet` : `${marks.length} of ${total} answered: ${tally("right")} right, ${tally("partly")} partly, ${tally("miss")} missed`;
	let offset = 0;
	return (
		<div role="img" aria-label={label} className={cn("flex min-w-0", large ? "gap-3" : "gap-2", className)}>
			{parts.map((part, p) => {
				const start = offset;
				offset += part.count;
				return (
					<div key={p} className="min-w-0" style={{ flex: part.count }}>
						<div className={cn("flex items-center", large ? "h-2.5 gap-1" : "h-2 gap-[3px]")}>
							{Array.from({ length: part.count }, (_, i) => {
								const mark = marks[start + i];
								return (
									<i
										key={i}
										className={cn(
											"min-w-0 flex-1 rounded-[3px]",
											mark === "partly" ? "h-1" : "h-full",
											mark === "right" && "bg-teal",
											mark === "partly" && "bg-teal",
											mark === "miss" && "shadow-[inset_0_0_0_1.5px_var(--q-ink-4)]",
											mark === undefined && "bg-well-2",
											mark === undefined && start + i === current && "shadow-[0_0_0_1.5px_var(--q-bg),0_0_0_3px_var(--q-teal)]",
										)}
									/>
								);
							})}
						</div>
						{part.caption && <p className="mt-2 font-ui text-[12.5px] text-ink-3">{part.caption}</p>}
					</div>
				);
			})}
		</div>
	);
}

export function TrackLegend({ className }: { className?: string }) {
	return (
		<p className={cn("q-legend", className)}>
			<span>
				<i style={{ background: "var(--q-teal)" }} />
				right
			</span>
			<span>
				<i className="!h-1" style={{ background: "var(--q-teal)" }} />
				partly
			</span>
			<span>
				<i style={{ boxShadow: "inset 0 0 0 1.5px var(--q-ink-4)" }} />
				missed
			</span>
		</p>
	);
}
