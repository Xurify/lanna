"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** A 0–1 slider drawn by hand, like every other control here (no native
 *  range input), left to right or, when vertical, bottom to top. Drag,
 *  click the track, or use the arrow, Home, End and Page keys. `onChange` fires while moving; `onCommit` once when the
 *  pointer lifts or a key is pressed, for a sound or a save. */
export function Slider({
	value,
	onChange,
	onCommit,
	label,
	step = 0.05,
	orientation = "horizontal",
	className,
	testid,
}: {
	value: number;
	onChange: (next: number) => void;
	onCommit?: (next: number) => void;
	label: string;
	step?: number;
	orientation?: "horizontal" | "vertical";
	className?: string;
	testid?: string;
}) {
	const track = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const percent = Math.round(value * 100);
	const vertical = orientation === "vertical";

	const at = (e: { clientX: number; clientY: number }): number => {
		const rect = track.current?.getBoundingClientRect();
		const length = vertical ? rect?.height : rect?.width;
		if (!rect || !length) return value;
		const along = vertical ? rect.bottom - e.clientY : e.clientX - rect.left;
		return Math.min(1, Math.max(0, along / length));
	};

	return (
		<div
			role="slider"
			tabIndex={0}
			aria-label={label}
			aria-orientation={orientation}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			aria-valuetext={`${percent}%`}
			data-testid={testid}
			// A tall, invisible hit area around a thin track: easy to grab on a phone.
			className={cn(
				"group relative flex cursor-pointer touch-none select-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				vertical ? "h-full min-h-24 w-8 flex-col" : "h-8 min-w-24",
				className,
			)}
			onPointerDown={(e) => {
				e.preventDefault();
				e.currentTarget.setPointerCapture(e.pointerId);
				e.currentTarget.focus();
				setDragging(true);
				onChange(at(e));
			}}
			onPointerMove={(e) => {
				if (dragging) onChange(at(e));
			}}
			onPointerUp={(e) => {
				if (!dragging) return;
				setDragging(false);
				onCommit?.(at(e));
			}}
			onPointerCancel={() => setDragging(false)}
			onKeyDown={(e) => {
				const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "PageUp" ? 0.1 : e.key === "PageDown" ? -0.1 : 0;
				const next = e.key === "Home" ? 0 : e.key === "End" ? 1 : delta ? Math.min(1, Math.max(0, Math.round((value + delta) * 100) / 100)) : null;
				if (next === null) return;
				e.preventDefault();
				onChange(next);
				onCommit?.(next);
			}}
		>
			<div ref={track} className={cn("relative rounded-full bg-border", vertical ? "h-full w-1.5" : "h-1.5 w-full")}>
				<div className={cn("absolute rounded-full bg-go", vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0")} style={vertical ? { height: `${percent}%` } : { width: `${percent}%` }} />
				<div
					className={cn(
						"absolute size-4 rounded-full border border-border bg-foreground shadow-xs transition-transform",
						vertical ? "left-1/2 -translate-x-1/2 translate-y-1/2" : "top-1/2 -translate-x-1/2 -translate-y-1/2",
						dragging && "scale-110",
						"group-hover:scale-110",
					)}
					style={vertical ? { bottom: `${percent}%` } : { left: `${percent}%` }}
				/>
			</div>
		</div>
	);
}
