"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
	ArrowLeftIcon,
	ClockIcon,
	ExternalLinkIcon,
	LoaderCircleIcon,
	PlayIcon,
	PlusIcon,
	Trash2Icon,
	VideoIcon,
	XIcon,
} from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { loadYouTubeApi, type YTPlayer } from "@/components/watch/youtube-api";
import { cn } from "@/lib/utils";
import {
	belongsToLayoutAccent,
	formatClock,
	MAX_NOTE_CHARS,
	MAX_NOTE_TITLE,
	noteHeading,
	noteMoments,
	stampFor,
	type Note,
	type NoteVideo,
} from "@/src/core";

const SAVE_AFTER_MS = 700;

type Change = { title?: string; body?: string; video?: string };

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

/** Today, Yesterday, This week, then month and year, so a long list reads like a notebook's tabs. */
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

function snippet(note: Note): string {
	const lines = note.body
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
		<div className="flex flex-col gap-5" data-testid="notes-list">
			{groups.map((g) => (
				<section key={g.label} aria-label={g.label}>
					<h2 className="mb-1 px-3 font-ui text-[12.5px] font-[600] text-ink-3">{g.label}</h2>
					<ul className="flex flex-col gap-0.5">
						{g.notes.map((n) => {
							const on = n.id === selectedId;
							const rest = snippet(n);
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
										{n.video && (
											<PlayIcon
												className="size-3 shrink-0 fill-current text-teal-2"
												strokeWidth={0}
												aria-label="Linked to a video"
											/>
										)}
										<span className="min-w-0 truncate font-prose text-[13.5px] text-ink-3">
											{rest || (n.video?.title ?? "No text yet")}
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

	const show = (id: string | null) => {
		try {
			window.history.replaceState(null, "", id ? `/notes?id=${encodeURIComponent(id)}` : "/notes?new=1");
		} catch {}
	};

	const select = (id: string) => {
		setSelectedId(id);
		setSheetKey((k) => k + 1);
		setChosen(true);
		show(id);
	};

	const startNew = () => {
		setSelectedId(null);
		setSheetKey((k) => k + 1);
		setChosen(true);
		show(null);
	};

	const saved = useCallback((note: Note) => {
		setNotes((all) => [note, ...all.filter((n) => n.id !== note.id)]);
		setSelectedId((cur) => {
			if (cur === null) {
				try {
					window.history.replaceState(null, "", `/notes?id=${encodeURIComponent(note.id)}`);
				} catch {}
			}
			return note.id;
		});
	}, []);

	const deleted = (id: string) => {
		const rest = notes.filter((n) => n.id !== id);
		setNotes(rest);
		setSelectedId(rest[0]?.id ?? null);
		setSheetKey((k) => k + 1);
		setChosen(false);
		try {
			window.history.replaceState(null, "", "/notes");
		} catch {}
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
			<main className="lanna-rise @container mx-auto w-full max-w-6xl px-5 pb-24" data-testid="notes-page">
				<div className="grid gap-x-8 gap-y-6 @4xl:grid-cols-[18rem_minmax(0,1fr)]">
					<aside className={cn("min-w-0 @4xl:sticky @4xl:top-16 @4xl:self-start", chosen && "@max-4xl:hidden")}>
						<div className="mb-5 flex items-center justify-between gap-3 px-3 @4xl:px-0">
							<h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Notes</h1>
							<button
								type="button"
								onClick={startNew}
								className="q-btn sec t h-10 rounded-xl px-3.5"
								data-testid="notes-new"
							>
								<PlusIcon className="size-4" strokeWidth={1.8} />
								New note
							</button>
						</div>
						{notes.length > 0 ? (
							<div className="-mx-3 @4xl:mx-0 @4xl:max-h-[calc(100dvh-10rem)] @4xl:overflow-y-auto">
								<NoteList notes={notes} selectedId={selectedId} onSelect={select} />
							</div>
						) : (
							<p className="font-prose text-[15px] leading-relaxed text-ink-3" data-testid="notes-empty">
								Nothing here yet. Write anything: a phrase you heard, a word to look up, a question for the tutor. Link
								a YouTube video to a note and you can stamp the moments in it.
							</p>
						)}
					</aside>

					<section
						className={cn(
							"min-w-0 @4xl:min-h-[calc(100dvh-6rem)] @4xl:border-l @4xl:border-[var(--q-line)] @4xl:pl-10",
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
								try {
									window.history.replaceState(null, "", "/notes");
								} catch {}
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
	const [save, setSave] = useState<SaveState>("idle");
	const [linking, setLinking] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const titleField = useRef<HTMLInputElement>(null);
	const bodyField = useRef<HTMLTextAreaElement>(null);
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
		if (!id.current && !change.title?.trim() && !change.body?.trim() && !change.video) {
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

	const queue = (change: Change) => {
		pending.current = { ...pending.current, ...change };
		setSave("saving");
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => void flush().catch(() => {}), SAVE_AFTER_MS);
	};

	const changeBody = (text: string) => {
		setBody(text);
		queue({ body: text, ...(id.current ? {} : { title }) });
	};

	const insertStamp = () => {
		const el = bodyField.current;
		const p = player.current;
		if (!el || !p) return;
		let sec = 0;
		try {
			sec = p.getCurrentTime();
		} catch {
			return;
		}
		const start = el.selectionStart;
		const before = body.slice(0, start);
		const lead = before === "" || before.endsWith("\n") ? "" : "\n";
		const stamp = `${lead}${stampFor(sec)} `;
		changeBody(before + stamp + body.slice(el.selectionEnd));
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + stamp.length, start + stamp.length);
		});
	};

	const link = async (url: string) => {
		pending.current = { ...pending.current, title, body, video: url };
		try {
			await flush();
		} catch (err) {
			const { video: _refused, ...rest } = pending.current;
			pending.current = rest;
			if (Object.keys(rest).length > 0) queue({});
			else setSave(id.current ? "saved" : "idle");
			throw err;
		}
		setLinking(false);
	};

	const unlink = async () => {
		pending.current = { ...pending.current, video: "" };
		await flush().catch(() => {});
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

	const video = note?.video;
	const moments = video ? noteMoments(body) : [];
	const words = body.trim() ? body.trim().split(/\s+/).length : 0;

	return (
		<div className="mx-auto w-full max-w-[46rem]" data-testid="notes-sheet">
			<div className="mb-3 flex min-h-9 items-center gap-1">
				<button
					type="button"
					onClick={() => {
						void flush().catch(() => {});
						onBack();
					}}
					className="-ml-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-ui text-[14px] text-ink-3 hover:text-ink-2 @4xl:hidden"
					data-testid="notes-back"
				>
					<ArrowLeftIcon className="size-4" strokeWidth={1.6} />
					Notes
				</button>
				<span className="flex-1" />
				<SaveLine state={save} onRetry={() => void flush().catch(() => {})} />
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
				{!video && !linking && (
					<button
						type="button"
						onClick={() => setLinking(true)}
						className="q-btn ghost h-9 rounded-lg px-2.5 text-[13px]"
						data-testid="notes-link-open"
					>
						<VideoIcon className="size-4" strokeWidth={1.7} />
						<span className="@max-lg:sr-only">Link a video</span>
					</button>
				)}
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

			<article className="pb-10 pt-2">
				{linking && !video && <LinkVideo onLink={link} onCancel={() => setLinking(false)} />}
				{video && (
					<div className="mb-8">
						<VideoBox video={video} player={player} onUnlink={() => void unlink()} />
						{moments.length > 0 && (
							<ul className="mt-3 flex flex-col" data-testid="notes-moments" aria-label="Moments">
								{moments.map((m, i) => (
									<li key={`${m.sec}-${i}`}>
										<button
											type="button"
											onClick={() => seek(m.sec)}
											className="-mx-2 flex w-[calc(100%+1rem)] items-baseline gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-well"
										>
											<span className="shrink-0 font-ui text-[13px] font-[600] tabular-nums text-teal-2">
												{formatClock(m.sec)}
											</span>
											<span className="min-w-0 truncate font-prose text-[14px] text-ink-2">{m.text || "…"}</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}

				<p className="font-ui text-[13px] text-ink-3">{longDate(note?.createdAt ?? new Date().toISOString())}</p>
				<label htmlFor="note-title" className="sr-only">
					Title
				</label>
				<input
					ref={titleField}
					id="note-title"
					value={title}
					maxLength={MAX_NOTE_TITLE}
					onChange={(e) => {
						setTitle(e.target.value);
						queue({ title: e.target.value, ...(id.current ? {} : { body }) });
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.nativeEvent.isComposing) {
							e.preventDefault();
							bodyField.current?.focus();
						}
					}}
					onBlur={() => void flush().catch(() => {})}
					autoFocus={!note}
					placeholder="Title"
					autoComplete="off"
					className="mt-1 w-full bg-transparent font-ui text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground outline-none placeholder:text-ink-4/60"
					data-testid="notes-title"
				/>
				<label htmlFor="note-body" className="sr-only">
					Note
				</label>
				<textarea
					ref={bodyField}
					id="note-body"
					value={body}
					maxLength={MAX_NOTE_CHARS}
					onChange={(e) => changeBody(e.target.value)}
					onBlur={() => void flush().catch(() => {})}
					onKeyDown={(e) => {
						if (belongsToLayoutAccent(e.nativeEvent)) return;
						if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyT" && video) {
							e.preventDefault();
							insertStamp();
						}
					}}
					autoFocus={!!note}
					spellCheck={false}
					placeholder={
						video
							? "Write what you hear. Alt+T puts the video's time here, so you can jump back to it."
							: "Start writing. A phrase you heard, a word to look up, a question for the tutor…"
					}
					className="mt-4 block min-h-[50vh] w-full resize-none bg-transparent font-[family-name:var(--font-read)] text-[18px] leading-[1.68] text-foreground outline-none [field-sizing:content] placeholder:text-ink-4/70"
					data-testid="notes-body"
				/>
			</article>
			<p className="mt-3 px-1 text-right font-ui text-[12.5px] tabular-nums text-ink-3" aria-live="off">
				{words} {words === 1 ? "word" : "words"}
			</p>
		</div>
	);
}

function SaveLine({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
	if (state === "failed") {
		return (
			<button
				type="button"
				onClick={onRetry}
				className="mr-2 font-ui text-[13px] text-miss underline underline-offset-2"
				role="alert"
			>
				Not saved. Try again
			</button>
		);
	}
	return (
		<span className="mr-2 font-ui text-[13px] text-ink-3" aria-live="polite" data-testid="notes-save-state">
			{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}
		</span>
	);
}

function LinkVideo({ onLink, onCancel }: { onLink: (url: string) => Promise<void>; onCancel: () => void }) {
	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				if (!url.trim() || busy) return;
				setBusy(true);
				setError(null);
				try {
					await onLink(url.trim());
				} catch (err) {
					setError(err instanceof Error ? err.message : "The link was not saved.");
					setBusy(false);
				}
			}}
			className="mb-8 rounded-xl bg-well p-4"
			data-testid="notes-link"
		>
			<label htmlFor="note-video" className="font-ui text-[14px] font-[600] text-foreground">
				Link a YouTube video
			</label>
			<p className="mt-0.5 font-prose text-[13.5px] text-ink-3">
				It plays here, and Alt+T stamps its time into the note. No subtitles are fetched and nothing is paid for.
			</p>
			<div className="mt-3 flex gap-2">
				<input
					id="note-video"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					onKeyDown={(e) => e.key === "Escape" && onCancel()}
					placeholder="https://youtu.be/…"
					autoComplete="off"
					autoFocus
					spellCheck={false}
					className="q-field h-10 min-w-0 flex-1 rounded-lg px-3 font-ui text-[15px]"
					data-testid="notes-link-url"
				/>
				<button
					type="submit"
					disabled={!url.trim() || busy}
					className="q-btn sec h-10 rounded-lg px-4"
					data-testid="notes-link-save"
				>
					{busy && <LoaderCircleIcon className="size-4 animate-spin" />}
					Link
				</button>
				<button type="button" onClick={onCancel} className="q-btn ghost h-10 w-10 rounded-lg p-0" aria-label="Cancel">
					<XIcon className="size-4" />
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

function VideoBox({
	video,
	player,
	onUnlink,
}: {
	video: NoteVideo;
	player: React.RefObject<YTPlayer | null>;
	onUnlink: () => void;
}) {
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
					videoId: video.id,
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
									? "The owner of this video does not allow it to be played here. Watch it on YouTube; your note still works."
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
	}, [video.id, player]);

	return (
		<div className="flex flex-col gap-2">
			<div ref={holder} className="aspect-video w-full overflow-hidden rounded-xl bg-well" data-testid="notes-player" />
			{error && (
				<p className="font-prose text-[14px] text-miss" role="alert">
					{error}
				</p>
			)}
			<div className="flex items-center gap-1">
				<p className="min-w-0 flex-1 truncate font-ui text-[13.5px] font-[600] text-ink-2">
					{video.title ?? "YouTube video"}
				</p>
				<a
					href={video.url}
					target="_blank"
					rel="noreferrer"
					className="q-btn ghost h-8 shrink-0 rounded-lg px-2 text-[13px]"
				>
					<ExternalLinkIcon className="size-3.5" strokeWidth={1.8} />
					YouTube
				</a>
				<button
					type="button"
					onClick={onUnlink}
					className="q-btn ghost h-8 shrink-0 rounded-lg px-2 text-[13px] text-ink-3"
					data-testid="notes-unlink"
				>
					Unlink
				</button>
			</div>
		</div>
	);
}
