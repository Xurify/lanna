"use client";

/**
 * The full-screen task frame (LangHarness, 2026-10-28) — what the Listen,
 * Speak and Fluency screens share: a fixed frame over the app (a focus
 * mode; Escape leaves), the one content column, the button styles, the
 * top bar with exit · progress · count, and the small stat block the
 * end screens use. Lessons keep their own copy in lesson-player.tsx.
 */

import Link from "next/link";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export { BUTTON, PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";

export const COLUMN = "mx-auto w-full max-w-3xl px-6";

export function TaskFrame({ children, strip = true }: { children: React.ReactNode; strip?: boolean }) {
	return (
		<div className="fixed inset-0 z-40 flex flex-col bg-background">
			{strip && <div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
			{children}
		</div>
	);
}

/** Exit · progress bar · count. The band drags the window. */
export function TaskTop({ progress, label, count, ink = "bg-sky", href = "/", onLeave }: { progress: number; label: string; count: string; ink?: string; href?: string; onLeave?: () => void }) {
	return (
		<div className="lh-drag lh-wco-gutter shrink-0 select-none">
			<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
				{onLeave ? (
					<button type="button" onClick={onLeave} aria-label="Leave" className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</button>
				) : (
					<Link href={href} aria-label="Leave" className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</Link>
				)}
				<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="relative h-3 flex-1 overflow-hidden rounded-full bg-accent" aria-label={label}>
					<div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", ink)} style={{ width: `${Math.max(3, Math.min(100, progress * 100))}%` }} />
				</div>
				<span className="font-ui text-sm font-semibold tabular-nums text-muted-foreground" data-testid="task-count">
					{count}
				</span>
			</div>
		</div>
	);
}

export function Stat({ label, value, ink }: { label: string; value: string; ink: string }) {
	return (
		<div>
			<p className="text-xs font-bold tracking-wide text-muted-foreground">{label}</p>
			<p className={cn("text-2xl font-black tabular-nums", ink)}>{value}</p>
		</div>
	);
}

export function Centered({ children, testId }: { children: React.ReactNode; testId?: string }) {
	return (
		<div className="m-auto max-w-md text-center" data-testid={testId}>
			{children}
		</div>
	);
}
