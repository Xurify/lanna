"use client";

/**
 * Watch → picks (LangHarness, 2026-11-05): the videos offered from the
 * learner's creators and YouTube, the creators themselves, and the link to
 * the learner's YouTube (the desktop app's own sign-in window, or a Google
 * Takeout export). The work is on the server (src/server/discover.ts); this
 * file draws it and starts the reads.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon, ScissorsIcon, SearchIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/settings/controls";
import { timeAgo } from "@/components/sidebar";
import { useActiveLanguage } from "@/components/speech";
import { FragmentsPanel } from "@/components/watch/fragments";
import { Thumb } from "@/components/watch/thumb";
import { coverageBand, formatClock, MAX_VIDEO_SEC, parseChannelInput, parseTakeoutHistory, parseTakeoutSubscriptions, SPARSE_SPEECH_WPM, splitChannelInputs, sortCreatorVideos, takeoutKind, videoUrl, type CreatorVideo, type DiscoverStateView, type FragmentRange, type PickedVideo } from "@/src/core";

type State = DiscoverStateView;

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; body: Record<string, unknown> }> {
	try {
		const res = await fetch("/api/watch/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
		return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
	} catch (err) {
		return { ok: false, body: { message: err instanceof Error ? err.message : String(err) } };
	}
}

/** The discover state, polled while a refresh runs. */
export function useDiscover(initial: State | null) {
	const [state, setState] = useState<State | null>(initial);
	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/watch/discover");
			if (res.ok) setState((await res.json()) as State);
		} catch {
			// the page keeps what it has
		}
	}, []);
	useEffect(() => {
		if (!initial) void load();
	}, [initial, load]);
	const running = state?.refresh.running ?? false;
	useEffect(() => {
		if (!running) return;
		const t = window.setInterval(() => void load(), 2000);
		return () => window.clearInterval(t);
	}, [running, load]);
	const apply = useCallback((body: Record<string, unknown>) => {
		const s = (body.state ?? body) as State;
		if (s && Array.isArray(s.picks)) setState(s);
	}, []);
	return { state, setState, load, apply };
}

type Discover = ReturnType<typeof useDiscover>;

// ─── Picked for you ─────────────────────────────────────────────────────────

const SHOWN = 6;

function pickLine(p: PickedVideo, name: string): string {
	const parts: string[] = [];
	if (p.channel) parts.push(p.channel);
	parts.push(formatClock(p.durationSec));
	if (p.coverage !== undefined) parts.push(`${Math.round(p.coverage * 100)}% known (${coverageBand(p.coverage).title.toLowerCase()})`);
	else if (p.trackLang) parts.push(`captions in another language`);
	parts.push(p.captionKind === "captions" ? "captions by people" : "automatic captions");
	if (p.wordsPerMin !== undefined && p.wordsPerMin < SPARSE_SPEECH_WPM) parts.push("little speech");
	if (p.spoken === "unsure") parts.push(`may not be spoken in ${name}`);
	return parts.join(" · ");
}

