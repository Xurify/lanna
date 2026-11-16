"use client";

/**
 * Split the day across languages: the minutes for today and each
 * language's share of them. Saving writes each language's minutes a day
 * (PUT /api/day), which its plan, pace and estimates read.
 */

import { useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/country-flag";
import { minutesFromShares, sharesFromMinutes, type LanguageDay } from "@/src/core";

const MIN_TOTAL = 15;
const MAX_TOTAL = 600;

export function DaySplit({
	day,
	onSaved,
	onCancel,
}: {
	day: LanguageDay;
	onSaved: (next: LanguageDay) => void;
	onCancel: () => void;
}) {
	const [total, setTotal] = useState(Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, day.minutes)));
	const [shares, setShares] = useState(() => sharesFromMinutes(day.languages));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const minutes = minutesFromShares(total, shares);
	const sum = Object.values(shares).reduce((n, v) => n + v, 0);

	const save = async () => {
		setBusy(true);
		setError(null);
		const res = await fetch(`/api/day?tz=${new Date().getTimezoneOffset()}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ minutes }),
		}).catch(() => null);
		if (!res?.ok) {
			setError("Could not save the split. Check that Lanna is still running.");
			setBusy(false);
			return;
		}
		onSaved((await res.json()) as LanguageDay);
	};

	return (
		<div className="mb-4 rounded-[12px] bg-well p-4" data-testid="day-split">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-[14px] font-[550] text-foreground">Minutes a day</p>
				<Stepper
					value={total}
					onChange={setTotal}
					min={MIN_TOTAL}
					max={MAX_TOTAL}
					step={15}
					unit="min"
					label="Minutes a day"
					testid="day-split-total"
				/>
			</div>
			<ul className="mt-3 flex flex-col divide-y divide-[var(--q-line)]" aria-label="Each language's share">
				{day.languages.map((l) => (
					<li key={l.id} className="flex flex-wrap items-center gap-3 py-2.5" data-testid={`day-split-${l.id}`}>
						<CountryFlag lang={l.id} />
						<span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
							{l.endonym} <span className="text-ink-3">{l.english !== l.endonym ? l.english : ""}</span>
						</span>
						<Stepper
							value={shares[l.id] ?? 0}
							onChange={(v) => setShares((s) => ({ ...s, [l.id]: v }))}
							min={5}
							max={100}
							step={5}
							unit="%"
							label={`${l.english}'s share`}
							testid={`day-split-share-${l.id}`}
						/>
						<span
							className="q-num w-16 shrink-0 text-right text-[13px] text-ink-2"
							data-testid={`day-split-minutes-${l.id}`}
						>
							{minutes[l.id]} min
						</span>
					</li>
				))}
			</ul>
			<p className="mt-2 text-[12.5px] text-ink-3" aria-live="polite">
				{sum === 100
					? "Each language's plan, pace and dates follow its minutes."
					: `The shares add up to ${sum}%, so each language gets its part of ${total} min.`}
			</p>
			{error && (
				<p className="mt-2 text-[13px] text-[var(--q-miss)]" role="alert">
					{error}
				</p>
			)}
			<div className="mt-3 flex justify-end gap-2">
				<button type="button" className="q-btn ghost" onClick={onCancel}>
					Cancel
				</button>
				<button
					type="button"
					className="q-btn primary"
					onClick={() => void save()}
					disabled={busy}
					data-testid="day-split-save"
				>
					Save the split
				</button>
			</div>
		</div>
	);
}

function Stepper({
	value,
	onChange,
	min,
	max,
	step,
	unit,
	label,
	testid,
}: {
	value: number;
	onChange: (v: number) => void;
	min: number;
	max: number;
	step: number;
	unit: string;
	label: string;
	testid?: string;
}) {
	const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
	const btn =
		"grid size-9 place-items-center text-ink-3 transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-ink-3 pointer-coarse:size-11";
	return (
		<div
			role="group"
			aria-label={label}
			className="flex items-center rounded-[9px] bg-card ring-1 ring-[var(--q-line-2)]"
			data-testid={testid}
		>
			<button
				type="button"
				aria-label={`Less, ${label}`}
				className={cn(btn, "rounded-l-[9px]")}
				disabled={value <= min}
				onClick={() => set(value - step)}
			>
				<MinusIcon className="size-4" />
			</button>
			<span className="q-num min-w-[64px] text-center text-[14px] font-[550] text-foreground" aria-live="polite">
				{value}
				{unit === "%" ? "%" : ` ${unit}`}
			</span>
			<button
				type="button"
				aria-label={`More, ${label}`}
				className={cn(btn, "rounded-r-[9px]")}
				disabled={value >= max}
				onClick={() => set(value + step)}
			>
				<PlusIcon className="size-4" />
			</button>
		</div>
	);
}
