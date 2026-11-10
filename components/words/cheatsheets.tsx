"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, FileTextIcon, FolderGit2Icon, HeadphonesIcon, PencilIcon, PlusIcon, RepeatIcon, SearchIcon, Trash2Icon, UploadIcon, Volume2Icon, XIcon } from "lucide-react";
import { EmptyState } from "@/components/quiet/empty-state";
import { speak, useActiveLanguage } from "@/components/speech";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { cn } from "@/lib/utils";
import { CheatsheetParseError, cheatsheetRowCount, countOverlap, formatSheetText, parseSheetText, searchSections, type Cheatsheet, type CheatRow, type CheatsheetSummary, type CheatSection, type SheetProgress } from "@/src/core";

interface ReviewState {
	inDictionary: number;
	inReview: number;
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function listenHref(sheetId: string, sectionId?: string): string {
	const href = `/listen?sheet=${encodeURIComponent(sheetId)}`;
	return sectionId ? `${href}&section=${encodeURIComponent(sectionId)}` : href;
}

/** The sheet's address, so a link (or a second window during a game) opens it directly. */
function setSheetInUrl(id: string | null) {
	const url = new URL(window.location.href);
	url.searchParams.set("tab", "cheatsheets");
	if (id) url.searchParams.set("sheet", id);
	else url.searchParams.delete("sheet");
	window.history.replaceState(null, "", url);
}

function SearchField({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
	return (
		<div className="relative min-w-0 flex-1">
			<SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
			<input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off" spellCheck={false} className="q-field h-10 w-full rounded-xl pl-10 pr-10 font-prose text-[15px]" />
			{value && (
				<button type="button" onClick={() => onChange("")} aria-label="Clear the search" className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:bg-well hover:text-foreground">
					<XIcon className="size-4" />
				</button>
			)}
		</div>
	);
}

export function CheatsheetsTab({ initialSheet, onCount }: { initialSheet?: string; onCount?: (n: number) => void }) {
	const [sheets, setSheets] = useState<CheatsheetSummary[] | null>(null);
	const [openId, setOpenId] = useState<string | null>(initialSheet ?? null);
	const [creating, setCreating] = useState(false);
	const [query, setQuery] = useState("");
	// The sheets whose title or phrases hold the search; null while the answer is on its way.
	const [found, setFound] = useState<CheatsheetSummary[] | null>(null);

	useEffect(() => {
		const q = query.trim();
		if (!q) return;
		const ctl = new AbortController();
		const t = window.setTimeout(() => {
			void fetch(`/api/cheatsheets?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
				.then((res) => (res.ok ? (res.json() as Promise<{ sheets: CheatsheetSummary[] }>) : null))
				.then((data) => setFound(data?.sheets ?? []))
				.catch(() => {});
		}, 150);
		return () => {
			window.clearTimeout(t);
			ctl.abort();
		};
	}, [query]);

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
				key={openId}
				id={openId}
				onBack={() => open(null)}
				onChanged={() => void load()}
				onMoved={(newId) => {
					open(newId);
					void load();
				}}
				onRemoved={() => {
					open(null);
					void load();
				}}
			/>
		);
	}

	const searching = query.trim() !== "";
	const shownSheets = searching ? found : sheets;

	return (
		<div className="space-y-4" data-testid="cheatsheets">
			<div className="flex items-center gap-3">
				<SearchField value={query} onChange={(v) => { setQuery(v); if (!v.trim()) setFound(null); }} placeholder="Search your cheatsheets and their phrases" label="Search cheatsheets" />
				<button type="button" className="q-btn primary shrink-0" onClick={() => setCreating(true)} data-testid="cheatsheet-new">
					<PlusIcon className="size-4" />
					New cheatsheet
				</button>
			</div>

			<div className="min-h-[120px]">
				{shownSheets && shownSheets.length > 0 && (
					<ul className="q-card border border-border/70 divide-y divide-border/70 overflow-hidden" data-testid="cheatsheet-list">
						{shownSheets.map((s) => (
							<li key={s.id}>
								<button type="button" onClick={() => open(s.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-well">
									<FileTextIcon className="size-4 shrink-0 text-ink-3" />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-ui text-[15px] font-semibold text-foreground">{s.title}</span>
										<span className="block font-ui text-xs text-muted-foreground">
											{plural(s.rows, "phrase")} · {s.repoFile ? "in the repo" : dateLabel(s.updatedAt ?? s.importedAt)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
				{searching && found?.length === 0 && (
					<EmptyState testid="cheatsheets-no-match" title="Nothing matches">
						<p>No cheatsheet has that in its title or its phrases. Accents are optional.</p>
					</EmptyState>
				)}
				{!searching && sheets && sheets.length === 0 && (
					<EmptyState testid="cheatsheets-empty" title="No cheatsheets yet">
						<p>A cheatsheet is a list of phrases you keep at hand. Press New cheatsheet to make one.</p>
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
 *  It edits as a table; the text view pastes a list, such as an assistant's answer, as one phrase per line. */
type DialogMode = { kind: "new" } | { kind: "add"; sheet: Cheatsheet } | { kind: "edit"; sheet: Cheatsheet };

type RowField = keyof Omit<DraftRow, "key">;

const FIELD = "h-9 w-full min-w-0 rounded-md border border-border bg-well px-2.5 font-prose text-sm text-foreground outline-none focus:border-primary";
const ICON_BUTTON = "grid size-9 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-well hover:text-miss";
const COLUMNS = "grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_2.25rem]";

const isFilled = (r: DraftRow) => !!(r.text.trim() || r.pron.trim() || r.meaning.trim() || r.note.trim());

/** One phrase's inputs. Memoised, so typing in one row of a long sheet re-renders that row only. */
const RowFields = memo(function RowFields({
	sectionKey,
	row,
	tag,
	onChange,
	onRemove,
	onEnter,
}: {
	sectionKey: number;
	row: DraftRow;
	tag?: string;
	onChange: (sectionKey: number, rowKey: number, field: RowField, value: string) => void;
	onRemove: (sectionKey: number, rowKey: number) => void;
	onEnter: (sectionKey: number, from: HTMLElement) => void;
}) {
	const input = (field: RowField, label: string, className: string, lang?: string) => (
		<input
			type="text"
			aria-label={label}
			placeholder={label.toLowerCase()}
			value={row[field]}
			lang={lang}
			onChange={(e) => onChange(sectionKey, row.key, field, e.target.value)}
			onKeyDown={(e) => {
				if (e.key !== "Enter" || e.nativeEvent.isComposing || e.metaKey || e.ctrlKey) return;
				e.preventDefault();
				onEnter(sectionKey, e.currentTarget);
			}}
			className={className}
		/>
	);
	return (
		<div data-row-key={row.key} className={cn(COLUMNS, "[contain:layout_paint] max-sm:border-b max-sm:border-border/60 max-sm:pb-3")}>
			{input("text", "Phrase", cn(FIELD, "col-span-2 sm:col-span-1"), tag)}
			{input("pron", "Say it", cn(FIELD, "font-ui text-[13px] text-ink-2"))}
			{input("meaning", "Meaning", FIELD, "en")}
			{input("note", "Note", cn(FIELD, "font-ui text-[13px] text-ink-2"))}
			<button type="button" aria-label="Remove phrase" onClick={() => onRemove(sectionKey, row.key)} className={cn(ICON_BUTTON, "justify-self-end")}>
				<Trash2Icon className="size-4" />
			</button>
		</div>
	);
});

/** One section of the table: its name and its phrases. Memoised with RowFields, so a keystroke rebuilds only the section being typed in. */
const SectionEditor = memo(function SectionEditor({
	section,
	first,
	confirming,
	tag,
	onRename,
	onRemove,
	onKeep,
	onAddRow,
	onFirstPhrase,
	onChange,
	onRemoveRow,
	onEnter,
}: {
	section: DraftSection;
	first: boolean;
	confirming: boolean;
	tag?: string;
	onRename: (sectionKey: number, title: string) => void;
	onRemove: (sectionKey: number, filled: boolean, confirmed: boolean) => void;
	onKeep: () => void;
	onAddRow: (sectionKey: number) => void;
	onFirstPhrase: (sectionKey: number) => void;
	onChange: (sectionKey: number, rowKey: number, field: RowField, value: string) => void;
	onRemoveRow: (sectionKey: number, rowKey: number) => void;
	onEnter: (sectionKey: number, from: HTMLElement) => void;
}) {
	const filled = section.rows.filter(isFilled).length;
	return (
		<div data-section-key={section.key} className="scroll-mt-2 space-y-2 [contain-intrinsic-size:auto_520px] [content-visibility:auto]">
			<div className="flex items-center gap-2">
				<input
					type="text"
					aria-label="Section name"
					value={section.title}
					onChange={(e) => onRename(section.key, e.target.value)}
					onKeyDown={(e) => {
						if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
						e.preventDefault();
						onFirstPhrase(section.key);
					}}
					placeholder={first ? "Section name (optional)" : "Section name"}
					maxLength={120}
					className={cn(FIELD, "h-10 font-ui text-[15px] font-semibold")}
				/>
				{confirming ? (
					<span className="flex shrink-0 items-center gap-1">
						<button type="button" className="q-btn ghost text-miss" onClick={() => onRemove(section.key, filled > 0, true)} data-testid="cheatsheet-remove-section-yes">
							Remove {plural(filled, "phrase")}
						</button>
						<button type="button" className="q-btn ghost" onClick={onKeep}>
							Keep
						</button>
					</span>
				) : (
					<button type="button" aria-label="Remove section" onClick={() => onRemove(section.key, filled > 0, false)} className={ICON_BUTTON}>
						<Trash2Icon className="size-4" />
					</button>
				)}
			</div>

			<div className={cn(COLUMNS, "hidden px-0.5 font-ui text-xs text-ink-3 sm:grid")} aria-hidden="true">
				<span>Phrase</span>
				<span>Say it</span>
				<span>Meaning</span>
				<span>Note</span>
				<span />
			</div>

			<div className="space-y-2 max-sm:space-y-3">
				{section.rows.map((row) => (
					<RowFields key={row.key} sectionKey={section.key} row={row} tag={tag} onChange={onChange} onRemove={onRemoveRow} onEnter={onEnter} />
				))}
			</div>

			<button type="button" onClick={() => onAddRow(section.key)} className="q-btn ghost -ml-2.5">
				<PlusIcon className="size-4" />
				Add phrase
			</button>
		</div>
	);
});

function SheetDialog({ mode, onClose, onSaved }: { mode: DialogMode; onClose: () => void; onSaved: (sheet: Cheatsheet) => void }) {
	const lang = useActiveLanguage();
	// Adding to a sheet is mostly pasting a list; writing or editing one is the table.
	const [view, setView] = useState<"table" | "text">(mode.kind === "add" ? "text" : "table");
	const [draft, setDraft] = useState<DraftSection[]>(() => (mode.kind === "edit" ? draftFromSections(mode.sheet.sections) : [emptySection()]));
	const [text, setText] = useState("");
	const [switchError, setSwitchError] = useState<string | null>(null);
	const [title, setTitle] = useState(mode.kind === "edit" ? mode.sheet.title : "");
	const [fileName, setFileName] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [confirmSection, setConfirmSection] = useState<number | null>(null);
	const [confirmClose, setConfirmClose] = useState(false);
	const [jump, setJump] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);
	// A selector to focus once the draft has rendered (a new row or section).
	const pendingFocus = useRef<string | null>(null);

	const textParse = useMemo(() => (view === "text" ? parseOrError(text) : null), [view, text]);
	const current = useMemo(() => (view === "table" ? sectionsFromDraft(draft) : (textParse?.sections ?? [])), [view, draft, textParse]);
	const phrases = phraseCount(current);
	const overlap = mode.kind === "add" && phrases > 0 ? countOverlap(mode.sheet.sections, current) : null;
	const nothingNew = !!overlap && overlap.fresh === 0;
	const canSave = phrases > 0 && !saving && !nothingNew && !textParse?.error;

	const initial = useMemo(() => ({ body: mode.kind === "edit" ? formatSheetText(mode.sheet.sections) : "", title: mode.kind === "edit" ? mode.sheet.title : "" }), [mode]);
	const body = useMemo(() => (view === "table" ? formatSheetText(current) : text), [view, current, text]);
	const dirty = body.trim() !== initial.body.trim() || title.trim() !== initial.title.trim();

	const heading = mode.kind === "new" ? "New cheatsheet" : mode.kind === "add" ? `Add phrases to ${mode.sheet.title}` : "Edit cheatsheet";
	const action = mode.kind === "edit" ? "Save" : mode.kind === "add" ? (nothingNew ? "Nothing new" : `Add ${plural(overlap?.fresh ?? 0, "phrase")}`) : "Create";

	const requestClose = useCallback(() => {
		if (dirty) setConfirmClose(true);
		else onClose();
	}, [dirty, onClose]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			if (confirmClose) setConfirmClose(false);
			else requestClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [confirmClose, requestClose]);

	useEffect(() => {
		const selector = pendingFocus.current;
		if (!selector) return;
		pendingFocus.current = null;
		const el = bodyRef.current?.querySelector<HTMLInputElement>(selector);
		el?.focus();
		el?.scrollIntoView({ block: "nearest" });
	}, [draft]);

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

	const updateRow = useCallback((sectionKey: number, rowKey: number, field: RowField, value: string) => {
		setDraft((d) => d.map((s) => (s.key !== sectionKey ? s : { ...s, rows: s.rows.map((r) => (r.key === rowKey ? { ...r, [field]: value } : r)) })));
	}, []);

	const removeRow = useCallback((sectionKey: number, rowKey: number) => {
		setDraft((d) =>
			d.map((s) => {
				if (s.key !== sectionKey) return s;
				const rows = s.rows.filter((r) => r.key !== rowKey);
				return { ...s, rows: rows.length ? rows : [emptyRow()] };
			}),
		);
	}, []);

	const addRow = useCallback((sectionKey: number) => {
		const row = emptyRow();
		pendingFocus.current = `[data-row-key="${row.key}"] input`;
		setDraft((d) => d.map((s) => (s.key === sectionKey ? { ...s, rows: [...s.rows, row] } : s)));
	}, []);

	/** Enter goes down to the next phrase, and past the last one starts a new phrase. */
	const onEnter = useCallback(
		(sectionKey: number, from: HTMLElement) => {
			const next = from.closest("[data-row-key]")?.nextElementSibling;
			const input = next?.matches("[data-row-key]") ? next.querySelector("input") : null;
			if (input) input.focus();
			else addRow(sectionKey);
		},
		[addRow],
	);

	const addSection = () => {
		const section = emptySection();
		pendingFocus.current = `[data-section-key="${section.key}"] input`;
		setDraft((d) => [...d, section]);
	};

	const removeSection = useCallback((sectionKey: number, filled: boolean, confirmed: boolean) => {
		if (filled && !confirmed) return setConfirmSection(sectionKey);
		setConfirmSection(null);
		setDraft((d) => (d.length > 1 ? d.filter((s) => s.key !== sectionKey) : [emptySection()]));
	}, []);
	const keepSection = useCallback(() => setConfirmSection(null), []);
	const renameSection = useCallback((sectionKey: number, value: string) => setDraft((d) => d.map((s) => (s.key === sectionKey ? { ...s, title: value } : s))), []);

	const focusFirstPhrase = useCallback((sectionKey?: number) => {
		const scope = sectionKey === undefined ? bodyRef.current : bodyRef.current?.querySelector(`[data-section-key="${sectionKey}"]`);
		scope?.querySelector<HTMLInputElement>("[data-row-key] input")?.focus();
	}, []);

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
		if (!res.ok || !data.sheet) return setServerError(data.message ?? "The cheatsheet was not saved. Try again.");
		onSaved(data.sheet);
	};

	let status: React.ReactNode = null;
	const shownError = serverError ?? switchError ?? textParse?.error ?? null;
	if (shownError) status = <span className="text-miss">{shownError}</span>;
	else if (overlap) status = <span className="text-ink-2">{`${overlap.fresh} new · ${overlap.shared} already here`}</span>;
	else if (phrases > 0) status = <span className="text-ink-2">{`${plural(phrases, "phrase")} in ${plural(current.length, "section")}`}</span>;

	return (
		<div className="lh-fade fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
			<form
				ref={formRef}
				onSubmit={submit}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						formRef.current?.requestSubmit();
					}
				}}
				role="dialog"
				aria-modal="true"
				aria-labelledby="cheatsheet-dialog-title"
				className="lh-menu-in q-card flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden"
				data-testid="cheatsheet-dialog"
			>
				<div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
					<h2 id="cheatsheet-dialog-title" className="truncate font-title text-xl font-semibold text-foreground">
						{heading}
					</h2>
					<button type="button" onClick={requestClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-well hover:text-foreground">
						<XIcon className="size-5" />
					</button>
				</div>

				<div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6" data-testid="cheatsheet-dialog-body">
					{mode.kind !== "add" && (
						<label className="block">
							<span className="font-ui text-xs font-semibold text-muted-foreground">Title</span>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
									e.preventDefault();
									if (view === "table") focusFirstPhrase();
								}}
								placeholder="Sample sheet"
								maxLength={120}
								className={cn(FIELD, "mt-1 h-10")}
								data-testid="cheatsheet-title"
							/>
						</label>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<div className="q-segc" role="radiogroup" aria-label="Edit as">
							<button type="button" role="radio" aria-checked={view === "table"} className={cn(view === "table" && "on")} onClick={() => switchTo("table")} data-testid="cheatsheet-view-table">
								Table
							</button>
							<button type="button" role="radio" aria-checked={view === "text"} className={cn(view === "text" && "on")} onClick={() => switchTo("text")} data-testid="cheatsheet-view-text">
								Text
							</button>
						</div>
						{view === "text" && (
							<button type="button" className="ml-auto font-ui text-xs font-medium text-teal-2 hover:underline" onClick={() => fileRef.current?.click()}>
								<UploadIcon className="mr-1 inline size-3.5 align-[-2px]" />
								{fileName ?? "From a text file"}
							</button>
						)}
						{view === "table" && draft.length > 3 && (
							<ChoiceMenu
								value={jump}
								onChange={(next) => {
									setJump(next);
									bodyRef.current?.querySelector(`[data-section-key="${next}"]`)?.scrollIntoView({ block: "start" });
								}}
								ariaLabel="Jump to a section"
								className="w-full sm:ml-auto sm:w-64"
								options={[{ value: "", label: "Jump to a section" }, ...draft.map((s) => ({ value: String(s.key), label: s.title.trim() || "Untitled section" }))]}
							/>
						)}
					</div>

					{view === "table" ? (
						<div className="space-y-6" data-testid="cheatsheet-table">
							{draft.map((section, si) => (
								<SectionEditor
									key={section.key}
									section={section}
									first={si === 0}
									confirming={confirmSection === section.key}
									tag={lang?.tag}
									onRename={renameSection}
									onRemove={removeSection}
									onKeep={keepSection}
									onAddRow={addRow}
									onFirstPhrase={focusFirstPhrase}
									onChange={updateRow}
									onRemoveRow={removeRow}
									onEnter={onEnter}
								/>
							))}
							<button type="button" onClick={addSection} className="q-btn sec" data-testid="cheatsheet-add-section">
								<PlusIcon className="size-4" />
								Add section
							</button>
						</div>
					) : (
						<div className="space-y-2">
							<span className="block font-ui text-xs text-ink-3">One phrase per line: phrase | say it | meaning | note. A line with no | is a section name.</span>
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
								className="q-field w-full resize-y rounded-md px-3 py-2 font-mono text-[13px] leading-relaxed"
								data-testid="cheatsheet-text"
							/>
						</div>
					)}

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
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-5 py-3.5 sm:px-6" data-testid="cheatsheet-dialog-footer">
					{confirmClose ? (
						<>
							<p className="font-ui text-sm text-ink-2">Discard your changes?</p>
							<div className="ml-auto flex items-center gap-2">
								<button type="button" className="q-btn ghost" onClick={() => setConfirmClose(false)} data-testid="cheatsheet-keep-editing">
									Keep editing
								</button>
								<button type="button" className="q-btn sec text-miss" onClick={onClose} data-testid="cheatsheet-discard">
									Discard
								</button>
							</div>
						</>
					) : (
						<>
							<p className="min-h-5 font-ui text-xs" aria-live="polite" data-testid="cheatsheet-preview">
								{status}
							</p>
							<div className="ml-auto flex items-center gap-2">
								<button type="button" className="q-btn ghost" onClick={requestClose}>
									Cancel
								</button>
								<button type="submit" className="q-btn primary" disabled={!canSave} data-testid="cheatsheet-save">
									{saving ? "Saving…" : action}
								</button>
							</div>
						</>
					)}
				</div>
			</form>
		</div>
	);
}

function CheatsheetView({ id, onBack, onChanged, onMoved, onRemoved }: { id: string; onBack: () => void; onChanged: () => void; onMoved: (newId: string) => void; onRemoved: () => void }) {
	const lang = useActiveLanguage();
	const [sheet, setSheet] = useState<Cheatsheet | null>(null);
	const [missing, setMissing] = useState(false);
	const [review, setReview] = useState<ReviewState | null>(null);
	const [heard, setHeard] = useState<SheetProgress | null>(null);
	const [reviewNote, setReviewNote] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [cover, setCover] = useState(false);
	const [shown, setShown] = useState<Set<string>>(() => new Set());
	const [confirmRemove, setConfirmRemove] = useState(false);
	const [dialog, setDialog] = useState<DialogMode | null>(null);
	const [jump, setJump] = useState("");
	const [find, setFind] = useState("");

	const load = useCallback(async () => {
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}`).catch(() => null);
		if (!res?.ok) return setMissing(true);
		const data = (await res.json()) as { sheet: Cheatsheet; review: ReviewState; listen: SheetProgress };
		setSheet(data.sheet);
		setReview(data.review);
		setHeard(data.listen);
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
		setReviewNote(data.added.length ? `Added ${plural(data.added.length, "word")} to Review.` : "None of these words has a dictionary sentence yet, so none was added.");
	};

	const [moveError, setMoveError] = useState<string | null>(null);
	const toRepo = async () => {
		setMoveError(null);
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}/to-repo`, { method: "POST" }).catch(() => null);
		const data = (await res?.json().catch(() => ({}))) as { sheet?: Cheatsheet; message?: string } | undefined;
		if (!res?.ok || !data?.sheet) return setMoveError(data?.message ?? "The sheet was not moved. Try again.");
		onMoved(data.sheet.id);
	};

	const remove = async () => {
		const res = await fetch(`/api/cheatsheets/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
		if (res?.ok) onRemoved();
	};

	const setMode = (next: boolean) => {
		setCover(next);
		setShown(new Set());
	};

	const sections = useMemo(() => searchSections(sheet?.sections ?? [], find, lang?.tag), [sheet, find, lang?.tag]);

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

	return (
		<div className="min-h-[60vh] space-y-5" data-testid="cheatsheet-view">
			<button type="button" onClick={onBack} className="q-btn ghost -ml-2.5">
				<ArrowLeftIcon className="size-4" />
				All cheatsheets
			</button>

			{!sheet && (
				<div className="space-y-3" aria-busy="true" aria-label="Loading the cheatsheet" data-testid="cheatsheet-loading">
					<div className="h-8 w-56 rounded-lg bg-well" />
					<div className="h-4 w-32 rounded-md bg-well" />
					<div className="q-card h-48" />
				</div>
			)}

			{sheet && (
				<>
					<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
						<div className="min-w-0 space-y-1">
							<h2 className="font-title text-2xl font-semibold tracking-tight text-foreground">{sheet.title}</h2>
							<p className="font-ui text-xs text-muted-foreground">
								{plural(cheatsheetRowCount(sheet), "phrase")} · {sheet.repoFile ? `in the repo: ${sheet.repoFile}` : sheet.updatedAt ? `edited ${dateLabel(sheet.updatedAt)}` : `made ${dateLabel(sheet.importedAt)}`}
							</p>
							{moveError && <p className="font-ui text-xs text-miss">{moveError}</p>}
						</div>
						<span className="flex flex-wrap items-center gap-1">
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
									{!sheet.repoFile && (
										<>
											<button type="button" className="q-btn ghost" onClick={() => void toRepo()} title="Keep it in the repo, as a text file you can commit" data-testid="cheatsheet-to-repo">
												<FolderGit2Icon className="size-4" />
												Move to repo
											</button>
											<button type="button" className="q-btn ghost" onClick={() => setConfirmRemove(true)} data-testid="cheatsheet-remove">
												<Trash2Icon className="size-4" />
												Remove
											</button>
										</>
									)}
								</>
							)}
						</span>
					</div>

					{heard && heard.lines > 0 && (
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="cheatsheet-listen">
							<Link href={listenHref(sheet.id)} className="q-btn primary pointer-coarse:min-h-11" data-testid="cheatsheet-listen-start">
								<HeadphonesIcon className="size-4" />
								Listen and type
							</Link>
							<p className="font-ui text-[13px] text-ink-3" data-testid="cheatsheet-listen-progress">
								{heard.heard === 0
									? "Ten phrases at a time, heard before they are seen."
									: `${heard.caught} of ${heard.lines} caught by ear · ${heard.heard} heard so far`}
							</p>
						</div>
					)}

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

					<SearchField value={find} onChange={setFind} placeholder="Search this sheet by phrase, meaning or note" label="Search this cheatsheet" />
					{find.trim() && sections.length === 0 && (
						<p className="font-prose text-[15px] text-ink-3" data-testid="cheatsheet-find-empty">
							Nothing in this sheet matches “{find.trim()}”. Accents are optional.
						</p>
					)}

					{sections.map((section) => (
						<section key={section.id} id={`cs-${section.id}`} className="scroll-mt-6 space-y-3 [contain-intrinsic-size:auto_900px] [content-visibility:auto]">
							<h3 className="q-sh !mb-0">
								{section.title}
								<Link
									href={listenHref(sheet.id, section.id)}
									aria-label={`Listen to ${section.title}`}
									className="order-3 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-[550] text-ink-3 hover:text-ink-2 pointer-coarse:min-h-11"
									data-testid="cheatsheet-listen-section"
								>
									<HeadphonesIcon className="size-3.5" strokeWidth={1.8} />
									Listen
								</Link>
							</h3>
							<ul className="q-card border border-border/70 divide-y divide-border/70 overflow-hidden">
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
