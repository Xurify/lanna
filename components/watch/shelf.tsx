"use client";

/**
 * The Media shelf (LangHarness, 2026-11-07): what the learner sees before a
 * video starts. One shape, the video card, in four places, behind four tabs
 * that stay in reach while the page scrolls:
 *
 *   For you       the picks from creators and YouTube, by how much each is known
 *   My videos     what is prepared, newest first
 *   Creators      the saved channels and their videos
 *   Your YouTube  the link to the learner's account, or a Takeout export
 *
 * Above the tabs, always: a link field (paste, Enter) and, when something is
 * ready, the one next step: the newest video not yet watched, or else the best
 * pick at the learner's level. "/" focuses the link field.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
	ArrowLeftIcon,
	BookOpenIcon,
	LinkIcon,
	ListPlusIcon,
	LoaderCircleIcon,
	PlayIcon,
	ScissorsIcon,
	Trash2Icon,
} from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { useActiveLanguage } from "@/components/speech";
import type { FeedTask } from "@/components/activity-dock";
import { KeyNote } from "@/components/quiet/empty-state";
import { PRIMARY } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";
import { ChannelLink } from "@/components/watch/channel-link";
import { CreatorsPanel } from "@/components/watch/creators-panel";
import { useAddToRead } from "@/components/watch/read-import";
import { YouTubeSection, type useDiscover } from "@/components/watch/discover";
import { atLevel, PicksPanel } from "@/components/watch/picks-panel";
import { PreparingContext, usePreparing } from "@/components/watch/preparing";
import { StretchDialog } from "@/components/watch/stretch-dialog";
import { Poster } from "@/components/watch/thumb";
import { CardGrid, CardIconButton, Known, VideoCard } from "@/components/watch/video-card";
import {
	captionLanguageName,
	coverageBand,
	coverageKind,
	formatClock,
	isSpotifyId,
	parseVideoUrl,
	videoUrl,
	type FragmentRange,
	type PickedVideo,
	type VideoLibraryEntry,
	type WatchState,
} from "@/src/core";

type TabId = "picks" | "videos" | "creators" | "youtube";

// Survives the shelf unmounting for a video, so "back to the shelf" lands on the tab that was open.
let lastTab: TabId | null = null;

/** The video a stretch is being picked for. */
interface Cutting {
	id: string;
	title?: string;
}

