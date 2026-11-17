"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ClockIcon, GlobeIcon, LinkIcon, PlayIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { NoteEditor, type NoteEditorHandle } from "@/components/notes/note-editor";
import { SidebarToggle } from "@/components/sidebar";
import { loadYouTubeApi, type YTPlayer } from "@/components/watch/youtube-api";
import { cn } from "@/lib/utils";
import {
	MAX_NOTE_LINKS,
	MAX_NOTE_TITLE,
	normalizeLink,
	noteHeading,
	noteVideo,
	noteWords,
	plainText,
	type Note,
	type NoteLink,
} from "@/src/core";

const SAVE_AFTER_MS = 700;

type Change = { title?: string; body?: string; links?: string[] };

async function send(id: string | null, change: Change): Promise<Note> {
	const res = await fetch(id ? `/api/notes?id=${encodeURIComponent(id)}` : "/api/notes", {
		method: id ? "PATCH" : "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(change),
		keepalive: true,
	});
	const out = (await res.json().catch(() => null)) as { note?: Note; message?: string } | null;
	if (!res.ok || !out?.note) throw new Error(out?.message ?? "The note was not saved.");
	return out.note;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayGroup(iso: string, now = new Date()): string {
	const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 7) return "This week";
	return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shortWhen(iso: string, now = new Date()): string {
	const d = new Date(iso);
	const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
	if (days <= 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function longDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function prettyUrl(url: string): string {
	try {
		const u = new URL(url);
		const rest = decodeURIComponent(u.pathname + u.search).replace(/\/$/, "");
		return `${u.hostname.replace(/^www\./, "")}${rest}`;
	} catch {
		return url;
	}
}

function snippet(note: Note): string {
	const lines = plainText(note.body)
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	return (note.title?.trim() ? lines : lines.slice(1)).join(" · ");
}

const newestFirst = (notes: Note[]) => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

// ─── The list ───────────────────────────────────────────────────────────────

export function NoteList({
	notes,
	selectedId,
	onSelect,
	hrefFor,
}: {
	notes: Note[];
	selectedId?: string | null;
	onSelect?: (id: string) => void;
	hrefFor?: (id: string) => string;
}) {
	const groups: Array<{ label: string; notes: Note[] }> = [];
	for (const n of notes) {
		const label = dayGroup(n.updatedAt);
		const last = groups.at(-1);
		if (last?.label === label) last.notes.push(n);
		else groups.push({ label, notes: [n] });
	}
	return (
		<div className="flex flex-col gap-4" data-testid="notes-list">
			{groups.map((g) => (
				<section key={g.label} aria-label={g.label}>
					<h2 className="mb-1 px-3 font-ui text-[12.5px] font-[600] text-ink-3">{g.label}</h2>
					<ul className="flex flex-col gap-0.5">
						{g.notes.map((n) => {
							const on = n.id === selectedId;
							const rest = snippet(n);
							const hasVideo = !!noteVideo(n);
							const linkCount = n.links?.length ?? 0;
							const inner = (
								<>
									<span className="flex items-baseline gap-2">
										<span className="min-w-0 flex-1 truncate font-ui text-[15px] font-[600] text-foreground">
											{noteHeading(n)}
										</span>
										<span className="shrink-0 font-ui text-[12px] tabular-nums text-ink-3">
											{shortWhen(n.updatedAt)}
										</span>
									</span>
									<span className="mt-0.5 flex items-center gap-1.5">
										{hasVideo ? (
											<PlayIcon
												className="size-3 shrink-0 fill-current text-teal-2"
												strokeWidth={0}
												aria-label="Has a video"
											/>
										) : linkCount > 0 ? (
											<LinkIcon className="size-3 shrink-0 text-teal-2" strokeWidth={2} aria-label="Has links" />
										) : null}
										<span className="min-w-0 truncate font-prose text-[13.5px] text-ink-3">
											{rest || n.links?.[0]?.title || "No text yet"}
										</span>
									</span>
								</>
							);
							const cls = cn(
								"block w-full rounded-xl px-3 py-2.5 text-left transition-colors",
								on ? "bg-well" : "hover:bg-well/60",
							);
							return (
								<li key={n.id}>
									{hrefFor ? (
										<Link href={hrefFor(n.id)} className={cls} data-testid="notes-row">
											{inner}
										</Link>
									) : (
										<button
											type="button"
											onClick={() => onSelect?.(n.id)}
											aria-current={on ? "true" : undefined}
											className={cls}
											data-testid="notes-row"
										>
											{inner}
										</button>
									)}
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}

// ─── The page ───────────────────────────────────────────────────────────────

const ROW = "flex h-12 items-center";

export function NotesPage({
	initial,
	initialId,
	fresh,
}: {
	initial: Note[];
	initialId: string | null;
	fresh: boolean;
}) {
	const [notes, setNotes] = useState(() => newestFirst(initial));
	const [selectedId, setSelectedId] = useState<string | null>(() =>
		fresh ? null : initial.some((n) => n.id === initialId) ? initialId : (newestFirst(initial)[0]?.id ?? null),
	);
	const [chosen, setChosen] = useState(fresh || !!initialId);
	const [sheetKey, setSheetKey] = useState(0);

	const showUrl = (url: string) => {
		try {
			window.history.replaceState(null, "", url);
		} catch {}
	};

	const select = (id: string) => {
		setSelectedId(id);
		setSheetKey((k) => k + 1);
		setChosen(true);
		showUrl(`/notes?id=${encodeURIComponent(id)}`);
	};

	const startNew = () => {
		setSelectedId(null);
		setSheetKey((k) => k + 1);
		setChosen(true);
		showUrl("/notes?new=1");
	};

	const saved = useCallback((note: Note) => {
		setNotes((all) => [note, ...all.filter((n) => n.id !== note.id)]);
		setSelectedId((cur) => {
			if (cur === null) showUrl(`/notes?id=${encodeURIComponent(note.id)}`);
			return note.id;
		});
	}, []);

	const deleted = (id: string) => {
		const rest = notes.filter((n) => n.id !== id);
		setNotes(rest);
		setSelectedId(rest[0]?.id ?? null);
		setSheetKey((k) => k + 1);
		setChosen(false);
		showUrl("/notes");
	};

	const selected = notes.find((n) => n.id === selectedId) ?? null;

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lanna-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-20 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-ink-3 hover:text-ink-2 lanna-no-drag"
				>
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
			</header>
			<main className="lanna-rise @container mx-auto w-full max-w-7xl px-5" data-testid="notes-page">
				<div className="grid @4xl:grid-cols-[19rem_minmax(0,1fr)]">
					<aside
						className={cn(
							"flex min-w-0 flex-col pb-10 @4xl:sticky @4xl:top-13 @4xl:h-[calc(100dvh-3.25rem)] @4xl:self-start @4xl:pb-4 @4xl:pr-6",
							chosen && "@max-4xl:hidden",
						)}
					>
						<div className={cn(ROW, "mb-3 justify-between gap-3 px-3")}>
							<h1 className="text-[28px] font-semibold leading-none tracking-[-0.028em] text-foreground">Notes</h1>
							<button
								type="button"
								onClick={startNew}
								className="q-btn sec t h-9 rounded-xl px-3"
								data-testid="notes-new"
							>
								<PlusIcon className="size-4" strokeWidth={1.8} />
								New note
							</button>
						</div>
						{notes.length > 0 ? (
							<div className="min-h-0 flex-1 @4xl:-mr-2 @4xl:overflow-y-auto @4xl:pr-2">
								<NoteList notes={notes} selectedId={selectedId} onSelect={select} />
							</div>
						) : (
							<p className="px-3 font-prose text-[15px] leading-relaxed text-ink-3" data-testid="notes-empty">
								Nothing here yet. Write anything: a phrase you heard, a word to look up, a question for the tutor. Paste
								a link and it becomes a card; a YouTube link plays beside the note.
							</p>
						)}
					</aside>

					<section
						className={cn(
							"flex min-w-0 flex-col pb-16 @4xl:min-h-[calc(100dvh-3.25rem)] @4xl:border-l @4xl:border-[var(--q-line)] @4xl:pl-10 @6xl:pl-14",
							!chosen && "@max-4xl:hidden",
						)}
						aria-label="Note"
					>
						<NoteSheet
							key={sheetKey}
							note={selected}
							onSaved={saved}
							onDeleted={deleted}
							onBack={() => {
								setChosen(false);
								showUrl("/notes");
							}}
						/>
					</section>
				</div>
			</main>
		</div>
	);
}

// ─── The sheet ──────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "failed";

function NoteSheet({
	note,
	onSaved,
	onDeleted,
	onBack,
}: {
	note: Note | null;
	onSaved: (n: Note) => void;
	onDeleted: (id: string) => void;
	onBack: () => void;
}) {
	const [title, setTitle] = useState(note?.title ?? "");
	const [body, setBody] = useState(note?.body ?? "");
	const [links, setLinks] = useState<NoteLink[]>(note?.links ?? []);
	const [save, setSave] = useState<SaveState>("idle");
	const [adding, setAdding] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const editor = useRef<NoteEditorHandle>(null);
	const player = useRef<YTPlayer | null>(null);
	const id = useRef<string | null>(note?.id ?? null);
	const pending = useRef<Change>({});
	const inFlight = useRef<Promise<void> | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const flush = useCallback(async (): Promise<void> => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		if (inFlight.current) {
			await inFlight.current;
			return flush();
		}
		const change = pending.current;
		if (Object.keys(change).length === 0) return;
		if (!id.current && !change.title?.trim() && !change.body?.trim() && !change.links?.length) {
			pending.current = {};
			return;
		}
		pending.current = {};
		setSave("saving");
		const run = (async () => {
			try {
				const saved = await send(id.current, change);
				id.current = saved.id;
				onSaved(saved);
				if (change.links && pending.current.links === undefined) setLinks(saved.links ?? []);
				setSave(Object.keys(pending.current).length ? "saving" : "saved");
			} catch (err) {
				pending.current = { ...change, ...pending.current };
				setSave("failed");
				throw err;
			} finally {
				inFlight.current = null;
			}
		})();
		inFlight.current = run.catch(() => {});
		await run;
	}, [onSaved]);

	useEffect(
		() => () => {
			void flush().catch(() => {});
		},
		[flush],
	);

	const queue = (change: Change, now = false) => {
		pending.current = {
			...pending.current,
			...(id.current ? {} : { title, body }),
			...change,
		};
		setSave("saving");
		if (timer.current) clearTimeout(timer.current);
		if (now) void flush().catch(() => {});
		else timer.current = setTimeout(() => void flush().catch(() => {}), SAVE_AFTER_MS);
	};

	const changeBody = (text: string) => {
		setBody(text);
		queue({ body: text });
	};

	const setLinkList = (next: NoteLink[]) => {
		setLinks(next);
		queue({ links: next.map((l) => l.url) }, true);
	};

	/** Adds a link and returns null, or says why it was not added. */
	const addLink = (raw: string): string | null => {
		const found = normalizeLink(raw);
		if (!found) return "That is not a link.";
		if (links.some((l) => l.url === found.url)) return null;
		if (links.length >= MAX_NOTE_LINKS) return `A note holds up to ${MAX_NOTE_LINKS} links.`;
		setLinkList([...links, found]);
		return null;
	};

	const removeLink = (url: string) => setLinkList(links.filter((l) => l.url !== url));

	const playHere = (url: string) => {
		const picked = links.find((l) => l.url === url);
		if (!picked) return;
		setLinkList([picked, ...links.filter((l) => l.url !== url)]);
	};

	const insertStamp = () => {
		const p = player.current;
		if (!p) return;
		try {
			editor.current?.insertStamp(p.getCurrentTime());
		} catch {}
	};

	const remove = async () => {
		if (timer.current) clearTimeout(timer.current);
		pending.current = {};
		if (inFlight.current) await inFlight.current;
		if (!id.current) {
			onDeleted("");
			return;
		}
		const res = await fetch(`/api/notes?id=${encodeURIComponent(id.current)}`, { method: "DELETE" }).catch(() => null);
		if (res?.ok) onDeleted(id.current);
		else setSave("failed");
	};

	const seek = (sec: number) => {
		try {
			player.current?.seekTo(sec, true);
			player.current?.playVideo();
		} catch {}
	};

	const video = noteVideo({ links });
	const words = noteWords(body);

	return (
		<div className="flex w-full max-w-[50rem] flex-1 flex-col" data-testid="notes-sheet">
			<div className={cn(ROW, "mb-3 gap-1")}>
				<button
					type="button"
					onClick={() => {
						void flush().catch(() => {});
						onBack();
					}}
					className="-ml-1.5 mr-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-ui text-[14px] text-ink-3 hover:text-ink-2 @4xl:hidden"
					data-testid="notes-back"
				>
					<ArrowLeftIcon className="size-4" strokeWidth={1.6} />
					Notes
				</button>
				<p className="min-w-0 flex-1 truncate font-ui text-[13px] text-ink-3">
					<span className="@max-md:hidden">{longDate(note?.createdAt ?? new Date().toISOString())} · </span>
					<span className="tabular-nums">
						{words} {words === 1 ? "word" : "words"}
					</span>
					<SaveLine state={save} onRetry={() => void flush().catch(() => {})} />
				</p>
				{video && (
					<button
						type="button"
						onClick={insertStamp}
						className="q-btn ghost h-9 rounded-lg px-2.5 text-[13px]"
						title="Put the video's time where the cursor is"
						data-testid="notes-stamp"
					>
						<ClockIcon className="size-4" strokeWidth={1.7} />
						<span className="@max-lg:sr-only">Add time</span>
						<kbd className="q-kbd hidden pointer-fine:inline-flex">Alt T</kbd>
					</button>
				)}
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="q-btn ghost h-9 rounded-lg px-2.5 text-[13px]"
					data-testid="notes-link-open"
				>
					<LinkIcon className="size-4" strokeWidth={1.7} />
					<span className="@max-lg:sr-only">Add a link</span>
				</button>
				{confirming ? (
					<span className="flex items-center gap-1" role="group" aria-label="Delete this note?">
						<button
							type="button"
							onClick={() => void remove()}
							className="q-btn ghost h-9 rounded-lg px-2.5 text-[13px] text-miss"
							data-testid="notes-delete-confirm"
						>
							Delete
						</button>
						<button
							type="button"
							onClick={() => setConfirming(false)}
							className="q-btn ghost h-9 rounded-lg px-2.5 text-[13px]"
						>
							Keep
						</button>
					</span>
				) : (
					<button
						type="button"
						onClick={() => setConfirming(true)}
						className="q-btn ghost h-9 w-9 rounded-lg p-0 text-ink-3"
						aria-label="Delete note"
						title="Delete note"
						data-testid="notes-delete"
					>
						<Trash2Icon className="size-4" strokeWidth={1.7} />
					</button>
				)}
			</div>

			<label htmlFor="note-title" className="sr-only">
				Title
			</label>
			<input
				id="note-title"
				value={title}
				maxLength={MAX_NOTE_TITLE}
				onChange={(e) => {
					setTitle(e.target.value);
					queue({ title: e.target.value });
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.nativeEvent.isComposing) {
						e.preventDefault();
						editor.current?.focusEnd();
					}
				}}
				onBlur={() => void flush().catch(() => {})}
				autoFocus={!note}
				placeholder="Title"
				autoComplete="off"
				className="w-full bg-transparent font-ui text-[30px] font-semibold leading-tight tracking-[-0.022em] text-foreground outline-none placeholder:text-ink-4/60"
				data-testid="notes-title"
			/>

			{video?.videoId && (
				<div className="mt-5">
					<VideoBox videoId={video.videoId} player={player} />
				</div>
			)}

			<div className="mt-4">
				<NoteEditor
					ref={editor}
					initial={note?.body ?? ""}
					autoFocus={!!note}
					hasVideo={!!video}
					placeholder={
						video
							? "Write what you hear. Alt+T puts the video's time here, so you can jump back to it."
							: "Start writing. Paste a link to mention it or show it as a card."
					}
					onChange={changeBody}
					onBlur={() => void flush().catch(() => {})}
					onSeek={seek}
					onStampKey={insertStamp}
					onCard={(url) => addLink(url)}
				/>
			</div>

			{(links.length > 0 || adding) && (
				<section className="mt-8 border-t border-[var(--q-line)] pt-5" aria-label="Links" data-testid="notes-links">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-ui text-[13px] font-[600] text-ink-3">
							{links.length > 0 ? `Links · ${links.length}` : "Links"}
						</h2>
					</div>
					<ul className="flex flex-col gap-2.5">
						{links.map((l) => (
							<li key={l.url}>
								<LinkCard
									link={l}
									playing={l.url === video?.url}
									onRemove={() => removeLink(l.url)}
									onPlay={l.videoId && l.url !== video?.url ? () => playHere(l.url) : undefined}
								/>
							</li>
						))}
					</ul>
					{adding && <AddLink onAdd={addLink} onDone={() => setAdding(false)} />}
				</section>
			)}

			<div
				aria-hidden="true"
				onMouseDown={(e) => {
					e.preventDefault();
					editor.current?.focusEnd();
				}}
				className="min-h-24 flex-1 cursor-text"
			/>
		</div>
	);
}

function SaveLine({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
	if (state === "failed") {
		return (
			<>
				{" · "}
				<button type="button" onClick={onRetry} className="text-miss underline underline-offset-2" role="alert">
					Not saved. Try again
				</button>
			</>
		);
	}
	return (
		<span aria-live="polite" data-testid="notes-save-state">
			{state === "saving" ? " · Saving…" : state === "saved" ? " · Saved" : ""}
		</span>
	);
}

function LinkCard({
	link,
	playing,
	onRemove,
	onPlay,
}: {
	link: NoteLink;
	playing: boolean;
	onRemove: () => void;
	onPlay?: () => void;
}) {
	const [imageFailed, setImageFailed] = useState(false);
	const loading = !link.title && !link.site;
	const site = link.site ?? hostOf(link.url);
	return (
		<div className="group relative flex overflow-hidden rounded-xl border border-[var(--q-line)] bg-card transition-colors hover:border-[var(--q-line-2)] hover:bg-well/40">
			<a
				href={link.url}
				target="_blank"
				rel="noreferrer"
				className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3"
				data-testid="notes-link-card"
			>
				{loading ? (
					<>
						<span className="h-4 w-3/4 animate-pulse rounded bg-well" />
						<span className="h-3 w-1/2 animate-pulse rounded bg-well" />
					</>
				) : (
					<>
						<span className="line-clamp-2 font-ui text-[15px] font-[600] leading-snug text-foreground">
							{link.title ?? prettyUrl(link.url)}
						</span>
						{link.description && (
							<span className="line-clamp-2 font-prose text-[13.5px] leading-snug text-ink-3">{link.description}</span>
						)}
					</>
				)}
				<span className="mt-0.5 flex min-w-0 items-center gap-1.5 font-ui text-[12.5px] text-ink-3">
					{link.videoId ? (
						<PlayIcon className="size-3 shrink-0 fill-current text-teal-2" strokeWidth={0} />
					) : (
						<GlobeIcon className="size-3 shrink-0" strokeWidth={1.8} />
					)}
					<span className="truncate">{site}</span>
					{playing && <span className="shrink-0 text-teal-2">· playing above</span>}
				</span>
			</a>
			{link.image && !imageFailed && (
				<a
					href={link.url}
					target="_blank"
					rel="noreferrer"
					tabIndex={-1}
					aria-hidden="true"
					className="relative hidden w-44 shrink-0 bg-well @lg:block"
				>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={link.image}
						alt=""
						loading="lazy"
						referrerPolicy="no-referrer"
						onError={() => setImageFailed(true)}
						className="absolute inset-0 size-full object-cover"
					/>
				</a>
			)}
			<div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
				{onPlay && (
					<button
						type="button"
						onClick={onPlay}
						className="inline-flex h-7 items-center gap-1 rounded-md bg-background/90 px-2 font-ui text-[12px] font-[600] text-ink-2 hover:text-foreground"
					>
						<PlayIcon className="size-3 fill-current" strokeWidth={0} />
						Play here
					</button>
				)}
				<button
					type="button"
					onClick={onRemove}
					aria-label={`Remove the link to ${link.title ?? hostOf(link.url)}`}
					className="inline-flex size-7 items-center justify-center rounded-md bg-background/90 text-ink-3 hover:text-foreground"
					data-testid="notes-link-remove"
				>
					<XIcon className="size-3.5" />
				</button>
			</div>
		</div>
	);
}

function AddLink({ onAdd, onDone }: { onAdd: (raw: string) => string | null; onDone: () => void }) {
	const [url, setUrl] = useState("");
	const [error, setError] = useState<string | null>(null);
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (!url.trim()) return onDone();
				const why = onAdd(url);
				if (why) setError(why);
				else {
					setUrl("");
					setError(null);
				}
			}}
			className="mt-2.5"
			data-testid="notes-link"
		>
			<div className="flex gap-2">
				<label htmlFor="note-link" className="sr-only">
					Link
				</label>
				<input
					id="note-link"
					value={url}
					onChange={(e) => {
						setUrl(e.target.value);
						setError(null);
					}}
					onKeyDown={(e) => e.key === "Escape" && onDone()}
					onBlur={() => !url.trim() && onDone()}
					placeholder="Paste a link: an article, a video, a podcast…"
					autoComplete="off"
					autoFocus
					spellCheck={false}
					className="q-field h-11 min-w-0 flex-1 rounded-xl px-4 font-ui text-[15px]"
					data-testid="notes-link-url"
				/>
				<button type="submit" className="q-btn sec h-11 rounded-xl px-4" data-testid="notes-link-save">
					<PlusIcon className="size-4" strokeWidth={1.8} />
					Add
				</button>
			</div>
			{error && (
				<p className="mt-2 font-prose text-[14px] text-miss" role="alert">
					{error}
				</p>
			)}
		</form>
	);
}

function VideoBox({ videoId, player }: { videoId: string; player: React.RefObject<YTPlayer | null> }) {
	const holder = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;
		let p: YTPlayer | null = null;
		loadYouTubeApi()
			.then((YT) => {
				if (!alive || !holder.current) return;
				const el = document.createElement("div");
				holder.current.replaceChildren(el);
				p = new YT.Player(el, {
					videoId,
					width: "100%",
					height: "100%",
					host: "https://www.youtube-nocookie.com",
					playerVars: { rel: 0, playsinline: 1, origin: window.location.origin },
					events: {
						onReady: () => {
							if (alive) player.current = p;
						},
						onError: (e: { data: number }) =>
							alive &&
							setError(
								e.data === 101 || e.data === 150
									? "The owner of this video does not allow it to be played here. Open it from its card below; your note still works."
									: "YouTube could not play this video here.",
							),
					},
				});
			})
			.catch((err: Error) => alive && setError(err.message));
		return () => {
			alive = false;
			player.current = null;
			try {
				p?.destroy();
			} catch {}
		};
	}, [videoId, player]);

	return (
		<div>
			<div ref={holder} className="aspect-video w-full overflow-hidden rounded-xl bg-well" data-testid="notes-player" />
			{error && (
				<p className="mt-2 font-prose text-[14px] text-miss" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
