"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, FileTextIcon, PencilIcon, PlusIcon, RepeatIcon, Trash2Icon, UploadIcon, Volume2Icon, XIcon } from "lucide-react";
import { EmptyState } from "@/components/quiet/empty-state";
import { speak, useActiveLanguage } from "@/components/speech";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { cn } from "@/lib/utils";
import { CheatsheetParseError, cheatsheetOverlap, cheatsheetRowCount, parseCheatsheet, type Cheatsheet, type ParsedCheatsheet, type CheatsheetSummary, type CheatRow } from "@/src/core";

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
	const [creating, setCreating] = useState(false);

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
				onChanged={() => void load()}
				onRemoved={() => {
					open(null);
					void load();
				}}
			/>
		);
	}

	return (
		<div className="space-y-4" data-testid="cheatsheets">
			<div className="flex justify-end">
				<button type="button" className="q-btn primary" onClick={() => setCreating(true)} data-testid="cheatsheet-new">
					<PlusIcon className="size-4" />
					New cheatsheet
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
											{plural(s.rows, "phrase")} · {dateLabel(s.importedAt)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
				{sheets && sheets.length === 0 && (
					<EmptyState testid="cheatsheets-empty" title="No cheatsheets yet">
						<p>Paste a phrase guide in Markdown, or choose a .md file.</p>
					</EmptyState>
				)}
			</div>

			{creating && (
				<SheetDialog
					mode={{ kind: "new" }}
					onClose={() => setCreating(false)}
					onSaved={(sheet) => {
						setCreating(false);
						void load();
						open(sheet.id);
					}}
				/>
			)}
		</div>
	);
}

function preview(markdown: string): { draft: ParsedCheatsheet | null; error: string | null } {
	if (!markdown.trim()) return { draft: null, error: null };
	try {
		return { draft: parseCheatsheet(markdown), error: null };
	} catch (err) {
		return { draft: null, error: err instanceof CheatsheetParseError ? err.message : "This text could not be read." };
	}
}

/** The one dialog for a sheet's text, in three uses:
 *  new   a title and the phrases, from the list
 *  add   more phrases for an open sheet; only the ones it lacks are kept
 *  edit  the sheet's title and its whole text */
type DialogMode = { kind: "new" } | { kind: "add"; sheet: Cheatsheet } | { kind: "edit"; id: string; title: string; markdown: string };

