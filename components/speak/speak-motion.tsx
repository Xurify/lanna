import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/lesson/ink";
import { C, Person } from "@/components/reading/cover-scene";

const ARCS = ["M7 8.5q2 3.5 0 7", "M10.5 6q3.6 6 0 12", "M14 3.5q5.2 8.5 0 17"];

export function VoiceArcs({
	active,
	level,
	flip,
	className,
}: {
	active: boolean;
	level?: number;
	flip?: boolean;
	className?: string;
}) {
	const scale = level === undefined ? 1 : 0.85 + Math.min(1, level * 2.4) * 0.45;
	return (
		<svg
			viewBox="0 0 22 24"
			className={cn("overflow-visible", flip && "-scale-x-100", className)}
			aria-hidden="true"
			style={{ transform: level === undefined ? undefined : `scale(${flip ? -scale : scale}, ${scale})` }}
		>
			{ARCS.map((d, i) => (
				<path
					key={d}
					d={d}
					className={cn("fill-none stroke-current", active ? "speak-arc" : "opacity-30")}
					strokeWidth={1.8}
					strokeLinecap="round"
					style={{ "--i": i } as CSSProperties}
				/>
			))}
		</svg>
	);
}

export function InkThinking({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 30 10" className={cn("h-2.5 w-8", className)} aria-hidden="true">
			{[5, 15, 25].map((cx, i) => (
				<circle
					key={cx}
					cx={cx}
					cy={5}
					r={2.4}
					className="speak-dot fill-current"
					style={{ "--i": i } as CSSProperties}
				/>
			))}
		</svg>
	);
}

export function CallStage({
	speaker,
	level,
	connecting,
}: {
	speaker: "tutor" | "learner" | null;
	level: number;
	connecting: boolean;
}) {
	const you = speaker === "learner" || (speaker === null && level > 0.08);
	const tutor = speaker === "tutor";
	return (
		<div className="relative mx-auto mt-4 max-w-md text-foreground" data-testid="live-stage">
			<Sheet viewBox="0 0 200 92" className="w-full">
				<C
					points={[
						[14, 86],
						[70, 85],
						[130, 87],
						[186, 86],
					]}
					seed={901}
					tone="soft"
					width={1.1}
				/>
				<Person
					x={46}
					top={30}
					height={56}
					seed={910}
					hair="short"
					arms={[
						[
							[38, 56],
							[37, 64],
						],
						[
							[58, 50],
							[52, 39],
						],
					]}
				/>
				<Person
					x={154}
					top={30}
					height={56}
					seed={930}
					hair="bun"
					dress
					arms={[
						[
							[142, 50],
							[148, 39],
						],
						[
							[162, 56],
							[163, 64],
						],
					]}
				/>
			</Sheet>
			<div className="pointer-events-none absolute inset-0 flex items-start justify-between px-[33%] pt-[12%]">
				<VoiceArcs
					active={you}
					level={you ? level : undefined}
					className={cn("h-8 w-8", you ? "text-teal-2" : "text-ink-4")}
				/>
				{connecting ? (
					<InkThinking className="mt-3 text-ink-3" />
				) : (
					<VoiceArcs active={tutor} flip className={cn("h-8 w-8", tutor ? "text-teal-2" : "text-ink-4")} />
				)}
			</div>
			<p className="sr-only" role="status" aria-live="polite">
				{connecting ? "Connecting" : tutor ? "The tutor is talking" : you ? "You are talking" : ""}
			</p>
			<div className="mt-1 grid grid-cols-2 font-ui text-[12px] font-[550] text-ink-3">
				<span className={cn("pl-[16%]", you && "text-teal-2")}>You</span>
				<span className={cn("pr-[16%] text-right", tutor && "text-teal-2")}>Tutor</span>
			</div>
		</div>
	);
}
