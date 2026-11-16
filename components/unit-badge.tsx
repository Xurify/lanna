"use client";

import { CheckIcon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitIcon } from "@/components/lesson/unit-icon";

/**
 * A unit's circle on the path (LangHarness): its icon, with a ring that
 * fills toward completion, a gold check once done, a lock while its
 * chapter or prerequisites are still ahead. Shared by the Today page's
 * Continue card and the curriculum path.
 */
export function UnitBadge({
	glyph,
	progress,
	done = false,
	active = false,
	locked = false,
	size = "md",
}: {
	glyph: string;
	progress: number;
	done?: boolean;
	active?: boolean;
	locked?: boolean;
	size?: "sm" | "md" | "lg";
	/** The ring and active fill: go (lessons), xp (tutor), flame (goals). */
	tone?: "go" | "xp" | "flame";
}) {
	const px = size === "lg" ? 88 : size === "sm" ? 44 : 56;
	const stroke = size === "lg" ? 7 : size === "sm" ? 4 : 5;
	const r = (px - stroke) / 2;
	const c = 2 * Math.PI * r;
	const ring = "var(--q-teal)";
	return (
		<span
			className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", active && "lh-here-ring")}
			style={{ width: px, height: px }}
		>
			<svg width={px} height={px} className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--q-well-2)" strokeWidth={stroke} />
				<circle
					cx={px / 2}
					cy={px / 2}
					r={r}
					fill="none"
					stroke={ring}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={c * (1 - (done ? 1 : locked ? 0 : progress))}
					className="transition-[stroke-dashoffset] duration-700"
				/>
			</svg>
			<span
				className={cn(
					"flex items-center justify-center rounded-full",
					size === "lg" ? "size-[66px]" : size === "sm" ? "size-[32px]" : "size-[40px]",
					active
						? "bg-teal text-[var(--q-on-teal)]"
						: done
							? "bg-teal-wash text-teal-2"
							: locked
								? "bg-well text-ink-4"
								: progress > 0
									? "bg-card text-ink-2 shadow-raise"
									: "bg-well text-ink-3",
				)}
			>
				<UnitIcon
					name={glyph}
					className={size === "lg" ? "size-8" : size === "sm" ? "size-4" : "size-5"}
					strokeWidth={1.6}
				/>
			</span>
			{done && (
				<span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-card bg-teal text-[var(--q-on-teal)]">
					<CheckIcon className="size-3" strokeWidth={3} aria-label="Done" />
				</span>
			)}
			{locked && !done && (
				<span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-card bg-well-2 text-ink-3">
					<LockIcon className="size-2.5" strokeWidth={3} aria-label="Locked" />
				</span>
			)}
		</span>
	);
}