function SheetDialog({ mode, onClose, onSaved }: { mode: DialogMode; onClose: () => void; onSaved: (sheet: Cheatsheet) => void }) {
	const [markdown, setMarkdown] = useState(mode.kind === "edit" ? mode.markdown : "");
	const [title, setTitle] = useState(mode.kind === "edit" ? mode.title : "");
	const [fileName, setFileName] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const { draft, error } = useMemo(() => preview(markdown), [markdown]);
	const overlap = useMemo(() => (mode.kind === "add" && draft ? cheatsheetOverlap(draft, mode.sheet) : null), [mode, draft]);
	const hasHeading = /^#\s+\S/m.test(markdown);
	const heading = mode.kind === "new" ? "New cheatsheet" : mode.kind === "add" ? `Add phrases to ${mode.sheet.title}` : "Edit the cheatsheet";

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
		if (!draft || saving || (overlap && overlap.fresh.length === 0)) return;
		setSaving(true);
		setServerError(null);
		const fallback = fileName ? fileName.replace(/\.(md|markdown|txt)$/i, "") : "";
		const request =
			mode.kind === "edit"
				? { url: `/api/cheatsheets/${encodeURIComponent(mode.id)}`, method: "PUT", body: { markdown, title } }
				: mode.kind === "add"
					? { url: `/api/cheatsheets/${encodeURIComponent(mode.sheet.id)}/merge`, method: "POST", body: { markdown } }
					: { url: "/api/cheatsheets", method: "POST", body: { markdown, title: title.trim() || (hasHeading ? undefined : fallback) } };
		const res = await fetch(request.url, { method: request.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) }).catch(() => null);
		setSaving(false);
		if (!res) return setServerError("The app did not answer. Try again.");
		const data = (await res.json().catch(() => ({}))) as { sheet?: Cheatsheet; message?: string };
		if (!res.ok || !data.sheet) return setServerError(data.message ?? "The cheatsheet was not saved.");
		onSaved(data.sheet);
	};

	let status: React.ReactNode = null;
	if (serverError || error) status = <span className="text-miss">{serverError ?? error}</span>;
	else if (draft) {
		const parts = overlap ? [`${overlap.fresh.length} new`, overlap.shared ? `${overlap.shared} already here` : ""] : [plural(cheatsheetRowCount(draft), "phrase")];
		if (draft.skipped.length) parts.push(`${plural(draft.skipped.length, "chat line")} left out`);
		status = <span className="text-ink-2">{parts.filter(Boolean).join(" · ")}</span>;
	}

	const action = mode.kind === "edit" ? "Save" : mode.kind === "add" ? (!overlap ? "Add" : overlap.fresh.length ? `Add ${plural(overlap.fresh.length, "phrase")}` : "Nothing new") : "Create";

	return (
		<div className="lh-fade fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cheatsheet-dialog-title" className="lh-menu-in q-card flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col gap-4 overflow-y-auto p-5 sm:p-6" data-testid="cheatsheet-dialog">
				<div className="flex items-center justify-between gap-3">
					<h2 id="cheatsheet-dialog-title" className="truncate font-title text-xl font-semibold text-foreground">
						{heading}
					</h2>
					<button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-well hover:text-foreground">
						<XIcon className="size-5" />
					</button>
				</div>

				{mode.kind !== "add" && (
					<label className="block">
						<span className="font-ui text-xs font-semibold text-muted-foreground">Title</span>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={draft && hasHeading ? draft.title : "Night shift phrases"}
							maxLength={120}
							className="mt-1 w-full rounded-md border border-border bg-well px-3 py-2 font-prose text-sm text-foreground outline-none focus:border-primary"
							data-testid="cheatsheet-title"
						/>
					</label>
				)}

				<label className="block">
					<span className="flex items-center justify-between gap-2">
						<span className="font-ui text-xs font-semibold text-muted-foreground">Phrases</span>
						{mode.kind !== "edit" && (
							<button type="button" className="font-ui text-xs font-medium text-teal-2 hover:underline" onClick={() => fileRef.current?.click()}>
								<UploadIcon className="mr-1 inline size-3.5 align-[-2px]" />
								{fileName ?? "From a file"}
							</button>
						)}
					</span>
					<textarea
						value={markdown}
						onChange={(e) => {
							setMarkdown(e.target.value);
							setServerError(null);
						}}
						rows={mode.kind === "edit" ? 18 : 12}
						spellCheck={false}
						autoFocus={mode.kind !== "edit"}
						placeholder={"## At the desk\n| Russian | Say it | English |\n|---|---|---|\n| Пускаем? | poos-KA-yem? | Do we let it in? |\n\n- пожар — fire"}
						className="mt-1 w-full resize-y rounded-md border border-border bg-well px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground outline-none focus:border-primary"
						data-testid="cheatsheet-markdown"
					/>
				</label>
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

				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="min-h-5 font-ui text-xs" aria-live="polite" data-testid="cheatsheet-preview">
						{status}
					</p>
					<div className="ml-auto flex items-center gap-2">
						<button type="button" className="q-btn ghost" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" className="q-btn primary" disabled={!draft || saving || (!!overlap && overlap.fresh.length === 0)} data-testid="cheatsheet-save">
							{saving ? "Saving…" : action}
						</button>
					</div>
				</div>
			</form>
		</div>
	);
}

