"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { weakSpotGroups, type LearnerGoal, type WeakSpotSummary } from "@/src/core";

export type Goal = LearnerGoal;

/** The struggles on record, one line each: the unit (or the family two
 *  units share), where it was seen, and the tally since. Each opens the
 *  unit's lesson; the map shows the same spots in place. */
export function WeakSpots({ weak, className = "mt-4 border-t pt-4" }: { weak: WeakSpotSummary[]; className?: string }) {
	const groups = weakSpotGroups(weak);
	if (!groups.length) return null;
	return (
		<div className={className} data-testid="weak-spots">
			<p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
				<AlertTriangleIcon className="size-4 text-miss" aria-hidden="true" />
				Your weak spots
			</p>
			<ul className="mt-2 flex flex-col gap-0.5">
				{groups.slice(0, 4).map((g) => (
					<li key={g.id}>
						<Link
							href={`/lesson?unit=${g.unit}`}
							className="group -mx-2 block rounded-lg px-2 py-1.5 hover:bg-accent"
							data-testid={`weak-spot-${g.id}`}
						>
							<span className="block text-sm font-bold text-foreground group-hover:text-go">{g.title}</span>
							<span className="block text-xs text-muted-foreground">
								{g.spots.length > 1 ? `${g.spots.map((m) => m.title).join(" + ")} · ${g.spots[0]!.line}` : g.line}
							</span>
						</Link>
					</li>
				))}
				{groups.length > 4 && (
					<li className="pt-1 text-xs text-muted-foreground">
						<Link href="/curriculum" className="underline underline-offset-2 hover:text-foreground">
							{groups.length - 4} more in Curriculum
						</Link>
					</li>
				)}
			</ul>
		</div>
	);
}
