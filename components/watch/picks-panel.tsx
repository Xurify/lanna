"use client";

/**
 * Watch → For you: the videos offered from the learner's creators and YouTube,
 * as cards, split by what the known-word share says about them. Videos at the
 * level (88% of the words known or more) come first; when there are none, the
 * closest ones say so plainly instead of being passed off as picks.
 */

import { useState } from "react";
import { LoaderCircleIcon, RefreshCwIcon, ScissorsIcon, XIcon } from "lucide-react";
import { Toggle } from "@/components/settings/controls";
import { timeAgo } from "@/components/sidebar";
import { useActiveLanguage } from "@/components/speech";
import { ChannelLink } from "@/components/watch/channel-link";
import { post, type Discover } from "@/components/watch/discover";
import { usePreparing } from "@/components/watch/preparing";
import { CardGrid, CardIconButton, Known, VideoCard } from "@/components/watch/video-card";
import {
	captionLanguageName,
	coverageBand,
	SPARSE_SPEECH_WPM,
	videoUrl,
	type FragmentRange,
	type PickedVideo,
} from "@/src/core";

const SHOWN = 6;

/** Is this one at the level: comfortable or a stretch? */
export function atLevel(p: Pick<PickedVideo, "coverage">): boolean {
	if (p.coverage === undefined) return false;
	const b = coverageBand(p.coverage).band;
	return b === "comfortable" || b === "stretch";
}

function why(p: PickedVideo): string | null {
	if (p.sources.includes("creator")) {
		const days = p.publishedAt ? (Date.now() - Date.parse(p.publishedAt)) / 86_400_000 : Infinity;
		return days < 8 ? "New from a creator you saved" : null;
	}
	if (p.sources.includes("subscriptions")) return "From a channel you subscribe to";
	if (p.sources.includes("history")) return "In your YouTube history";
	if (p.sources.includes("recommended")) return "YouTube recommends it to you";
	if (p.sources.includes("search") && p.query) return `Found by searching "${p.query}"`;
	return null;
}

/** The facts under a video's title: the known share, then anything that should give pause. */
function PickFacts({ p, name, note }: { p: PickedVideo; name: string; note?: string }) {
	const flags: string[] = [];
	if (p.coverage === undefined && p.trackLang) flags.push(`captions in ${captionLanguageName(p.trackLang)}`);
	flags.push(p.captionKind === "captions" ? "captions by people" : "automatic captions");
	if (p.wordsPerMin !== undefined && p.wordsPerMin < SPARSE_SPEECH_WPM) flags.push("little speech");
	if (p.spoken === "unsure") flags.push(`may not be spoken in ${name}`);
	const reason = note ?? why(p);
	return (
		<>
			<span className="block">{p.coverage !== undefined && <Known coverage={p.coverage} />}</span>
			<span className="block truncate text-[12.5px]" title={flags.join(" · ")}>
				{flags.join(" · ")}
			</span>
			{reason && <span className="block truncate text-[12.5px]">{reason}</span>}
		</>
	);
}

export function PickCard({
	p,
	name,
	lang,
	canPrepare,
	onPrepare,
	onCut,
	onDismiss,
	note,
}: {
	p: PickedVideo;
	name: string;
	lang?: string;
	canPrepare: boolean;
	onPrepare: () => void;
	onCut: () => void;
	onDismiss: () => void;
	note?: string;
}) {
	const preparing = usePreparing(p.id);
	return (
		<li>
			<VideoCard
				testid="watch-pick"
				id={p.id}
				title={p.title}
				lang={lang}
				durationSec={p.durationSec}
				coverage={p.coverage}
				href={videoUrl(p.id)}
				by={p.channel ? <ChannelLink id={p.channelId} name={p.channel} avatar={p.avatar} withAvatar /> : undefined}
				line={<PickFacts p={p} name={name} note={note} />}
			>
				<button
					type="button"
					disabled={!canPrepare || preparing}
					onClick={onPrepare}
					aria-busy={preparing}
					className="q-btn sec t h-8 min-w-0 flex-1 px-3 pointer-coarse:h-11"
					title={
						preparing
							? "Being translated; it lands in My videos"
							: canPrepare
								? "Translate it and add it to My videos"
								: "Preparing needs an AI key"
					}
					data-testid="watch-pick-prepare"
				>
					{preparing ? (
						<>
							<LoaderCircleIcon className="size-3.5 animate-spin" />
							Preparing…
						</>
					) : (
						"Prepare"
					)}
				</button>
				<CardIconButton label="Watch only a stretch of it" onClick={onCut} testid="watch-pick-fragments">
					<ScissorsIcon className="size-4" strokeWidth={1.6} />
				</CardIconButton>
				<CardIconButton label={`Not for me: ${p.title}`} onClick={onDismiss} testid="watch-pick-dismiss">
					<XIcon className="size-4" strokeWidth={1.6} />
				</CardIconButton>
			</VideoCard>
		</li>
	);
}

interface Common {
	name: string;
	lang?: string;
	canPrepare: boolean;
	onPrepare: (p: PickedVideo, range?: FragmentRange) => void;
	onCut: (p: PickedVideo) => void;
	onDismiss: (p: PickedVideo) => void;
}

