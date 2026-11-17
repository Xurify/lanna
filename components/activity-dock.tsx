"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIcon, ClapperboardIcon, GlobeIcon, SquareIcon } from "lucide-react";
import { useServerEvent, useServerResync } from "@/components/server-events";

/**
 * THE BACKGROUND SECTION: the bottom strip of the LEFT SIDEBAR, one row per
 * RUNNING background task (video preparation, adding a language). Finished
 * tasks are the ready notice (components/task-notice.tsx) and the Tasks page.
 *
 * Data: ONE feed of GET /api/activity, refetched when the events channel
 * says the tasks moved, on channel resync, and when the tab becomes visible.
 * Quiet by design: no entry animations, stable keys, updates land in place.
 * Elapsed time ticks once a second while rows are shown.
 */

/** A background task (server/tasks.ts): running ones are rows here, finished
 *  ones are the ready notice (components/task-notice.tsx). */
export interface FeedTask {
	id: string;
	kind: "video" | "language";
	title: string;
	step: string;
	status: "running" | "done" | "error";
	startedAt: number;
	finishedAt?: number;
	dismissed?: boolean;
	href?: string;
	error?: string;
	retry?: { label: string; url: string; transcribe: boolean };
	language?: { id: string; english: string };
	note?: string;
}

export interface ActivityFeed {
	tasks: FeedTask[];
}

const EMPTY_FEED: ActivityFeed = { tasks: [] };

// ─── The activity feed (composition root: the root layout) ───────────────────

const ActivityContext = createContext<{ feed: ActivityFeed; refresh: () => void }>({
	feed: EMPTY_FEED,
	refresh: () => {},
});

/**
 * THE ACTIVITY FEED, PUSH-DRIVEN: the dock refetches exactly when truth
 * moves. A task change is announced on the events channel (activity-changed),
 * and channel resync (reconnect / dev-restart catch-up) and tab visibility
 * are the two client-local causes. Announced fetches ride a 250ms trailing
 * debounce (bursts of step updates); resync and visibility are immediate.
 * A failed fetch keeps the last feed (the dock never flickers to empty on a blip).
 */
export function ActivityProvider({ children }: { children: React.ReactNode }) {
	const [feed, setFeed] = useState<ActivityFeed>(EMPTY_FEED);
	const [nonce, setNonce] = useState(0);
	const refresh = useCallback(() => setNonce((n) => n + 1), []);
	const refreshRef = useRef(refresh);
	refreshRef.current = refresh;
	const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => {
		let alive = true;
		void (async () => {
			try {
				const res = await fetch("/api/activity");
				if (res.ok) {
					const data = (await res.json()) as Partial<ActivityFeed>;
					if (alive) setFeed({ tasks: data.tasks ?? [] });
				}
			} catch {
				// transport blip: keep the last feed, announce again next event
			}
		})();
		return () => {
			alive = false;
		};
	}, [nonce]);

	const scheduleAnnouncedFetch = () => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			debounceRef.current = undefined;
			refreshRef.current();
		}, 250);
	};
	useServerEvent("activity-changed", scheduleAnnouncedFetch);
	// Reconnect catch-up: events missed while the channel was down.
	useServerResync(() => refreshRef.current());

	// Returning to the tab refetches at once: anything missed while hidden lands now.
	useEffect(() => {
		const onVisibility = () => {
			if (document.visibilityState === "visible") setNonce((n) => n + 1);
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	}, []);

	// The debounce timer never outlives the provider.
	useEffect(
		() => () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		},
		[],
	);

	return <ActivityContext.Provider value={{ feed, refresh }}>{children}</ActivityContext.Provider>;
}

/** The activity feed seam for the rest of the shell: the tasks plus the
 *  refresh nudge. */
export function useActivity(): { feed: ActivityFeed; refresh: () => void } {
	return useContext(ActivityContext);
}

// ─── Pure presentation helpers (exported for tests) ──────────────────────────

/** One dock row: a running background task. */
interface ActivityBlob {
	id: string;
	kind: FeedTask["kind"];
	title: string;
	/** ms epoch — rows order oldest-first and elapsed counts from it. */
	startedAt: number;
	/** The task's current step line ("" when it has none). */
	activity: string;
}

/** The running tasks as rows, oldest first (the stable row order). */
export function toBlobs(feed: ActivityFeed): ActivityBlob[] {
	return feed.tasks
		.filter((task) => task.status === "running")
		.map((task) => ({
			id: task.id,
			kind: task.kind,
			title: task.title,
			startedAt: task.startedAt,
			activity: task.step,
		}))
		.sort((a, b) => a.startedAt - b.startedAt);
}