export function Shelf({
	state,
	running,
	starting,
	discover,
	onOpen,
	onPrepare,
	onDelete,
}: {
	state: WatchState | null;
	running: FeedTask[];
	starting?: string | null;
	discover: ReturnType<typeof useDiscover>;
	onOpen: (id: string) => void;
	onPrepare: (url: string, range?: FragmentRange) => void;
	onDelete: (id: string) => void;
}) {
	const lang = useActiveLanguage();
	const name = lang?.english ?? "the language";
	const canPrepare = state?.canPrepare !== false;
	const library = [...(state?.library ?? [])].reverse();
	const picks = discover.state?.picks ?? [];

	const upNextVideo = library.find((v) => v.watches === 0) ?? null;
	const upNextPick = upNextVideo ? null : (picks.find(atLevel) ?? null);
	const shownPicks = picks.length - (upNextPick ? 1 : 0);

	const [tab, setTabState] = useState<TabId>(
		() =>
			lastTab ??
			(shownPicks > 0
				? "picks"
				: library.length > 0
					? "videos"
					: (discover.state?.creators.length ?? 0) > 0
						? "creators"
						: "picks"),
	);
	const setTab = (t: TabId) => {
		lastTab = t;
		setTabState(t);
	};
	const [cutting, setCutting] = useState<Cutting | null>(null);
	// A background task's id is "video:<id>". The shelf's own "Adding" row is
	// only for the moment before the server's task exists; then the task's row says it.
	const runningIds = running.map((t) => t.id.replace(/^video:/, ""));
	const startingId = starting ? parseVideoUrl(starting) : null;
	const showStarting = !!starting && !(startingId && runningIds.includes(startingId));
	const preparing = new Set([...runningIds, ...(startingId ? [startingId] : [])]);

	return (
		<PreparingContext.Provider value={preparing}>
			<div className="relative min-h-dvh bg-background">
				<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
				<header className="sticky top-0 z-20 flex items-center gap-2 bg-background px-3 py-2">
					<SidebarToggle />
					<Link
						href="/"
						className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-ink-3 hover:text-ink-2 lh-no-drag"
					>
						<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
						Today
					</Link>
				</header>
				<main className="lh-rise @container mx-auto w-full max-w-6xl px-5 pb-24" data-testid="watch-shelf">
					<div className="flex items-baseline gap-3">
						<h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Media</h1>
						{state && state.watchedToday > 0 && (
							<span className="font-ui text-[13px] text-ink-3">{state.watchedToday} watched today</span>
						)}
					</div>

					<LinkField
						name={name}
						fallbacks={(lang?.captionFallbacks ?? []).map((f) => f.english)}
						canPrepare={canPrepare}
						canTranscribe={!!state?.canTranscribe}
						onPrepare={onPrepare}
						onCut={(id) => setCutting({ id })}
					/>

					{(running.length > 0 || showStarting) && (
						<ul className="mt-4 flex flex-col gap-1.5" data-testid="watch-running">
							{showStarting && (
								<li className="q-card flex items-center gap-3 px-4 py-2.5" data-testid="watch-starting">
									<LoaderCircleIcon className="size-4 shrink-0 animate-spin text-ink-3" />
									<span className="min-w-0 flex-1 truncate font-ui text-[14px] text-foreground">
										Adding {starting}
										<span className="text-ink-3"> · It keeps going if you leave this page.</span>
									</span>
								</li>
							)}
							{running.map((t) => (
								<li key={t.id} className="q-card flex items-center gap-3 px-4 py-2.5">
									<LoaderCircleIcon className="size-4 shrink-0 animate-spin text-ink-3" />
									<span className="min-w-0 flex-1 truncate font-ui text-[14px] text-foreground">
										{t.title}
										<span className="text-ink-3"> · {t.step}. It keeps going if you leave this page.</span>
									</span>
								</li>
							))}
						</ul>
					)}

					{upNextVideo && <UpNext video={upNextVideo} lang={upNextVideo.lang} onOpen={() => onOpen(upNextVideo.id)} />}
					{upNextPick && (
						<UpNext
							pick={upNextPick}
							lang={lang?.code}
							name={name}
							canPrepare={canPrepare}
							onPrepare={() => onPrepare(videoUrl(upNextPick.id))}
							onCut={() => setCutting({ id: upNextPick.id, title: upNextPick.title })}
						/>
					)}

					<Tabs
						tab={tab}
						onTab={setTab}
						counts={{ picks: shownPicks, videos: library.length, creators: discover.state?.creators.length ?? 0 }}
					/>

					<div
						role="tabpanel"
						id={`watch-panel-${tab}`}
						aria-labelledby={`watch-tab-${tab}`}
						className="pt-6"
						data-testid={`watch-panel-${tab}`}
					>
						{tab === "picks" && (
							<PicksPanel
								d={discover}
								canPrepare={canPrepare}
								exclude={upNextPick?.id}
								onPrepare={onPrepare}
								onCut={(p) => setCutting({ id: p.id, title: p.title })}
								onSources={setTab}
							/>
						)}
						{tab === "videos" && (
							<LibraryPanel
								library={library}
								exclude={upNextVideo?.id}
								watchedToday={state?.watchedToday ?? 0}
								onOpen={onOpen}
								onDelete={onDelete}
								onCut={(v) => setCutting({ id: v.id, title: v.title })}
								onFind={() => setTab("picks")}
							/>
						)}
						{tab === "creators" && (
							<CreatorsPanel
								d={discover}
								canPrepare={canPrepare}
								onPrepare={onPrepare}
								onCut={(p) => setCutting({ id: p.id, title: p.title })}
							/>
						)}
						{tab === "youtube" && <YouTubeSection d={discover} />}
					</div>
				</main>
				{cutting && (
					<StretchDialog
						videoId={cutting.id}
						title={cutting.title}
						canPrepare={canPrepare}
						onPrepare={(range) => (setCutting(null), onPrepare(videoUrl(cutting.id), range))}
						onClose={() => setCutting(null)}
					/>
				)}
			</div>
		</PreparingContext.Provider>
	);
}

