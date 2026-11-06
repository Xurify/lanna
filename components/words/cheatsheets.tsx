"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, FileTextIcon, PlusIcon, RepeatIcon, Trash2Icon, UploadIcon, Volume2Icon, XIcon } from "lucide-react";
import { EmptyState } from "@/components/quiet/empty-state";
import { speak, useActiveLanguage } from "@/components/speech";
import { cn } from "@/lib/utils";
import { CheatsheetParseError, cheatsheetRowCount, parseCheatsheet, type Cheatsheet, type CheatsheetDraft, type CheatsheetSummary, type CheatRow } from "@/src/core";

interface ReviewState {
	inDictionary: number;
	inReview: number;
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The sheet's address, so a link (or a second window during a game) opens it directly. */
function setSheetInUrl(id: string | null) {
	const url = new URL(window.location.href);
	url.searchParams.set("tab", "cheatsheets");
	if (id) url.searchParams.set("sheet", id);
	else url.searchParams.delete("sheet");
	window.history.replaceState(null, "", url);
}

export function CheatsheetsTab({ initialSheet, onCount }: { initialSheet?: string; onCount?: (n: number) => void }) {
	const [sheets, setSheets] = useState<CheatsheetSummary[] | null>(null);
	const [openId, setOpenId] = useState<string | null>(initialSheet ?? null);
	const [importing, setImporting] = useState(false);

	const load = useCallback(async () => {
		const res = await fetch("/api/cheatsheets").catch(() => null);
		if (!res?.ok) return setSheets([]);
		const data = (await res.json()) as { sheets: CheatsheetSummary[] };
		setSheets(data.sheets);
		onCount?.(data.sheets.length);
	}, [onCount]);

	useEffect(() => {
		void load();
	}, [load]);

	const open = (id: string | null) => {
		setOpenId(id);
		setSheetInUrl(id);
	};

	if (openId) {
		return (
			<CheatsheetView
				id={openId}
				onBack={() => open(null)}
				onRemoved={() => {
					open(null);
					void load();
				}}
			/>
		);
	}

	return (
		<div className="space-y-6" data-testid="cheatsheets">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="max-w-xl font-prose text-sm text-muted-foreground">
					Phrase guides you keep at hand: for a game, a trip or a call. Paste one or choose a Markdown file.
				</p>
				<button type="button" className="q-btn primary shrink-0" onClick={() => setImporting(true)} data-testid="cheatsheet-import-open">
					<PlusIcon className="size-4" />
					Import a cheatsheet
				</button>
			</div>

			<div className="min-h-[120px]">
				{sheets && sheets.length > 0 && (
					<ul className="q-card divide-y divide-border/70 overflow-hidden" data-testid="cheatsheet-list">
						{sheets.map((s) => (
							<li key={s.id}>
								<button type="button" onClick={() => open(s.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-well">
									<FileTextIcon className="size-4 shrink-0 text-ink-3" />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-ui text-[15px] font-semibold text-foreground">{s.title}</span>
										<span className="block font-ui text-xs text-muted-foreground">
											{plural(s.rows, "phrase")} · {plural(s.sections, "section")} · imported {dateLabel(s.importedAt)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
				{sheets && sheets.length === 0 && (
					<EmptyState testid="cheatsheets-empty" title="No cheatsheets yet">
						<p>Import a phrase guide as Markdown: a table with the phrase, how to say it and the meaning, one section per heading. Its words can go to Review from the sheet.</p>
					</EmptyState>
				)}
			</div>

			{importing && (
				<ImportDialog
					onClose={() => setImporting(false)}
					onImported={(sheet) => {
						setImporting(false);
						void load();
						open(sheet.id);
					}}
				/>
			)}
		</div>
	);
}

function preview(markdown: string): { draft: CheatsheetDraft | null; error: string | null } {
	if (!markdown.trim()) return { draft: null, error: null };
	try {
		return { draft: parseCheatsheet(markdown), error: null };
	} catch (err) {
		return { draft: null, error: err instanceof CheatsheetParseError ? err.message : "This text could not be read." };
	}
}

function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (sheet: Cheatsheet) => void }) {
	const [markdown, setMarkdown] = useState("");
	const [title, setTitle] = useState("");
	const [fileName, setFileName] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const { draft, error } = useMemo(() => preview(markdown), [markdown]);
	const hasHeading = /^#\s+\S/m.test(markdown);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const readFile = async (file: File) => {
		setFileName(file.name);
		setServerError(null);
		setMarkdown(await file.text());
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!draft || saving) return;
		setSaving(true);
		setServerError(null);
		const fallback = fileName ? fileName.replace(/\.(md|markdown|txt)$/i, "") : "";
		const res = await fetch("/api/cheatsheets", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ markdown, title: title.trim() || (hasHeading ? undefined : fallback) }),
		}).catch(() => null);
		setSaving(false);
		if (!res) return setServerError("The app did not answer. Try again.");
		const data = (await res.json().catch(() => ({}))) as { sheet?: Cheatsheet; message?: string };
		if (!res.ok || !data.sheet) return setServerError(data.message ?? "The cheatsheet was not saved.");
		onImported(data.sheet);
	};

	return (
		<div className="lh-fade fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cheatsheet-import-title" className="lh-menu-in q-card flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col gap-4 overflow-y-auto p-5 sm:p-6" data-testid="cheatsheet-import">
				<div className="flex items-center justify-between">
					<h2 id="cheatsheet-import-title" className="font-title text-xl font-semibold text-foreground">
						Import a cheatsheet
					</h2>
					<button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-well hover:text-foreground">
						<XIcon className="size-5" />
					</button>
				</div>

				<label className="block">
					<span className="font-ui text-xs font-semibold text-muted-foreground">Title</span>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder={draft && hasHeading ? draft.title : "For example Night shift phrases"}
						maxLength={120}
						className="mt-1 w-full rounded-md border border-border bg-well px-3 py-2 font-prose text-sm text-foreground outline-none focus:border-primary"
					/>
				</label>

				<label className="block">
					<span className="flex items-center justify-between">
						<span className="font-ui text-xs font-semibold text-muted-foreground">The guide in Markdown</span>
						{fileName && <span className="truncate font-ui text-xs text-ink-3">{fileName}</span>}
					</span>
					<textarea
						value={markdown}
						onChange={(e) => {
							setMarkdown(e.target.value);
							setServerError(null);
						}}
						rows={12}
						spellCheck={false}
						placeholder={"# Night shift\n\n## At the desk\n| Russian | Say it | English |\n|---|---|---|\n| Пускаем? | poos-KA-yem? | Do we let it in? |"}
						className="mt-1 w-full resize-y rounded-md border border-border bg-well px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground outline-none focus:border-primary"
						data-testid="cheatsheet-markdown"
					/>
				</label>

				<p className="min-h-5 font-ui text-xs" aria-live="polite" data-testid="cheatsheet-preview">
					{serverError ? (
						<span className="text-miss">{serverError}</span>
					) : error ? (
						<span className="text-miss">{error}</span>
					) : draft ? (
						<span className="text-ink-2">
							Found {plural(cheatsheetRowCount(draft), "phrase")} in {plural(draft.sections.filter((s) => s.rows.length).length, "section")}.
						</span>
					) : (
						<span className="text-muted-foreground">A table per section works best. A list line with a dash, “phrase — meaning”, works too.</span>
					)}
				</p>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<button type="button" className="q-btn sec" onClick={() => fileRef.current?.click()}>
						<UploadIcon className="size-4" />
						Choose a file
					</button>
					<input
						ref={fileRef}
						type="file"
						accept=".md,.markdown,.txt,text/markdown,text/plain"
						className="sr-only"
						tabIndex={-1}
						aria-hidden="true"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void readFile(file);
							e.target.value = "";
						}}
					/>
					<div className="flex items-center gap-2">
						<button type="button" className="q-btn ghost" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" className="q-btn primary" disabled={!draft || saving} data-testid="cheatsheet-import-save">
							{saving ? "Importing…" : "Import"}
						</button>
					</div>
				</div>
			</form>
		</div>
	);
}

