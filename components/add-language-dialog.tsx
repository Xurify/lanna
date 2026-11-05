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
}

export function AddLanguageDialog({ onClose, onStarted }: { onClose: () => void; onStarted: () => void }) {
	const [rows, setRows] = useState<CatalogRow[] | null>(null);
	const [picked, setPicked] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const dismiss = useBackdropDismiss(onClose);

	useEffect(() => {
		let live = true;
		fetch("/api/languages")
			.then((r) => r.json() as Promise<{ languages: CatalogRow[] }>)
			.then((d) => live && setRows(d.languages))
			.catch(() => live && setError("Could not load the list of languages."));
		return () => {
			live = false;
		};
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	const choice = rows?.find((r) => r.id === picked) ?? null;
	const anyAdding = rows?.some((r) => r.adding) ?? false;

	const start = async () => {
		if (!choice) return;
		setBusy(true);
		setError(null);
		try {
			await addLanguage(choice.id);
			onStarted();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setBusy(false);
		}
	};

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100" {...dismiss}>
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
							LangHarness downloads about 3,000 common words from Wiktionary and example sentences from Tatoeba. It takes a minute or two in the background, so you can keep studying.
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
									) : null}
								</span>
							</button>
						);
					})}
				</div>

				<p className="text-xs leading-relaxed text-muted-foreground">
					If a model is set in Settings, it also drafts a grammar map for the skill map in one Cheap-slot call. Review, Words and the tutor work in the new language. Lessons, Read, Watch and Speak are still written for Slovak.
				</p>
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
						disabled={!choice || busy || anyAdding}
						onClick={() => void start()}
						className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
					>
						{anyAdding ? "Another language is being added" : choice ? `Add ${choice.english}` : "Pick a language"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
