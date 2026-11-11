"use client";

/**
 * The diacritic bar (LangHarness): one-click letters the learner's
 * keyboard may lack (á ä č ď … for Slovak, ё й ъ … for Russian), plus the
 * playback-speed toggle. It types into whichever text field was focused
 * last — the composer, a question's answer or thinking field, the review
 * card — so one bar serves every input above or below it. Shift-click
 * types the capital. The bar can be folded away; the choice is remembered
 * in this browser.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpeedToggle, useActiveLanguage } from "@/components/speech";
import { letterFamilies, liveFamily, pressLetter } from "@/src/core";

type Field = HTMLTextAreaElement | HTMLInputElement;

const OPEN_KEY = "lh-diacritics-open";

function isTextField(el: EventTarget | null): el is Field {
	return (
		el instanceof HTMLTextAreaElement ||
		(el instanceof HTMLInputElement && (el.type === "text" || el.type === "search" || el.type === ""))
	);
}

function fieldInUse(last: Field | null): Field | null {
	if (last?.isConnected) return last;
	return isTextField(document.activeElement) ? document.activeElement : null;
}

/** Insert text at the caret of a React-controlled field: set the value
 *  through the native setter and fire `input`, so React's onChange runs. */
export function insertAtCaret(field: Field, text: string): void {
	const start = field.selectionStart ?? field.value.length;
	const end = field.selectionEnd ?? start;
	setFieldValue(field, field.value.slice(0, start) + text + field.value.slice(end), start + text.length);
}

function setFieldValue(field: Field, value: string, caret: number): void {
	const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
	field.dispatchEvent(new Event("input", { bubbles: true }));
	field.focus();
	field.setSelectionRange(caret, caret);
}

function KeyGrid({ letters, english, tag, live, grab, press, className }: { letters: string[]; english: string; tag: string; live: string | null; grab: () => void; press: (letter: string, shift: boolean) => void; className?: string }) {
	const families = useMemo(() => letterFamilies(letters, tag), [letters, tag]);
	return (
		<div data-testid="diacritic-bar" role="group" aria-label={`${english} letters`} className={cn("flex min-w-0 flex-wrap gap-1.5 font-prose", className)}>
			{families.map((family) => {
				const on = family.base === live;
				return (
					<div
						key={family.base}
						data-family={family.base}
						data-live={on ? "true" : undefined}
						className={cn("flex rounded-[10px] transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none", on ? "bg-teal-wash shadow-[inset_0_0_0_1.5px_var(--q-teal)]" : "bg-well shadow-[inset_0_0_0_1px_var(--q-line-2)]")}
					>
						{family.letters.map((letter, i) => (
							<button
								key={letter}
								type="button"
								onPointerDown={grab}
								onMouseDown={(e) => e.preventDefault()}
								onClick={(e) => press(letter, e.shiftKey)}
								title={on ? `Change ${family.base} to ${letter}` : `Type ${letter} (Shift for ${letter.toLocaleUpperCase(tag)})`}
								className={cn(
									"lh-press flex h-10 min-w-9 items-center justify-center px-1.5 text-[17px] font-medium first:rounded-l-[10px] last:rounded-r-[10px] pointer-coarse:h-11 pointer-coarse:min-w-[42px]",
									i > 0 && "shadow-[inset_1px_0_0_var(--q-line-2)]",
									on ? "text-teal-2 hover:bg-[var(--q-teal-line)]" : "text-foreground hover:bg-well-2",
								)}
							>
								{letter}
							</button>
						))}
					</div>
				);
			})}
		</div>
	);
}

/** `keys`: the lesson's keycap row — real tap targets, no speed toggle and
 *  no fold (the lesson has its own sound control, and the letters are
 *  needed on every typed rep). */
