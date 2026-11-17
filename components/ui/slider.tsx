"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SliderStop = number | { value: number; label: string };

/**
 * The app's one slider, drawn by hand like every other control (no native range input).
 *
 * A 3 px track with an accent fill, a 16 px thumb with a thin outline and no glow, ticks at real values,
 * and a 44 px hit area around it. With `header`, the label sits at the left and the live value at the
 * right of one line, in tabular figures. Drag, click the track, or use the keys: arrows, Page Up and
 * Page Down (ten steps), Home and End. `onChange` fires while moving; `onCommit` once when the pointer
 * lifts or a key is pressed, for a sound or a save.
 *
 * `min`, `max` and `step` are in the value's own units. The default 0 to 1 range reads to a screen
 * reader as a percentage. `ticks`: true marks every step when there are twelve or fewer, or give the
 * values to mark. When `stops` is provided, snapping, track notches, and keyboard navigation move
 * between these discrete segments.
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
	stops,
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
	/** Discrete stops/segments along the slider. Snapping and keyboard navigation move between these points. */
	stops?: readonly SliderStop[];
	orientation?: "horizontal" | "vertical";
	className?: string;
	testid?: string;
	valueTestid?: string;
}) {
	const track = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const labelId = useId();
	const vertical = orientation === "vertical";
	const stopList = stops?.map((s) => (typeof s === "number" ? { value: s, label: String(s) } : s));
	const stopValues = stopList?.map((s) => s.value);
	const unit = !stopValues && min === 0 && max === 1;

	const currentIndex = stopValues
		? stopValues.reduce(
				(bestIdx, currVal, idx) => (Math.abs(currVal - value) < Math.abs(stopValues[bestIdx]! - value) ? idx : bestIdx),
				0,
			)
		: -1;

	const effectiveMin = stopValues && stopValues.length > 0 ? stopValues[0]! : min;
	const effectiveMax = stopValues && stopValues.length > 0 ? stopValues[stopValues.length - 1]! : max;

	const clamp = (v: number) => {
		if (stopValues && stopValues.length > 0) {
			return stopValues.reduce((prev, curr) => (Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev));
		}
		return Math.min(effectiveMax, Math.max(effectiveMin, Math.round((v - effectiveMin) / step) * step + effectiveMin));
	};

	const share = stopValues
		? stopValues.length > 1
			? currentIndex / (stopValues.length - 1)
			: 1
		: effectiveMax > effectiveMin
			? (Math.min(effectiveMax, Math.max(effectiveMin, value)) - effectiveMin) / (effectiveMax - effectiveMin)
			: 0;

	const text = valueText ?? (unit ? `${Math.round(value * 100)}%` : String(value));
	const tickValues =
		ticks === true
			? Math.round((effectiveMax - effectiveMin) / step) <= 12
				? Array.from(
						{ length: Math.round((effectiveMax - effectiveMin) / step) + 1 },
						(_, i) => effectiveMin + i * step,
					)
				: []
			: ticks
				? [...ticks].filter((t) => t >= effectiveMin && t <= effectiveMax)
				: [];

	const at = (e: { clientX: number; clientY: number }): number => {
		const rect = track.current?.getBoundingClientRect();
		const length = vertical ? rect?.height : rect?.width;
		if (!rect || !length) return value;
		const along = vertical ? rect.bottom - e.clientY : e.clientX - rect.left;
		const fraction = Math.min(1, Math.max(0, along / length));
		if (stopValues && stopValues.length > 1) {
			const idx = Math.round(fraction * (stopValues.length - 1));
			return stopValues[idx]!;
		}
		return clamp(effectiveMin + fraction * (effectiveMax - effectiveMin));
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
			aria-valuemin={unit ? 0 : effectiveMin}
			aria-valuemax={unit ? 100 : effectiveMax}
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
				if (stopValues && stopValues.length > 0) {
					let next: number | null = null;
					if (e.key === "Home") next = stopValues[0]!;
					else if (e.key === "End") next = stopValues[stopValues.length - 1]!;
					else if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp") {
						const jump = e.key === "PageUp" ? 2 : 1;
						next = stopValues[Math.min(stopValues.length - 1, currentIndex + jump)]!;
					} else if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown") {
						const jump = e.key === "PageDown" ? 2 : 1;
						next = stopValues[Math.max(0, currentIndex - jump)]!;
					}
					if (next !== null) {
						e.preventDefault();
						set(next, true);
					}
					return;
				}
				const big = e.key === "PageUp" || e.key === "PageDown" ? 10 : 1;
				const delta =
					e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp"
						? step * big
						: e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown"
							? -step * big
							: 0;
				const next =
					e.key === "Home" ? effectiveMin : e.key === "End" ? effectiveMax : delta ? clamp(value + delta) : null;
				if (next === null) return;
				e.preventDefault();
				set(next, true);
			}}
		>
			<div
				ref={track}
				className={cn(
					"relative rounded-full bg-line-2",
					vertical ? "my-2 h-[calc(100%-1rem)] w-[3px]" : "mx-2 h-[3px] w-[calc(100%-1rem)]",
				)}
			>
				<div
					className={cn("absolute rounded-full bg-teal", vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0")}
					style={vertical ? { height: `${share * 100}%` } : { width: `${share * 100}%` }}
				/>
				{stopList
					? stopList.map((stop, i) => {
							const p = stopList.length > 1 ? (i / (stopList.length - 1)) * 100 : 100;
							return (
								<span
									key={stop.value}
									aria-hidden="true"
									className={cn(
										"absolute -translate-y-1/2 -translate-x-1/2 rounded-full transition-colors",
										vertical ? "left-1/2 w-2 h-0.5" : "top-1/2 size-1",
										i <= currentIndex ? "bg-teal" : "bg-ink-4",
									)}
									style={vertical ? { bottom: `${p}%` } : { left: `${p}%` }}
								/>
							);
						})
					: tickValues.map((t) => {
							const p = ((t - effectiveMin) / (effectiveMax - effectiveMin)) * 100;
							return (
								<span
									key={t}
									aria-hidden="true"
									className={cn(
										"absolute bg-ink-4",
										vertical ? "left-1/2 h-px w-2 -translate-x-1/2" : "top-1/2 h-2 w-px -translate-y-1/2",
									)}
									style={vertical ? { bottom: `${p}%` } : { left: `${p}%` }}
								/>
							);
						})}
				<div
					data-thumb=""
					className={cn(
						"absolute size-4 rounded-full bg-card shadow-[0_0_0_1.5px_var(--q-teal)]",
						vertical ? "left-1/2 -translate-x-1/2 translate-y-1/2" : "top-1/2 -translate-x-1/2 -translate-y-1/2",
						!dragging && "transition-[left,bottom] duration-100 ease-out",
					)}
					style={vertical ? { bottom: `${share * 100}%` } : { left: `${share * 100}%` }}
					aria-hidden="true"
				/>
			</div>
		</div>
	);

	if (!header && !stopList) return control;
	return (
		<div className="w-full">
			{header && (
				<div className="flex items-baseline justify-between gap-3">
					<span id={labelId} className="text-sm font-semibold text-foreground">
						{label}
					</span>
					<output className="q-num text-sm font-semibold text-foreground" data-testid={valueTestid} aria-live="off">
						{text}
					</output>
				</div>
			)}
			{control}
			{stopList && stopList.length > 1 && !vertical && (
				<div className="relative -mt-2 h-4 w-full select-none" aria-hidden="true">
					<div className="relative mx-2 h-full">
						{stopList.map((stop, i) => {
							const p = (i / (stopList.length - 1)) * 100;
							const isFirst = i === 0;
							const isLast = i === stopList.length - 1;
							const isActive = i === currentIndex;
							return (
								<button
									key={stop.value}
									type="button"
									tabIndex={-1}
									onClick={(e) => {
										e.stopPropagation();
										set(stop.value, true);
									}}
									className={cn(
										"absolute font-ui text-xs tabular-nums transition-colors cursor-pointer -translate-y-1/2 top-1/2",
										isFirst ? "left-0 text-left" : isLast ? "right-0 text-right" : "-translate-x-1/2 text-center",
										isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
									)}
									style={!isFirst && !isLast ? { left: `${p}%` } : undefined}
								>
									{stop.label}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
