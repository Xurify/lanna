"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The app's one slider, drawn by hand like every other control (no native range input).
 *
 * A 4 px track with an accent fill, a 20 px thumb with a thin outline and no glow, ticks at real values,
 * and a 44 px hit area around it. With `header`, the label sits at the left and the live value at the
 * right of one line, in tabular figures. Drag, click the track, or use the keys: arrows, Page Up and
 * Page Down (ten steps), Home and End. `onChange` fires while moving; `onCommit` once when the pointer
 * lifts or a key is pressed, for a sound or a save.
 *
 * `min`, `max` and `step` are in the value's own units. The default 0 to 1 range reads to a screen
 * reader as a percentage. `ticks`: true marks every step when there are twelve or fewer, or give the
 * values to mark.
 */
export function Slider({
	value,
	onChange,
	onCommit,
	label,
	min = 0,
	max = 1,
	step = 0.05,
	valueText,
	header = false,
	ticks,
	orientation = "horizontal",
	className,
	testid,
	valueTestid,
}: {
	value: number;
	onChange: (next: number) => void;
	onCommit?: (next: number) => void;
	label: string;
	min?: number;
	max?: number;
	step?: number;
	/** What the value is called ("30 min", "5 days"); defaults to the number, or a percentage on the 0 to 1 range. */
	valueText?: string;
	/** Show the label and the live value above the track. */
	header?: boolean;
	ticks?: boolean | readonly number[];
	orientation?: "horizontal" | "vertical";
	className?: string;
	testid?: string;
	valueTestid?: string;
}) {
	const track = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const labelId = useId();
	const vertical = orientation === "vertical";
	const unit = min === 0 && max === 1;
	const clamp = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
	const share = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
	const text = valueText ?? (unit ? `${Math.round(value * 100)}%` : String(value));
	const tickValues = ticks === true ? (Math.round((max - min) / step) <= 12 ? Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step) : []) : ticks ? [...ticks].filter((t) => t >= min && t <= max) : [];

	const at = (e: { clientX: number; clientY: number }): number => {
		const rect = track.current?.getBoundingClientRect();
		const length = vertical ? rect?.height : rect?.width;
		if (!rect || !length) return value;
		const along = vertical ? rect.bottom - e.clientY : e.clientX - rect.left;
		return clamp(min + Math.min(1, Math.max(0, along / length)) * (max - min));
	};

	const set = (next: number, commit: boolean) => {
		if (next !== value) onChange(next);
		if (commit) onCommit?.(next);
	};

	const control = (
		<div
			role="slider"
			tabIndex={0}
			aria-labelledby={header ? labelId : undefined}
			aria-label={header ? undefined : label}
			aria-orientation={orientation}
			aria-valuemin={unit ? 0 : min}
			aria-valuemax={unit ? 100 : max}
			aria-valuenow={unit ? Math.round(value * 100) : value}
			aria-valuetext={text}
			data-testid={testid}
			// A 44 px band around a 4 px track, so it is easy to grab with a thumb.
			className={cn(
				"group relative flex cursor-pointer touch-none select-none items-center justify-center outline-none focus-visible:[&_[data-thumb]]:outline focus-visible:[&_[data-thumb]]:outline-2 focus-visible:[&_[data-thumb]]:outline-offset-2 focus-visible:[&_[data-thumb]]:outline-teal",
				vertical ? "h-full min-h-24 w-11 flex-col" : "h-11 w-full min-w-24",
				className,
			)}
			onPointerDown={(e) => {
				e.preventDefault();
				e.currentTarget.setPointerCapture(e.pointerId);
				e.currentTarget.focus();
				setDragging(true);
				set(at(e), false);
			}}
			onPointerMove={(e) => {
				if (dragging) set(at(e), false);
			}}
			onPointerUp={(e) => {
				if (!dragging) return;
				setDragging(false);
				set(at(e), true);
			}}
			onPointerCancel={() => setDragging(false)}
			onKeyDown={(e) => {
				const big = e.key === "PageUp" || e.key === "PageDown" ? 10 : 1;
				const delta = e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp" ? step * big : e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown" ? -step * big : 0;
				const next = e.key === "Home" ? min : e.key === "End" ? max : delta ? clamp(value + delta) : null;
				if (next === null) return;
				e.preventDefault();
				set(next, true);
			}}
		>
			<div ref={track} className={cn("relative rounded-full bg-line-2", vertical ? "h-full w-1" : "h-1 w-full")}>
				<div className={cn("absolute rounded-full bg-teal", vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0")} style={vertical ? { height: `${share * 100}%` } : { width: `${share * 100}%` }} />
				{tickValues.map((t) => {
					const p = ((t - min) / (max - min)) * 100;
					return <span key={t} aria-hidden="true" className={cn("absolute bg-ink-4", vertical ? "left-1/2 h-px w-2 -translate-x-1/2" : "top-1/2 h-2 w-px -translate-y-1/2")} style={vertical ? { bottom: `${p}%` } : { left: `${p}%` }} />;
				})}
				<div
					data-thumb=""
					className={cn("absolute size-5 rounded-full bg-card shadow-[0_0_0_1.5px_var(--q-teal)]", vertical ? "left-1/2 -translate-x-1/2 translate-y-1/2" : "top-1/2 -translate-x-1/2 -translate-y-1/2")}
					style={vertical ? { bottom: `${share * 100}%` } : { left: `${share * 100}%` }}
					aria-hidden="true"
				/>
			</div>
		</div>
	);

	if (!header) return control;
	return (
		<div className="w-full">
			<div className="flex items-baseline justify-between gap-3">
				<span id={labelId} className="text-sm font-semibold text-foreground">
					{label}
				</span>
				<output className="q-num text-sm font-semibold text-foreground" data-testid={valueTestid} aria-live="off">
					{text}
				</output>
			</div>
			{control}
		</div>
	);
}
