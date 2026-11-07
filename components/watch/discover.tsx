"use client";

/**
 * Watch → picks (LangHarness, 2026-11-05): the shared state behind the shelf's
 * For you and Creators tabs (useDiscover, post), and the link to the
 * learner's YouTube (the desktop app's own sign-in window, or a Google
 * Takeout export). The work is on the server (src/server/discover.ts); the
 * tabs draw it (picks-panel.tsx, creators-panel.tsx) and start the reads.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, LoaderCircleIcon, RefreshCwIcon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/components/sidebar";
import { useActiveLanguage } from "@/components/speech";
import { parseTakeoutHistory, parseTakeoutSubscriptions, takeoutKind, type DiscoverStateView } from "@/src/core";
import { Avatar } from "@/components/watch/avatar";

type State = DiscoverStateView;

export async function post(body: Record<string, unknown>): Promise<{ ok: boolean; body: Record<string, unknown> }> {
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
	// A picture the server was still fetching when the page was drawn: ask once more after it has had time.
	const missing = !!state && [...state.creators, ...state.suggestions].some((c) => !c.avatar);
	const asked = useRef(false);
	useEffect(() => {
		if (!missing || asked.current) return;
		const t = window.setTimeout(() => {
			asked.current = true;
			void load();
		}, 3500);
		return () => window.clearTimeout(t);
	}, [missing, load]);
	const apply = useCallback((body: Record<string, unknown>) => {
		const s = (body.state ?? body) as State;
		if (s && Array.isArray(s.picks)) setState(s);
	}, []);
	return { state, setState, load, apply };
}

export type Discover = ReturnType<typeof useDiscover>;

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
	const [signedOut, setSignedOut] = useState(false);
	// Lists read from the account keep Sign out in reach even when the status check says the cookies are gone.
	const accountRead = !signedOut && !!state && LISTS.some((l) => state.youtube[l]?.via === "account");

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
			// Who is signed in, for the card. Not every desktop build can ask; a refusal costs nothing.
			if (yt.account) {
				try {
					const a = await yt.account();
					if (a.signedIn && a.text) await post({ action: "account", text: a.text });
				} catch {
					// the lists are read; the name can wait for the next read
				}
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
		setSignedOut(false);
		if (s.connected) await readAccount();
		else setMessage({ text: "Not signed in. If Google refused the window, use a Takeout export below.", bad: true });
	};

	const disconnect = async () => {
		const yt = window.lh?.youtube;
		if (!yt) return;
		const s = await yt.disconnect().catch(() => ({ available: true, connected: false }));
		setDesktop({ connected: s.connected });
		setSignedOut(true);
		try {
			apply((await post({ action: "forget-account" })).body);
		} catch {
			// the card shows no one once the status says signed out
		}
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
	const account = desktop?.connected && !signedOut ? state.youtubeAccount : undefined;
	return (
		<section data-testid="watch-youtube">
			<div className="q-card px-5 py-4">
				{desktop ? (
					<>
						{desktop.connected && (
							<div className="mb-2 flex items-center gap-3" data-testid="watch-youtube-account">
								<Avatar name={account?.name ?? "?"} src={account?.photo} />
								<span className="min-w-0">
									<span className="block truncate font-ui text-[15px] font-[600] text-foreground">{account?.name ? `Signed in as ${account.name}` : "Signed in"}</span>
									{account?.handle && (
										<span className="block truncate font-prose text-[13px] text-ink-3" data-testid="watch-youtube-handle">
											{account.handle}
										</span>
									)}
								</span>
							</div>
						)}
						<p className="font-prose text-[15px] leading-relaxed text-foreground">
							{desktop.connected
								? `The app reads your history, your recommendations and the channels you subscribe to, and finds the ones in ${name}.`
								: `Connect your YouTube and the app reads your history, your recommendations and the channels you subscribe to, then finds the videos and creators in ${name} among them.`}
						</p>
						<p className="mt-1 font-prose text-[13px] leading-relaxed text-ink-3">You sign in to Google in a window of the app&rsquo;s own. The app never sees your password, posts nothing, and keeps only your name and picture and the lists of videos and channels.</p>
						<div className="mt-3 flex flex-wrap items-center gap-2">
							{desktop.connected ? (
								<button type="button" disabled={!!busy} onClick={() => void readAccount()} className="q-btn sec t" data-testid="watch-youtube-read">
									<RefreshCwIcon className="size-4" strokeWidth={1.8} />
									Read again
								</button>
							) : (
								<button type="button" disabled={!!busy} onClick={() => void connect()} className="q-btn sec t" data-testid="watch-youtube-connect">
									Connect YouTube
								</button>
							)}
							{(desktop.connected || accountRead) && (
								<button type="button" disabled={!!busy} onClick={() => void disconnect()} className="q-btn ghost" data-testid="watch-youtube-disconnect">
									Sign out of YouTube
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
