"use client";

/**
 * Add a language: pick one from the catalog, and the app builds it in the
 * background (src/server/language-add.ts). The dialog closes as soon as the
 * work starts; the sidebar's Background section shows its progress and a
 * notice offers the switch when it is ready.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/country-flag";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { addLanguage } from "@/components/switch-language";

interface CatalogRow {
	id: string;
	english: string;
	endonym: string;
	tag: string;
	ready: boolean;
	adding: boolean;
	/** Downloaded before courses were generated: adding finishes it. */
	started: boolean;
	/** A removed built-in language that is still complete: adding puts it back at once. */
	restoreOnly?: boolean;
}

interface Estimate {
	slot: "strong" | "cheap" | "dictionary";
	name: string;
	level: string;
	typicalUsd: number | null;
	mostUsd: number | null;
	measured: number;
	subscription: boolean;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/** What a course will cost on one model, before anything is spent. */
function priceLine(e: Estimate): string {
	if (e.slot === "dictionary") return "Free";
	if (e.subscription) return "Included in your subscription";
	if (e.typicalUsd === null || e.mostUsd === null) return "Its price is not in the catalog";
	return `About ${usd(e.typicalUsd)}, at most ${usd(e.mostUsd)}`;
}

function basisLine(e: Estimate): string {
	if (e.slot === "dictionary") return "Plainer: rules from templates, no word themes or story world.";
	return e.measured > 0 ? `From ${e.measured} earlier ${e.measured === 1 ? "course" : "courses"} on this model.` : "A first guess: no course has been written on this model yet.";
}

export function AddLanguageDialog({ onClose, onStarted }: { onClose: () => void; onStarted: () => void }) {
	const [rows, setRows] = useState<CatalogRow[] | null>(null);
	const [picked, setPicked] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [writers, setWriters] = useState<Estimate[]>([]);
	const [writer, setWriter] = useState<Estimate["slot"]>("strong");
	const dismiss = useBackdropDismiss(onClose);

	useEffect(() => {
		let live = true;
		fetch("/api/languages")
			.then((r) => r.json() as Promise<{ languages: CatalogRow[]; writers: Estimate[] }>)
			.then((d) => {
				if (!live) return;
				setRows(d.languages);
				setWriters(d.writers);
				if (d.writers[0]) setWriter(d.writers[0].slot);
			})
			.catch(() => live && setError("Could not load the list of languages."));
		return () => {
			live = false;
		};
	}, []);

	useEffect(() => {
		// Capture phase: opened from Settings, one Escape must close this dialog and leave Settings open.
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopImmediatePropagation();
			onClose();
		};
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [onClose]);

	const choice = rows?.find((r) => r.id === picked) ?? null;
	const anyAdding = rows?.some((r) => r.adding) ?? false;

	const start = async () => {
		if (!choice) return;
		setBusy(true);
		setError(null);
		try {
			await addLanguage(choice.id, writer);
			onStarted();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setBusy(false);
		}
	};

	return createPortal(
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100" {...dismiss}>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="add-lang-title"
				data-testid="add-language-dialog"
				className="flex max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-md flex-col gap-3 rounded-xl bg-card p-5 shadow-raise-hi animate-in zoom-in-95 duration-150"
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 id="add-lang-title" className="text-base font-semibold text-foreground">
							Add a language
						</h3>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							LangHarness builds the whole course: about 3,000 common words from Wiktionary with example sentences from Tatoeba, then lessons, chapters, tutor sessions, goals and a story world written by your model. It runs in the background, so you can keep studying.
						</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
						<XIcon className="size-4" />
					</button>
				</div>

				<div role="listbox" aria-label="Languages you can add" className="-mx-1 min-h-48 flex-1 overflow-y-auto px-1" data-testid="add-language-list">
					{rows === null && !error && <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>}
					{rows?.map((r) => {
						const unavailable = r.ready || r.adding;
						const selected = picked === r.id;
						return (
							<button
								key={r.id}
								type="button"
								role="option"
								aria-selected={selected}
								aria-disabled={unavailable}
								disabled={unavailable}
								data-testid={`add-language-${r.id}`}
								onClick={() => setPicked(r.id)}
								className={cn(
									"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
									selected ? "bg-accent font-semibold text-foreground ring-1 ring-primary/50" : "text-foreground hover:bg-accent/60",
									unavailable && "cursor-default text-muted-foreground hover:bg-transparent",
								)}
							>
								<CountryFlag lang={r.id} />
								<span className="truncate">{r.endonym}</span>
								<span className="truncate text-xs text-muted-foreground">({r.english})</span>
								<span className="ml-auto shrink-0 text-xs text-muted-foreground">
									{r.ready ? (
										<span className="inline-flex items-center gap-1">
											<CheckIcon className="size-3.5" />
											Added
										</span>
									) : r.adding ? (
										"Adding…"
									) : r.restoreOnly ? (
										"Removed"
									) : r.started ? (
										"Needs its course"
									) : null}
								</span>
							</button>
						);
					})}
				</div>

				<p className="text-xs leading-relaxed text-muted-foreground">
					The sentences are never written by a model: they are real Tatoeba sentences. A model writes the lessons and the stories in two calls, each capped, so it cannot cost more than shown; or the app builds plainer lessons from the dictionary for free.
				</p>
				{writers.length > 0 && !choice?.restoreOnly && (
					<div role="radiogroup" aria-label="Model that writes the course" className="flex flex-col gap-1" data-testid="add-language-writers">
						<p className="text-xs font-semibold text-foreground">Written by</p>
						{writers.map((w) => {
							const on = w.slot === writer;
							return (
								<button
									key={w.slot}
									type="button"
									role="radio"
									aria-checked={on}
									data-testid={`add-language-writer-${w.slot}`}
									onClick={() => setWriter(w.slot)}
									className={cn(
										"flex w-full items-baseline justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
										on ? "bg-accent text-foreground ring-1 ring-primary/50" : "text-muted-foreground hover:bg-accent/60",
									)}
								>
									<span className="min-w-0">
										<span className="block truncate font-semibold">{w.name}</span>
										<span className="block truncate text-muted-foreground">
											{w.slot === "dictionary" ? basisLine(w) : <>{w.slot === "strong" ? "Strong" : "Cheap"} slot · {w.level} thinking · {basisLine(w)}</>}
										</span>
									</span>
									<span className="shrink-0 tabular-nums font-semibold">{priceLine(w)}</span>
								</button>
							);
						})}
					</div>
				)}
				{error && (
					<p className="text-xs text-destructive" role="alert">
						{error}
					</p>
				)}
				<div className="flex items-center justify-end gap-2">
					<button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
						Cancel
					</button>
					<button
						type="button"
						data-testid="add-language-start"
						disabled={!choice || busy || (anyAdding && !choice.restoreOnly)}
						onClick={() => void start()}
						className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
					>
						{choice?.restoreOnly ? `Put ${choice.english} back` : anyAdding ? "Another language is being added" : choice ? `${choice.started ? "Finish" : "Add"} ${choice.english}` : "Pick a language"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
