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
			<span className="h-1.5 w-full rounded-full bg-well-2" aria-hidden="true" />
			<span className="absolute left-0 h-1.5 rounded-full bg-teal" style={{ width: `${share * 100}%` }} aria-hidden="true" />
			<span className={cn("absolute size-5 -translate-x-1/2 rounded-full bg-card shadow-[0_0_0_1.5px_var(--q-teal),0_1px_3px_rgb(var(--q-shadow-rgb)/0.2)] transition-transform group-hover:scale-110 group-focus-visible:shadow-[0_0_0_1.5px_var(--q-teal),0_0_0_4px_var(--q-teal-line)]")} style={{ left: `${share * 100}%` }} aria-hidden="true" />
		</div>
	);
}