export function DiacriticBar({ className, variant = "bar" }: { className?: string; variant?: "bar" | "keys" }) {
	const lang = useActiveLanguage();
	const lastField = useRef<Field | null>(null);
	const grabbed = useRef<{ field: Field; start: number; end: number } | null>(null);
	const [open, setOpen] = useState(true);
	const [live, setLive] = useState<string | null>(null);
	const families = useMemo(() => (lang ? letterFamilies(lang.specialLetters, lang.tag) : []), [lang]);

	useEffect(() => {
		if (variant !== "keys" || !lang) return;
		const update = () => {
			const field = fieldInUse(lastField.current);
			setLive(field ? liveFamily(families, field.value, field.selectionStart ?? 0, field.selectionEnd ?? 0, lang.tag) : null);
		};
		update();
		const events = ["selectionchange", "input", "keyup", "pointerup", "focusin"] as const;
		for (const name of events) document.addEventListener(name, update, true);
		return () => {
			for (const name of events) document.removeEventListener(name, update, true);
		};
	}, [variant, lang, families]);

	useEffect(() => {
		try {
			if (localStorage.getItem(OPEN_KEY) === "0") setOpen(false);
		} catch {
			// storage blocked — stays open
		}
		const onFocus = (e: FocusEvent) => {
			if (isTextField(e.target)) lastField.current = e.target;
		};
		document.addEventListener("focusin", onFocus);
		return () => document.removeEventListener("focusin", onFocus);
	}, []);

	const toggle = () => {
		setOpen((o) => {
			try {
				localStorage.setItem(OPEN_KEY, o ? "0" : "1");
			} catch {
				// not remembered
			}
			return !o;
		});
	};

	if (!lang) return null;
	const type = (letter: string, upper: boolean) => {
		const target = fieldInUse(lastField.current);
		if (!target) return;
		insertAtCaret(target, upper ? letter.toLocaleUpperCase(lang.tag) : letter);
	};
	// A tap moves the caret of an input to its start between pointerdown and click in Chrome on touch screens, so the caret is read on pointerdown.
	const grab = () => {
		const field = fieldInUse(lastField.current);
		grabbed.current = field ? { field, start: field.selectionStart ?? field.value.length, end: field.selectionEnd ?? field.value.length } : null;
	};
	const press = (letter: string, shift: boolean) => {
		const target = fieldInUse(lastField.current);
		if (!target) return;
		const held = grabbed.current?.field === target ? grabbed.current : null;
		grabbed.current = null;
		const start = held?.start ?? target.selectionStart ?? target.value.length;
		const end = held?.end ?? target.selectionEnd ?? start;
		const next = pressLetter(target.value, start, end, letter, shift, lang.tag);
		setFieldValue(target, next.value, next.caret);
	};

	if (variant === "keys") {
		return <KeyGrid letters={lang.specialLetters} english={lang.english} tag={lang.tag} live={live} grab={grab} press={press} className={className} />;
	}

	return (
		<div
			data-testid="diacritic-bar"
			// On a phone the strip is wider than the card: it starts at the left
			// and scrolls sideways (justify-end would push the first letters off-screen).
			className={cn("pointer-events-auto flex items-center justify-start gap-0.5 overflow-x-auto px-1 pb-1 font-ui sm:justify-end", className)}
			aria-label={`${lang.english} letters`}
		>
			{open &&
				lang.specialLetters.map((letter) => (
					<button
						key={letter}
						type="button"
						// Keep focus (and the caret) in the field being typed into.
						onMouseDown={(e) => e.preventDefault()}
						onClick={(e) => type(letter, e.shiftKey)}
						title={`Type ${letter} (Shift for ${letter.toLocaleUpperCase(lang.tag)})`}
						className="min-w-6 shrink-0 rounded-sm px-1 py-0.5 text-sm text-ink-3 transition-colors hover:bg-well hover:text-ink-2"
					>
						{letter}
					</button>
				))}
			{open && <SpeedToggle className="ml-1" />}
			<button
				type="button"
				onMouseDown={(e) => e.preventDefault()}
				onClick={toggle}
				aria-label={open ? "Hide letter bar" : "Show letter bar"}
				title={open ? "Hide letter bar" : `${lang.english} letters`}
				className="ml-0.5 flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] text-ink-3 transition-colors hover:bg-well hover:text-ink-2"
			>
				{open ? <ChevronDownIcon className="size-3" /> : <>{lang.specialLetters.slice(0, 3).join(" ")} <ChevronUpIcon className="size-3" /></>}
			</button>
		</div>
	);
}
