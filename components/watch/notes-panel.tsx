"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ClockIcon, ExternalLinkIcon, LinkIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import { timeAgo } from "@/components/sidebar";
import { Poster } from "@/components/watch/thumb";
import { loadYouTubeApi, type YTPlayer } from "@/components/watch/youtube-api";
import { cn } from "@/lib/utils";
import {
	belongsToLayoutAccent,
	formatClock,
	MAX_NOTE_CHARS,
	noteHeading,
	noteMoments,
	stampFor,
	type Note,
	type NoteVideo,
} from "@/src/core";

const SAVE_AFTER_MS = 700;

async function send(method: "POST" | "PATCH", id: string | null, change: { body?: string; video?: string }) {
	const res = await fetch(id ? `/api/notes?id=${encodeURIComponent(id)}` : "/api/notes", {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(change),
		keepalive: true,
	});
	const out = (await res.json().catch(() => null)) as { note?: Note; message?: string } | null;
	if (!res.ok || !out?.note) throw new Error(out?.message ?? "The note was not saved.");
	return out.note;
}

export function NotesPanel() {
	const [notes, setNotes] = useState<Note[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [openId, setOpenId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		void fetch("/api/notes")
			.then((r) => (r.ok ? (r.json() as Promise<{ notes: Note[] }>) : Promise.reject(new Error())))
			.then((x) => setNotes(x.notes))
			.catch(() => setFailed(true));
	}, []);

	const replace = useCallback((note: Note) => {
		setNotes((all) => [note, ...(all ?? []).filter((n) => n.id !== note.id)]);
	}, []);

	const create = async () => {
		setCreating(true);
		try {
			const note = await send("POST", null, {});
			replace(note);
			setOpenId(note.id);
		} catch {
			setFailed(true);
		} finally {
			setCreating(false);
		}
	};

	const open = notes?.find((n) => n.id === openId);
	if (open) {
		return (
			<NoteEditor
				key={open.id}
				note={open}
				onSaved={replace}
				onClose={() => setOpenId(null)}
				onDeleted={() => {
					setNotes((all) => (all ?? []).filter((n) => n.id !== open.id));
					setOpenId(null);
				}}
			/>
		);
	}

	if (failed && !notes) {
		return (
			<p className="font-prose text-[15px] text-miss" role="alert">
				Your notes did not load. Reload the page to try again.
			</p>
		);
	}
	if (!notes) return <div className="min-h-40" aria-busy="true" />;

	const newButton = (
		<button
			type="button"
			onClick={() => void create()}
			disabled={creating}
			className="q-btn sec t h-10 rounded-xl px-4"
			data-testid="notes-new"
		>
			{creating ? (
				<LoaderCircleIcon className="size-4 animate-spin" />
			) : (
				<PlusIcon className="size-4" strokeWidth={1.8} />
			)}
			New note
		</button>
	);

	if (notes.length === 0) {
		return (
			<div className="max-w-lg" data-testid="notes-empty">
				<p className="font-ui text-[17px] font-[600] text-foreground">No notes yet</p>
				<p className="q-sub">
					Write down what you hear while you watch: phrases, words to look up, things to ask the tutor. Link the video
					and each time stamp takes you back to that moment.
				</p>
				<div className="mt-4">{newButton}</div>
			</div>
		);
	}

	return (
		<div data-testid="notes-list">
			<div className="mb-4 flex items-center justify-between gap-3">
				<p className="font-prose text-[14px] text-ink-3">
					{notes.length} {notes.length === 1 ? "note" : "notes"}, last changed first
				</p>
				{newButton}
			</div>
			<ul className="flex flex-col gap-2">
				{notes.map((n) => (
					<li key={n.id}>
						<NoteRow note={n} onOpen={() => setOpenId(n.id)} />
					</li>
				))}
			</ul>
		</div>
	);
}

