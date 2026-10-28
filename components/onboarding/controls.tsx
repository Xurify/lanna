"use client";

/**
 * The setup's own controls (LangHarness onboarding, 2026-10-28): chips for
 * a short choice, a stepper for a number. No native <select>: the app's
 * surfaces are its own (Xurify, 2026-10-28), and a select's popup is the
 * browser's, not ours. Everything is keyboard-reachable: chips are
 * buttons with aria-pressed, the stepper is a real number input.
 */

import { useEffect, useState } from "react";
import { CheckIcon, MinusIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_LANG_LEVEL, KNOWN_LANGUAGES, LANG_LEVELS, languageName, MAX_LANGUAGES, normalizeLangLevel, type Lang, type LangLevel } from "@/src/core";

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
 * The languages the learner knows. Twenty as chips (the catalogue's
 * `primary` ones), any number pressed; everything else behind "More
 * languages", a searchable panel of the app's own (no native select, no
 * free text: Xurify, 2026-10-28). A chosen language from the panel joins
 * the chip row. Under the row, one line per chosen language says how well
 * it is known, three taps wide, so "know" has a meaning: a bit, comfortable,
 * fluent.
 */
export function LanguagePicker({
	value,
	levels,
	onChange,
	testid = "languages",
}: {
	value: readonly Lang[];
	levels: Readonly<Partial<Record<Lang, LangLevel>>>;
	onChange: (langs: Lang[], levels: Partial<Record<Lang, LangLevel>>) => void;
	testid?: string;
}) {
	// The panel works on a copy: nothing outside it (the chip row, the level
	// rows, the explanation chips) moves until it closes, so the panel never
	// slides out from under the pointer (Xurify: content shift on every pick).
	const [pending, setPending] = useState<Lang[] | null>(null);
	const [query, setQuery] = useState("");
	const more = pending !== null;
	const chosen = pending ?? value;
	const prune = (langs: readonly Lang[]) => {
		const next: Partial<Record<Lang, LangLevel>> = {};
		for (const l of langs) if (levels[l]) next[l] = levels[l];
		return next;
	};
	const toggle = (id: Lang) => {
		if (value.includes(id)) return onChange(value.filter((l) => l !== id), prune(value.filter((l) => l !== id)));
		if (value.length >= MAX_LANGUAGES) return;
		onChange([...value, id], { ...levels });
	};
	const togglePending = (id: Lang) => setPending((p) => (p ? (p.includes(id) ? p.filter((l) => l !== id) : p.length >= MAX_LANGUAGES ? p : [...p, id]) : p));
	const setLevel = (id: Lang, level: LangLevel) => onChange([...value], { ...levels, [id]: level });
	const open = () => (setQuery(""), setPending([...value]));
	const close = () => {
		if (pending && (pending.length !== value.length || pending.some((l, i) => value[i] !== l))) onChange(pending, prune(pending));
		setPending(null);
		setQuery("");
	};
	const shown = KNOWN_LANGUAGES.filter((l) => l.primary || value.includes(l.id));
	const q = query.trim().toLowerCase();
	const found = KNOWN_LANGUAGES.filter((l) => (q ? l.title.toLowerCase().includes(q) : !l.primary));
	const added = pending ? pending.filter((l) => !value.includes(l)).length : 0;
	return (
		<div data-testid={testid}>
			<div className="flex flex-wrap gap-2" role="group" aria-label="Languages you know">
				{shown.map((l) => {
					const on = value.includes(l.id);
					return (
						<button key={l.id} type="button" aria-pressed={on} title={l.line} onClick={() => toggle(l.id)} className={cn(CHIP, "min-w-0 px-3.5 py-1.5 text-sm", on ? ON : OFF)} data-testid={`${testid}-${l.id}`}>
							{l.title}
						</button>
					);
				})}
				<span className="relative">
					<button type="button" aria-expanded={more} onClick={() => (more ? close() : open())} className={cn(CHIP, OFF, "min-w-0 border-dashed px-3.5 py-1.5 text-sm", more && "border-foreground/40 text-foreground")} data-testid={`${testid}-more`}>
						<SearchIcon className="-ml-0.5 mr-1.5 inline size-3.5" />
						More languages
					</button>
					{more && (
						<>
							<div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
							<div className="absolute left-0 top-full z-20 mt-2 w-[22rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card p-3 shadow-xl" role="dialog" aria-label="More languages" data-testid={`${testid}-panel`}>
								<input
									autoFocus
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Escape") (e.preventDefault(), close());
										if (e.key === "Enter" && found[0]) (e.preventDefault(), togglePending(found[0].id));
									}}
									placeholder="Search languages"
									aria-label="Search languages"
									className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 font-ui text-sm font-bold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-go"
									data-testid={`${testid}-search`}
								/>
								<div className="mt-2 grid max-h-64 grid-cols-2 gap-1 overflow-y-auto pr-1">
									{found.map((l) => {
										const on = chosen.includes(l.id);
										return (
											<button key={l.id} type="button" aria-pressed={on} title={l.line} onClick={() => togglePending(l.id)} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-ui text-sm font-bold transition-colors", on ? "bg-go/10 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")} data-testid={`${testid}-pick-${l.id}`}>
												<span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-go bg-go text-go-ink" : "border-border")}>{on && <CheckIcon className="size-3" strokeWidth={3} />}</span>
												{l.title}
											</button>
										);
									})}
									{found.length === 0 && <p className="col-span-2 px-2 py-3 font-prose text-sm text-muted-foreground">Nothing by that name. Pick the nearest relative; the tutor adapts.</p>}
								</div>
								<div className="mt-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2">
									<span className="font-ui text-xs text-muted-foreground" aria-live="polite">
										{added === 0 ? "Pick as many as you like" : `${added} to add`}
									</span>
									<button type="button" onClick={close} className="rounded-lg bg-go px-3 py-1.5 font-ui text-xs font-extrabold text-go-ink hover:brightness-110" data-testid={`${testid}-done`}>
										Done
									</button>
								</div>
							</div>
						</>
					)}
				</span>
			</div>
			{value.length > 0 && (
				<div className="mt-4 flex flex-col gap-1.5" data-testid={`${testid}-levels`}>
					{value.map((id) => {
						const level = normalizeLangLevel(levels[id]) ?? DEFAULT_LANG_LEVEL; // a profile from before may still say "fluent"
						return (
							<div key={id} className="flex items-center gap-2" data-testid={`level-${id}`}>
								<span className="w-28 shrink-0 truncate font-ui text-sm font-bold text-foreground">{languageName(id)}</span>
								<span className="flex shrink-0 gap-1" role="group" aria-label={`Your level in ${languageName(id)}, on the CEFR`}>
									{LANG_LEVELS.map((lv) => (
										<button key={lv.id} type="button" aria-pressed={lv.id === level} title={lv.line} onClick={() => setLevel(id, lv.id)} className={cn("whitespace-nowrap rounded-lg border-2 py-1 font-ui text-xs font-bold tabular-nums transition-colors", lv.id === "native" ? "px-2.5" : "px-2", lv.id === level ? ON : OFF)} data-testid={`level-${id}-${lv.id}`}>
											{lv.title}
										</button>
									))}
								</span>
								<button type="button" aria-label={`Remove ${languageName(id)}`} onClick={() => toggle(id)} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
									<XIcon className="size-3.5" />
								</button>
							</div>
						);
					})}
				</div>
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
