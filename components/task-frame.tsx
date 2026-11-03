"use client";

/**
 * The full-screen task frame (LangHarness, 2026-10-28) — what the lesson,
 * exam, Listen, Speak and Fluency screens share, in the Quiet tool look
 * (the mockup's practice screen): a fixed frame over the app (a focus
 * mode; Escape leaves), the one content column, the top bar with
 * exit · progress · count, the practice card, the option tile and the
 * stat row the end screens use.
 */

import Link from "next/link";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import type { QIconName } from "@/components/quiet/icon-paths";

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

const LEAVE = "-ml-1.5 pointer-coarse:-ml-3 rounded-lg p-1.5 pointer-coarse:p-3 text-ink-3 transition-colors hover:bg-well hover:text-ink-2";

/** Exit · progress bar · count. The band drags the window. The bar is the
 *  teal of work done; only a clock running low turns it red (`ink` is kept for older callers). */
export function TaskTop({ progress, label, count, tone, ink, href = "/", onLeave }: { progress: number; label: string; count: string; tone?: string; ink?: string; href?: string; onLeave?: () => void }) {
	return (
		<div className="lh-drag lh-wco-gutter shrink-0 select-none">
			<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
				{onLeave ? (
					<button type="button" onClick={onLeave} aria-label="Leave" className={LEAVE}>
						<XIcon className="size-5" strokeWidth={1.6} />
					</button>
				) : (
					<Link href={href} aria-label="Leave" className={LEAVE}>
						<XIcon className="size-5" strokeWidth={1.6} />
					</Link>
				)}
				<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="relative h-1 flex-1 overflow-hidden rounded-full bg-well-2" aria-label={label}>
					<div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tone ?? (ink === "bg-miss" ? ink : "bg-teal"))} style={{ width: `${Math.max(3, Math.min(100, progress * 100))}%` }} />
				</div>
				<span className="font-ui text-[12.5px] font-[450] tabular-nums text-ink-3" data-testid="task-count">
					{count}
				</span>
			</div>
		</div>
	);
}

/** The practice card (the mockup's `.q-cloze`): a head with what this is, a
 *  body for the question. `right` is the quiet note in the head's far corner. */
export function PracticeCard({ icon, title, sub, right, children, className }: { icon?: QIconName; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
	return (
		<div className={cn("q-cloze", className)}>
			<div className="q-card-head">
				{icon && <QIcon name={icon} />}
				<span className="text-ink first-letter:uppercase">{title}</span>
				{sub && <span className="font-[450] text-ink-3">{sub}</span>}
				{right !== undefined && <span className="mins">{right}</span>}
			</div>
			<div className="px-5 py-6 sm:px-7 sm:pb-6 sm:pt-7">{children}</div>
		</div>
	);
}

/** One answer to pick: a raised tile with its key. Right is the teal, a
 *  wrong pick the muted red, the rest step back once an answer is in. */
export function OptionTile({ n, state = "idle", disabled, onClick, children, testId, lang }: { n: number; state?: "idle" | "right" | "wrong" | "dim" | "ruled-out"; disabled?: boolean; onClick: () => void; children: React.ReactNode; testId?: string; lang?: string }) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			data-testid={testId}
			className={cn(
				"flex min-h-12 items-center gap-3 rounded-[10px] bg-card px-3.5 py-2.5 text-left font-prose text-[19px] font-medium tracking-[-0.01em] text-foreground shadow-raise transition-[background-color,box-shadow,opacity] duration-150",
				state === "idle" && !disabled && "hover:bg-well",
				state === "right" && "bg-teal-wash text-teal-2 shadow-[inset_0_0_0_1.5px_var(--q-teal)]",
				state === "wrong" && "bg-miss-soft text-miss shadow-[inset_0_0_0_1.5px_var(--q-miss)]",
				state === "dim" && "opacity-50",
				state === "ruled-out" && "line-through opacity-50",
			)}
		>
			<span className="q-kbd shrink-0 justify-center">{n}</span>
			<span lang={lang}>{children}</span>
		</button>
	);
}

/** The bar under the question, in the same place every time. */
export function Dock({ tone = "plain", children, testId, live }: { tone?: "plain" | "right" | "miss" | "wait"; children: React.ReactNode; testId?: string; live?: boolean }) {
	return (
		<div
			className={cn("shrink-0 shadow-[0_-1px_0_var(--q-line)] pb-[env(safe-area-inset-bottom)]", tone === "right" && "bg-teal-wash", tone === "miss" && "bg-miss-soft", tone === "wait" && "bg-well")}
			data-testid={testId}
			aria-live={live ? "polite" : undefined}
		>
			{children}
		</div>
	);
}

/** The verdict mark: a small filled disc with a tick or a cross. */
export function VerdictDisc({ ok }: { ok: boolean }) {
	return (
		<span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", ok ? "bg-teal text-[var(--q-on-teal)]" : "bg-miss text-[var(--q-bg)]")} aria-hidden="true">
			<svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
				{ok ? <path d="M5.5 12.5l4 4L18.5 7.5" /> : <path d="M7 7l10 10M17 7L7 17" />}
			</svg>
		</span>
	);
}

/** A placeholder in the shape of what is coming, so its slot keeps its size. */
export function Pulse({ className }: { className?: string }) {
	return <span aria-hidden="true" className={cn("inline-block animate-pulse rounded-md bg-well-2 motion-reduce:animate-none", className)} />;
}

/** Numbers on an end screen, in one card divided into cells (the mockup's
 *  score card). */
export function Stats({ children, className }: { children: React.ReactNode; className?: string }) {
	return <div className={cn("q-card grid grid-flow-col auto-cols-fr divide-x divide-[var(--q-line)] overflow-hidden text-left", className)}>{children}</div>;
}

export function Stat({ label, value, ink, icon }: { label: string; value: string | null; ink?: string; icon?: React.ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5">
			<p className="text-xs text-ink-3">{label}</p>
			<p className={cn("flex h-6 items-center gap-1.5 font-ui text-[17px] font-semibold tracking-[-0.015em] tabular-nums", ink ?? "text-foreground")}>
				{icon}
				{value ?? <Pulse className="h-4 w-12" />}
			</p>
		</div>
	);
}

export function Centered({ children, testId }: { children: React.ReactNode; testId?: string }) {
	return (
		<div className="m-auto max-w-md px-6 text-center" data-testid={testId}>
			{children}
		</div>
	);
}