function UpNextAdd({ id, canPrepare, onPrepare }: { id: string; canPrepare: boolean; onPrepare: () => void }) {
	const preparing = usePreparing(id);
	return (
		<button
			type="button"
			disabled={!canPrepare || preparing}
			onClick={onPrepare}
			aria-busy={preparing}
			className={cn(PRIMARY, "h-11 rounded-xl px-6")}
			data-testid="watch-up-next-prepare"
		>
			{preparing ? (
				<LoaderCircleIcon className="size-4 animate-spin" />
			) : (
				<ListPlusIcon className="size-4" strokeWidth={1.8} />
			)}
			{preparing ? "Preparing…" : "Add video"}
		</button>
	);
}

// ─── The link field ─────────────────────────────────────────────────────────

function LinkField({
	name,
	fallbacks,
	canPrepare,
	canTranscribe,
	onPrepare,
	onCut,
}: {
	name: string;
	fallbacks: string[];
	canPrepare: boolean;
	canTranscribe: boolean;
	onPrepare: (url: string) => void;
	onCut: (id: string) => void;
}) {
	const [url, setUrl] = useState("");
	const field = useRef<HTMLInputElement>(null);
	const id = parseVideoUrl(url);
	const spotify = !!id && isSpotifyId(id);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
			const t = e.target as HTMLElement | null;
			if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
			e.preventDefault();
			field.current?.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	return (
		<div className="mt-5">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (id) onPrepare(url.trim());
				}}
				className="flex flex-col gap-2 @2xl:flex-row"
				data-testid="watch-form"
			>
				<label className="sr-only" htmlFor="watch-url">
					YouTube or Spotify link
				</label>
				<div className="relative min-w-0 flex-1">
					<LinkIcon
						className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3"
						strokeWidth={1.6}
					/>
					<input
						ref={field}
						id="watch-url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder={`Paste a YouTube or Spotify link in ${name}`}
						autoFocus
						autoComplete="off"
						spellCheck={false}
						className="q-field h-12 w-full rounded-xl pl-11 pr-12 font-ui text-[15px]"
						data-testid="watch-url"
					/>
					{!url && (
						<kbd className="q-kbd pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 pointer-fine:inline-flex">
							/
						</kbd>
					)}
				</div>
				<div className="flex gap-2">
					<button
						type="submit"
						disabled={!id || !canPrepare}
						className={cn(PRIMARY, "h-12 flex-1 rounded-xl px-5 @2xl:flex-none")}
						data-testid="watch-prepare"
					>
						<ListPlusIcon className="size-4" strokeWidth={1.8} />
						{spotify ? "Add track" : "Add video"}
					</button>
					<button
						type="button"
						disabled={!id || spotify}
						onClick={() => id && !spotify && onCut(id)}
						className="q-btn sec h-12 flex-1 rounded-xl px-4 @2xl:flex-none"
						title="Watch only a stretch of it"
						data-testid="watch-fragments-open"
					>
						<ScissorsIcon className="size-4" strokeWidth={1.6} />
						Pick a stretch
					</button>
				</div>
			</form>
			{!canPrepare ? (
				<div className="mt-3">
					<KeyNote>
						Preparing a new video needs an AI key, for the English translation. Videos you have already prepared play
						without one.
					</KeyNote>
				</div>
			) : (
				<p className="mt-2.5 max-w-3xl font-prose text-[13px] leading-relaxed text-ink-3">
					Uses YouTube's captions, written by people or automatic
					{fallbacks.length > 0 ? `, or ${fallbacks.join(" or ")} ones when there are none in ${name}` : ""}, or
					transcribes Spotify tracks and uncaptioned videos from audio. Adding a video or track costs one or two short
					AI requests, once.{canTranscribe ? " Audio transcription is ready." : ""}
				</p>
			)}
		</div>
	);
}

