"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A custom single-choice menu (the app uses no native select: its popup is drawn by the browser). */
export function ChoiceMenu({
	value,
	options,
	onChange,
	ariaLabel,
	className,
	quiet = false,
	align = "start",
}: {
	value: string;
	options: readonly { value: string; label: string }[];
	onChange: (next: string) => void;
	ariaLabel: string;
	className?: string;
	quiet?: boolean;
	align?: "start" | "end";
}) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const away = (e: PointerEvent) => {
			if (!root.current?.contains(e.target as Node)) setOpen(false);
		};
		const esc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", away);
		document.addEventListener("keydown", esc, true);
		return () => {
			document.removeEventListener("pointerdown", away);
			document.removeEventListener("keydown", esc, true);
		};
	}, [open]);
	const current = options.find((o) => o.value === value) ?? options[0];
	return (
		<div ref={root} className={cn("relative", className)}>
			<button
				type="button"
				aria-label={`${ariaLabel}: ${current?.label ?? ""}`}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className={cn(
					"flex items-center gap-2 rounded-md font-ui focus-visible:ring-2 focus-visible:ring-teal",
					quiet
						? "h-8 px-2 text-[13px] font-[550] text-ink-2 transition-colors hover:bg-well hover:text-foreground pointer-coarse:h-11"
						: "h-10 w-full justify-between bg-card px-3 text-sm font-medium text-foreground ring-1 ring-line-2 transition-shadow hover:bg-well",
				)}
			>
				<span className="truncate">{current?.label}</span>
				<ChevronDownIcon className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} />
			</button>
			{open && (
				<ul role="listbox" aria-label={ariaLabel} className={cn("absolute top-full z-30 mt-1.5 min-w-full overflow-hidden rounded-lg bg-card p-1 shadow-raise-hi", align === "end" ? "end-0" : "start-0")}>
					{options.map((o) => (
						<li key={o.value} role="option" aria-selected={o.value === value}>
							<button
								type="button"
								onClick={() => {
									onChange(o.value);
									setOpen(false);
								}}
								className={cn(
									"flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-3 py-2 text-left font-ui text-sm hover:bg-well",
									o.value === value ? "font-semibold text-teal-2" : "text-ink-2",
								)}
							>
								{o.label}
								{o.value === value && <CheckIcon className="size-4" strokeWidth={2} />}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