function NoteRow({ note, onOpen }: { note: Note; onOpen: () => void }) {
	const moments = noteMoments(note.body).length;
	const firstLine = noteHeading(note);
	const rest = note.body
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean)
		.slice(1)
		.join(" · ");
	return (
		<button
			type="button"
			onClick={onOpen}
			className="q-card flex w-full items-center gap-4 p-3 text-left transition-colors hover:bg-well"
			data-testid="notes-row"
		>
			{note.video ? (
				<Poster id={note.video.id} className="w-28 shrink-0 overflow-hidden rounded-lg max-sm:w-20" />
			) : (
				<span className="grid aspect-video w-28 shrink-0 place-items-center rounded-lg bg-well text-ink-3 max-sm:w-20">
					<LinkIcon className="size-4" strokeWidth={1.6} />
				</span>
			)}
			<span className="min-w-0 flex-1">
				<span className="block truncate font-ui text-[15px] font-[600] text-foreground">{firstLine}</span>
				<span className="block truncate font-prose text-[13px] text-ink-3">
					{[
						note.video?.title ?? (note.video ? "YouTube video" : "No video"),
						timeAgo(note.updatedAt),
						moments > 0 ? `${moments} ${moments === 1 ? "moment" : "moments"}` : null,
					]
						.filter(Boolean)
						.join(" · ")}
				</span>
				{rest && <span className="mt-0.5 block truncate font-prose text-[14px] text-ink-2">{rest}</span>}
			</span>
		</button>
	);
}

type SaveState = "saved" | "saving" | "failed";