/** Elapsed as a compact ticking string: 45s / 3m 04s / 1h 12m. */
export function formatElapsed(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
	return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

// ─── The section (the sidebar's bottom strip) ─────────────────────────────────

/** A 1s heartbeat while the section is populated — elapsed lines tick. */
function useNow(active: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, [active]);
	return now;
}

const TASK_VIEW: Record<FeedTask["kind"], { icon: typeof GlobeIcon; label: string }> = {
	language: { icon: GlobeIcon, label: "Adding a language" },
	video: { icon: ClapperboardIcon, label: "Video preparation" },
};

/** Abort states per row id: pending (fired) / failed (backend absent). */
type AbortState = "pending" | "failed";

export function ActivitySection({ feed: feedProp }: { feed?: ActivityFeed }) {
	const ctx = useContext(ActivityContext);
	const feed = feedProp ?? ctx.feed;
	const refresh = ctx.refresh;
	const blobs = useMemo(() => toBlobs(feed), [feed]);
	const [abortStates, setAbortStates] = useState<Record<string, AbortState>>({});
	const now = useNow(blobs.length > 0);
	// Refs for stable abort handlers (no re-created closures per tick).
	const abortRef = useRef({ refresh, setAbortStates });
	abortRef.current = { refresh, setAbortStates };

	const abort = useCallback(async (blob: ActivityBlob) => {
		const { setAbortStates: set } = abortRef.current;
		set((s) => ({ ...s, [blob.id]: "pending" }));
		try {
			const res = await fetch("/api/activity/abort", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ kind: "task", id: blob.id }),
			});
			if (!res.ok) {
				// 409 not_running: the task already finished — the desired end
				// state. Refresh and clear; nothing to report.
				if (res.status === 404 || res.status === 409) {
					abortRef.current.refresh();
					set((s) => {
						const { [blob.id]: _drop, ...rest } = s;
						return rest;
					});
					return;
				}
				throw new Error(String(res.status));
			}
			abortRef.current.refresh();
		} catch {
			set((s) => ({ ...s, [blob.id]: "failed" }));
		}
	}, []);

	// Sidebar-native skin: part of the sidebar's surface, not a floating card —
	// the border-t separator matches the sidebar's own edge line, the header
	// matches the "Sessions" label, the rows match the session rows' hover.
	return (
		<section data-testid="activity-section" className="border-t border-border px-3 pb-3 pt-2.5">
			<div
				className={cn(
					"flex h-5 items-center gap-1.5 px-2.5 text-xs font-bold text-muted-foreground",
					blobs.length > 0 && "mb-1",
				)}
			>
				<ActivityIcon className="size-3" />
				Background
				{feed.tasks.length > 0 && (
					<Link
						href="/tasks"
						className="ml-auto font-medium text-primary hover:underline"
						data-testid="activity-all-tasks"
					>
						All tasks
					</Link>
				)}
			</div>
			{blobs.length > 0 && (
				<div className="flex max-h-[40dvh] flex-col gap-1 overflow-y-auto">
					{blobs.map((blob) => (
						<ActivityBlobRow
							key={blob.id}
							blob={blob}
							now={now}
							abortState={abortStates[blob.id]}
							onAbort={() => void abort(blob)}
						/>
					))}
				</div>
			)}
		</section>
	);
}

/** One running task: icon, title, step line and elapsed; the row opens the Tasks page. */
function ActivityBlobRow({
	blob,
	now,
	abortState,
	onAbort,
}: {
	blob: ActivityBlob;
	now: number;
	abortState: AbortState | undefined;
	onAbort: () => void;
}) {
	const { icon: Icon, label } = TASK_VIEW[blob.kind];
	return (
		<div
			data-testid="activity-blob-task"
			className="relative rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-accent"
		>
			<Link href="/tasks" className="flex w-full items-center gap-2 pr-7 text-left" data-testid="activity-task-link">
				<Icon className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium text-card-foreground">{blob.title}</span>
					{blob.activity ? (
						<span className="block truncate text-muted-foreground" title={blob.activity}>
							{blob.activity}
						</span>
					) : (
						<span className="block truncate text-muted-foreground/80">{label}</span>
					)}
				</span>
				<span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
					<span data-testid="activity-blob-elapsed">{formatElapsed(now - blob.startedAt)}</span>
				</span>
			</Link>
			<button
				type="button"
				data-testid="activity-abort"
				onClick={onAbort}
				disabled={abortState !== undefined}
				title={abortState === "failed" ? "Couldn't stop it." : "Stop this background work"}
				aria-label={`End ${label} in ${blob.title}`}
				className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
			>
				<SquareIcon className="size-3" />
			</button>
		</div>
	);
}
