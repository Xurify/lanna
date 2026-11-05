"use client";

/**
 * Setup controls: chips for a short choice, a stepper for a number. No native
 * <select>, since its popup is styled by the browser. Chips are buttons with
 * aria-pressed, and the stepper is a real number input.
 */

import { useEffect, useRef, useState } from "react";
import { CheckIcon, MinusIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuShell, type MenuAlign } from "@/components/menu-shell";
import { CountryFlag } from "@/components/ui/country-flag";
import { KNOWN_LANGUAGES, LANG_LEVELS, languageName, MAX_LANGUAGES, normalizeLangLevel, type Lang, type LangLevel } from "@/src/core";

const CHIP = "min-w-14 rounded-xl border px-4 py-2 font-ui text-base font-semibold tabular-nums transition-colors";
const ON = "border-primary/80 bg-primary/15 text-primary shadow-xs font-semibold";
const OFF = "border-border/80 bg-accent/20 text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground";
const PANEL = "flex w-[22rem] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border border-border bg-card p-3 shadow-xl";

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

/** Quick-pick chips plus a free-entry stepper for values outside the quick list. − and + move by `step`. */
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
	return (
		<div className="flex flex-wrap items-center gap-2" role="group" aria-label={label} data-testid={testid}>
			{quick.map((q) => (
				<button key={q} type="button" aria-pressed={value === q} onClick={() => onChange(q)} className={cn(CHIP, value === q ? ON : OFF)} data-testid={testid ? `${testid}-${q}` : undefined}>
					{q}
				</button>
			))}
			<div className="flex items-center rounded-xl border-2 border-border focus-within:border-go" data-testid={testid ? `${testid}-custom` : undefined}>
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
					className="w-16 bg-transparent text-center font-ui text-base font-semibold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
 * Languages the learner knows: the primary ones as chips, the rest in a
 * searchable "More languages" panel. A language picked in the panel joins the
 * chip row. Each chosen language gets a three-step level row (CEFR).
 */
export function LanguagePicker({
	value,
	levels,
	onChange,
	exclude,
	testid = "languages",
}: {
	value: readonly Lang[];
	/** The language being learned (ISO 639-1): not one the learner "knows". */
	exclude?: string;
	levels: Readonly<Partial<Record<Lang, LangLevel>>>;
	onChange: (langs: Lang[], levels: Partial<Record<Lang, LangLevel>>) => void;
	testid?: string;
}) {
	// The panel edits a copy, so the chip row and level rows stay put until it closes.
	const [pending, setPending] = useState<Lang[] | null>(null);
	const [query, setQuery] = useState("");
	const [align, setAlign] = useState<MenuAlign>("right");
	const more = pending !== null;
	const anchor = useRef<HTMLSpanElement>(null);
	const chosen = pending ?? value;
	// A language has a level only once the learner presses one. Until then the tutor reads DEFAULT_LANG_LEVEL.
	const levelsFor = (langs: readonly Lang[]) => {
		const next: Partial<Record<Lang, LangLevel>> = {};
		for (const l of langs) if (levels[l]) next[l] = levels[l];
		return next;
	};
	const toggle = (id: Lang) => {
		if (value.includes(id)) return onChange(value.filter((l) => l !== id), levelsFor(value.filter((l) => l !== id)));
		if (value.length >= MAX_LANGUAGES) return;
		onChange([...value, id], levelsFor([...value, id]));
	};
	const togglePending = (id: Lang) => setPending((p) => (p ? (p.includes(id) ? p.filter((l) => l !== id) : p.length >= MAX_LANGUAGES ? p : [...p, id]) : p));
	const setLevel = (id: Lang, level: LangLevel) => onChange([...value], { ...levels, [id]: level });
	// The panel lines up with the More button on the side that has room: the button sits at the end of a wrapping row.
	const open = () => {
		const rect = anchor.current?.getBoundingClientRect();
		setAlign(rect && rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right");
		setQuery("");
		setPending([...value]);
	};
	const close = () => {
		if (pending && (pending.length !== value.length || pending.some((l, i) => value[i] !== l))) onChange(pending, levelsFor(pending));
		setPending(null);
		setQuery("");
	};
	// Close on a press outside the chip and panel, or on Escape. A backdrop element
	// can't do this: the step's transform pins a fixed child to the form column.
	// The panel is portaled (MenuShell), so a press inside it is matched by test id.
	useEffect(() => {
		if (!more) return;
		const onDown = (e: PointerEvent) => {
			const target = e.target as Node;
			const panel = document.querySelector(`[data-testid="${testid}-panel"]`);
			if (!anchor.current?.contains(target) && !panel?.contains(target)) close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("pointerdown", onDown, true);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onDown, true);
			document.removeEventListener("keydown", onKey);
		};
	});
	const offered = KNOWN_LANGUAGES.filter((l) => l.id !== exclude);
	const shown = offered.filter((l) => l.primary || value.includes(l.id));
	const q = query.trim().toLowerCase();
	const found = offered.filter((l) => (q ? l.title.toLowerCase().includes(q) : !l.primary));
	const added = pending ? pending.filter((l) => !value.includes(l)).length : 0;
	return (
		<div data-testid={testid}>
			<div className="flex flex-wrap gap-2" role="group" aria-label="Languages you know">
				{shown.map((l) => {
					const on = value.includes(l.id);
					return (
						<button key={l.id} type="button" aria-pressed={on} title={l.line} onClick={() => toggle(l.id)} className={cn(CHIP, "min-w-0 px-3.5 py-1.5 text-sm inline-flex items-center gap-2", on ? ON : OFF)} data-testid={`${testid}-${l.id}`}>
							<CountryFlag lang={l.id} className="w-6 h-4 rounded-[3px]" />
							<span>{l.title}</span>
						</button>
					);
				})}
				<span ref={anchor}>
					<button type="button" aria-expanded={more} onClick={() => (more ? close() : open())} className={cn(CHIP, OFF, "min-w-0 border-dashed px-3.5 py-1.5 text-sm", more && "border-foreground/40 text-foreground")} data-testid={`${testid}-more`}>
						<SearchIcon className="-ml-0.5 mr-1.5 inline size-3.5" />
						More languages
					</button>
					{more && (
						<MenuShell anchorRef={anchor} preferredSide="down" align={align} testid={`${testid}-panel`} menuClass={PANEL}>
							<div role="dialog" aria-label="More languages" className="flex min-h-0 flex-1 flex-col" onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), close())}>
								<input
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && found[0]) (e.preventDefault(), togglePending(found[0].id));
									}}
									placeholder="Search languages"
									aria-label="Search languages"
									className="w-full shrink-0 rounded-xl border-2 border-border bg-background px-3 py-2 font-ui text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-go"
									data-testid={`${testid}-search`}
								/>
								<div className="mt-2 grid max-h-64 min-h-0 flex-1 grid-cols-2 content-start gap-1 overflow-y-auto pr-1">
									{found.map((l) => {
										const on = chosen.includes(l.id);
										return (
											<button key={l.id} type="button" aria-pressed={on} title={l.line} onClick={() => togglePending(l.id)} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-ui text-sm font-semibold transition-colors", on ? "bg-go/10 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")} data-testid={`${testid}-pick-${l.id}`}>
												<span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-go bg-go text-go-ink" : "border-border")}>{on && <CheckIcon className="size-3" strokeWidth={3} />}</span>
												<CountryFlag lang={l.id} className="w-6 h-4 rounded-[3px]" />
												<span>{l.title}</span>
											</button>
										);
									})}
									{found.length === 0 && <p className="col-span-2 px-2 py-3 font-prose text-sm text-muted-foreground">Nothing by that name. Pick the nearest relative; the tutor adapts.</p>}
								</div>
								<div className="mt-2 flex shrink-0 items-center justify-between gap-3 border-t border-border/60 pt-2">
									<span className="font-ui text-xs text-muted-foreground" aria-live="polite">
										{added === 0 ? "Pick as many as you like" : `${added} to add`}
									</span>
									<button type="button" onClick={close} className="rounded-lg bg-go px-3 py-1.5 font-ui text-xs font-semibold text-go-ink hover:brightness-110" data-testid={`${testid}-done`}>
										Done
									</button>
								</div>
							</div>
						</MenuShell>
					)}
				</span>
			</div>
			{value.length > 0 && (
				<div className="mt-4 flex flex-col gap-2" data-testid={`${testid}-levels`}>
					{value.map((id) => {
						const level = normalizeLangLevel(levels[id]); // none until pressed; a profile from before may still say "fluent"
						return (
							<div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-accent/10 px-3.5 py-2.5 transition-colors" data-testid={`level-${id}`}>
								<span className="flex items-center gap-2.5 w-36 shrink-0 min-w-0">
									<CountryFlag lang={id} className="w-6 h-4 rounded-[3px]" />
									<span className="truncate font-ui text-sm font-semibold text-foreground">{languageName(id)}</span>
								</span>
								<span className="flex min-w-0 flex-wrap gap-1" role="group" aria-label={`Your level in ${languageName(id)}, on the CEFR`}>
									{LANG_LEVELS.map((lv) => (
										<button
											key={lv.id}
											type="button"
											aria-pressed={lv.id === level}
											title={lv.line}
											onClick={() => setLevel(id, lv.id)}
											className={cn(
												"whitespace-nowrap rounded-lg border py-1 font-ui text-xs tabular-nums transition-colors",
												lv.id === "native" ? "px-2.5" : "px-2",
												lv.id === level ? ON : OFF,
											)}
											data-testid={`level-${id}-${lv.id}`}
										>
											{lv.title}
										</button>
									))}
								</span>
								<div className="ml-auto flex shrink-0 items-center gap-2.5">
									{level === undefined && (
										<span className="font-ui text-xs font-medium text-sun/90" data-testid={`level-${id}-unset`}>
											Pick a level
										</span>
									)}
									<button
										type="button"
										aria-label={`Remove ${languageName(id)}`}
										onClick={() => toggle(id)}
										className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-miss"
									>
										<XIcon className="size-3.5" />
									</button>
								</div>
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
						{on && max > 1 && <span className="flex size-5 items-center justify-center rounded-full bg-go font-ui text-[11px] font-semibold text-go-ink">{at + 1}</span>}
						<CountryFlag lang={String(it.id)} className="w-6 h-4 rounded-[3px]" />
						<span>{it.title}</span>
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
