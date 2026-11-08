/**
 * A scene with a date, as a row inside Today's "Where you are" card
 * (LangHarness, 2026-11-06; creator-hooks proposal 3). The days left are the
 * figure; the status is a word, never a color alone; the line under it is the
 * app's own estimate or its honest "not measured yet". It links to Speak to
 * rehearse, and to Milestones once the date has passed with no line written.
 * Weekly rehearsal is not built yet.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { dateInWords, daysLeftWords, type DatedStatus } from "@/src/core";

interface DatedSceneCardProps {
	scene: { title: string; words?: string | null; date: string; daysLeft: number; status: DatedStatus; line: string; outcomeDue: boolean };
}

const STATUS_LABEL: Record<DatedStatus, string> = {
	"on-track": "On track",
	behind: "Later than the date",
	"no-speed": "Speed not measured",
	"no-pace": "Pace not measured",
	passed: "Date passed",
};

export function DatedSceneCard({ scene }: DatedSceneCardProps) {
	const past = scene.daysLeft < 0;
	const n = Math.abs(scene.daysLeft);
	return (
		<div className="flex items-start gap-4" data-testid="dated-scene-card">
			<div className="w-14 shrink-0 pt-0.5 text-center" role="img" aria-label={daysLeftWords(scene.daysLeft)}>
				<p className="text-[30px] font-semibold leading-none tracking-[-0.025em] text-foreground">{n}</p>
				<p className="mt-1 text-[11.5px] leading-tight text-ink-3">{past ? (n === 1 ? "day ago" : "days ago") : n === 0 ? "today" : n === 1 ? "day left" : "days left"}</p>
			</div>
			<div className="min-w-0 flex-1">
				{/* The learner's own words, whole: the generated title is cut short. */}
				<h3 className="line-clamp-2 text-[15px] font-[550] leading-snug tracking-[-0.006em] text-foreground first-letter:uppercase" title={scene.title}>
					{scene.words?.trim() || scene.title}
				</h3>
				<p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
					<span className={cn("q-pill", scene.status !== "on-track" && "grey")}>{STATUS_LABEL[scene.status]}</span>
					<time dateTime={scene.date}>{dateInWords(scene.date)}</time>
				</p>
				<p className="mt-1.5 text-[14px] leading-snug text-ink-2">{scene.line}</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<Link href="/speak" className="q-btn sec pointer-coarse:h-11">
						Open Speak
					</Link>
					{scene.outcomeDue && (
						<Link href="/milestones" className="q-btn sec t pointer-coarse:h-11">
							How did it go?
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}