function CheatsheetView({ id, onBack, onRemoved }: { id: string; onBack: () => void; onRemoved: () => void }) {
	const lang = useActiveLanguage();
	const [sheet, setSheet] = useState<Cheatsheet | null>(null);
	const [missing, setMissing] = useState(false);
	const [review, setReview] = useState<ReviewState | null>(null);
	const [reviewNote, setReviewNote] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [cover, setCover] = useState(false);
	const [shown, setShown] = useState<Set<string>>(() => new Set());
	const [confirmRemove, setConfirmRemove] = useState(false);

	useEffect(() => {
		let live = true;
		void fetch(`/api/cheatsheets/${encodeURIComponent(id)}`)
			.then(async (res) => {
				if (!live) return;
				if (!res.ok) return setMissing(true);
				const data = (await res.json()) as { sheet: Cheatsheet; review: ReviewState };
				if (!live) return;
				setSheet(data.sheet);
				setReview(data.review);
			})
			.catch(() => live && setMissing(true));
		return () => {
			live = false;
		};
	}, [id]);

	const addToReview = async () => {
		setAdding(true);
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}/review`, { method: "POST" }).catch(() => null);
		setAdding(false);
		if (!res?.ok) return setReviewNote("The words were not added. Try again.");
		const data = (await res.json()) as ReviewState & { added: string[] };
		setReview({ inDictionary: data.inDictionary, inReview: data.inReview });
		setReviewNote(
			data.added.length
				? `Added ${plural(data.added.length, "word")}. Review asks for them in dictionary sentences, not in this sheet's lines.`
				: "None of the remaining words has a dictionary sentence yet, so they cannot become cards.",
		);
	};

	const remove = async () => {
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
		if (res?.ok) onRemoved();
	};

	const setMode = (next: boolean) => {
		setCover(next);
		setShown(new Set());
	};

	if (missing) {
		return (
			<EmptyState
				testid="cheatsheet-missing"
				title="This cheatsheet is not here"
				action={
					<button type="button" className="q-btn primary" onClick={onBack}>
						All cheatsheets
					</button>
				}
			>
				<p>It may have been removed, or it belongs to another language. Removed sheets stay in the cheatsheets trash folder.</p>
			</EmptyState>
		);
	}

	const waiting = review ? review.inDictionary - review.inReview : 0;
	const languageName = lang?.english ?? "phrase";
	const sections = sheet?.sections ?? [];
	const rowSections = sections.filter((s) => s.rows.length);

	return (
		<div className="min-h-[60vh] space-y-6" data-testid="cheatsheet-view">
			<button type="button" onClick={onBack} className="q-btn ghost -ml-2.5">
				<ArrowLeftIcon className="size-4" />
				All cheatsheets
			</button>

			{sheet && (
				<>
					<div className="space-y-1">
						<h2 className="font-title text-2xl font-semibold tracking-tight text-foreground">{sheet.title}</h2>
						<p className="font-ui text-xs text-muted-foreground">
							{plural(cheatsheetRowCount(sheet), "phrase")} · imported {dateLabel(sheet.importedAt)}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="q-segc" role="radiogroup" aria-label="Show the phrases">
							<button type="button" role="radio" aria-checked={!cover} className={cn(!cover && "on")} onClick={() => setMode(false)}>
								Show all
							</button>
							<button type="button" role="radio" aria-checked={cover} className={cn(cover && "on")} onClick={() => setMode(true)} data-testid="cheatsheet-cover">
								Cover the {languageName}
							</button>
						</div>
						{review && waiting > 0 && (
							<button type="button" className="q-btn sec t" onClick={() => void addToReview()} disabled={adding} data-testid="cheatsheet-to-review">
								<RepeatIcon className="size-4" />
								{adding ? "Adding…" : `Add ${plural(Math.min(waiting, 30), "word")} to Review`}
							</button>
						)}
						{review && review.inDictionary > 0 && waiting === 0 && <span className="font-ui text-xs text-ink-2">All {plural(review.inDictionary, "dictionary word")} are in Review.</span>}
						<span className="ml-auto flex items-center gap-1">
							{confirmRemove ? (
								<>
									<span className="font-ui text-xs text-ink-2">Remove this sheet?</span>
									<button type="button" className="q-btn ghost text-miss" onClick={() => void remove()} data-testid="cheatsheet-remove-yes">
										Remove
									</button>
									<button type="button" className="q-btn ghost" onClick={() => setConfirmRemove(false)}>
										Keep
									</button>
								</>
							) : (
								<button type="button" className="q-btn ghost" onClick={() => setConfirmRemove(true)} data-testid="cheatsheet-remove">
									<Trash2Icon className="size-4" />
									Remove
								</button>
							)}
						</span>
					</div>
					{reviewNote && (
						<p className="font-ui text-xs text-ink-2" aria-live="polite">
							{reviewNote}
						</p>
					)}

					{rowSections.length > 1 && (
						<nav aria-label="Sections" className="flex flex-wrap gap-1.5">
							{rowSections.map((s) => (
								<a key={s.id} href={`#cs-${s.id}`} className="rounded-md bg-well px-2.5 py-1 font-ui text-xs font-medium text-ink-2 transition-colors hover:bg-well-2 hover:text-foreground">
									{s.title}
								</a>
							))}
						</nav>
					)}

					{sheet.intro.length > 0 && (
						<div className="max-w-2xl space-y-2 font-prose text-sm text-ink-2">
							{sheet.intro.map((p, i) => (
								<p key={i}>{p}</p>
							))}
						</div>
					)}

					{sections.map((section) => (
						<section key={section.id} id={`cs-${section.id}`} className="scroll-mt-6 space-y-3">
							<h3 className="q-sh !mb-0">
								{section.title}
								{section.rows.length > 0 && <small>{plural(section.rows.length, "phrase")}</small>}
							</h3>
							{section.rows.length > 0 && (
								<ul className="q-card divide-y divide-border/70 overflow-hidden">
									{section.rows.map((row, i) => {
										const key = `${section.id}:${i}`;
										const hidden = cover && !shown.has(key);
										return (
											<CheatRowItem
												key={key}
												row={row}
												tag={lang?.tag}
												hidden={hidden}
												onReveal={() => setShown((prev) => new Set(prev).add(key))}
											/>
										);
									})}
								</ul>
							)}
							{section.notes.length > 0 && (
								<div className="max-w-2xl space-y-1.5 font-prose text-sm text-ink-2">
									{section.notes.map((n, i) => (
										<p key={i}>{n}</p>
									))}
								</div>
							)}
						</section>
					))}
				</>
			)}
		</div>
	);
}

