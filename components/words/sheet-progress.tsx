import { cn } from "@/lib/utils";
import type { SheetProgress } from "@/src/core";
import { STRUCK } from "@/components/task-frame";

const SEGMENT = "h-full min-w-2 rounded-full";

export function SheetProgressBar({ progress, className }: { progress: SheetProgress; className?: string }) {
	const { lines, caught } = progress;
	const missed = progress.heard - caught;
	const ahead = lines - progress.heard;
	const parts = [`${caught} of ${lines} caught by ear`, missed > 0 && `${missed} missed last time`, ahead > 0 && `${ahead} not heard yet`].filter(Boolean);
	return (
		<div className={className} data-testid="sheet-progress">
			<div role="img" aria-label={parts.join(", ")} className="flex h-2 gap-[3px]">
				{caught > 0 && <span className={cn(SEGMENT, "bg-teal")} style={{ flex: `${caught} 1 0%` }} />}
				{missed > 0 && <span className={cn(SEGMENT, STRUCK, "after:bg-miss")} style={{ flex: `${missed} 1 0%` }} />}
				{ahead > 0 && <span className={cn(SEGMENT, "bg-well-2")} style={{ flex: `${ahead} 1 0%` }} />}
			</div>
			<p className="q-legend" aria-hidden="true">
				<span>
					<i className="bg-teal" />
					<b className="tabular-nums">{caught}</b> caught by ear
				</span>
				{missed > 0 && (
					<span>
						<i className={cn(STRUCK, "after:bg-miss")} />
						<b className="tabular-nums">{missed}</b> missed last time
					</span>
				)}
				{ahead > 0 && (
					<span>
						<i className="bg-well-2" />
						<b className="tabular-nums">{ahead}</b> not heard yet
					</span>
				)}
			</p>
		</div>
	);
}
