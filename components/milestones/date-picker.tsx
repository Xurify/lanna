"use client";

/**
 * The day of a scene with a date (LangHarness, 2026-11-05): five quick
 * choices, then a month and year stepper for any other day. The stepper holds
 * the day it starts from and clamps it to the month's length, so the 31st
 * becomes the 28th or 29th in February. The chosen date is said in words under
 * the controls. Custom buttons only, no native date input (E4); the chips and
 * arrows reach 44 px on a touch screen (E20).
 */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	DATED_CHOICES,
	dateForChoice,
	dateInWords,
	daysLeftWords,
	datedDateProblem,
	isoAddMonths,
	isoAddYears,
	isoDaysBetween,
} from "@/src/core";

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function DatePicker({
	value,
	today,
	onChange,
}: {
	value: string | null;
	today: string;
	onChange: (iso: string) => void;
}) {
	// With nothing chosen, the steppers start from today, so one step is the next month.
	const shown = value ?? today;
	const allowed = (iso: string) => (datedDateProblem(iso, today) === null ? iso : null);
	const prevMonth = allowed(isoAddMonths(shown, -1));
	const nextMonth = allowed(isoAddMonths(shown, 1));
	const prevYear = allowed(isoAddYears(shown, -1));
	const nextYear = allowed(isoAddYears(shown, 1));
	return (
		<div className="flex flex-col gap-3" data-testid="date-picker">
			<div role="group" aria-label="Quick choices" className="flex flex-wrap gap-2">
				{DATED_CHOICES.map((c) => {
					const iso = dateForChoice(c.id, today);
					const on = value === iso;
					return (
						<button
							key={c.id}
							type="button"
							aria-pressed={on}
							onClick={() => onChange(iso)}
							className={cn("q-btn sec pointer-coarse:h-11", on && "t")}
							data-testid={`date-choice-${c.id}`}
						>
							{c.label}
						</button>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<span className="w-full font-ui text-xs text-muted-foreground sm:w-auto">Or another month</span>
				<Stepper
					label="month"
					text={MONTHS[Number(shown.slice(5, 7)) - 1]!}
					width="w-24"
					prev={prevMonth}
					next={nextMonth}
					onChange={onChange}
				/>
				<Stepper
					label="year"
					text={shown.slice(0, 4)}
					width="w-14"
					prev={prevYear}
					next={nextYear}
					onChange={onChange}
				/>
			</div>
			<p aria-live="polite" className="min-h-6 font-ui text-sm text-foreground" data-testid="date-words">
				{value
					? `${dateInWords(value)} · ${daysLeftWords(isoDaysBetween(today, value))}`
					: "Pick a day above, or a month and year."}
			</p>
		</div>
	);
}

const ARROW =
	"inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-well disabled:opacity-40 pointer-coarse:size-11";

function Stepper({
	label,
	text,
	width,
	prev,
	next,
	onChange,
}: {
	label: string;
	text: string;
	width: string;
	prev: string | null;
	next: string | null;
	onChange: (iso: string) => void;
}) {
	return (
		<div
			role="group"
			aria-label={label}
			className="inline-flex items-center rounded-lg bg-card p-0.5 shadow-[0_0_0_1px_var(--q-line-2)]"
		>
			<button
				type="button"
				aria-label={`Previous ${label}`}
				disabled={prev === null}
				onClick={() => {
					if (prev) onChange(prev);
				}}
				className={ARROW}
			>
				<ChevronLeftIcon className="size-4" />
			</button>
			<span className={cn("text-center font-ui text-sm font-semibold tabular-nums text-foreground", width)}>
				{text}
			</span>
			<button
				type="button"
				aria-label={`Next ${label}`}
				disabled={next === null}
				onClick={() => {
					if (next) onChange(next);
				}}
				className={ARROW}
			>
				<ChevronRightIcon className="size-4" />
			</button>
		</div>
	);
}
