"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, FileTextIcon, PencilIcon, PlusIcon, RepeatIcon, Trash2Icon, UploadIcon, Volume2Icon, XIcon } from "lucide-react";
import { EmptyState } from "@/components/quiet/empty-state";
import { speak, useActiveLanguage } from "@/components/speech";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { cn } from "@/lib/utils";
import { CheatsheetParseError, cheatsheetRowCount, countOverlap, formatSheetText, parseSheetText, type Cheatsheet, type CheatRow, type CheatsheetSummary, type CheatSection } from "@/src/core";

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
											{plural(s.rows, "phrase")} · {dateLabel(s.updatedAt ?? s.importedAt)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
				{sheets && sheets.length === 0 && (
					<EmptyState testid="cheatsheets-empty" title="No cheatsheets yet">
						<p>A cheatsheet is a list of phrases you keep at hand. Add one phrase per line.</p>
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

function parseOrError(text: string): { sections: CheatSection[] | null; error: string | null } {
	if (!text.trim()) return { sections: null, error: null };
	try {
		return { sections: parseSheetText(text), error: null };
	} catch (err) {
		return { sections: null, error: err instanceof CheatsheetParseError ? err.message : "This text could not be read." };
	}
}

/** The editor's own shape: strings for every field, so an input is never uncontrolled. `key` only keeps React from mixing rows up. */
interface DraftRow {
	key: number;
	text: string;
	pron: string;
	meaning: string;
	note: string;
}
interface DraftSection {
	key: number;
	title: string;
	rows: DraftRow[];
}

let draftKey = 0;
const nextKey = () => ++draftKey;
const emptyRow = (): DraftRow => ({ key: nextKey(), text: "", pron: "", meaning: "", note: "" });
const emptySection = (): DraftSection => ({ key: nextKey(), title: "", rows: [emptyRow()] });

function draftFromSections(sections: ReadonlyArray<CheatSection>): DraftSection[] {
	return sections.map((s) => ({
		key: nextKey(),
		title: s.title,
		rows: s.rows.map((r) => ({ key: nextKey(), text: r.text, pron: r.pron ?? "", meaning: r.meaning ?? "", note: r.note ?? "" })),
	}));
}

/** What a draft means: blank phrases dropped, sections with no phrase dropped, a blank section name is "Phrases". */
function sectionsFromDraft(draft: DraftSection[]): Array<{ title: string; rows: CheatRow[] }> {
	const out: Array<{ title: string; rows: CheatRow[] }> = [];
	for (const s of draft) {
		const rows: CheatRow[] = [];
		for (const r of s.rows) {
			const text = r.text.trim();
			if (!text) continue;
			rows.push({ text, pron: r.pron.trim() || undefined, meaning: r.meaning.trim() || undefined, note: r.note.trim() || undefined });
		}
		if (rows.length) out.push({ title: s.title.trim() || "Phrases", rows });
	}
	return out;
}

const phraseCount = (sections: ReadonlyArray<{ rows: ReadonlyArray<unknown> }>) => sections.reduce((n, s) => n + s.rows.length, 0);

/** One dialog for the phrases, in three uses: a new sheet, adding phrases to an open one, and editing a sheet.
 *  It edits as a table by default; the text view pastes a list, such as an assistant's answer, as one phrase per line. */
type DialogMode = { kind: "new" } | { kind: "add"; sheet: Cheatsheet } | { kind: "edit"; sheet: Cheatsheet };

const FIELD = "h-9 w-full min-w-0 rounded-md border border-border bg-well px-2.5 font-prose text-sm text-foreground outline-none focus:border-primary";
const ICON_BUTTON = "grid size-9 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-well hover:text-miss";

function SheetDialog({ mode, onClose, onSaved }: { mode: DialogMode; onClose: () => void; onSaved: (sheet: Cheatsheet) => void }) {
	const [view, setView] = useState<"table" | "text">("table");
	const [draft, setDraft] = useState<DraftSection[]>(() => (mode.kind === "edit" ? draftFromSections(mode.sheet.sections) : [emptySection()]));
	const [text, setText] = useState("");
	const [switchError, setSwitchError] = useState<string | null>(null);
	const [title, setTitle] = useState(mode.kind === "edit" ? mode.sheet.title : "");
	const [fileName, setFileName] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const textParse = useMemo(() => (view === "text" ? parseOrError(text) : null), [view, text]);
	const current = view === "table" ? sectionsFromDraft(draft) : (textParse?.sections ?? []);
	const phrases = phraseCount(current);
	const overlap = mode.kind === "add" && phrases > 0 ? countOverlap(mode.sheet.sections, current) : null;
	const nothingNew = !!overlap && overlap.fresh === 0;
	const canSave = phrases > 0 && !saving && !nothingNew && !textParse?.error;

	const heading = mode.kind === "new" ? "New cheatsheet" : mode.kind === "add" ? `Add phrases to ${mode.sheet.title}` : "Edit cheatsheet";
	const action = mode.kind === "edit" ? "Save" : mode.kind === "add" ? (nothingNew ? "Nothing new" : `Add ${plural(overlap?.fresh ?? 0, "phrase")}`) : "Create";

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const switchTo = (next: "table" | "text") => {
		if (next === view) return;
		if (next === "text") {
			setText(formatSheetText(sectionsFromDraft(draft)));
			setSwitchError(null);
			setView("text");
			return;
		}
		if (!text.trim()) {
			setDraft([emptySection()]);
			setSwitchError(null);
			setView("table");
			return;
		}
		const parsed = parseOrError(text);
		if (parsed.error || !parsed.sections) return setSwitchError(parsed.error);
		setDraft(draftFromSections(parsed.sections));
		setSwitchError(null);
		setView("table");
	};

	const updateSection = (key: number, patch: Partial<DraftSection>) => setDraft((d) => d.map((s) => (s.key === key ? { ...s, ...patch } : s)));
	const updateRow = (sectionKey: number, rowKey: number, field: keyof Omit<DraftRow, "key">, value: string) =>
		setDraft((d) => d.map((s) => (s.key !== sectionKey ? s : { ...s, rows: s.rows.map((r) => (r.key === rowKey ? { ...r, [field]: value } : r)) })));
	const addRow = (sectionKey: number) => setDraft((d) => d.map((s) => (s.key === sectionKey ? { ...s, rows: [...s.rows, emptyRow()] } : s)));
	const removeRow = (sectionKey: number, rowKey: number) =>
		setDraft((d) =>
			d.map((s) => {
				if (s.key !== sectionKey) return s;
				const rows = s.rows.filter((r) => r.key !== rowKey);
				return { ...s, rows: rows.length ? rows : [emptyRow()] };
			}),
		);
	const removeSection = (key: number) => setDraft((d) => (d.length > 1 ? d.filter((s) => s.key !== key) : [emptySection()]));
	const addSection = () => setDraft((d) => [...d, emptySection()]);

	const readFile = async (file: File) => {
		setFileName(file.name);
		setServerError(null);
		setText(await file.text());
		setSwitchError(null);
		setView("text");
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canSave) return;
		setSaving(true);
		setServerError(null);
		const body = view === "table" ? formatSheetText(sectionsFromDraft(draft)) : text;
		const request =
			mode.kind === "edit"
				? { url: `/api/cheatsheets/${encodeURIComponent(mode.sheet.id)}`, method: "PUT", body: { title, text: body } }
				: mode.kind === "add"
					? { url: `/api/cheatsheets/${encodeURIComponent(mode.sheet.id)}/add`, method: "POST", body: { text: body } }
					: { url: "/api/cheatsheets", method: "POST", body: { title: title.trim() || fileName?.replace(/\.txt$/i, "") || "", text: body } };
		const res = await fetch(request.url, { method: request.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) }).catch(() => null);
		setSaving(false);
		if (!res) return setServerError("The app did not answer. Try again.");
		const data = (await res.json().catch(() => ({}))) as { sheet?: Cheatsheet; message?: string };
		if (!res.ok || !data.sheet) return setServerError(data.message ?? "The cheatsheet was not saved.");
		onSaved(data.sheet);
	};

	let status: React.ReactNode = null;
	const shownError = serverError ?? switchError ?? textParse?.error ?? null;
	if (shownError) status = <span className="text-miss">{shownError}</span>;
	else if (overlap) status = <span className="text-ink-2">{`${overlap.fresh} new · ${overlap.shared} already here`}</span>;
	else if (phrases > 0) {
		const names = current.map((s) => s.title || "Phrases");
		const list = names.slice(0, 4).join(", ") + (names.length > 4 ? ` +${names.length - 4} more` : "");
		status = <span className="text-ink-2">{`${plural(phrases, "phrase")} in ${plural(current.length, "section")}: ${list}`}</span>;
	}

	return (
		<div className="lh-fade fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cheatsheet-dialog-title" className="lh-menu-in q-card flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col gap-4 overflow-y-auto p-5 sm:p-6" data-testid="cheatsheet-dialog">
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
							placeholder="Sample sheet"
							maxLength={120}
							className={cn(FIELD, "mt-1 h-10")}
							data-testid="cheatsheet-title"
						/>
					</label>
				)}

				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="q-segc" role="radiogroup" aria-label="How to edit the phrases">
							<button type="button" role="radio" aria-checked={view === "table"} className={cn(view === "table" && "on")} onClick={() => switchTo("table")} data-testid="cheatsheet-view-table">
								Table
							</button>
							<button type="button" role="radio" aria-checked={view === "text"} className={cn(view === "text" && "on")} onClick={() => switchTo("text")} data-testid="cheatsheet-view-text">
								Text
							</button>
						</div>
						{view === "text" && (
							<button type="button" className="font-ui text-xs font-medium text-teal-2 hover:underline" onClick={() => fileRef.current?.click()}>
								<UploadIcon className="mr-1 inline size-3.5 align-[-2px]" />
								{fileName ?? "From a text file"}
							</button>
						)}
					</div>

					{view === "table" ? (
						<div className="space-y-6" data-testid="cheatsheet-table">
							{draft.map((section, si) => (
								<div key={section.key} className="space-y-2">
									<div className="flex items-center gap-2">
										<input
											type="text"
											aria-label="Section name"
											value={section.title}
											onChange={(e) => updateSection(section.key, { title: e.target.value })}
											placeholder={si === 0 ? "Section name (optional)" : "Section name"}
											maxLength={120}
											className={cn(FIELD, "h-10 font-ui text-[15px] font-semibold")}
										/>
										<button type="button" aria-label="Remove section" onClick={() => removeSection(section.key)} className={ICON_BUTTON}>
											<Trash2Icon className="size-4" />
										</button>
									</div>

									<div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_2.25rem] gap-2 px-0.5 font-ui text-xs text-ink-3 sm:grid">
										<span>Phrase</span>
										<span>Say it</span>
										<span>Meaning</span>
										<span>Note</span>
										<span />
									</div>

									{section.rows.map((row) => (
										<div key={row.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_2.25rem]">
											<input type="text" aria-label="Phrase" value={row.text} onChange={(e) => updateRow(section.key, row.key, "text", e.target.value)} placeholder="phrase" className={cn(FIELD, "col-span-2 sm:col-span-1")} lang="ru" />
											<input type="text" aria-label="Say it" value={row.pron} onChange={(e) => updateRow(section.key, row.key, "pron", e.target.value)} placeholder="say it" className={cn(FIELD, "font-ui text-[13px] text-ink-2")} />
											<input type="text" aria-label="Meaning" value={row.meaning} onChange={(e) => updateRow(section.key, row.key, "meaning", e.target.value)} placeholder="meaning" className={FIELD} lang="en" />
											<input type="text" aria-label="Note" value={row.note} onChange={(e) => updateRow(section.key, row.key, "note", e.target.value)} placeholder="note" className={cn(FIELD, "font-ui text-[13px] text-ink-2")} />
											<button type="button" aria-label="Remove phrase" onClick={() => removeRow(section.key, row.key)} className={cn(ICON_BUTTON, "justify-self-end")}>
												<Trash2Icon className="size-4" />
											</button>
										</div>
									))}

									<button type="button" onClick={() => addRow(section.key)} className="q-btn ghost -ml-2.5">
										<PlusIcon className="size-4" />
										Add phrase
									</button>
								</div>
							))}
							<button type="button" onClick={addSection} className="q-btn sec" data-testid="cheatsheet-add-section">
								<PlusIcon className="size-4" />
								Add section
							</button>
						</div>
					) : (
						<>
							<span className="block font-ui text-xs text-ink-3">One phrase per line: phrase | say it | meaning. A line with no | is a section name.</span>
							<textarea
								value={text}
								onChange={(e) => {
									setText(e.target.value);
									setServerError(null);
									setSwitchError(null);
								}}
								rows={14}
								spellCheck={false}
								autoFocus
								placeholder={"Desk\nПускаем? | poos-KA-yem? | Do we let it in?\nНе пускаем. | nye poos-KA-yem | We don't let it in."}
								className="w-full resize-y rounded-md border border-border bg-well px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground outline-none focus:border-primary"
								data-testid="cheatsheet-text"
							/>
						</>
					)}
				</div>

				<input
					ref={fileRef}
					type="file"
					accept=".txt,text/plain"
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
						<button type="submit" className="q-btn primary" disabled={!canSave} data-testid="cheatsheet-save">
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
								{plural(cheatsheetRowCount(sheet), "phrase")} · {sheet.updatedAt ? `edited ${dateLabel(sheet.updatedAt)}` : `made ${dateLabel(sheet.importedAt)}`}
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
									<button type="button" className="q-btn ghost" onClick={() => setDialog({ kind: "edit", sheet })} data-testid="cheatsheet-edit">
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
						{sections.length > 1 && (
							<ChoiceMenu
								value={jump}
								onChange={(next) => {
									setJump(next);
									document.getElementById(`cs-${next}`)?.scrollIntoView({ block: "start" });
								}}
								ariaLabel="Jump to a section"
								className="w-full sm:ml-auto sm:w-64"
								options={[{ value: "", label: "Jump to a section" }, ...sections.map((s) => ({ value: s.id, label: s.title }))]}
							/>
						)}
					</div>

					{sections.map((section) => (
						<section key={section.id} id={`cs-${section.id}`} className="scroll-mt-6 space-y-3">
							<h3 className="q-sh !mb-0">{section.title}</h3>
							<ul className="q-card divide-y divide-border/70 overflow-hidden">
								{section.rows.map((row, i) => {
									const key = `${section.id}:${i}`;
									return <CheatRowItem key={key} row={row} tag={lang?.tag} hidden={cover && !shown.has(key)} onReveal={() => setShown((prev) => new Set(prev).add(key))} />;
								})}
							</ul>
						</section>
					))}
				</>
			)}

			{dialog && (
				<SheetDialog
					mode={dialog}
					onClose={() => setDialog(null)}
					onSaved={() => {
						setDialog(null);
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