// ─── Up next ────────────────────────────────────────────────────────────────

type UpNextProps = { lang?: string } & (
	| { video: VideoLibraryEntry; onOpen: () => void; pick?: never }
	| { pick: PickedVideo; name: string; canPrepare: boolean; onPrepare: () => void; onCut: () => void; video?: never }
);

/** The one next step: a prepared video waiting, or the best pick the learner can follow. */
function UpNext(props: UpNextProps) {
	const v = props.video;
	const p = props.pick;
	const id = (v ?? p)!.id;
	const title = (v ?? p)!.title;
	const channel = (v ?? p)!.channel;
	const sec = (v ?? p)!.durationSec;
	const coverage = v ? (coverageKind(v) === "none" ? undefined : v.coverage) : p!.coverage;
	const about = !!v && coverageKind(v) === "estimated";
	const band = coverage !== undefined ? coverageBand(coverage) : null;
	return (
		<section
			className="q-card mt-6 flex flex-col overflow-hidden @2xl:flex-row"
			aria-label="Up next"
			data-testid="watch-up-next"
		>
			<div className="relative aspect-video @2xl:aspect-auto @2xl:min-h-[12.5rem] @2xl:w-[22rem] @2xl:shrink-0">
				{v ? (
					<button
						type="button"
						onClick={props.onOpen}
						tabIndex={-1}
						aria-hidden="true"
						className="absolute inset-0 block"
					>
						<Poster id={id} className="absolute inset-0 aspect-auto h-full" />
					</button>
				) : (
					<a
						href={videoUrl(id)}
						target="_blank"
						rel="noreferrer"
						tabIndex={-1}
						aria-hidden="true"
						className="absolute inset-0 block"
					>
						<Poster id={id} className="absolute inset-0 aspect-auto h-full" />
					</a>
				)}
				<span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 font-ui text-[11.5px] font-[600] tabular-nums leading-none text-white">
					{formatClock(sec)}
				</span>
			</div>
			<div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-5">
				<p className="font-ui text-[13px] font-[600] text-teal-2">
					{v ? (v.watches === 0 ? "Ready to watch" : "Up next") : "Best pick for you"}
				</p>
				<h2
					className="line-clamp-2 font-ui text-[22px] font-[600] leading-snug tracking-[-0.015em] text-foreground"
					lang={props.lang}
				>
					{p ? (
						<a
							href={videoUrl(id)}
							target="_blank"
							rel="noreferrer"
							title={`${title} (opens on YouTube)`}
							className="hover:underline"
						>
							{title}
						</a>
					) : (
						title
					)}
				</h2>
				<p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-prose text-[14px] text-ink-3">
					{channel && <ChannelLink id={(v ?? p)!.channelId} name={channel} avatar={p?.avatar} withAvatar={!!p} />}
					{v && <span>· {v.segments} lines</span>}
					{coverage !== undefined ? (
						<span>
							· <Known coverage={coverage} about={about} />
						</span>
					) : (
						v?.trackLang && <span>· {captionLanguageName(v.trackLang)} captions</span>
					)}
				</p>
				{band && <p className="max-w-xl font-prose text-[13px] leading-snug text-ink-3">{band.line}</p>}
				<div className="mt-1 flex flex-wrap items-center gap-2">
					{v ? (
						<button
							type="button"
							onClick={props.onOpen}
							className={cn(PRIMARY, "h-11 rounded-xl px-6")}
							data-testid="watch-up-next-start"
						>
							<PlayIcon className="size-4 fill-current" />
							{isSpotifyId(v.id) ? "Start playing" : "Start watching"}
						</button>
					) : (
						<>
							<UpNextAdd id={props.pick.id} canPrepare={props.canPrepare} onPrepare={props.onPrepare} />
							<button
								type="button"
								onClick={props.onCut}
								className="q-btn sec h-11 rounded-xl px-4"
								data-testid="watch-up-next-stretch"
							>
								<ScissorsIcon className="size-4" strokeWidth={1.6} />
								Pick a stretch
							</button>
						</>
					)}
				</div>
			</div>
		</section>
	);
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string; count?: boolean }> = [
	{ id: "picks", label: "For you", count: true },
	{ id: "videos", label: "My videos", count: true },
	{ id: "creators", label: "Creators", count: true },
	{ id: "youtube", label: "YouTube" },
];