function Group({ title, picks, more, common }: { title: string; picks: PickedVideo[]; more: string; common: Common }) {
	const [all, setAll] = useState(false);
	const shown = all ? picks : picks.slice(0, SHOWN);
	return (
		<section className="mt-8 first:mt-0" aria-label={title}>
			<h2 className="q-sh">
				{title}
				<small>{picks.length}</small>
			</h2>
			<CardGrid>
				{shown.map((p) => (
					<PickCard
						key={p.id}
						p={p}
						name={common.name}
						lang={common.lang}
						canPrepare={common.canPrepare}
						onPrepare={() => common.onPrepare(p)}
						onCut={() => common.onCut(p)}
						onDismiss={() => common.onDismiss(p)}
					/>
				))}
			</CardGrid>
			{picks.length > SHOWN && (
				<button
					type="button"
					onClick={() => setAll((v) => !v)}
					className="q-btn ghost mt-3"
					data-testid="watch-picks-more"
				>
					{all ? "Show fewer" : `Show ${picks.length - SHOWN} ${more}`}
				</button>
			)}
		</section>
	);
}

export function PicksPanel({
	d,
	canPrepare,
	exclude,
	onPrepare,
	onCut,
	onSources,
}: {
	d: Discover;
	canPrepare: boolean;
	exclude?: string;
	onPrepare: (url: string, range?: FragmentRange) => void;
	onCut: (p: PickedVideo) => void;
	/** Opens the Creators or Your YouTube tab. */ onSources: (to: "creators" | "youtube") => void;
}) {
	const { state, apply, load } = d;
	const lang = useActiveLanguage();
	const name = lang?.english ?? "the language";
	if (!state) return null;
	const anything = state.creators.length > 0 || Object.keys(state.youtube).length > 0;
	const refresh = state.refresh;
	const status = refresh.running
		? refresh.total
			? `${refresh.step ?? "Checking"}: ${refresh.done} of ${refresh.total}`
			: (refresh.step ?? "Checking")
		: state.refreshedAt
			? `Checked ${timeAgo(state.refreshedAt)}`
			: null;
	const picks = state.picks.filter((p) => p.id !== exclude);
	const fit = picks.filter(atLevel);
	const rest = picks.filter((p) => !atLevel(p));
	const common: Common = {
		name,
		lang: lang?.code,
		canPrepare,
		onPrepare: (p: PickedVideo, range?: FragmentRange) => onPrepare(videoUrl(p.id), range),
		onCut,
		onDismiss: (p: PickedVideo) => void post({ action: "dismiss", videoId: p.id }).then((r) => apply(r.body)),
	};
	return (
		<div data-testid="watch-picks">
			{anything && (
				<div className="mb-5 flex items-center gap-3">
					<p
						className="min-w-0 flex-1 font-prose text-[14px] text-ink-3"
						data-testid="watch-picks-status"
						role="status"
					>
						{status ?? "Videos from your creators and YouTube, by how much of each you know."}
					</p>
					<button
						type="button"
						disabled={refresh.running}
						onClick={() => void post({ action: "refresh" }).then((r) => (apply(r.body), load()))}
						className="q-btn ghost h-8 shrink-0"
						data-testid="watch-picks-refresh"
					>
						{refresh.running ? (
							<LoaderCircleIcon className="size-3.5 animate-spin" />
						) : (
							<RefreshCwIcon className="size-3.5" strokeWidth={1.8} />
						)}
						<span className="max-sm:sr-only">Check again</span>
					</button>
				</div>
			)}

			{!anything ? (
				<div className="max-w-lg" data-testid="watch-picks-empty">
					<p className="font-ui text-[17px] font-[600] text-foreground">No picks yet</p>
					<p className="q-sub">
						Save a creator who speaks {name}, or connect your YouTube. Their new videos show up here, sorted by how much
						of each you already know.
					</p>
					<div className="mt-4 flex flex-wrap gap-2">
						<button type="button" onClick={() => onSources("creators")} className="q-btn sec t">
							Save a creator
						</button>
						<button type="button" onClick={() => onSources("youtube")} className="q-btn ghost">
							Connect your YouTube
						</button>
					</div>
				</div>
			) : picks.length === 0 ? (
				<p className="q-sub max-w-2xl">
					{refresh.running
						? `Checking the videos. The ones in ${name} with captions show up here as they are found.`
						: `Nothing to offer yet: of ${state.checked} videos checked, none is spoken in ${name} with captions. Save another creator, or check again later.`}
				</p>
			) : (
				<>
					{fit.length > 0 ? (
						<Group common={common} title="At your level" picks={fit} more="more at your level" />
					) : (
						<p className="q-sub mb-6 max-w-2xl" data-testid="watch-picks-none-at-level">
							Nothing is at your level yet (88% of the words known or more). The closest come first; the scissors on a
							video find its easiest stretch.
						</p>
					)}
					{rest.length > 0 && (
						<Group common={common} title={fit.length > 0 ? "Harder" : "Closest so far"} picks={rest} more="more" />
					)}
				</>
			)}

			{anything && (
				<div className="q-card mt-10 flex items-center gap-4 px-4 py-3" data-testid="watch-keep-ready">
					<span className="min-w-0 flex-1">
						<span className="block font-ui text-[15px] font-[600] text-foreground">Keep one ready</span>
						<span className="block font-prose text-[13px] leading-snug text-ink-3">
							{state.canSearch
								? "When no video is waiting, the best pick you can follow (88% known or more) is prepared for you, so Today has a Watch task. One or two short AI requests a video."
								: "Needs an AI key: preparing a video translates it."}
						</span>
					</span>
					<Toggle
						checked={state.keepReady && state.canSearch}
						disabled={!state.canSearch}
						label="Keep one ready"
						testid="watch-keep-ready-toggle"
						onChange={(on) => void post({ action: "keep-ready", on }).then((r) => apply(r.body))}
					/>
				</div>
			)}
		</div>
	);
}