function CheatsheetView({ id, onBack, onChanged, onRemoved }: { id: string; onBack: () => void; onChanged: () => void; onRemoved: () => void }) {
	const lang = useActiveLanguage();
	const [sheet, setSheet] = useState<Cheatsheet | null>(null);
	const [missing, setMissing] = useState(false);
	const [review, setReview] = useState<ReviewState | null>(null);
	const [reviewNote, setReviewNote] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [cover, setCover] = useState(false);
	const [shown, setShown] = useState<Set<string>>(() => new Set());
	const [confirmRemove, setConfirmRemove] = useState(false);
	const [dialog, setDialog] = useState<DialogMode | null>(null);
	const [jump, setJump] = useState("");

	const load = useCallback(async () => {
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}`).catch(() => null);
		if (!res?.ok) return setMissing(true);
		const data = (await res.json()) as { sheet: Cheatsheet; review: ReviewState };
		setSheet(data.sheet);
		setReview(data.review);
	}, [id]);

	useEffect(() => {
		void load();
	}, [load]);

	const startEdit = async () => {
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}?source=1`).catch(() => null);
		if (!res?.ok) return;
		const data = (await res.json()) as { markdown: string; title: string };
		setDialog({ kind: "edit", id, title: data.title, markdown: data.markdown });
	};

	const addToReview = async () => {
		setAdding(true);
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}/review`, { method: "POST" }).catch(() => null);
		setAdding(false);
		if (!res?.ok) return setReviewNote("The words were not added. Try again.");
		const data = (await res.json()) as ReviewState & { added: string[] };
		setReview({ inDictionary: data.inDictionary, inReview: data.inReview });
		setReviewNote(data.added.length ? `Added ${plural(data.added.length, "word")} to Review.` : "The other words have no dictionary sentence yet.");
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
				<p>It was removed, or it belongs to another language.</p>
			</EmptyState>
		);
	}

	const waiting = review ? review.inDictionary - review.inReview : 0;
	const languageName = lang?.english ?? "phrases";
	const sections = sheet?.sections ?? [];
	const rowSections = sections.filter((s) => s.rows.length);

	return (
		<div className="min-h-[60vh] space-y-5" data-testid="cheatsheet-view">
			<button type="button" onClick={onBack} className="q-btn ghost -ml-2.5">
				<ArrowLeftIcon className="size-4" />
				All cheatsheets
			</button>

			{sheet && (
				<>
					<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
						<div className="min-w-0 space-y-1">
							<h2 className="font-title text-2xl font-semibold tracking-tight text-foreground">{sheet.title}</h2>
							<p className="font-ui text-xs text-muted-foreground">
								{plural(cheatsheetRowCount(sheet), "phrase")} · {sheet.updatedAt ? `edited ${dateLabel(sheet.updatedAt)}` : dateLabel(sheet.importedAt)}
							</p>
						</div>
						<span className="flex items-center gap-1">
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
								<>
									<button type="button" className="q-btn ghost" onClick={() => setDialog({ kind: "add", sheet })} data-testid="cheatsheet-add">
										<PlusIcon className="size-4" />
										Add phrases
									</button>
									<button type="button" className="q-btn ghost" onClick={() => void startEdit()} data-testid="cheatsheet-edit">
										<PencilIcon className="size-4" />
										Edit
									</button>
									<button type="button" className="q-btn ghost" onClick={() => setConfirmRemove(true)} data-testid="cheatsheet-remove">
										<Trash2Icon className="size-4" />
										Remove
									</button>
								</>
							)}
						</span>
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
						{reviewNote && (
							<span className="font-ui text-xs text-ink-2" aria-live="polite">
								{reviewNote}
							</span>
						)}
						{rowSections.length > 1 && (
							<ChoiceMenu
								value={jump}
								onChange={(next) => {
									setJump(next);
									document.getElementById(`cs-${next}`)?.scrollIntoView({ block: "start" });
								}}
								ariaLabel="Jump to a section"
								className="w-full sm:ml-auto sm:w-64"
								options={[{ value: "", label: "Jump to a section" }, ...rowSections.map((s) => ({ value: s.id, label: s.title }))]}
							/>
						)}
					</div>

					{sheet.intro.length > 0 && (
						<div className="max-w-2xl space-y-1.5 font-prose text-sm text-ink-2">
							{sheet.intro.map((p, i) => (
								<p key={i}>{p}</p>
							))}
						</div>
					)}

					{sections.map((section) => (
						<section key={section.id} id={`cs-${section.id}`} className="scroll-mt-6 space-y-3">
							<h3 className="q-sh !mb-0">{section.title}</h3>
							{section.rows.length > 0 && (
								<ul className="q-card divide-y divide-border/70 overflow-hidden">
									{section.rows.map((row, i) => {
										const key = `${section.id}:${i}`;
										return <CheatRowItem key={key} row={row} tag={lang?.tag} hidden={cover && !shown.has(key)} onReveal={() => setShown((prev) => new Set(prev).add(key))} />;
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

			{dialog && (
				<SheetDialog
					mode={dialog}
					onClose={() => setDialog(null)}
					onSaved={(saved) => {
						setDialog(null);
						setSheet(saved);
						setShown(new Set());
						setReviewNote(null);
						void load();
						onChanged();
					}}
				/>
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
