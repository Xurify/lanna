import { cn } from "@/lib/utils";
import { Pip, type PipOutcome } from "@/components/task-frame";
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

function outcomeOf(mark: TrackMark | undefined, isCurrent: boolean): PipOutcome {
	if (mark === "right") return "right";
	if (mark === "partly") return "almost";
	if (mark === "miss") return "miss";
	return isCurrent ? "now" : "ahead";
}

export function CheckTrack({
	parts,
	marks,
	current = -1,
	large = false,
	className,
}: {
	parts: Part[];
	marks: TrackMark[];
	current?: number;
	large?: boolean;
	className?: string;
}) {
	const total = parts.reduce((sum, part) => sum + part.count, 0);
	const tally = (mark: TrackMark) => marks.filter((m) => m === mark).length;
	const label =
		marks.length === 0
			? `${total} sentences, none answered yet`
			: `${marks.length} of ${total} answered: ${tally("right")} right, ${tally("partly")} partly, ${tally("miss")} missed`;
	let offset = 0;
	return (
		<div role="img" aria-label={label} className={cn("flex min-w-0", large ? "gap-3" : "gap-2", className)}>
			{parts.map((part, p) => {
				const start = offset;
				offset += part.count;
				return (
					<div key={p} className="min-w-0" style={{ flex: part.count }}>
						<div className={cn("flex items-center", large ? "gap-1" : "gap-[3px]")}>
							{Array.from({ length: part.count }, (_, i) => (
								<Pip
									key={i}
									outcome={outcomeOf(marks[start + i], start + i === current)}
									className={cn("min-w-0 flex-1", large && "h-2")}
								/>
							))}
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
				<i className="bg-teal" />
				right
			</span>
			<span>
				<i className="bg-teal-line" />
				partly
			</span>
			<span>
				<i className="bg-miss" />
				missed
			</span>
		</p>
	);
}
