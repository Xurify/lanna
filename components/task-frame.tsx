"use client";

/**
 * The full-screen task frame (2026-10-28) — what the lesson,
 * exam, Listen, Speak and Fluency screens share, in the Quiet tool look
 * (the mockup's practice screen): a fixed frame over the app (a focus
 * mode; Escape leaves), the one content column, the top bar with
 * exit · progress · count, the practice card, the option tile and the
 * stat row the end screens use.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { TimerIcon, Volume2Icon, XIcon } from "lucide-react";
import { practiceClock } from "@/src/core";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import type { QIconName } from "@/components/quiet/icon-paths";
import { fillStyle } from "@/components/ui/fill";
import { KBD } from "@/components/ui/learn-buttons";
import { renderAhead } from "@/components/instant-navigation";
import { readOrigin } from "@/components/origin";

export { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";

export const COLUMN = "mx-auto w-full max-w-3xl px-4 sm:px-6";

export function TaskFrame({ children, strip = true }: { children: React.ReactNode; strip?: boolean }) {
	return (
		<>
			<div className="fixed inset-y-0 right-0 left-0 z-40 flex flex-col bg-background md:left-[var(--sidebar-cols,3.25rem)]">
				{strip && <div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
				{children}
			</div>
		</>
	);
}

const LEAVE =
	"-ml-1.5 pointer-coarse:-ml-3 rounded-lg p-1.5 pointer-coarse:p-3 text-ink-3 transition-colors hover:bg-well hover:text-ink-2";

/** Exit · progress bar · count. The band drags the window. The bar is the
 *  teal of work done; only a clock running low turns it red (`ink` is kept for older callers). */
export function TaskTop({
	progress,
	label,
	count,
	tone,
	ink,
	href = "/",
	onLeave,
}: {
	progress: number;
	label: string;
	count: string;
	tone?: string;
	ink?: string;
	href?: string;
	onLeave?: () => void;
}) {
	return (
		<TaskBar href={href} onLeave={onLeave}>
			<div
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(progress * 100)}
				className="relative h-1 flex-1 overflow-hidden rounded-full bg-well-2"
				aria-label={label}
			>
				<div
					className={cn("lh-fill rounded-full", tone ?? (ink === "bg-miss" ? ink : "bg-teal"))}
					style={fillStyle(Math.max(0.03, progress))}
				/>
			</div>
			<span className="font-ui text-[12.5px] font-[450] tabular-nums text-ink-3" data-testid="task-count">
				{count}
			</span>
		</TaskBar>
	);
}

export type PipOutcome = "right" | "almost" | "miss" | "shown" | "now" | "ahead";

const STRUCK =
	"relative bg-well-2 after:absolute after:inset-x-0 after:top-[calc(50%-1px)] after:h-0.5 after:rounded-full after:content-['']";

export function Pip({ outcome, className }: { outcome: PipOutcome; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"h-1.5 rounded-full transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none",
				outcome === "right" && "bg-teal",
				outcome === "almost" && "bg-teal-line",
				outcome === "miss" && "bg-miss",
				outcome === "shown" && cn(STRUCK, "after:bg-ink-4"),
				outcome === "now" && "bg-ink-4",
				outcome === "ahead" && "bg-well-2",
				className,
			)}
		/>
	);
}

export function Pips({ outcomes, className }: { outcomes: readonly PipOutcome[]; className?: string }) {
	return (
		<span className={cn("flex items-center gap-[3px]", className)} aria-hidden="true">
			{outcomes.map((outcome, i) => (
				<Pip key={i} outcome={outcome} className="flex-1" />
			))}
		</span>
	);
}

export function TaskRound({
	outcomes,
	label,
	count,
	href = "/",
	onLeave,
}: {
	outcomes: readonly PipOutcome[];
	label: string;
	count: string;
	href?: string;
	onLeave?: () => void;
}) {
	const answered = outcomes.filter((o) => o !== "now" && o !== "ahead").length;
	return (
		<TaskBar href={href} onLeave={onLeave}>
			<div
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={outcomes.length}
				aria-valuenow={answered}
				aria-label={label}
				className="min-w-0 flex-1"
				data-testid="task-round"
			>
				<Pips outcomes={outcomes} />
			</div>
			<span className="font-ui text-[12.5px] font-[450] tabular-nums text-ink-3" data-testid="task-count">
				{count}
			</span>
		</TaskBar>
	);
}

export function TaskBar({
	href = "/",
	onLeave,
	children,
}: {
	href?: string;
	onLeave?: () => void;
	children?: React.ReactNode;
}) {
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
				{children}
			</div>
		</div>
	);
}

