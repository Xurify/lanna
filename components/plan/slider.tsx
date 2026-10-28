"use client";

/**
 * A slider in the app's own marks (no native range input): a track, a
 * filled part and a thumb. Pointer drag anywhere on the track, arrow keys
 * (Shift or PageUp/PageDown for ten steps), Home and End. It reports every
 * change as it happens, so what hangs off it can move live.
 */

import { useRef } from "react";
import { cn } from "@/lib/utils";

export function Slider({ value, min, max, step = 1, onChange, label, valueText, testid }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; valueText?: string; testid?: string }) {
	const track = useRef<HTMLDivElement>(null);
	const clamp = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
	const share = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;

	const fromPointer = (clientX: number) => {
		const r = track.current?.getBoundingClientRect();
		if (!r || r.width === 0) return;
		const next = clamp(min + ((clientX - r.left) / r.width) * (max - min));
		if (next !== value) onChange(next);
	};

	return (
		<div
			ref={track}
			role="slider"
			tabIndex={0}
			aria-label={label}
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuenow={value}
			aria-valuetext={valueText}
			data-testid={testid}
			className="group relative flex h-9 w-full cursor-pointer touch-none items-center outline-none"
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				e.currentTarget.focus();
				fromPointer(e.clientX);
			}}
			onPointerMove={(e) => {
				if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
			}}
			onKeyDown={(e) => {
				const big = e.shiftKey ? 10 : 1;
				const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step * big : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step * big : e.key === "PageUp" ? step * 10 : e.key === "PageDown" ? -step * 10 : 0;
				if (delta) {
					e.preventDefault();
					onChange(clamp(value + delta));
				} else if (e.key === "Home") {
					e.preventDefault();
					onChange(min);
				} else if (e.key === "End") {
					e.preventDefault();
					onChange(max);
				}
			}}
		>
			<span className="h-2 w-full rounded-full bg-accent" aria-hidden="true" />
			<span className="absolute left-0 h-2 rounded-full bg-go" style={{ width: `${share * 100}%` }} aria-hidden="true" />
			<span className={cn("absolute size-5 -translate-x-1/2 rounded-full border-2 border-background bg-go shadow transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-go/50")} style={{ left: `${share * 100}%` }} aria-hidden="true" />
		</div>
	);
}
