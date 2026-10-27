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

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpeedToggle, useActiveLanguage } from "@/components/speech";

type Field = HTMLTextAreaElement | HTMLInputElement;

const OPEN_KEY = "lh-diacritics-open";

function isTextField(el: EventTarget | null): el is Field {
	return (
		el instanceof HTMLTextAreaElement ||
		(el instanceof HTMLInputElement && (el.type === "text" || el.type === "search" || el.type === ""))
	);
}

/** Insert text at the caret of a React-controlled field: set the value
 *  through the native setter and fire `input`, so React's onChange runs. */
export function insertAtCaret(field: Field, text: string): void {
	const start = field.selectionStart ?? field.value.length;
	const end = field.selectionEnd ?? start;
	const next = field.value.slice(0, start) + text + field.value.slice(end);
	const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, next);
	field.dispatchEvent(new Event("input", { bubbles: true }));
	const caret = start + text.length;
	field.focus();
	field.setSelectionRange(caret, caret);
}

/** `keys`: the lesson's keycap row — real tap targets, no speed toggle and
 *  no fold (the lesson has its own sound control, and the letters are
 *  needed on every typed rep). */
export function DiacriticBar({ className, variant = "bar" }: { className?: string; variant?: "bar" | "keys" }) {
	const lang = useActiveLanguage();
	const lastField = useRef<Field | null>(null);
	const [open, setOpen] = useState(true);

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
		const field = lastField.current?.isConnected ? lastField.current : null;
		const target = field ?? (isTextField(document.activeElement) ? document.activeElement : null);
		if (!target) return;
		insertAtCaret(target, upper ? letter.toLocaleUpperCase(lang.tag) : letter);
	};

	if (variant === "keys") {
		return (
			<div data-testid="diacritic-bar" className={cn("flex flex-wrap gap-1.5 font-prose", className)} aria-label={`${lang.english} letters`}>
				{lang.specialLetters.map((letter) => (
					<button
						key={letter}
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={(e) => type(letter, e.shiftKey)}
						title={`Type ${letter} (Shift for ${letter.toLocaleUpperCase(lang.tag)})`}
						className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-lg text-foreground transition-colors hover:border-foreground/40 hover:bg-accent active:bg-background"
					>
						{letter}
					</button>
				))}
			</div>
		);
	}

	return (
		<div
			data-testid="diacritic-bar"
			className={cn("pointer-events-auto flex items-center justify-end gap-0.5 px-1 pb-1 font-ui", className)}
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
						className="min-w-6 rounded-sm px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
				className="ml-0.5 flex items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
			>
				{open ? <ChevronDownIcon className="size-3" /> : <>{lang.specialLetters.slice(0, 3).join(" ")} <ChevronUpIcon className="size-3" /></>}
			</button>
		</div>
	);
}
