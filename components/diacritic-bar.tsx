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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const KEY_PX = 40; // h-10: a key is never narrower than it is tall
const KEY_GAP_PX = 8; // gap-2

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The fewest even rows whose keys all fit `width`: never a lone key on a
 *  last row, never wider than the card. Measured on the grid itself because
 *  the card is narrower than the page, so a viewport breakpoint overflows. */
function columnsFor(count: number, width: number): number {
	const fit = Math.max(1, Math.floor((width + KEY_GAP_PX) / (KEY_PX + KEY_GAP_PX)));
	return Math.ceil(count / Math.ceil(count / fit));
}

function KeyGrid({ letters, english, tag, type, className }: { letters: string[]; english: string; tag: string; type: (letter: string, upper: boolean) => void; className?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const [cols, setCols] = useState(() => Math.ceil(letters.length / 2));

	useIsoLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => setCols(columnsFor(letters.length, el.clientWidth));
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [letters.length]);

	return (
		<div
			ref={ref}
			data-testid="diacritic-bar"
			// min-w-0: beside a button in a flex row, the keys' own minimum must not stop the grid shrinking.
			className={cn("grid min-w-0 gap-2 font-prose", className)}
			style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
			aria-label={`${english} letters`}
		>
			{letters.map((letter) => (
				<button
					key={letter}
					type="button"
					onMouseDown={(e) => e.preventDefault()}
					onClick={(e) => type(letter, e.shiftKey)}
					title={`Type ${letter} (Shift for ${letter.toLocaleUpperCase(tag)})`}
					className="lh-press flex h-10 min-w-0 items-center justify-center rounded-lg bg-well-2 text-lg font-medium text-foreground shadow-[0_0_0_1px_var(--q-line-2),0_2px_0_var(--q-line-2)] hover:bg-well active:shadow-[0_0_0_1px_var(--q-line-2)]"
				>
					{letter}
				</button>
			))}
		</div>
	);
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
		return <KeyGrid letters={lang.specialLetters} english={lang.english} tag={lang.tag} type={type} className={className} />;
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
