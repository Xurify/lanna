"use client";

/**
 * The setup's own controls (LangHarness onboarding, 2026-10-28): chips for
 * a short choice, a stepper for a number. No native <select>: the app's
 * surfaces are its own (Xurify, 2026-10-28), and a select's popup is the
 * browser's, not ours. Everything is keyboard-reachable: chips are
 * buttons with aria-pressed, the stepper is a real number input.
 */

import { useEffect, useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIP = "min-w-14 rounded-xl border-2 px-4 py-2 font-ui text-base font-bold tabular-nums transition-colors";
const ON = "border-go bg-go/10 text-foreground";
const OFF = "border-border text-muted-foreground hover:border-foreground/40";

/** One of a few: a row of chips, one pressed. */
export function Chips<T extends string | number>({
	items,
	value,
	onPick,
	label,
	testid,
}: {
	items: ReadonlyArray<{ id: T; title: string; hint?: string }>;
	value: T | null;
	onPick: (v: T) => void;
	label: string;
	testid?: string;
}) {
	return (
		<div className="flex flex-wrap gap-2" role="group" aria-label={label} data-testid={testid}>
			{items.map((it) => (
				<button key={String(it.id)} type="button" aria-pressed={it.id === value} title={it.hint} onClick={() => onPick(it.id)} className={cn(CHIP, it.id === value ? ON : OFF)} data-testid={testid ? `${testid}-${it.id}` : undefined}>
					{it.title}
				</button>
			))}
		</div>
	);
}

/**
 * A number with quick picks and free entry: the chips for the usual
 * values, a stepper for anything else (a power learner's three hours a
 * day is a real plan, not an outlier — the cap is 600 minutes). The
 * stepper's field is the app's own input; − and + move by `step`.
 */
export function NumberPicker({
	value,
	onChange,
	quick,
	min,
	max,
	step,
	unit,
	label,
	testid,
}: {
	value: number;
	onChange: (v: number) => void;
	quick: readonly number[];
	min: number;
	max: number;
	step: number;
	unit: string;
	label: string;
	testid?: string;
}) {
	const [text, setText] = useState(String(value));
	useEffect(() => setText(String(value)), [value]);
	const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
	const commit = (raw: string) => {
		const n = Number(raw.replace(",", "."));
		if (Number.isFinite(n) && raw.trim() !== "") onChange(clamp(n));
		else setText(String(value));
	};
	const custom = !quick.includes(value);
	return (
		<div className="flex flex-wrap items-center gap-2" role="group" aria-label={label} data-testid={testid}>
			{quick.map((q) => (
				<button key={q} type="button" aria-pressed={value === q} onClick={() => onChange(q)} className={cn(CHIP, value === q ? ON : OFF)} data-testid={testid ? `${testid}-${q}` : undefined}>
					{q}
				</button>
			))}
			<div className={cn("flex items-center rounded-xl border-2", custom ? "border-go bg-go/10" : "border-border")} data-testid={testid ? `${testid}-custom` : undefined}>
				<button type="button" aria-label={`Less ${unit}`} onClick={() => onChange(clamp(value - step))} className="flex size-10 items-center justify-center rounded-l-[10px] text-muted-foreground hover:bg-accent hover:text-foreground">
					<MinusIcon className="size-4" />
				</button>
				<input
					type="number"
					inputMode="numeric"
					min={min}
					max={max}
					step={step}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onBlur={(e) => commit(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit((e.target as HTMLInputElement).value))}
					aria-label={`${label}, any number`}
					className="w-16 bg-transparent text-center font-ui text-base font-bold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
				<span className="pr-1 font-ui text-xs text-muted-foreground">{unit}</span>
				<button type="button" aria-label={`More ${unit}`} onClick={() => onChange(clamp(value + step))} className="flex size-10 items-center justify-center rounded-r-[10px] text-muted-foreground hover:bg-accent hover:text-foreground">
					<PlusIcon className="size-4" />
				</button>
			</div>
		</div>
	);
}