export function PracticeCard({
	icon,
	title,
	sub,
	right,
	children,
	className,
}: {
	icon?: QIconName;
	title: string;
	sub?: string;
	right?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			<div className="flex min-h-8 items-center gap-2 text-[13px] font-[550] text-ink-2" data-testid="practice-head">
				{icon && <QIcon name={icon} className="text-ink-3" />}
				<span className="shrink-0 text-ink first-letter:uppercase">{title}</span>
				{sub && <span className="min-w-0 truncate font-[450] text-ink-3">{sub}</span>}
				{right !== undefined && <span className="ml-auto shrink-0 font-[450] text-ink-3">{right}</span>}
			</div>
			<div className="pt-5 sm:pt-6">{children}</div>
		</div>
	);
}

/** One answer to pick: a raised tile with its key. Right is the teal, a
 *  wrong pick the muted red, the rest step back once an answer is in. */
export function OptionTile({
	n,
	state = "idle",
	disabled,
	onClick,
	children,
	testId,
	lang,
}: {
	n: number;
	state?: "idle" | "right" | "wrong" | "dim" | "ruled-out";
	disabled?: boolean;
	onClick: () => void;
	children: React.ReactNode;
	testId?: string;
	lang?: string;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			data-testid={testId}
			className={cn(
				// The tile sits on a card, so it needs its own line: the raise shadow alone vanishes in the dark theme.
				"lh-press flex min-h-12 items-center gap-3 rounded-[10px] bg-card px-3.5 py-2.5 text-left font-prose text-[19px] font-medium tracking-[-0.01em] text-foreground shadow-[0_0_0_1px_var(--q-line-2),0_1px_2px_rgb(var(--q-shadow-rgb)/0.05)]",
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
export function Dock({
	tone = "plain",
	children,
	testId,
	live,
}: {
	tone?: "plain" | "right" | "miss" | "wait";
	children: React.ReactNode;
	testId?: string;
	live?: boolean;
}) {
	return (
		<div
			className={cn(
				"shrink-0 shadow-[0_-1px_0_var(--q-line)] pb-[env(safe-area-inset-bottom)]",
				tone === "right" && "bg-teal-wash shadow-[0_-1px_0_var(--q-teal-line)]",
				tone === "miss" && "bg-miss-soft shadow-[0_-1px_0_color-mix(in_srgb,var(--q-miss)_45%,transparent)]",
				tone === "wait" && "bg-well",
			)}
			data-testid={testId}
			aria-live={live ? "polite" : undefined}
		>
			{children}
		</div>
	);
}

export function TaskEnd({
	children,
	actions,
	hint,
	wide = false,
	label = "Your result",
	testId,
}: {
	children: React.ReactNode;
	actions: React.ReactNode;
	hint?: React.ReactNode;
	wide?: boolean;
	label?: string;
	testId?: string;
}) {
	const column = cn("mx-auto w-full max-w-2xl px-6", wide && "lg:max-w-5xl");
	const body = useRef<HTMLDivElement>(null);
	useEffect(() => {
		renderAhead(readOrigin());
		endOpenedAt = performance.now();
		if (document.activeElement === null || document.activeElement === document.body)
			body.current?.focus({ preventScroll: true });
	}, []);
	return (
		<>
			<div
				ref={body}
				tabIndex={-1}
				role="region"
				aria-label={label}
				data-task-end=""
				className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
				data-testid={testId}
			>
				<div className={cn(column, "q-rise my-auto pb-12 pt-16")}>{children}</div>
			</div>
			<Dock>
				<div className={cn(column, "flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4")}>
					{hint}
					<div
						className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2"
						onPointerOver={() => renderAhead(readOrigin())}
						onFocus={() => renderAhead(readOrigin())}
					>
						{actions}
					</div>
				</div>
			</Dock>
		</>
	);
}

export const PLAY_ROW =
	"lh-press flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-ink-3 shadow-[0_0_0_1px_var(--q-line-2)] hover:bg-well hover:text-ink-2 pointer-coarse:size-11";

export function SentenceRows({
	children,
	className,
	"data-testid": testId,
}: {
	children: React.ReactNode;
	className?: string;
	"data-testid"?: string;
}) {
	return (
		<ul className={cn("divide-y divide-[var(--q-line)]", className)} data-testid={testId}>
			{children}
		</ul>
	);
}

export function SentenceRow({
	sentence,
	lang,
	translation,
	note,
	onPlay,
	children,
}: {
	sentence: string;
	lang?: string;
	translation?: string;
	note?: React.ReactNode;
	onPlay: () => void;
	children?: React.ReactNode;
}) {
	return (
		<li className="flex items-start gap-4 py-4">
			<button type="button" onClick={onPlay} className={PLAY_ROW} aria-label={`Play: ${sentence}`} title="Play">
				<Volume2Icon className="size-4" strokeWidth={1.6} />
			</button>
			<div className="min-w-0 flex-1">
				<p className="font-prose text-[17px] font-medium leading-snug tracking-[-0.008em] text-foreground" lang={lang}>
					{children ?? sentence}
				</p>
				{translation && (
					<p data-no-word-lookup="true" className="mt-0.5 font-prose text-[15px] text-ink-3">
						{translation}
					</p>
				)}
				{note && (
					<div
						className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[12.5px] text-ink-3"
						data-no-word-lookup="true"
					>
						{note}
					</div>
				)}
			</div>
		</li>
	);
}

export function NotSaved({
	onRetry,
	busy = false,
	refused = false,
}: {
	onRetry: () => void;
	busy?: boolean;
	refused?: boolean;
}) {
	if (refused)
		return (
			<p className="font-prose text-[13px] text-ink-3" role="status">
				Not saved: the app refused this session, so it is not counted.
			</p>
		);
	return (
		<p className="font-prose text-[13px] text-ink-3" role="status">
			Not saved yet. The app keeps trying.{" "}
			<button
				type="button"
				onClick={onRetry}
				disabled={busy}
				className="font-ui font-[550] text-ink-2 underline decoration-[var(--q-line-2)] underline-offset-[3px] hover:text-foreground disabled:text-ink-3 disabled:no-underline pointer-coarse:py-3"
			>
				{busy ? "Trying…" : "Try again"}
			</button>
		</p>
	);
}

const END_ENTER_PAUSE_MS = 1000;
let endOpenedAt = 0;

export function endEnterBlocked(e: KeyboardEvent): boolean {
	return e.repeat || onFocusedControl(e) || performance.now() - endOpenedAt < END_ENTER_PAUSE_MS;
}

export function onFocusedControl(e: KeyboardEvent): boolean {
	return e.target instanceof Element && !!e.target.closest("a, button, input, textarea, summary");
}

export function EnterHint({ children }: { children: React.ReactNode }) {
	return (
		<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 sm:pointer-fine:flex">
			<kbd className={KBD}>Enter</kbd> {children}
		</p>
	);
}

/** The verdict mark: a small filled disc with a tick or a cross. */
export function VerdictDisc({ ok }: { ok: boolean }) {
	return (
		<span
			className={cn(
				"flex size-6 shrink-0 items-center justify-center rounded-full",
				ok ? "bg-teal text-[var(--q-on-teal)]" : "bg-miss text-[var(--q-bg)]",
			)}
			aria-hidden="true"
		>
			<svg
				viewBox="0 0 24 24"
				className="size-3.5 fill-none stroke-current"
				strokeWidth={2.6}
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{ok ? <path d="M5.5 12.5l4 4L18.5 7.5" /> : <path d="M7 7l10 10M17 7L7 17" />}
			</svg>
		</span>
	);
}

/** A placeholder in the shape of what is coming, so its slot keeps its size. */
export function Pulse({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn("inline-block animate-pulse rounded-md bg-well-2 motion-reduce:animate-none", className)}
		/>
	);
}

/** Numbers on an end screen, in one card divided into cells (the mockup's
 *  score card). */
export function Stats({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				"flex max-w-sm flex-col divide-y divide-[var(--q-line)] border-t border-[var(--q-line)] text-left",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function Stat({
	label,
	value,
	ink,
	icon,
}: {
	label: string;
	value: string | null;
	ink?: string;
	icon?: React.ReactNode;
}) {
	return (
		<div className="flex min-h-11 items-center justify-between gap-4 py-2">
			<p className="min-w-0 text-[14px] text-ink-3">{label}</p>
			<p
				className={cn(
					"flex h-6 shrink-0 items-center gap-1.5 font-ui text-[16px] font-semibold tracking-[-0.01em] tabular-nums",
					ink ?? "text-foreground",
				)}
			>
				{icon}
				{value ?? <Pulse className="h-4 w-12" />}
			</p>
		</div>
	);
}

export function PracticeTime({ ms, how }: { ms: number | null; how: string }) {
	return (
		<p
			className="mt-3 flex h-6 items-center gap-1.5 font-ui text-[15px] font-[550] text-ink-2"
			title={how}
			data-testid="practice-time"
		>
			<TimerIcon className="size-4 text-teal" strokeWidth={1.6} aria-hidden="true" />
			{ms === null ? (
				<Pulse className="h-4 w-10" />
			) : (
				<span className="tabular-nums text-foreground">{practiceClock(ms)}</span>
			)}
			<span>practice time</span>
			<span className="sr-only">. {how}</span>
		</p>
	);
}

export const ACTIVE_TIME_HOW = "Active time: a pause longer than 90 seconds is not counted.";
export const PAGE_TIME_HOW = "Counted while this page was open and in front of you.";

export function Centered({ children, testId }: { children: React.ReactNode; testId?: string }) {
	return (
		<div className="m-auto max-w-md px-6 text-center" data-testid={testId}>
			{children}
		</div>
	);
}
