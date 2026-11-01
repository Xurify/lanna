"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** A 0–1 slider drawn by hand, like every other control here (no native
 *  range input). Drag, click the track, or use the arrow, Home, End and
 *  Page keys. `onChange` fires while moving; `onCommit` once when the
 *  pointer lifts or a key is pressed, for a sound or a save. */
export function Slider({
	value,
	onChange,
	onCommit,
	label,
	step = 0.05,
	className,
	testid,
}: {
	value: number;
	onChange: (next: number) => void;
	onCommit?: (next: number) => void;
	label: string;
	step?: number;
	className?: string;
	testid?: string;
}) {
	const track = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const percent = Math.round(value * 100);

	const at = (clientX: number): number => {
		const rect = track.current?.getBoundingClientRect();
		if (!rect || rect.width === 0) return value;
		return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
	};

	return (
		<div
			role="slider"
			tabIndex={0}
			aria-label={label}
			aria-orientation="horizontal"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			aria-valuetext={`${percent}%`}
			data-testid={testid}
			// A tall, invisible hit area around a thin track: easy to grab on a phone.
			className={cn("group relative flex h-8 min-w-24 cursor-pointer touch-none select-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60", className)}
			onPointerDown={(e) => {
				e.preventDefault();
				e.currentTarget.setPointerCapture(e.pointerId);
				e.currentTarget.focus();
				setDragging(true);
				onChange(at(e.clientX));
			}}
			onPointerMove={(e) => {
				if (dragging) onChange(at(e.clientX));
			}}
			onPointerUp={(e) => {
				if (!dragging) return;
				setDragging(false);
				onCommit?.(at(e.clientX));
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
			<div ref={track} className="relative h-1.5 w-full rounded-full bg-border">
				<div className="absolute inset-y-0 left-0 rounded-full bg-go" style={{ width: `${percent}%` }} />
				<div
					className={cn("absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-foreground shadow-xs transition-transform", dragging && "scale-110", "group-hover:scale-110")}
					style={{ left: `${percent}%` }}
				/>
			</div>
		</div>
	);
}