function sourceLine(p: PickedVideo): string | null {
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

export function PicksSection({ d, canPrepare, onPrepare }: { d: Discover; canPrepare: boolean; onPrepare: (url: string, range?: FragmentRange) => void }) {
	const { state, apply, load } = d;
	const [all, setAll] = useState(false);
	const lang = useActiveLanguage();
	const name = lang?.english ?? "the language";
	if (!state) return null;
	const anything = state.creators.length > 0 || Object.keys(state.youtube).length > 0;
	const shown = all ? state.picks : state.picks.slice(0, SHOWN);
	const refresh = state.refresh;
	const status = refresh.running ? (refresh.total ? `${refresh.step ?? "Checking"}: ${refresh.done} of ${refresh.total}` : (refresh.step ?? "Checking")) : state.refreshedAt ? `checked ${timeAgo(state.refreshedAt)}` : null;
	return (
		<section className="mt-10" data-testid="watch-picks">
			<div className="flex items-center gap-2">
				<h2 className="q-sh mb-0 flex-1">
					Picked for you
					{status && <small data-testid="watch-picks-status">{status}</small>}
				</h2>
				{anything && (
					<button type="button" disabled={refresh.running} onClick={() => void post({ action: "refresh" }).then((r) => (apply(r.body), load()))} className="q-btn ghost h-8" data-testid="watch-picks-refresh">
						{refresh.running ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" strokeWidth={1.8} />}
						<span className="max-sm:sr-only">Check again</span>
					</button>
				)}
			</div>
			{!anything ? (
				<p className="q-sub mt-3 max-w-2xl">Save a creator who speaks {name}, or connect your YouTube below, and their new videos show up here, sorted by how much of each you already know.</p>
			) : state.picks.length === 0 ? (
				<p className="q-sub mt-3 max-w-2xl">{refresh.running ? "Checking the videos. The ones in " + name + " with captions show up here as they are found." : `Nothing to offer yet: of ${state.checked} videos checked, none is spoken in ${name} with captions. Save another creator, or check again later.`}</p>
			) : (
				<>
					{(state.picks[0]?.coverage ?? 0) < 0.88 && (
						<p className="q-sub mt-3 max-w-2xl" data-testid="watch-picks-none-at-level">
							None of these is at your level yet (88% of the words known or more). The closest come first; a video below that is mostly decoding, not listening. The scissors on a video find its easiest stretch, which may be much closer. Creators who speak slowly or about everyday things fit sooner too.
						</p>
					)}
					<ol className="mt-3 flex flex-col gap-2">
						{shown.map((p) => (
							<PickRow key={p.id} p={p} name={name} lang={lang?.code} canPrepare={canPrepare} onPrepare={(range) => onPrepare(videoUrl(p.id), range)} onDismiss={() => void post({ action: "dismiss", videoId: p.id }).then((r) => apply(r.body))} />
						))}
					</ol>
					{state.picks.length > SHOWN && (
						<button type="button" onClick={() => setAll((v) => !v)} className="q-btn ghost mt-2" data-testid="watch-picks-more">
							{all ? "Show fewer" : `Show ${state.picks.length - SHOWN} more`}
						</button>
					)}
					<p className="mt-3 max-w-2xl font-prose text-[13px] leading-relaxed text-ink-3">
						The share known is measured on each video&rsquo;s captions against your words, with no AI request. Preparing a video translates it, once.
					</p>
				</>
			)}
			{anything && (
				<div className="q-card mt-4 flex items-center gap-4 px-4 py-3" data-testid="watch-keep-ready">
					<span className="min-w-0 flex-1">
						<span className="block font-ui text-[15px] font-[600] text-foreground">Keep one ready</span>
						<span className="block font-prose text-[13px] leading-snug text-ink-3">
							{state.canSearch ? "When no video is waiting, the best pick you can follow (88% known or more) is prepared for you, so Today has a Watch task. One or two short AI requests a video." : "Needs an AI key: preparing a video translates it."}
						</span>
					</span>
					<Toggle checked={state.keepReady && state.canSearch} disabled={!state.canSearch} label="Keep one ready" testid="watch-keep-ready-toggle" onChange={(on) => void post({ action: "keep-ready", on }).then((r) => apply(r.body))} />
				</div>
			)}
		</section>
	);
}

function PickRow({ p, name, lang, canPrepare, onPrepare, onDismiss, bare, note }: { p: PickedVideo; name: string; lang?: string; canPrepare: boolean; onPrepare: (range?: FragmentRange) => void; onDismiss: () => void; bare?: boolean; note?: string }) {
	const why = note ?? sourceLine(p);
	const [cutting, setCutting] = useState(false);
	return (
		<li className={bare ? "border-t border-border" : "q-card"} data-testid="watch-pick">
			<div className="flex items-center gap-3 py-3 pl-4 pr-2 sm:gap-4">
				<span className="max-sm:hidden">
					<Thumb id={p.id} watched={false} />
				</span>
				<span className="min-w-0 flex-1">
					<span className="line-clamp-2 font-ui text-[15px] font-[600] text-foreground sm:block sm:truncate" lang={lang} title={p.title}>
						{p.title}
					</span>
					<span className="line-clamp-2 font-prose text-[13px] text-ink-3 sm:block sm:truncate" title={pickLine(p, name)}>
						{!bare && p.avatar && <Avatar name={p.channel ?? ""} src={p.avatar} small />}
						{pickLine(p, name)}
					</span>
					{why && <span className="block truncate font-prose text-[12px] text-ink-3">{why}</span>}
				</span>
				<button
					type="button"
					onClick={() => setCutting((v) => !v)}
					aria-expanded={cutting}
					aria-label={`Pick a stretch of ${p.title}`}
					title="Watch only a stretch of it"
					className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-foreground", cutting ? "bg-accent text-foreground" : "text-muted-foreground")}
					data-testid="watch-pick-fragments"
				>
					<ScissorsIcon className="size-4" strokeWidth={1.6} />
				</button>
				<button type="button" disabled={!canPrepare} onClick={() => onPrepare()} className="q-btn sec t h-9 shrink-0" title={canPrepare ? "Translate it and add it to your videos" : "Preparing needs an AI key"} data-testid="watch-pick-prepare">
					Prepare
				</button>
				<button type="button" onClick={onDismiss} aria-label={`Not for me: ${p.title}`} title="Not for me" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-pick-dismiss">
					<XIcon className="size-4" strokeWidth={1.6} />
				</button>
			</div>
			{cutting && <FragmentsPanel bare videoId={p.id} canPrepare={canPrepare} onPrepare={onPrepare} onClose={() => setCutting(false)} />}
		</li>
	);
}

// ─── Creators ───────────────────────────────────────────────────────────────

export function CreatorsSection({ d, canPrepare, onPrepare }: { d: Discover; canPrepare: boolean; onPrepare: (url: string, range?: FragmentRange) => void }) {
	const { state, apply } = d;
	const [open, setOpen] = useState<string | null>(null);
	const [savingAll, setSavingAll] = useState(false);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState<string | null>(null);
	const [saving, setSaving] = useState<string | null>(null);
	const lang = useActiveLanguage();
	const name = lang?.english ?? "the language";
	if (!state) return null;
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
		if (failed.length) {
			setInput(failed.map((f) => f.input).join("\n"));
			setError(`Saved ${String(r.body.saved ?? 0)}. Not saved: ${failed.map((f) => `${f.input} (${f.message.replace(/\.$/, "")})`).join("; ")}`);
			return;
		}
		setInput("");
	};
	const saveAll = async () => {
		setSavingAll(true);
		const r = await post({ action: "save-suggestions" });
		setSavingAll(false);
		if (r.ok) apply(r.body);
	};
	const dismissed = (id: string) => void post({ action: "dismiss-channel", id }).then((r) => apply(r.body));
	const save = async (id: string) => {
		setSaving(id);
		const r = await post({ action: "add-creator", input: id });
		setSaving(null);
		if (r.ok) apply(r.body);
	};
	return (
		<section className="mt-10" data-testid="watch-creators">
			<h2 className="q-sh">
				Creators
				{state.creators.length > 0 && <small>{state.creators.length}</small>}
			</h2>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (valid && !busy) void add();
				}}
				className="q-card flex flex-col gap-3 p-4 sm:flex-row"
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
					placeholder="Channel link, @handle, or one of their videos"
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
			{state.creators.length > 0 && (
				<ul className="mt-3 flex flex-col gap-2">
					{state.creators.map((c) => (
						<li key={c.id} className="q-card overflow-hidden" data-testid="watch-creator">
							<div className="relative flex items-center gap-3 py-3 pl-4 pr-[5.25rem]">
							<Avatar name={c.name} src={c.avatar} />
							<span className="min-w-0 flex-1">
								<a href={c.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${c.id}`} target="_blank" rel="noreferrer" className="block truncate font-ui text-[15px] font-[600] text-foreground hover:underline">
									{c.name}
								</a>
								<span className="line-clamp-2 sm:block sm:truncate font-prose text-[13px] text-ink-3">
									{c.handle ? `${c.handle} · ` : ""}
									{c.picks === 0 ? "no picks right now" : c.picks === 1 ? "1 pick" : `${c.picks} picks`}
									{c.awaitingCaptions > 0 && ` · ${c.awaitingCaptions} without captions yet`}
									{c.tooLong > 0 && ` · ${c.tooLong} over ${MAX_VIDEO_SEC / 60} min`}
								</span>
							</span>
							{confirming === c.id ? (
								<span className="absolute inset-y-1.5 right-1.5 flex items-center gap-1 rounded-lg bg-well pl-3 pr-1 font-ui text-xs font-[600] text-foreground">
									Remove this creator?
									<button
										type="button"
										onClick={() => {
											setConfirming(null);
											void post({ action: "remove-creator", id: c.id }).then((r) => apply(r.body));
										}}
										className="rounded-md px-2 py-1 text-miss hover:bg-accent"
									>
										Remove
									</button>
									<button type="button" onClick={() => setConfirming(null)} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">
										Keep
									</button>
								</span>
							) : (
								<button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} aria-label={`${open === c.id ? "Hide" : "Show"} the videos of ${c.name}`} title="Their videos" className="absolute right-10 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-creator-videos">
									<ChevronDownIcon className={cn("size-4 transition-transform", open === c.id && "rotate-180")} strokeWidth={1.6} />
								</button>
							)}
							{confirming !== c.id && (
								<button type="button" onClick={() => setConfirming(c.id)} aria-label={`Remove ${c.name}`} title="Remove this creator" className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-creator-remove">
									<Trash2Icon className="size-4" strokeWidth={1.6} />
								</button>
							)}
							</div>
							{open === c.id && <CreatorVideos c={c} name={name} lang={lang?.code} canPrepare={canPrepare} onPrepare={onPrepare} apply={apply} />}
						</li>
					))}
				</ul>
			)}
			{state.suggestions.length > 0 && (
				<>
					<div className="mt-6 flex items-center gap-2">
						<p className="min-w-0 flex-1 font-ui text-sm font-[600] text-ink-2">Channels in {name} from your YouTube</p>
						{state.suggestions.length > 1 && (
							<button type="button" disabled={savingAll} onClick={() => void saveAll()} className="q-btn ghost h-8" data-testid="watch-suggestions-save-all">
								{savingAll ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
								Save all {state.suggestions.length}
							</button>
						)}
					</div>
					<ul className="mt-2 flex flex-col gap-2" data-testid="watch-suggestions">
						{state.suggestions.map((s) => (
							<li key={s.id} className="q-card flex items-center gap-3 py-3 pl-4 pr-2" data-testid="watch-suggestion">
								<Avatar name={s.name} src={s.avatar} />
								<span className="min-w-0 flex-1">
									<span className="block truncate font-ui text-[15px] font-[600] text-foreground">{s.name}</span>
									<span className="line-clamp-2 sm:block sm:truncate font-prose text-[13px] text-ink-3">
										{s.subscribed ? "You subscribe · " : ""}
										{s.videos === 1 ? "1 video" : `${s.videos} videos`} in {name}
										{s.from.length ? ` from your ${s.from.map((f) => (f === "subscriptions" ? "subscriptions" : f === "history" ? "history" : f === "recommended" ? "recommendations" : "searches")).join(" and ")}` : ""}
									</span>
								</span>
								<button type="button" disabled={saving === s.id} onClick={() => void save(s.id)} className="q-btn sec h-9 shrink-0" data-testid="watch-suggestion-save">
									{saving === s.id ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
									Save
								</button>
								<button type="button" onClick={() => dismissed(s.id)} aria-label={`Not for me: ${s.name}`} title="Not for me" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-suggestion-dismiss">
									<XIcon className="size-4" strokeWidth={1.6} />
								</button>
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}

type CreatorRow = DiscoverStateView["creators"][number];

const STATUS_LINE: Record<Exclude<CreatorVideo["status"], "offered">, (name: string) => string> = {
	"in-library": () => "Already in your videos",
	dismissed: () => "You marked it not for you",
	"no-captions": (name) => `No captions in ${name} yet`,
	"other-language": (name) => `Not spoken in ${name}`,
	"not-in-language": (name) => `Not spoken in ${name}`,
	"too-long": () => `Over ${MAX_VIDEO_SEC / 60} minutes`,
	"too-short": () => "Under a minute",
	live: () => "A live stream",
	unavailable: () => "Not available",
};

/** Under a saved creator: their best picks, their newest uploads, or a search
 *  of the channel, best for you or newest first. Every video listed was
 *  checked for free (captions and the known-word share); one that cannot be
 *  offered says why instead of disappearing. */
function CreatorVideos({ c, name, lang, canPrepare, onPrepare, apply }: { c: CreatorRow; name: string; lang?: string; canPrepare: boolean; onPrepare: (url: string, range?: FragmentRange) => void; apply: (body: Record<string, unknown>) => void }) {
	const [sort, setSort] = useState<"best" | "newest">("best");
	const [query, setQuery] = useState("");
	/** The search the rows answer: null for the picks, "" for the newest uploads. */
	const [asked, setAsked] = useState<string | null>(null);
	const [rows, setRows] = useState<CreatorVideo[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const load = async (q: string) => {
		setAsked(q);
		setBusy(true);
		setError(null);
		const r = await post({ action: "creator-videos", id: c.id, ...(q ? { query: q } : {}) });
		setBusy(false);
		if (!r.ok || !Array.isArray(r.body.videos)) {
			setRows([]);
			setError(typeof r.body.message === "string" ? r.body.message : "YouTube did not answer. Try again.");
			return;
		}
		setRows(r.body.videos as CreatorVideo[]);
	};
	const choose = (by: "best" | "newest") => {
		setSort(by);
		if (by === "newest" && asked === null) void load("");
	};
	const clear = () => {
		setQuery("");
		if (sort === "newest") void load("");
		else {
			setAsked(null);
			setRows(null);
			setError(null);
		}
	};
	const dismiss = (id: string) =>
		void post({ action: "dismiss", videoId: id }).then((r) => {
			apply(r.body);
			setRows((list) => list?.map((v) => (v.id === id ? { ...v, status: "dismissed" as const } : v)) ?? null);
		});
	const listed = asked === null ? null : sortCreatorVideos(rows ?? [], sort);
	return (
		<div data-testid="watch-creator-panel">
			<div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
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
			{busy ? (
				<p className="flex items-center gap-2 border-t border-border px-4 py-3 font-prose text-[13px] text-ink-3" role="status">
					<LoaderCircleIcon className="size-4 animate-spin" />
					{asked ? `Searching ${c.name}'s videos and checking each one` : `Reading ${c.name}'s newest videos and checking each one`}
				</p>
			) : error ? (
				<p className="border-t border-border px-4 py-3 font-prose text-[13px] text-miss" role="alert">
					{error}
				</p>
			) : listed === null ? (
				c.videos.length > 0 ? (
					<ol>
						{c.videos.map((p) => (
							<PickRow key={p.id} bare p={p} name={name} lang={lang} canPrepare={canPrepare} onPrepare={(range) => onPrepare(videoUrl(p.id), range)} onDismiss={() => dismiss(p.id)} />
						))}
					</ol>
				) : (
					<p className="border-t border-border px-4 py-3 font-prose text-[13px] text-ink-3">
						Nothing to watch from {c.name} right now.
						{c.tooLong > 0 && ` ${c.tooLong === 1 ? "One video is" : `${c.tooLong} videos are`} over ${MAX_VIDEO_SEC / 60} minutes.`}
						{c.awaitingCaptions > 0 && ` ${c.awaitingCaptions === 1 ? "One has" : `${c.awaitingCaptions} have`} no captions yet; they are checked again each time.`}
					</p>
				)
			) : listed.length === 0 ? (
				<p className="border-t border-border px-4 py-3 font-prose text-[13px] text-ink-3">{asked ? `No video of ${c.name} matches "${asked}".` : `YouTube lists no videos for ${c.name}.`}</p>
			) : (
				<ol data-testid="watch-creator-videos-list">
					{listed.map((v) =>
						v.status === "offered" ? (
							<PickRow key={v.id} bare p={v} name={name} lang={lang} canPrepare={canPrepare} onPrepare={(range) => onPrepare(videoUrl(v.id), range)} onDismiss={() => dismiss(v.id)} note={v.publishedAt ? `Published ${timeAgo(v.publishedAt)}` : undefined} />
						) : (
							<li key={v.id} className="flex items-center gap-3 border-t border-border py-3 pl-4 pr-4 sm:gap-4" data-testid="watch-creator-video-skipped">
								<span className="max-sm:hidden opacity-60">
									<Thumb id={v.id} watched={false} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="line-clamp-2 font-ui text-[15px] font-[500] text-ink-2 sm:block sm:truncate" lang={lang} title={v.title}>
										{v.title}
									</span>
									<span className="block truncate font-prose text-[13px] text-ink-3">
										{STATUS_LINE[v.status](name)}
										{v.publishedAt && ` · published ${timeAgo(v.publishedAt)}`}
									</span>
								</span>
							</li>
						),
					)}
				</ol>
			)}
		</div>
	);
}

/** The channel's picture from Google's image host; the first letter shows
 *  when there is none or it does not load. The circle is the same size
 *  either way, so the row does not move when the picture arrives. */
function Avatar({ name, src, small }: { name: string; src?: string; small?: boolean }) {
	const [failed, setFailed] = useState(false);
	return (
		<span aria-hidden="true" className={cn("relative shrink-0 items-center justify-center overflow-hidden rounded-full bg-well-2 font-ui font-[600] text-ink-2", small ? "mr-1.5 inline-flex size-4 align-[-3px] text-[9px]" : "flex size-9 text-[15px]")}>
			{[...name.replace(/^[^\p{L}\p{N}]+/u, "")][0]?.toLocaleUpperCase() ?? "?"}
			{src && !failed && (
				// next/image would need Google's image host allowed in its config; the plain image needs no setup.
				// eslint-disable-next-line @next/next/no-img-element
				<img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
			)}
		</span>
	);
}

// ─── Your YouTube ───────────────────────────────────────────────────────────

const LISTS = ["history", "recommended", "subscriptions"] as const;

export function YouTubeSection({ d }: { d: Discover }) {
	const { state, apply, load } = d;
	const [desktop, setDesktop] = useState<{ connected: boolean } | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const lang = useActiveLanguage();
	const name = lang?.english ?? "the language";

	useEffect(() => {
		const yt = window.lh?.youtube;
		if (!yt) return;
		void yt.status().then((s) => setDesktop({ connected: s.connected }), () => setDesktop(null));
	}, []);

	const readAccount = useCallback(async () => {
		const yt = window.lh?.youtube;
		if (!yt) return;
		setBusy("Reading your history, recommendations and subscriptions…");
		setMessage(null);
		const counts: string[] = [];
		try {
			for (const list of LISTS) {
				const page = await yt.read(list);
				if (!page.signedIn || !page.html) {
					setDesktop({ connected: false });
					setMessage({ text: "YouTube no longer counts the app as signed in. Connect again.", bad: true });
					return;
				}
				const r = await post({ action: "import", list, via: "account", html: page.html });
				if (!r.ok) {
					setMessage({ text: typeof r.body.message === "string" ? r.body.message : "YouTube's page could not be read.", bad: true });
					return;
				}
				counts.push(`${r.body.count as number} ${list === "subscriptions" ? "channels" : list === "history" ? "from your history" : "recommended"}`);
			}
			const r = await post({ action: "refresh" });
			apply(r.body);
			setMessage({ text: `Read ${counts.join(", ")}. Checking which are in ${name}…` });
		} catch (err) {
			setMessage({ text: err instanceof Error ? err.message : String(err), bad: true });
		} finally {
			setBusy(null);
		}
	}, [apply, name]);

	const connect = async () => {
		const yt = window.lh?.youtube;
		if (!yt) return;
		setBusy("Sign in to Google in the window that opened…");
		setMessage(null);
		const s = await yt.connect().catch(() => ({ available: true, connected: false }));
		setBusy(null);
		setDesktop({ connected: s.connected });
		if (s.connected) await readAccount();
		else setMessage({ text: "Not signed in. If Google refused the window, use a Takeout export below.", bad: true });
	};

	const disconnect = async () => {
		const yt = window.lh?.youtube;
		if (!yt) return;
		const s = await yt.disconnect().catch(() => ({ available: true, connected: false }));
		setDesktop({ connected: s.connected });
		setMessage({ text: "Signed out. What was read stays until you forget it." });
	};

	const takeout = async (files: FileList | null) => {
		if (!files?.length) return;
		setBusy("Reading the export…");
		setMessage(null);
		const counts: string[] = [];
		try {
			for (const file of [...files]) {
				const text = await file.text();
				const kind = takeoutKind(text);
				if (kind === "history") {
					const videos = parseTakeoutHistory(text).slice(0, 2000);
					const r = await post({ action: "import", list: "history", via: "takeout", videos });
					if (r.ok) counts.push(`${r.body.count as number} videos from your history`);
				} else if (kind === "subscriptions") {
					const channels = parseTakeoutSubscriptions(text);
					const r = await post({ action: "import", list: "subscriptions", via: "takeout", channels });
					if (r.ok) counts.push(`${r.body.count as number} subscriptions`);
				} else counts.push(`${file.name} is not a YouTube history or subscriptions file`);
			}
			const r = await post({ action: "refresh" });
			apply(r.body);
			setMessage({ text: `${counts.join("; ")}.` });
		} catch (err) {
			setMessage({ text: err instanceof Error ? err.message : String(err), bad: true });
		} finally {
			setBusy(null);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	if (!state) return null;
	const read = LISTS.filter((l) => state.youtube[l]);
	const lastRead = read.map((l) => state.youtube[l]!.at).sort().at(-1);
	return (
		<section className="mt-10" data-testid="watch-youtube">
			<h2 className="q-sh">Your YouTube</h2>
			<div className="q-card px-5 py-4">
				{desktop ? (
					<>
						<p className="font-prose text-[15px] leading-relaxed text-foreground">
							{desktop.connected
								? `Connected. The app reads your history, your recommendations and the channels you subscribe to, and finds the ones in ${name}.`
								: `Connect your YouTube and the app reads your history, your recommendations and the channels you subscribe to, then finds the videos and creators in ${name} among them.`}
						</p>
						<p className="mt-1 font-prose text-[13px] leading-relaxed text-ink-3">You sign in to Google in a window of the app&rsquo;s own. The app never sees your password, posts nothing, and keeps only the lists of videos and channels.</p>
						<div className="mt-3 flex flex-wrap items-center gap-2">
							{desktop.connected ? (
								<>
									<button type="button" disabled={!!busy} onClick={() => void readAccount()} className="q-btn sec t" data-testid="watch-youtube-read">
										<RefreshCwIcon className="size-4" strokeWidth={1.8} />
										Read again
									</button>
									<button type="button" disabled={!!busy} onClick={() => void disconnect()} className="q-btn ghost" data-testid="watch-youtube-disconnect">
										Sign out
									</button>
								</>
							) : (
								<button type="button" disabled={!!busy} onClick={() => void connect()} className="q-btn sec t" data-testid="watch-youtube-connect">
									Connect YouTube
								</button>
							)}
						</div>
					</>
				) : (
					<p className="font-prose text-[15px] leading-relaxed text-foreground">Add your YouTube history and subscriptions from a Google Takeout export, and the app finds the videos and creators in {name} among them. In the desktop app you can sign in instead.</p>
				)}

				<div className={cn("flex flex-col items-start gap-x-3 gap-y-2 sm:flex-row sm:items-center", desktop ? "mt-4 border-t border-line pt-4" : "mt-3")}>
					<input ref={fileRef} type="file" multiple accept=".json,.html,.htm,.csv" className="sr-only" tabIndex={-1} onChange={(e) => void takeout(e.target.files)} data-testid="watch-takeout-file" />
					<button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="q-btn sec" data-testid="watch-takeout">
						<UploadIcon className="size-4" strokeWidth={1.8} />
						Add Takeout files
					</button>
					<span className="min-w-0 flex-1 font-prose text-[13px] leading-snug text-ink-3">
						At{" "}
						<a href="https://takeout.google.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-2">
							takeout.google.com
						</a>
						, pick only &ldquo;YouTube and YouTube Music&rdquo; with history and subscriptions. Then add <code className="font-mono text-[12px]">watch-history</code> and <code className="font-mono text-[12px]">subscriptions.csv</code> from the download.
					</span>
				</div>

				{(busy || message) && (
					<p className={cn("mt-3 flex items-center gap-2 font-prose text-[13px]", message?.bad ? "text-miss" : "text-ink-2")} role="status" data-testid="watch-youtube-status">
						{busy ? <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" /> : !message?.bad ? <CheckIcon className="size-3.5 shrink-0 text-teal-2" /> : null}
						{busy ?? message?.text}
					</p>
				)}

				{read.length > 0 && (
					<div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 font-prose text-[13px] text-ink-3" data-testid="watch-youtube-read-lists">
						<span className="min-w-0 flex-1">
							Read {lastRead ? timeAgo(lastRead) : ""}:{" "}
							{read
								.map((l) => {
									const r = state.youtube[l]!;
									return l === "subscriptions" ? `${r.count} subscriptions` : l === "history" ? `${r.count} from your history` : `${r.count} recommended`;
								})
								.join(", ")}
							{state.searches.length > 0 && <> · searched for {state.searches.map((q) => `"${q}"`).join(", ")}</>}
						</span>
						<button type="button" onClick={() => void post({ action: "forget-youtube" }).then((r) => (apply(r.body), load(), setMessage({ text: "Forgotten. Your creators and videos stay." })))} className="q-btn ghost h-8" data-testid="watch-youtube-forget">
							Forget what was read
						</button>
					</div>
				)}
			</div>
		</section>
	);
}