function Tabs({
	tab,
	onTab,
	counts,
}: {
	tab: TabId;
	onTab: (t: TabId) => void;
	counts: Partial<Record<TabId, number>>;
}) {
	const move = (e: React.KeyboardEvent, i: number) => {
		const next =
			e.key === "ArrowRight"
				? i + 1
				: e.key === "ArrowLeft"
					? i - 1
					: e.key === "Home"
						? 0
						: e.key === "End"
							? TABS.length - 1
							: null;
		if (next === null) return;
		e.preventDefault();
		const t = TABS[(next + TABS.length) % TABS.length]!;
		onTab(t.id);
		document.getElementById(`watch-tab-${t.id}`)?.focus();
	};
	return (
		// Sticks under the header (52px), so the way to the other lists is in reach however far down the page is scrolled.
		<div className="sticky top-[52px] z-10 -mx-5 mt-8 bg-background px-5">
			<div
				role="tablist"
				aria-label="Media"
				className="flex max-w-full gap-6 overflow-x-auto border-b border-border"
				data-testid="watch-tabs"
			>
				{TABS.map((t, i) => {
					const on = t.id === tab;
					const n = t.count ? counts[t.id] : undefined;
					return (
						<button
							key={t.id}
							type="button"
							role="tab"
							id={`watch-tab-${t.id}`}
							aria-selected={on}
							aria-controls={`watch-panel-${t.id}`}
							tabIndex={on ? 0 : -1}
							onClick={() => onTab(t.id)}
							onKeyDown={(e) => move(e, i)}
							className={cn(
								"relative flex h-11 shrink-0 items-center gap-2 font-ui text-[15px] transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full",
								on ? "font-[600] text-foreground after:bg-teal-2" : "font-[500] text-ink-3 hover:text-foreground",
							)}
							data-testid={`watch-tab-${t.id}`}
						>
							{t.label}
							{n !== undefined && n > 0 && (
								<span
									className={cn(
										"rounded-md px-1.5 py-px text-[12px] font-[600] tabular-nums leading-snug",
										on ? "bg-teal-wash text-teal-2" : "bg-well text-ink-3",
									)}
								>
									{n}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

// ─── My videos ──────────────────────────────────────────────────────────────

function LibraryPanel({
	library,
	exclude,
	watchedToday,
	onOpen,
	onDelete,
	onCut,
	onFind,
}: {
	library: VideoLibraryEntry[];
	/** Shown above as the next step, so not twice. */ exclude?: string;
	watchedToday: number;
	onOpen: (id: string) => void;
	onDelete: (id: string) => void;
	onCut: (v: VideoLibraryEntry) => void;
	onFind: () => void;
}) {
	const readIn = useAddToRead();
	const [confirming, setConfirming] = useState<string | null>(null);
	if (library.length === 0) {
		return (
			<div className="max-w-lg" data-testid="watch-library-empty">
				<p className="font-ui text-[17px] font-[600] text-foreground">Nothing prepared yet</p>
				<p className="q-sub">
					Paste a YouTube or Spotify link above, or add one of the videos picked for you. It is translated once and kept
					here.
				</p>
				<button type="button" onClick={onFind} className="q-btn sec t mt-4">
					See what is picked for you
				</button>
			</div>
		);
	}
	const rest = library.filter((v) => v.id !== exclude);
	return (
		<div>
			<p className="mb-4 font-prose text-[14px] text-ink-3" hidden={rest.length === 0}>
				{library.length} {library.length === 1 ? "video" : "videos"}, newest first
				{rest.length < library.length ? " (the first is above)" : ""}
				{watchedToday > 0 ? ` · ${watchedToday} watched today` : ""}
			</p>
			{readIn.error && (
				<p className="mb-3 font-prose text-sm text-miss" role="alert" data-testid="watch-library-read-error">
					{readIn.error}
				</p>
			)}
			<CardGrid testid="watch-library">
				{rest.map((v) => {
					const kind = coverageKind(v);
					const gotFirst =
						v.watches > 0 && v.lastGotFirst !== undefined
							? `${Math.round(v.lastGotFirst * 100)}% got first time · watched ${v.watches}×`
							: v.watches > 0
								? `Watched ${v.watches}×`
								: null;
					return (
						<li key={v.id}>
							<VideoCard
								testid="watch-shelf-item"
								id={v.id}
								title={v.title}
								lang={v.lang}
								durationSec={v.durationSec}
								coverage={kind === "none" ? undefined : v.coverage}
								watched={v.watches > 0}
								onOpen={() => onOpen(v.id)}
								badge={
									v.watches === 0 ? (
										<span className="rounded-md bg-sun px-1.5 py-0.5 font-ui text-[11.5px] font-[600] leading-none text-sun-ink">
											New
										</span>
									) : undefined
								}
								by={v.channel ? <ChannelLink id={v.channelId} name={v.channel} /> : undefined}
								line={
									<>
										<span className="block">
											{kind === "none" ? (
												`${captionLanguageName(v.trackLang!)} captions`
											) : (
												<Known coverage={v.coverage} about={kind === "estimated"} />
											)}
										</span>
										<span className="block truncate text-[12.5px]">
											{v.segments} lines
											{v.fragment
												? ` · from ${formatClock(v.fragment.startSec)} of ${formatClock(v.fragment.ofSec)}`
												: ""}
											{gotFirst ? ` · ${gotFirst}` : ""}
										</span>
									</>
								}
							>
								{confirming === v.id ? (
									<span
										className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-well pl-3 pr-1 font-ui text-xs font-[600] text-foreground"
										data-testid="watch-delete-confirm"
									>
										<span className="min-w-0 flex-1 truncate">Delete this video?</span>
										<button
											type="button"
											onClick={() => {
												setConfirming(null);
												onDelete(v.id);
											}}
											className="rounded-md px-2 py-2 text-miss hover:bg-accent"
										>
											Delete
										</button>
										<button
											type="button"
											onClick={() => setConfirming(null)}
											className="rounded-md px-2 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
										>
											Keep
										</button>
									</span>
								) : (
									<>
										<button
											type="button"
											onClick={() => onOpen(v.id)}
											className="q-btn sec t h-8 min-w-0 flex-1 px-3 pointer-coarse:h-11"
											data-testid="watch-shelf-open"
										>
											<PlayIcon className="size-3.5 fill-current" />
											{isSpotifyId(v.id) ? "Play" : "Watch"}
											{v.watches > 0 ? " again" : ""}
										</button>
										<CardIconButton label="Add to Read" onClick={() => readIn.add(v.id)} testid="watch-shelf-read">
											<BookOpenIcon className="size-4" strokeWidth={1.6} />
										</CardIconButton>
										{!isSpotifyId(v.id) && (
											<CardIconButton
												label="Pick another stretch of this video"
												onClick={() => onCut(v)}
												testid="watch-shelf-fragments"
											>
												<ScissorsIcon className="size-4" strokeWidth={1.6} />
											</CardIconButton>
										)}
										<CardIconButton
											label={`Delete ${v.title}`}
											onClick={() => setConfirming(v.id)}
											testid="watch-delete"
										>
											<Trash2Icon className="size-4" strokeWidth={1.6} />
										</CardIconButton>
									</>
								)}
							</VideoCard>
						</li>
					);
				})}
			</CardGrid>
		</div>
	);
}
