"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { baseLetter, letterFamilies, type LetterFamily } from "@/src/core";

const LATIN_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const CYRILLIC_ROWS = ["йцукенгшщзхъ", "фывапролджэ", "ячсмитьбю"];

export interface AccentMenu {
	base: string;
	held: boolean;
}

export function accentsOf(family: LetterFamily | undefined): string[] {
	return family ? family.letters.filter((letter) => letter !== family.base) : [];
}

export function AccentChoices({ accents, onPick, grab, className }: { accents: string[]; onPick: (letter: string) => void; grab: () => void; className?: string }) {
	return (
		<span role="menu" aria-label="Accents" className={cn("flex gap-1", className)} data-testid="accent-menu">
			{accents.map((letter, n) => (
				<button
					key={letter}
					type="button"
					role="menuitem"
					onPointerDown={grab}
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => onPick(letter)}
					className="relative grid h-10 min-w-11 place-items-center rounded-[9px] bg-well px-2 text-[19px] font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)] hover:bg-well-2"
				>
					<span className="absolute left-1.5 top-0.5 font-ui text-[12px] font-[550] text-ink-3">{n + 1}</span>
					{letter}
				</button>
			))}
		</span>
	);
}

export function AccentKeyboard({
	letters,
	english,
	tag,
	live,
	menu,
	onKey,
	grab,
}: {
	letters: string[];
	english: string;
	tag: string;
	live: string | null;
	menu: AccentMenu | null;
	onKey: (key: string) => void;
	grab: () => void;
}) {
	const families = useMemo(() => new Map(letterFamilies(letters, tag).map((f) => [f.base, f])), [letters, tag]);
	const rows = useMemo(() => {
		const layout = letters.some((l) => /\p{Script=Cyrillic}/u.test(l)) ? CYRILLIC_ROWS : LATIN_ROWS;
		const onKeys = new Set(layout.join(""));
		const loose = [...families.keys()].filter((base) => !onKeys.has(base));
		return loose.length ? [...layout, loose.join("")] : layout;
	}, [letters, families]);

	return (
		<div data-testid="accent-keyboard" role="group" aria-label={`${english} keyboard: hold a letter or click it for its accents`} className="flex flex-col items-start gap-1.5 font-prose">
			{rows.map((row, i) => (
				<div key={row} className="flex gap-1.5" style={{ paddingInlineStart: `${i * 14}px` }}>
					{[...row].map((key) => {
						const family = families.get(baseLetter(key, tag));
						const accents = family?.base === key ? accentsOf(family) : [];
						const open = menu?.base === key && accents.length > 0;
						const isLive = live === key && accents.length > 0;
						return (
							<div key={key} className="relative">
								<button
									type="button"
									onPointerDown={grab}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => onKey(key)}
									title={accents.length ? `${key}: ${accents.join(" ")}. Hold ${key} on your keyboard, or click here` : `Type ${key}`}
									aria-expanded={accents.length ? open : undefined}
									data-key={key}
									data-live={isLive ? "true" : undefined}
									className={cn(
										"lh-press relative grid h-10 w-11 place-items-center rounded-[9px] text-[16px] transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none",
										accents.length ? "bg-well font-medium text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)] hover:bg-well-2" : "text-ink-3 shadow-[inset_0_0_0_1px_var(--q-line)] hover:bg-well",
										(isLive || open) && "bg-teal-wash text-teal-2 shadow-[inset_0_0_0_1.5px_var(--q-teal)] hover:bg-teal-wash",
									)}
								>
									{key}
									{accents.length > 0 && <span className={cn("absolute right-1 top-0.5 text-[12px] leading-none tracking-[-0.02em]", isLive || open ? "text-teal-2" : "text-teal")}>{accents.join("")}</span>}
								</button>
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}
