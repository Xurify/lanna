"use client";

/**
 * The setup's own controls (LangHarness onboarding, 2026-10-28): chips for
 * a short choice, a stepper for a number. No native <select>: the app's
 * surfaces are its own (Xurify, 2026-10-28), and a select's popup is the
 * browser's, not ours. Everything is keyboard-reachable: chips are
 * buttons with aria-pressed, the stepper is a real number input.
 */

import { useEffect, useState } from "react";
import { CheckIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KNOWN_LANGUAGES, languageName, MAX_OTHER_LANGUAGE_LENGTH, MAX_OTHER_LANGUAGES, type Lang } from "@/src/core";

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

/**
 * The languages the learner knows: every catalogue language as a chip
 * (any number pressed), the learner's own entries as chips with a ×, and
 * an "Another…" chip that opens a field for a language the catalogue
 * lacks. Xurify (2026-10-28): knowing a language is a bridge, so this is
 * a multi-pick and not limited to Slavic ones.
 */
export function LanguagePicker({
	value,
	other,
	onChange,
	testid = "languages",
}: {
	value: readonly Lang[];
	other: readonly string[];
	onChange: (langs: Lang[], other: string[]) => void;
	testid?: string;
}) {
	const [adding, setAdding] = useState(false);
	const [text, setText] = useState("");
	const toggle = (id: Lang) => onChange(value.includes(id) ? value.filter((l) => l !== id) : [...value, id], [...other]);
	const commit = () => {
		const name = text.trim().slice(0, MAX_OTHER_LANGUAGE_LENGTH);
		setText("");
		setAdding(false);
		if (!name || other.some((o) => o.toLowerCase() === name.toLowerCase())) return;
		// A catalogue language typed by name is pressed, not duplicated.
		const known = KNOWN_LANGUAGES.find((l) => l.title.toLowerCase() === name.toLowerCase());
		if (known) return onChange(value.includes(known.id) ? [...value] : [...value, known.id], [...other]);
		onChange([...value], [...other, name].slice(0, MAX_OTHER_LANGUAGES));
	};
	return (
		<div className="flex flex-wrap gap-2" role="group" aria-label="Languages you know" data-testid={testid}>
			{KNOWN_LANGUAGES.map((l) => {
				const on = value.includes(l.id);
				return (
					<button key={l.id} type="button" aria-pressed={on} title={l.line} onClick={() => toggle(l.id)} className={cn(CHIP, "min-w-0 px-3.5 py-1.5 text-sm", on ? ON : OFF)} data-testid={`${testid}-${l.id}`}>
						{l.title}
					</button>
				);
			})}
			{other.map((name) => (
				<span key={name} className={cn(CHIP, ON, "inline-flex min-w-0 items-center gap-1 py-1.5 pl-3.5 pr-1.5 text-sm")} data-testid={`${testid}-other`}>
					{name}
					<button type="button" aria-label={`Remove ${name}`} onClick={() => onChange([...value], other.filter((o) => o !== name))} className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
						<XIcon className="size-3.5" />
					</button>
				</span>
			))}
			{adding ? (
				<span className="inline-flex items-center rounded-xl border-2 border-go bg-go/10 pl-3">
					<input
						autoFocus
						value={text}
						maxLength={MAX_OTHER_LANGUAGE_LENGTH}
						placeholder="Which language?"
						onChange={(e) => setText(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === "Enter") (e.preventDefault(), commit());
							if (e.key === "Escape") (setText(""), setAdding(false));
						}}
						aria-label="Another language"
						className="w-36 bg-transparent font-ui text-sm font-bold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
						data-testid={`${testid}-input`}
					/>
					<button type="button" aria-label="Add language" onMouseDown={(e) => e.preventDefault()} onClick={commit} className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground">
						<CheckIcon className="size-4" />
					</button>
				</span>
			) : (
				<button type="button" onClick={() => setAdding(true)} className={cn(CHIP, OFF, "min-w-0 border-dashed px-3.5 py-1.5 text-sm")} data-testid={`${testid}-add`}>
					<PlusIcon className="-ml-0.5 mr-1 inline size-3.5" />
					Another…
				</button>
			)}
		</div>
	);
}

/**
 * Up to `max` of a few, in the order pressed: the first chip wears "1",
 * the second "2". Pressing a third when full replaces the last one;
 * pressing a chosen chip drops it. Never empty: `fallback` is chosen when
 * the last one goes.
 */
export function PickSome<T extends string>({
	items,
	value,
	onChange,
	max,
	fallback,
	label,
	testid,
}: {
	items: ReadonlyArray<{ id: T; title: string; hint?: string }>;
	value: readonly T[];
	onChange: (v: T[]) => void;
	max: number;
	fallback: T;
	label: string;
	testid?: string;
}) {
	const pick = (id: T) => {
		if (value.includes(id)) {
			const rest = value.filter((v) => v !== id);
			return onChange(rest.length ? rest : [fallback]);
		}
		const kept = value.length >= max ? value.slice(0, max - 1) : [...value];
		onChange([...kept, id]);
	};
	return (
		<div className="flex flex-wrap gap-2" role="group" aria-label={label} data-testid={testid}>
			{items.map((it) => {
				const at = value.indexOf(it.id);
				const on = at >= 0;
				return (
					<button key={String(it.id)} type="button" aria-pressed={on} title={it.hint} onClick={() => pick(it.id)} className={cn(CHIP, "inline-flex items-center gap-2", on ? ON : OFF)} data-testid={testid ? `${testid}-${it.id}` : undefined}>
						{on && max > 1 && <span className="flex size-5 items-center justify-center rounded-full bg-go font-ui text-[11px] font-black text-go-ink">{at + 1}</span>}
						{it.title}
					</button>
				);
			})}
		</div>
	);
}

/** The explanation language: English, or any language picked above. */
export function explainChoices(langs: readonly Lang[]): Array<{ id: Lang; title: string }> {
	return [{ id: "en" as Lang, title: "English" }, ...langs.filter((l) => l !== "en").map((l) => ({ id: l, title: languageName(l) }))];
}