function CheatRowItem({ row, tag, hidden, onReveal }: { row: CheatRow; tag?: string; hidden: boolean; onReveal: () => void }) {
	return (
		<li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-baseline">
			<span className="row-span-2 pt-0.5 sm:row-span-1">
				{hidden ? (
					<span className="block size-8" aria-hidden="true" />
				) : (
					<button type="button" onClick={() => void speak(row.text).catch(() => {})} aria-label={`Play ${row.text}`} className="lh-press grid size-8 place-items-center rounded-full bg-well text-ink-2 hover:text-foreground">
						<Volume2Icon className="size-4" />
					</button>
				)}
			</span>
			<span className="min-w-0">
				{hidden ? (
					<button type="button" onClick={onReveal} className="block w-full text-left font-ui text-[13px] text-ink-3 underline decoration-line-2 decoration-2 underline-offset-[7px] hover:text-ink-2" data-testid="cheatsheet-reveal">
						Say it, then show
					</button>
				) : (
					<>
						<span lang={tag} className="block font-prose text-[17px] font-semibold leading-snug text-foreground">
							{row.text}
						</span>
						{row.pron && <span className="block font-ui text-[13px] text-ink-3">{row.pron}</span>}
					</>
				)}
			</span>
			<span className="col-start-2 min-w-0 sm:col-start-3">
				{row.meaning && (
					<span lang="en" className="block font-prose text-[15px] text-ink-2">
						{row.meaning}
					</span>
				)}
				{row.note && <span className="block font-ui text-xs text-ink-3">{row.note}</span>}
			</span>
		</li>
	);
}
