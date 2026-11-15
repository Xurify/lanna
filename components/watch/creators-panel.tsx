"use client";

/**
 * Watch → Creators: the channels the learner saved. A list of them down the
 * side (along the top on a phone), the selected creator's videos beside it as
 * cards: their best picks, their newest uploads, or a search of the channel.
 * Every video listed was checked for free (captions and the known-word share);
 * one that cannot be offered says why instead of disappearing.
 */

import { useCallback, useRef, useState } from "react";
import { ExternalLinkIcon, LoaderCircleIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/components/sidebar";
import { useActiveLanguage } from "@/components/speech";
import { Avatar } from "@/components/watch/avatar";
import { creatorListings } from "@/components/watch/caches";
import { post, type Discover } from "@/components/watch/discover";
import { PickCard } from "@/components/watch/picks-panel";
import { CardGrid } from "@/components/watch/video-card";
import { channelUrl, MAX_VIDEO_SEC, parseChannelInput, sortCreatorVideos, splitChannelInputs, videoUrl, type CreatorVideo, type DiscoverStateView, type FragmentRange, type PickedVideo } from "@/src/core";

type CreatorRow = DiscoverStateView["creators"][number];

const SUGGESTIONS_SHOWN = 4;

// Survives the panel closing, so coming back from a video lands on the same creator.
let lastCreator: string | null = null;

const STATUS_LINE: Record<Exclude<CreatorVideo["status"], "offered">, (name: string) => string> = {
	"in-library": () => "Already in My videos",
	dismissed: () => "You marked it not for you",
	"no-captions": (name) => `No captions in ${name} yet`,
	"other-language": (name) => `Not spoken in ${name}`,
	"not-in-language": (name) => `Not spoken in ${name}`,
	"too-long": () => `Over ${MAX_VIDEO_SEC / 60} minutes`,
	"too-short": () => "Under a minute",
	live: () => "A live stream",
	unavailable: () => "Not available",
};

export function CreatorsPanel({ d, canPrepare, onPrepare, onCut }: { d: Discover; canPrepare: boolean; onPrepare: (url: string, range?: FragmentRange) => void; onCut: (p: PickedVideo) => void }) {
	const { state, apply } = d;
	const [chosen, setChosen] = useState<string | null>(lastCreator);
	const lang = useActiveLanguage();
	const name = lang?.english ?? "the language";
	if (!state) return null;
	const current = state.creators.find((c) => c.id === chosen) ?? state.creators[0] ?? null;
	return (
		<div data-testid="watch-creators">
			<AddCreators d={d} onSaved={(id) => id && ((lastCreator = id), setChosen(id))} />
			{state.creators.length > 0 && (
				<div className="mt-7 grid gap-5 @3xl:grid-cols-[14.5rem_minmax(0,1fr)] @3xl:gap-8">
					<ul className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 @3xl:mx-0 @3xl:flex-col @3xl:overflow-visible @3xl:px-0 @3xl:pb-0" aria-label="Your creators">
						{state.creators.map((c) => {
							const on = c.id === current?.id;
							return (
								<li key={c.id} className="shrink-0">
									<button
										type="button"
										onClick={() => {
											lastCreator = c.id;
											setChosen(c.id);
										}}
										aria-current={on ? "true" : undefined}
										className={cn("flex w-full min-w-0 items-center gap-2.5 rounded-xl py-2 pl-2 pr-3 text-left transition-colors @max-3xl:w-auto", on ? "bg-well-2" : "hover:bg-well")}
										data-testid="watch-creator"
									>
										<Avatar name={c.name} src={c.avatar} />
										<span className="min-w-0">
											<span className={cn("block max-w-40 truncate font-ui text-[14px] @3xl:max-w-none", on ? "font-[600] text-foreground" : "font-[500] text-ink-2")}>{c.name}</span>
											<span className="block truncate font-prose text-[12.5px] text-ink-3">{c.picks === 0 ? "no picks now" : c.picks === 1 ? "1 pick" : `${c.picks} picks`}</span>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
					{current && <CreatorDetail key={current.id} c={current} d={d} name={name} lang={lang?.code} canPrepare={canPrepare} onPrepare={onPrepare} onCut={onCut} apply={apply} onRemoved={() => ((lastCreator = null), setChosen(null))} />}
				</div>
			)}
			<Suggestions d={d} name={name} />
		</div>
	);
}

function AddCreators({ d, onSaved }: { d: Discover; onSaved: (firstId?: string) => void }) {
	const { apply } = d;
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const tokens = splitChannelInputs(input);
	const valid = tokens.length > 0 && tokens.every((t) => parseChannelInput(t) !== null);
	const add = async () => {
		setBusy(true);
		setError(null);
		const many = tokens.length > 1;
		const r = await post(many ? { action: "add-creators", input } : { action: "add-creator", input: tokens[0] });
		setBusy(false);
		if (!r.ok) {
			setError(typeof r.body.message === "string" ? r.body.message : "That channel could not be saved.");
			return;
		}
		apply(r.body);
		const failed = Array.isArray(r.body.failed) ? (r.body.failed as Array<{ input: string; message: string }>) : [];
		const created = (r.body.creator as { id?: string } | undefined)?.id;
		if (failed.length) {
			setInput(failed.map((f) => f.input).join("\n"));
			setError(`Saved ${String(r.body.saved ?? 0)}. Not saved: ${failed.map((f) => `${f.input} (${f.message.replace(/\.$/, "")})`).join("; ")}`);
			return;
		}
		setInput("");
		onSaved(created);
	};
	return (
		<>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (valid && !busy) void add();
				}}
				className="flex flex-col gap-2 sm:flex-row"
				data-testid="watch-creator-form"
			>
				<label className="sr-only" htmlFor="watch-creator">
					A channel link, an @handle or one of their videos; several at once, apart by spaces
				</label>
				<input
					id="watch-creator"
					value={input}
					onChange={(e) => {
						setInput(e.target.value);
						setError(null);
					}}
					placeholder="Save a creator: channel link, @handle, or one of their videos"
					autoComplete="off"
					spellCheck={false}
					className="q-field h-11 min-w-0 flex-1 rounded-lg px-4 font-ui text-[15px]"
					data-testid="watch-creator-input"
				/>
				<button type="submit" disabled={!valid || busy} className="q-btn sec h-11 px-5" data-testid="watch-creator-save">
					{busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
					{tokens.length > 1 ? `Save ${tokens.length} creators` : "Save creator"}
				</button>
			</form>
			{error && (
				<p className="mt-2 font-prose text-[13px] text-miss" role="alert" data-testid="watch-creator-error">
					{error}
				</p>
			)}
		</>
	);
}

function Suggestions({ d, name }: { d: Discover; name: string }) {
	const { state, apply } = d;
	const [savingAll, setSavingAll] = useState(false);
	const [saving, setSaving] = useState<string | null>(null);
	const [all, setAll] = useState(false);
	if (!state || state.suggestions.length === 0) return null;
	const shown = all ? state.suggestions : state.suggestions.slice(0, SUGGESTIONS_SHOWN);
	const saveAll = async () => {
		setSavingAll(true);
		const r = await post({ action: "save-suggestions" });
		setSavingAll(false);
		if (r.ok) apply(r.body);
	};
	const save = async (id: string) => {
		setSaving(id);
		const r = await post({ action: "add-creator", input: id });
		setSaving(null);
		if (r.ok) apply(r.body);
	};
	return (
		<section className="mt-12" aria-label={`Channels in ${name} from your YouTube`}>
			<div className="mb-3 flex items-center gap-2">
				<h2 className="min-w-0 flex-1 font-ui text-sm font-[600] text-ink-2">Channels in {name} from your YouTube</h2>
				{state.suggestions.length > 1 && (
					<button type="button" disabled={savingAll} onClick={() => void saveAll()} className="q-btn ghost h-8" data-testid="watch-suggestions-save-all">
						{savingAll ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
						Save all {state.suggestions.length}
					</button>
				)}
			</div>
			<ul className="grid gap-2 @4xl:grid-cols-2" data-testid="watch-suggestions">
				{shown.map((s) => (
					<li key={s.id} className="q-card flex items-center gap-3 py-2.5 pl-3 pr-2" data-testid="watch-suggestion">
						<a href={channelUrl({ id: s.id })} target="_blank" rel="noreferrer" title={`${s.name} (opens on YouTube)`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg" data-testid="watch-suggestion-link">
							<Avatar name={s.name} src={s.avatar} />
							<span className="min-w-0 flex-1">
								<span className="block truncate font-ui text-[14px] font-[600] text-foreground group-hover:underline">{s.name}</span>
								<span className="block truncate font-prose text-[12.5px] text-ink-3">
									{s.subscribed ? "You subscribe · " : ""}
									{s.videos === 1 ? "1 video" : `${s.videos} videos`} in {name}
								</span>
							</span>
						</a>
						<button type="button" disabled={saving === s.id} onClick={() => void save(s.id)} className="q-btn sec h-8 shrink-0 px-3" data-testid="watch-suggestion-save">
							{saving === s.id ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
							Save
						</button>
						<button type="button" onClick={() => void post({ action: "dismiss-channel", id: s.id }).then((r) => apply(r.body))} aria-label={`Not for me: ${s.name}`} title="Not for me" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-suggestion-dismiss">
							<XIcon className="size-4" strokeWidth={1.6} />
						</button>
					</li>
				))}
			</ul>
			{state.suggestions.length > SUGGESTIONS_SHOWN && (
				<button type="button" onClick={() => setAll((v) => !v)} className="q-btn ghost mt-2" data-testid="watch-suggestions-more">
					{all ? "Show fewer" : `Show ${state.suggestions.length - SUGGESTIONS_SHOWN} more`}
				</button>
			)}
		</section>
	);
}

function CreatorDetail({ c, d, name, lang, canPrepare, onPrepare, onCut, apply, onRemoved }: { c: CreatorRow; d: Discover; name: string; lang?: string; canPrepare: boolean; onPrepare: (url: string, range?: FragmentRange) => void; onCut: (p: PickedVideo) => void; apply: (body: Record<string, unknown>) => void; onRemoved: () => void }) {
	const [sort, setSort] = useState<"best" | "newest">("best");
	const [query, setQuery] = useState("");
	/** The search the rows answer: null for the picks, "" for the newest uploads. */
	const [asked, setAsked] = useState<string | null>(null);
	const [rows, setRows] = useState<CreatorVideo[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [skipped, setSkipped] = useState(false);
	const ask = useRef(0);
	const refreshedAt = d.state?.refreshedAt ?? "";
	const keyOf = (q: string) => `${lang ?? ""}|${refreshedAt}|${c.id}|${q}`;

	const load = useCallback(
		async (q: string) => {
			const mine = ++ask.current;
			setAsked(q);
			setError(null);
			const kept = creatorListings.peek(`${lang ?? ""}|${refreshedAt}|${c.id}|${q}`);
			if (kept) {
				setBusy(false);
				setRows(kept);
				return;
			}
			setBusy(true);
			try {
				const found = await creatorListings.run(`${lang ?? ""}|${refreshedAt}|${c.id}|${q}`, async () => {
					const r = await post({ action: "creator-videos", id: c.id, ...(q ? { query: q } : {}) });
					if (!r.ok || !Array.isArray(r.body.videos)) throw new Error(typeof r.body.message === "string" ? r.body.message : "YouTube did not answer. Try again.");
					return r.body.videos as CreatorVideo[];
				});
				if (mine === ask.current) setRows(found);
			} catch (err) {
				if (mine !== ask.current) return;
				setRows([]);
				setError(err instanceof Error ? err.message : "YouTube did not answer. Try again.");
			} finally {
				if (mine === ask.current) setBusy(false);
			}
		},
		[c.id, lang, refreshedAt],
	);
	const choose = (by: "best" | "newest") => {
		setSort(by);
		if (by === "newest" && asked === null) void load("");
	};
	const clear = () => {
		setQuery("");
		if (sort === "newest") void load("");
		else {
			ask.current++;
			setBusy(false);
			setAsked(null);
			setRows(null);
			setError(null);
		}
	};
	const dismiss = (id: string) =>
		void post({ action: "dismiss", videoId: id }).then((r) => {
			apply(r.body);
			setRows((list) => {
				const next = list?.map((v) => (v.id === id ? { ...v, status: "dismissed" as const } : v)) ?? null;
				if (next && asked !== null) creatorListings.set(keyOf(asked), next);
				return next;
			});
		});

	const listed = asked === null ? null : sortCreatorVideos(rows ?? [], sort);
	const offered: PickedVideo[] = listed === null ? c.videos : listed.filter((v): v is CreatorVideo & PickedVideo => v.status === "offered");
	const others = listed === null ? [] : listed.filter((v) => v.status !== "offered");
	return (
		<div className="@container min-w-0" data-testid="watch-creator-panel">
			<div className="flex items-center gap-3">
				<Avatar name={c.name} src={c.avatar} size="lg" />
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-ui text-xl font-[600] leading-tight text-foreground">
						<a href={channelUrl(c)} target="_blank" rel="noreferrer" title={`${c.name} (opens on YouTube)`} className="hover:underline" data-testid="watch-creator-link">
							{c.name}
						</a>
					</h2>
					<p className="truncate font-prose text-[13px] text-ink-3">
						{c.handle ? `${c.handle} · ` : ""}
						{c.picks === 0 ? "no picks right now" : c.picks === 1 ? "1 pick" : `${c.picks} picks`}
						{c.awaitingCaptions > 0 && ` · ${c.awaitingCaptions} without captions yet`}
						{c.tooLong > 0 && ` · ${c.tooLong} over ${MAX_VIDEO_SEC / 60} min`}
					</p>
				</div>
				{confirming ? (
					<span className="flex items-center gap-1 rounded-lg bg-well pl-3 pr-1 font-ui text-xs font-[600] text-foreground">
						Remove this creator?
						<button
							type="button"
							onClick={() => {
								setConfirming(false);
								void post({ action: "remove-creator", id: c.id }).then((r) => (apply(r.body), onRemoved()));
							}}
							className="rounded-md px-2 py-2 text-miss hover:bg-accent"
							data-testid="watch-creator-remove-yes"
						>
							Remove
						</button>
						<button type="button" onClick={() => setConfirming(false)} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-accent hover:text-foreground">
							Keep
						</button>
					</span>
				) : (
					<>
						<a href={c.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${c.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${c.name} on YouTube`} title="Open on YouTube" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
							<ExternalLinkIcon className="size-4" strokeWidth={1.6} />
						</a>
						<button type="button" onClick={() => setConfirming(true)} aria-label={`Remove ${c.name}`} title="Remove this creator" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-creator-remove">
							<Trash2Icon className="size-4" strokeWidth={1.6} />
						</button>
					</>
				)}
			</div>

			<div className="mt-5 flex flex-wrap items-center gap-2">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (query.trim()) void load(query.trim());
					}}
					className="relative min-w-48 flex-1"
					role="search"
				>
					<SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.6} />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape" && query) {
								e.preventDefault();
								e.stopPropagation();
								clear();
							}
						}}
						placeholder={`Search ${c.name}'s videos`}
						aria-label={`Search the videos of ${c.name}`}
						enterKeyHint="search"
						className="q-field h-9 w-full rounded-lg pl-9 pr-9 font-ui text-[14px]"
						data-testid="watch-creator-search"
					/>
					{query && (
						<button type="button" onClick={clear} aria-label="Clear the search" className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
							<XIcon className="size-3.5" strokeWidth={1.6} />
						</button>
					)}
				</form>
				<div className="q-segc" role="radiogroup" aria-label="Order">
					{(["best", "newest"] as const).map((by) => (
						<button key={by} type="button" role="radio" aria-checked={sort === by} className={cn(sort === by && "on")} onClick={() => choose(by)} data-testid={`watch-creator-sort-${by}`}>
							{by === "best" ? "Best for you" : "Newest"}
						</button>
					))}
				</div>
			</div>

			<div className="mt-5">
				{busy ? (
					<p className="flex items-center gap-2 font-prose text-[13px] text-ink-3" role="status">
						<LoaderCircleIcon className="size-4 animate-spin" />
						{asked ? `Searching ${c.name}'s videos and checking each one` : `Reading ${c.name}'s newest videos and checking each one`}
					</p>
				) : error ? (
					<p className="font-prose text-[13px] text-miss" role="alert">
						{error}
					</p>
				) : offered.length > 0 ? (
					<CardGrid testid="watch-creator-videos-list">
						{offered.map((v) => (
							<PickCard key={v.id} p={v} name={name} lang={lang} canPrepare={canPrepare} onPrepare={() => onPrepare(videoUrl(v.id))} onCut={() => onCut(v)} onDismiss={() => dismiss(v.id)} note={listed !== null && v.publishedAt ? `Published ${timeAgo(v.publishedAt)}` : undefined} />
						))}
					</CardGrid>
				) : (
					<p className="font-prose text-[13px] text-ink-3">
						{listed === null ? (
							<>
								Nothing to watch from {c.name} right now.
								{c.tooLong > 0 && ` ${c.tooLong === 1 ? "One video is" : `${c.tooLong} videos are`} over ${MAX_VIDEO_SEC / 60} minutes.`}
								{c.awaitingCaptions > 0 && ` ${c.awaitingCaptions === 1 ? "One has" : `${c.awaitingCaptions} have`} no captions yet; they are checked again each time.`}
							</>
						) : asked ? (
							`No video of ${c.name} matches "${asked}".`
						) : (
							`YouTube lists no videos for ${c.name}.`
						)}
					</p>
				)}

				{!busy && !error && others.length > 0 && (
					<div className="mt-6">
						<button type="button" onClick={() => setSkipped((v) => !v)} aria-expanded={skipped} className="q-btn ghost h-8">
							{skipped ? "Hide" : "Show"} {others.length} that cannot be offered
						</button>
						{skipped && (
							<ul className="mt-2 divide-y divide-border">
								{others.map((v) => (
									<li key={v.id} className="flex items-center gap-3 py-2.5" data-testid="watch-creator-video-skipped">
										<span className="min-w-0 flex-1">
											<a href={videoUrl(v.id)} target="_blank" rel="noreferrer" className="block truncate font-ui text-[14px] font-[500] text-ink-2 hover:underline" lang={lang} title={`${v.title} (opens on YouTube)`}>
												{v.title}
											</a>
											<span className="block truncate font-prose text-[12.5px] text-ink-3">
												{STATUS_LINE[v.status as Exclude<CreatorVideo["status"], "offered">](name)}
												{v.publishedAt && ` · published ${timeAgo(v.publishedAt)}`}
											</span>
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