function NoteEditor({
	note,
	onSaved,
	onClose,
	onDeleted,
}: {
	note: Note;
	onSaved: (n: Note) => void;
	onClose: () => void;
	onDeleted: () => void;
}) {
	const [body, setBody] = useState(note.body);
	const [save, setSave] = useState<SaveState>("saved");
	const [confirming, setConfirming] = useState(false);
	const field = useRef<HTMLTextAreaElement>(null);
	const player = useRef<YTPlayer | null>(null);
	const pending = useRef<string | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const flush = useCallback(async () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		const text = pending.current;
		if (text === null) return;
		pending.current = null;
		setSave("saving");
		try {
			onSaved(await send("PATCH", note.id, { body: text }));
			setSave(pending.current === null ? "saved" : "saving");
		} catch {
			pending.current ??= text;
			setSave("failed");
		}
	}, [note.id, onSaved]);

	useEffect(
		() => () => {
			void flush();
		},
		[flush],
	);

	const change = (text: string) => {
		setBody(text);
		pending.current = text;
		setSave("saving");
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
	};

	const insertStamp = () => {
		const el = field.current;
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
		change(before + stamp + body.slice(el.selectionEnd));
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + stamp.length, start + stamp.length);
		});
	};

	const seek = (sec: number) => {
		try {
			player.current?.seekTo(sec, true);
			player.current?.playVideo();
		} catch {}
	};

	const remove = async () => {
		await flush();
		const res = await fetch(`/api/notes?id=${encodeURIComponent(note.id)}`, { method: "DELETE" }).catch(() => null);
		if (res?.ok) onDeleted();
		else setSave("failed");
	};

	const moments = noteMoments(body);

	return (
		<div data-testid="notes-editor">
			<div className="mb-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => {
						void flush();
						onClose();
					}}
					className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-ui text-[14px] text-ink-3 hover:text-ink-2"
					data-testid="notes-back"
				>
					<ArrowLeftIcon className="size-4" strokeWidth={1.6} />
					All notes
				</button>
				<SaveLine state={save} onRetry={() => void flush()} />
			</div>

			<div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div className="flex min-w-0 flex-col gap-4">
					{note.video ? (
						<VideoBox
							video={note.video}
							player={player}
							onUnlink={async () => onSaved(await send("PATCH", note.id, { video: "" }))}
						/>
					) : (
						<LinkVideo onLink={async (url) => onSaved(await send("PATCH", note.id, { video: url }))} />
					)}
					{note.video && moments.length > 0 && (
						<div>
							<p className="mb-1.5 font-ui text-[13px] font-[600] text-ink-2">Moments</p>
							<ul className="flex flex-col" data-testid="notes-moments">
								{moments.map((m, i) => (
									<li key={`${m.sec}-${i}`}>
										<button
											type="button"
											onClick={() => seek(m.sec)}
											className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-well"
										>
											<span className="shrink-0 font-ui text-[13px] font-[600] tabular-nums text-teal-2">
												{formatClock(m.sec)}
											</span>
											<span className="min-w-0 truncate font-prose text-[14px] text-foreground">{m.text || "…"}</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>

				<div className="flex min-w-0 flex-col gap-2">
					<div className="flex items-center justify-between gap-3">
						<label htmlFor="note-body" className="font-ui text-[13px] font-[600] text-ink-2">
							Note
						</label>
						{note.video && (
							<button
								type="button"
								onClick={insertStamp}
								className="q-btn ghost h-8 rounded-lg px-2.5 text-[13px]"
								title="Add the video's time where the cursor is (Alt+T)"
								data-testid="notes-stamp"
							>
								<ClockIcon className="size-3.5" strokeWidth={1.8} />
								Add time
								<kbd className="q-kbd hidden pointer-fine:inline-flex">Alt T</kbd>
							</button>
						)}
					</div>
					<textarea
						ref={field}
						id="note-body"
						value={body}
						maxLength={MAX_NOTE_CHARS}
						onChange={(e) => change(e.target.value)}
						onBlur={() => void flush()}
						onKeyDown={(e) => {
							if (belongsToLayoutAccent(e.nativeEvent)) return;
							if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyT" && note.video) {
								e.preventDefault();
								insertStamp();
							}
						}}
						autoFocus
						spellCheck={false}
						placeholder={
							note.video
								? "Write what you hear. Alt+T adds the video's time, so you can jump back to it."
								: "Write what you hear: phrases, words to look up, questions."
						}
						className="q-field min-h-[22rem] w-full resize-none rounded-xl p-4 font-prose text-[16px] leading-relaxed text-foreground"
						data-testid="notes-body"
					/>
					<div className="mt-2 flex justify-end">
						{confirming ? (
							<div className="flex items-center gap-2" role="group" aria-label="Delete this note?">
								<span className="font-prose text-[14px] text-ink-2">Delete this note?</span>
								<button
									type="button"
									onClick={() => void remove()}
									className="q-btn sec h-8 rounded-lg px-3 text-[13px] text-miss"
									data-testid="notes-delete-confirm"
								>
									Delete
								</button>
								<button
									type="button"
									onClick={() => setConfirming(false)}
									className="q-btn ghost h-8 rounded-lg px-3 text-[13px]"
								>
									Keep
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setConfirming(true)}
								className="q-btn ghost h-8 rounded-lg px-3 text-[13px] text-ink-3"
								data-testid="notes-delete"
							>
								Delete note
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function SaveLine({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
	if (state === "failed") {
		return (
			<button type="button" onClick={onRetry} className="font-ui text-[13px] text-miss underline" role="alert">
				Not saved. Try again
			</button>
		);
	}
	return (
		<span className="font-ui text-[13px] text-ink-3" aria-live="polite" data-testid="notes-save-state">
			{state === "saving" ? "Saving…" : "Saved"}
		</span>
	);
}

function LinkVideo({ onLink }: { onLink: (url: string) => Promise<void> }) {
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
			className="q-card flex aspect-video flex-col justify-center gap-3 p-5"
			data-testid="notes-link"
		>
			<label htmlFor="note-video" className="font-ui text-[15px] font-[600] text-foreground">
				Link a YouTube video
			</label>
			<p className="-mt-2 font-prose text-[14px] text-ink-3">
				It plays here, and Alt+T stamps its time into your note. No subtitles are fetched and nothing is paid for.
			</p>
			<div className="flex gap-2">
				<input
					id="note-video"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://youtu.be/…"
					autoComplete="off"
					spellCheck={false}
					className="q-field h-11 min-w-0 flex-1 rounded-xl px-4 font-ui text-[15px]"
					data-testid="notes-link-url"
				/>
				<button
					type="submit"
					disabled={!url.trim() || busy}
					className="q-btn sec h-11 rounded-xl px-4"
					data-testid="notes-link-save"
				>
					{busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
					Link
				</button>
			</div>
			{error && (
				<p className="font-prose text-[14px] text-miss" role="alert">
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
	onUnlink: () => Promise<void>;
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
			<div className="flex items-center gap-3">
				<p className="min-w-0 flex-1 truncate font-ui text-[14px] font-[600] text-foreground">
					{video.title ?? "YouTube video"}
				</p>
				<a
					href={video.url}
					target="_blank"
					rel="noreferrer"
					className={cn("q-btn ghost h-8 shrink-0 rounded-lg px-2.5 text-[13px]")}
				>
					<ExternalLinkIcon className="size-3.5" strokeWidth={1.8} />
					YouTube
				</a>
				<button
					type="button"
					onClick={() => void onUnlink()}
					className="q-btn ghost h-8 shrink-0 rounded-lg px-2.5 text-[13px] text-ink-3"
					data-testid="notes-unlink"
				>
					Unlink
				</button>
			</div>
		</div>
	);
}
