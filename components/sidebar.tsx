"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MenuShell } from "@/components/menu-shell";
import { DeleteSessionDialog } from "@/components/delete-session-dialog";
import { DeleteSessionsDialog } from "@/components/delete-sessions-dialog";
import type { ChatDeleteMode } from "@/src/core";
import { BotMessageSquareIcon, CheckIcon, MessagesSquareIcon, ListChecksIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon, SettingsIcon, Trash2Icon, XIcon } from "lucide-react";
import { ActivitySection, toBlobs, useActivity } from "@/components/activity-dock";
import { CoverageMenuBlock } from "@/components/extraction-coverage";
import { LhMark } from "@/components/lh-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrailleSpinner } from "@/components/braille-spinner";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { JumpProvider } from "@/components/quiet/jump";
import { SettingsDialogProvider, useSettingsDialog } from "@/components/settings/settings-dialog.tsx";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fuzzyScore } from "@/src/core";
import { useServerEvent, useServerResync } from "@/components/server-events";
import type { ChatListItem } from "@/src/core";
import { kbdEventForAction } from "@/src/core";
import { notifySettingsSaved } from "@/components/settings-signal";
import { stopSpeaking } from "@/components/speech";
import { SelectionWordBankBar } from "@/components/words/selection-word-bank";

/**
 * Toggleable sidebar — NOT a modal drawer: no backdrop, no focus theft. It
 * sits inline next to the content and can stay open while working in a
 * session. Open state persists across pages (provider lives in the root
 * layout) and across reloads (localStorage).
 */


/*
 * Narrow-window behavior (owner, 2026-09-17): below SIDEBAR_AUTOCLOSE the
 * sidebar would squeeze the page below the 640px window floor (the two
 * numbers compose: 640 + 288 sidebar = 928), so it auto-closes — and
 * auto-RESTORES when the window widens again (owner choice: the sidebar
 * pops back, not a manual re-open). The whole behavior is one expression:
 * rendered = pref && !narrow, where pref is the persisted user choice.
 * Manual closes persist and stay closed; auto-close does not touch the
 * preference. Opening the sidebar while narrow asks the Electron shell to
 * widen the window to the threshold (window.lh.expandWindow, IPC in
 * electron/main.cjs) — the resize listener flips `narrow` and the sidebar
 * appears. In the plain browser there is no window to widen and no
 * suppression — a narrow tab opens the sidebar if the user says so.
 *
 * Mirrors SIDEBAR_AUTOCLOSE in electron/main.cjs — keep in sync.
 */
import type { ChatGPTControlBridge, NativeSubscriptionControlBridge } from "@/src/core";
import type { UpdateState } from "@/components/settings/update-settings.tsx";
const SIDEBAR_AUTOCLOSE = 900;

/* Phone widths, and touch tablets below lg, in the plain browser: the sidebar becomes
 * a drawer over the page instead of a 288px column that would leave about
 * 100px of page on a 390px phone. The drawer starts closed on every load and
 * never touches the persisted desktop preference. Electron keeps its own
 * narrow rule above. */
const PHONE_QUERY = "(width < 48rem), (pointer: coarse) and (width < 64rem)";

// Module scope, guarded for SSR (the server has no navigator).
// The preload bridge is the shell's identity: the user agent no longer
// names Electron (electron/main.cjs strips it so embedded YouTube plays).
const IS_ELECTRON = typeof window !== "undefined" && (!!window.lh?.platform || navigator.userAgent.includes("Electron"));

declare global {
	interface Window {
		/** Preload bridge (electron/preload.cjs) — Electron only, absent in the browser. */
		lh?: {
			/** Read-only host OS; determines the native-control gutter. */
			platform?: string;
			/** External Next desktop-dev uses the server's web connections. */
			subscriptionTransport?: "desktop" | "web";
			openSubscriptionBrowser?: (action: string) => Promise<void>;
			chatgpt?: ChatGPTControlBridge;
			subscriptions?: NativeSubscriptionControlBridge;
			expandWindow: () => void;
			/** Tells the Electron frame which theme the page is in. */
			setTheme?: (night: boolean) => void;
			/** LangHarness: restart the app (language-profile switch). */
			relaunch?: () => void;
			/** The zoom truth (owner round 7): subscribes to "lh:zoom" pushes; returns unsubscribe. */
			onZoom?: (cb: (factor: number) => void) => () => void;
			getZoom?: () => Promise<number>;
			/** Observational update events and a snapshot for late subscribers. */
			onUpdateStatus?: (cb: (status: UpdateState) => void) => () => void;
			getUpdateState?: () => Promise<UpdateState>;
			/** Explicit manual check also downloads and stages available updates. */
			checkForUpdates?: () => Promise<void>;
			installUpdate?: () => void;
			onOpenSettings?: (cb: (section: string) => void) => () => void;
			/** Settings → Data: the desktop HTTP cache in bytes; clearCache resolves with the size after. */
			storage?: {
				cacheSize: () => Promise<number>;
				clearCache: () => Promise<number>;
			};
		};
	}
}

const SidebarContext = createContext<{
	open: boolean;
	/** Phone drawer open (browser below md only). */
	drawer: boolean;
	/** The browser is at phone width, so toggling drives the drawer. */
	phone: boolean;
	toggle: () => void;
	closeDrawer: () => void;
}>({
	open: false,
	drawer: false,
	phone: false,
	toggle: () => {},
	closeDrawer: () => {},
});

export function useSidebar() {
	return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		const bridge = window.lh?.chatgpt;
		if (!bridge) return;
		const off = bridge.onChange(() => notifySettingsSaved("keys"));
		notifySettingsSaved("keys"); // cover changes missed before this root-lifetime subscription
		return off;
	}, []);
	// The sidebar is a permanent column on a desktop window. It used to be
	// collapsible, with the choice kept in a cookie, and a collapsed sidebar
	// then stayed gone on every route and every reload (a closed default made
	// it vanish for everyone, 2026-11-02). Only a window below the drawer
	// breakpoint hides it, as a drawer with a menu button.
	const open = true;
	const [narrow, setNarrow] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		// Electron shell detection (merged chrome, 2026-09-17): keys the
		// .lh-electron CSS (app/globals.css) that turns the header bands
		// into the window's drag surface. Post-mount only — server HTML
		// and first client render must agree (no hydration mismatch),
		// and in the plain browser the class never appears.
		if (IS_ELECTRON) {
			document.documentElement.classList.add("lh-electron");
			document.documentElement.dataset.lhPlatform = window.lh?.platform ?? "";
		}

		// THE ZOOM TRUTH (owner round 7, 2026-10-05): ⌘±/⌘0 zoom the UI
		// (Electron zoomFactor) while the native traffic lights stay
		// physical-fixed — the CSS gutter lengths divide by this factor so
		// their RENDERED size never moves. getZoom covers the first-paint
		// race; every later change arrives as an lh:zoom push.
		const setZoomVar = (factor: number) =>
			document.documentElement.style.setProperty("--lh-zoom", String(factor));
		const off = window.lh?.onZoom?.(setZoomVar);
		void window.lh?.getZoom?.().then(setZoomVar);

		// Arm the width transition only after the first frames have painted,
		// so nothing applied at mount animates.
		// (setTimeout fallback: test DOMs have no requestAnimationFrame.)
		const frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 16) as unknown as number;
		const cancel = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (id: number) => clearTimeout(id);
		let inner = 0;
		const outer = frame(() => {
			inner = frame(() => setMounted(true));
		});
		return () => {
			off?.();
			cancel(outer);
			cancel(inner);
		};
	}, []);

	// Narrow-window auto-close/auto-restore (see SIDEBAR_AUTOCLOSE note):
	// fires only on actual resizes — a boolean compare, no layout work.
	// Both this and the mount effect land before the first paint, so a
	// narrow window never flashes the open sidebar on load.
	useEffect(() => {
		if (!IS_ELECTRON) return; // plain-browser tabs open freely
		const onResize = () => setNarrow(window.innerWidth < SIDEBAR_AUTOCLOSE);
		onResize();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const [phone, setPhone] = useState(false);
	const [drawer, setDrawer] = useState(false);
	useEffect(() => {
		if (IS_ELECTRON || typeof window.matchMedia !== "function") return;
		const mq = window.matchMedia(PHONE_QUERY);
		const sync = () => {
			setPhone(mq.matches);
			if (!mq.matches) setDrawer(false);
		};
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	const closeDrawer = useCallback(() => setDrawer(false), []);

	const toggle = useCallback(() => {
		if (phone) {
			setDrawer((v) => !v);
			return;
		}
		// An Electron window narrower than the threshold hides the sidebar:
		// ask the shell to widen it, and the resize listener brings it back.
		if (narrow) window.lh?.expandWindow();
	}, [narrow, phone]);

	// ⌘B: the global shortcut dispatches kbdEventForAction("toggle-sidebar")
	// and the context answers on exactly that name — the shared spelling
	// is the fix for the interlude bug (the listener sat on the pre-
	// convention name "lh:toggle-sidebar" while the dispatcher sent
	// "lh:kbd-toggle-sidebar", so ⌘B silently did nothing; owner
	// 2026-09-25).
	useEffect(() => {
		const event = kbdEventForAction("toggle-sidebar");
		const onToggle = () => toggle();
		window.addEventListener(event, onToggle);
		return () => window.removeEventListener(event, onToggle);
	}, [toggle]);

	return (
		<SidebarContext.Provider value={{ open: open && !narrow, drawer, phone, toggle, closeDrawer }}>
			{/* transitions gated on mount: no slide-in flash on page load */}
			<div className={cn("flex h-dvh pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]", mounted && "[&_.sidebar-motion]:transition-[width,margin,opacity]")}>{children}</div>
		</SidebarContext.Provider>
	);
}

/** Hamburger for page headers — only visible when the sidebar is closed.
 *
 *  Owner, round 6c: the toggle is ALWAYS MOUNTED, owning a slot whose
 *  width+margin animate in LOCKSTEP with the sidebar's own width
 *  transition (same duration-200, same easing, both gated on mount) —
 *  before, it mounted/unmounted in one frame, so its 48px footprint
 *  (button + gap) popped and dragged the title and chips sideways while
 *  the sidebar was still mid-slide. When open the slot is exactly zero
 *  (w-0 -mr-3: width 0, the negative margin cancels the header's gap-3),
 *  so resting layouts are pixel-identical to the old conditional render.
 *  The icon fades with the slot and is clipped by it as it collapses —
 *  no popping in either direction. */
export function SidebarToggle() {
	const { open, drawer, phone, toggle } = useSidebar();
	const shown = phone ? !drawer : !open;
	return (
		<span
			className={cn(
				"sidebar-motion lh-no-drag relative flex h-9 shrink-0 overflow-hidden pointer-coarse:overflow-visible duration-200",
				open ? "w-0 -mr-3" : "w-9 mr-0 lh-closed-toggle",
				// Phone widths follow the drawer, decided in CSS so the first
				// paint is already right.
				drawer ? "max-md:w-0 max-md:-mr-3 touch-narrow:w-0 touch-narrow:-mr-3" : "max-md:w-9 max-md:mr-0 touch-narrow:w-9 touch-narrow:mr-0",
			)}
		>
			<Hint label="Open sidebar" action="toggle-sidebar">
			<Button
				variant="ghost"
				size="icon"
				aria-label="Open sidebar"
				aria-hidden={!shown}
				tabIndex={shown ? 0 : -1}
				onClick={toggle}
				className={cn(
					"sidebar-motion duration-200 pointer-coarse:size-11",
					open ? "pointer-events-none opacity-0" : "opacity-100",
					drawer ? "max-md:pointer-events-none max-md:opacity-0 touch-narrow:pointer-events-none touch-narrow:opacity-0" : "max-md:pointer-events-auto max-md:opacity-100 touch-narrow:pointer-events-auto touch-narrow:opacity-100",
				)}
			>
				{/* Owner, round 6: size-4, SAME as the close glyph — the toggle
				    must not grow when the sidebar is closed (it did: size-5 here).
				    The small look is the standard, both directions. */}
				<PanelLeftOpenIcon className="size-4" />
			</Button>
			</Hint>
		</span>
	);
}

/**
 * The row's status indicator (owner, minimal-color round): the braille
 * spinner, ONLY while a teach turn is in flight — monochrome motion, the
 * terminal's own glyph, existing exactly as long as the work does and
 * vanishing the moment it ends. Every other state renders NOTHING:
 * phases only advance (all sessions end in Teaching — phase-as-signal was
 * decoration, now retired app-wide), and question-pending is the dominant
 * RESTING state of real sessions — a resting state has no scan value, so
 * the meta line's "Waiting for input" text carries it. Idle is the
 * absence of a signal, by design.
 */
function SessionStatus({ busy }: { busy: boolean }) {
	if (!busy) return null;
	return <BrailleSpinner />;
}

/** Compact "how long ago": "just now", "5m ago", "3h ago", "2d ago",
 *  then a plain date. How long a session has been WAITING matters more
 *  than an absolute timestamp. Beyond a week the date renders ISO
 *  (YYYY-MM-DD, zero-padded) — the international standard: unambiguous
 *  in any locale and it sorts (owner, typography round 5; the old
 *  M/D/YYYY was the US convention. A user-locale setting can come later
 *  — trivial, a format function swap). Pure — exported for tests. */
export function timeAgo(iso: string, now = new Date()): string {
	const ms = now.getTime() - new Date(iso).getTime();
	if (ms < 60_000) return "just now";
	const min = Math.floor(ms / 60_000);
	if (min < 60) return `${min}m ago`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d}d ago`;
	const date = new Date(iso);
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${mm}-${dd}`;
}

/** The row's second line: the state when a state exists (waiting/working),
 *  otherwise just how long ago. The message count is DROPPED (owner,
 *  typography round 5): it informed no decision — clutter. messageCount
 *  still rides the API payload, so this is a one-line flip back if it's
 *  ever wanted. */
function sessionMeta(chat: ChatListItem): string {
	if (chat.compacting) return `Compacting context · ${timeAgo(chat.updatedAt)}`;
	if (chat.pendingQuestion) return `Waiting for input · ${timeAgo(chat.updatedAt)}`;
	if ((chat.kind ?? "teach") === "practice" && chat.pendingProblem) {
		return `Problem waiting · ${timeAgo(chat.updatedAt)}`;
	}
	if (chat.busy) return "Working…";
	return timeAgo(chat.updatedAt);
}

/**
 * One session row: the status spinner (only while working), then title +
 * state-aware meta. Exported for render tests — pure function of the
 * list item.
 */
export function SessionRow({
	chat,
	active,
	onOpen,
	kbdSelected = false,
	onContextMenu,
	selectMode = false,
	selected = false,
}: {
	chat: ChatListItem;
	active: boolean;
	/** The click: opens the chat, or toggles it while selecting (the parent reads the modifier keys). */
	onOpen: (e: React.MouseEvent<HTMLButtonElement>) => void;
	/** Bulk-delete selection: rows show a checkbox and a click toggles. */
	selectMode?: boolean;
	selected?: boolean;
	/** Keyboard-cycle highlight (shortcut wave A: Alt+↑/↓ + Alt+Enter) —
	 *  visually distinct from the active session, which stays filled. */
	kbdSelected?: boolean;
	/** Right-click opens the context menu (wave 6: Rename / Delete). */
	onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
	return (
		<button
			type="button"
			onClick={onOpen}
			onContextMenu={onContextMenu}
			data-testid={kbdSelected ? "session-row-kbd" : "session-row"}
			aria-pressed={selectMode ? selected : undefined}
			className={cn(
				"relative mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-accent",
				active && !selectMode && "bg-accent",
				selected && "bg-accent",
				kbdSelected && !active && "bg-accent/60 ring-1 ring-border",
			)}
		>
			{selectMode && (
				<span
					aria-hidden="true"
					data-testid="session-row-check"
					className={cn("grid size-4 shrink-0 place-items-center rounded border", selected ? "border-foreground bg-foreground text-background" : "border-muted-foreground/60")}
				>
					{selected && <CheckIcon className="size-3" strokeWidth={3} />}
				</span>
			)}
			<SessionStatus busy={chat.busy || chat.compacting} />
			<span className="min-w-0 flex-1">
				{/* Titles are the learner's/teacher's WORDS — Source Sans 3, the
				    same voice the words were typed in (every input is lh-prose);
				    the meta line below stays JetBrains Mono (machine data). One
				    rule, finally applied to the picker too (owner, typography
				    round): mono = chrome, Source Sans = human words. */}
				<span className="block truncate font-prose text-[14px] leading-5">{chat.title}</span>
				<span className="block text-xs text-muted-foreground">{sessionMeta(chat)}</span>
			</span>
			{/* The dumbbell rides the FAR RIGHT (owner round 6, 2026-10-05) —
			    was left of the name; right-aligned keeps the titles flush with
			    the teaching rows and reads cleaner. */}
			{(chat.kind ?? "teach") === "practice" && (
				<MessagesSquareIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Practice session" />
			)}
		</button>
	);
}

/** The inline-rename row (wave 6): same geometry as SessionRow, but the
 *  title line becomes a text input — select-all on entry (the click means
 *  "replace", the header rename's rule), Enter/blur commits, Esc discards.
 *  The meta line stays so the row never changes height mid-edit. */
export function RenameRow({ chat, onCommit, onCancel }: { chat: ChatListItem; onCommit: (next: string) => void; onCancel: () => void }) {
	const [draft, setDraft] = useState(chat.title);
	const inputRef = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		const el = inputRef.current;
		if (el) {
			el.focus();
			el.select();
		}
	}, []);
	return (
		<div
			data-testid="session-rename-row"
			className="relative mb-0.5 flex w-full items-center rounded-lg bg-accent px-2.5 py-1.5"
		>
			{/* NOTHING MOVES (owner, polish round): an idle row renders no
			    status spacer (SessionStatus is null when not busy), so the
			    title starts at the row's own px-3 — 12px in. The old rename
			    row always carried a 14px spacer + gap + the input's border
			    and padding, landing the text ~41px in (and the meta with
			    it). The input here is borderless and padding-free at the
			    exact title x; the underline is the only editing cue. */}
			<span className="flex min-w-0 w-full flex-col">
				<input
					ref={inputRef}
					value={draft}
					spellCheck={false}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => onCommit(draft)}
					onKeyDown={(e) => {
						if (e.key === "Enter") e.currentTarget.blur();
						if (e.key === "Escape") {
							e.stopPropagation(); // discard, not also the sidebar/chat chains
							onCancel();
						}
					}}
					aria-label="Rename session"
					data-testid="session-rename-input"
					className="lh-input w-full min-w-0 truncate border-0 border-b border-border bg-transparent px-0 text-foreground outline-none"
				/>
				<span className="block truncate text-xs text-muted-foreground">{sessionMeta(chat)}</span>
			</span>
		</div>
	);
}

/** The three-way kind filter (practice sessions, owner 2026-10-04):
 *  All / Learn / Practice — a client-side filter over the same snapshot.
 *  It lives behind the search button and applies only while search is
 *  open, so a forgotten filter can never leave the list silently short. */
export type SessionKindFilter = "teach" | "all" | "practice";

function SessionsSidebar() {
	const { open, drawer, phone, toggle, closeDrawer } = useSidebar();
	const visible = phone ? drawer : open;
	const [chats, setChats] = useState<ChatListItem[] | null>(null);
	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [kindFilter, setKindFilter] = useState<SessionKindFilter>("all");
	const searchBoxRef = useRef<HTMLDivElement>(null);
	const { feed } = useActivity();
	const agentsRunning = useMemo(() => toBlobs(feed).length > 0, [feed]);
	const pathname = usePathname();
	const router = useRouter();
	const { open: openSettings } = useSettingsDialog();

	/* New session (owner, 2026-09-13): NO POST — the button opens the
	   sessionless draft view; the session is created only when the first
	   message is sent (and that message becomes its title). Search: a
	   client-side filter over the poll snapshot — no server round trip. */
	const newSession = useCallback(() => {
		router.push("/chat/new");
	}, [router]);

	/* FUZZY (owner round 8, 2026-10-05): subsequence match ranked by
	 * fuzzyScore — prefix beats word-boundary beats scattered. Empty query
	 * keeps the natural list order (scores are all 0, sort is stable). */
	const shown = useMemo(() => {
		const q = query.trim();
		let list = chats;
		if (list && kindFilter !== "all") {
			list = list.filter((c) => (c.kind ?? "teach") === kindFilter);
		}
		if (!list) return list;
		if (!q) return list;
		return list
			.map((c) => ({ c, score: fuzzyScore(q, c.title) }))
			.filter((r): r is { c: (typeof list)[number]; score: number } => r.score !== null)
			.sort((a, b) => b.score - a.score)
			.map((r) => r.c);
	}, [chats, query, kindFilter]);

	const refreshInFlightRef = useRef(false);
	const refresh = useCallback(async () => {
		// In-flight coalesce (S6): event bursts may land several refresh
		// calls at once — one fetch serves them all; anything newer arrives
		// with the next event's fetch.
		if (refreshInFlightRef.current) return;
		refreshInFlightRef.current = true;
		try {
			const res = await fetch("/api/chats", { cache: "no-store" });
			const d = (await res.json()) as { chats: ChatListItem[] };
			setChats(d.chats);
		} catch {
			// a transient failure keeps the last snapshot
			setChats((prev) => prev ?? []);
		} finally {
			refreshInFlightRef.current = false;
		}
	}, []);

	/* Instant rename propagation (2026-09-17): the chat header's rename
	   commits dispatch lh:chat-renamed; patch the snapshot in place instead
	   of waiting for the 2.5s poll. */
	useEffect(() => {
		const onRenamed = (e: Event) => {
			const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
			setChats((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, title } : c)) : prev));
		};
		window.addEventListener("lh:chat-renamed", onRenamed);
		return () => window.removeEventListener("lh:chat-renamed", onRenamed);
	}, []);

	/* INSTANT TURN-STATE (owner, sidebar round 2026-10-02): the open
	   session broadcasts lh:turn-state the instant its turn starts
	   (submitted — the optimistic machine's own flip) and at settle —
	   busy mirrors the server's own definition (isTurnRunning), so the
	   patch is exact: spinner up the moment the action happens, cleared
	   and refetched once at settle (title/order move with turns). The
	   events channel is the backstop for everything only the server
	   knows: other windows, wake turns in unopened sessions. A start on
	   a chat not yet in the snapshot (a brand-new session) = one
	   immediate refresh instead of a patch. */
	const chatsRef = useRef(chats);
	chatsRef.current = chats;
	useEffect(() => {
		const onTurnState = (e: Event) => {
			const { id, running } = (e as CustomEvent<{ id: string; running: boolean }>).detail;
			if (running) {
				if (chatsRef.current?.some((c) => c.id === id)) {
					setChats((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, busy: true } : c)) : prev));
				} else {
					void refresh(); // the brand-new session: it isn't in the snapshot yet
				}
				return;
			}
			setChats((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, busy: false } : c)) : prev));
			void refresh(); // settle: the server snapshot is now truthful — land it now
		};
		window.addEventListener("lh:turn-state", onTurnState);
		return () => window.removeEventListener("lh:turn-state", onTurnState);
	}, [refresh]);

	/* PUSH (architecture S6, 2026-10-02): the 2.5s poll is RETIRED — the
	   last standing network poll in the app. List truth arrives as
	   events: chats-changed (create/rename/delete — the list-SHAPE
	   writes), and turn-started/turn-settled for EVERY chat (unfiltered:
	   any chat's turn flips busy/order/phase in this list). Announced
	   fetches ride the 250ms trailing debounce (the S4/S5 law); resync
	   (reconnect / dev-restart) is immediate. lh:turn-state +
	   lh:chat-renamed stay for same-tab INSTANTS — local beats any
	   round-trip. */
	const refreshRef = useRef(refresh);
	refreshRef.current = refresh;
	const eventDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const scheduleEventRefresh = () => {
		if (eventDebounceRef.current) clearTimeout(eventDebounceRef.current);
		eventDebounceRef.current = setTimeout(() => {
			eventDebounceRef.current = undefined;
			void refreshRef.current();
		}, 250);
	};
	useServerEvent("chats-changed", scheduleEventRefresh);
	useServerEvent("turn-started", scheduleEventRefresh);
	useServerEvent("turn-settled", scheduleEventRefresh);
	useServerEvent("compaction-changed", scheduleEventRefresh);
	useServerResync(() => void refreshRef.current());
	useEffect(
		() => () => {
			if (eventDebounceRef.current) clearTimeout(eventDebounceRef.current);
		},
		[],
	);

	/* ── Keyboard seams (shortcut wave A, 2026-09-17; search-walk round
	   2026-10-10) ── ⌘⇧F focuses the search field — and THE SEARCH OWNS THE
	   WALK: ↑/↓ cycle the filtered list (wrap — "cycle"), Enter opens the
	   walked row, or the FIRST match when nothing is walked (owner,
	   2026-10-10 — the quick-open pattern: ⌘⇧F, type, Enter, done). The
	   Alt+↑/↓/↵ global cycle was RETIRED the same round: barely used,
	   felt laggy. The selection is a row index into `shown`, so the walk
	   follows whatever the query + kind filter leave. Mouse and keyboard
	   coexist: hovering doesn't claim, a click or an open clears the
	   selection. */
	const [kbdIndex, setKbdIndex] = useState<number | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const closeSearch = useCallback(() => {
		setSearching(false);
		setQuery("");
		setKindFilter("all");
		setKbdIndex(null);
	}, []);
	const listRef = useRef<HTMLDivElement>(null);

	/* ── Wave 6 chunk A: context menu + inline rename + deletion ──
	   Right-click a session row → MenuShell: the two management actions
	   first (owner ruling), then — below a hairline — the extraction
	   coverage block (owner-locked redesign 2026-09-24, order refined
	   2026-09-24: Rename/Delete on top, the numbers + manual Extract
	   affordance at the bottom). The anchor is the row that was
	   right-clicked — assigned into a ref before the state flip so the
	   shell measures it on its first (hidden) pass. */
	const [ctxChatId, setCtxChatId] = useState<string | null>(null);
	const ctxAnchorRef = useRef<HTMLElement | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<ChatListItem | null>(null);

	/* Bulk delete: a Select button, or Ctrl/⌘-click and Shift-click on any
	   row, turns the list into a selection (checkbox rows; a click toggles,
	   Shift extends a range from the last click). The selection bar deletes
	   them all behind one dialog, always keeping graph traces. */
	const [selectMode, setSelectMode] = useState(false);
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [bulkOpen, setBulkOpen] = useState(false);
	const anchorRef = useRef<number | null>(null);
	const exitSelect = useCallback(() => {
		setSelectMode(false);
		setSelected(new Set());
		setBulkOpen(false);
		anchorRef.current = null;
	}, []);
	const selectedChats = useMemo(() => (chats ?? []).filter((c) => selected.has(c.id)), [chats, selected]);
	const allShownSelected = !!shown && shown.length > 0 && shown.every((c) => selected.has(c.id));

	const onRowClick = (e: React.MouseEvent<HTMLButtonElement>, c: ChatListItem, i: number) => {
		const list = shown ?? [];
		if (e.shiftKey && anchorRef.current !== null) {
			const [a, b] = [Math.min(anchorRef.current, i), Math.max(anchorRef.current, i)];
			setSelectMode(true);
			setSelected((prev) => new Set([...prev, ...list.slice(a, b + 1).map((x) => x.id)]));
			return;
		}
		if (selectMode || e.shiftKey || e.ctrlKey || e.metaKey) {
			setSelectMode(true);
			anchorRef.current = i;
			setSelected((prev) => {
				const next = new Set(prev);
				if (next.has(c.id)) next.delete(c.id);
				else next.add(c.id);
				return next;
			});
			return;
		}
		setKbdIndex(null);
		router.push(`/chat/${c.id}`);
	};

	useEffect(() => {
		if (!selectMode || bulkOpen) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || (e.target instanceof HTMLInputElement)) return;
			e.stopPropagation();
			exitSelect();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [selectMode, bulkOpen, exitSelect]);

	const openContext = (e: React.MouseEvent<HTMLButtonElement>, chat: ChatListItem) => {
		e.preventDefault(); // suppress the native menu
		ctxAnchorRef.current = e.currentTarget;
		setCtxChatId(chat.id);
	};

	// The menu contract (ai-section's): any pointerdown outside the menu
	// or its row closes it; Esc is CLAIMED so it never also aborts a turn
	// or folds the sidebar. Right-clicking another row re-anchors: its
	// pointerdown closes this menu, its contextmenu opens the next.
	useEffect(() => {
		if (ctxChatId === null) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (target instanceof Element && target.closest("[data-lh-menu]")) return;
			if (ctxAnchorRef.current?.contains(target)) return;
			setCtxChatId(null);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setCtxChatId(null);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [ctxChatId]);

	// Inline rename (owner ruling, wave 6): the row swaps to a text input;
	// commit rides the SAME plumbing as the header rename — PUT the title,
	// then lh:chat-renamed patches every listener (this sidebar's own
	// listener patches the snapshot instantly; an open chat header hears
	// it too). Esc discards; empty commit discards (the header's rules).
	const commitRename = useCallback(async (id: string, next: string) => {
		setRenamingId(null);
		const t = next.trim();
		if (t === "") return;
		try {
			const res = await fetch(`/api/chats/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: t }),
			});
			if (!res.ok) throw new Error(`rename failed: ${res.status}`);
			window.dispatchEvent(new CustomEvent("lh:chat-renamed", { detail: { id, title: t } }));
		} catch (err) {
			console.error("rename failed:", err); // keep the old title
		}
	}, []);

	// Delete success: patch the list instantly (the poll is the backstop),
	// navigate home if the open session died (the chat view unmounts —
	// drafts die with it, no orphan bubbles), and announce the graph
	// revision so the graph view refetches (deletion is the one writer
	// the status poll can't see — no run ever transitions some→none).
	const onDeleted = useCallback(
		(id: string, _mode: ChatDeleteMode, graphRevision: number) => {
			setDeleting(null);
			setChats((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
			if (pathname === `/chat/${id}`) router.push("/");
			window.dispatchEvent(new CustomEvent("lh:graph-revision", { detail: { revision: graphRevision } }));
		},
		[pathname, router],
	);

	const onBulkDeleted = useCallback(
		(ids: string[], graphRevision: number) => {
			const gone = new Set(ids);
			setChats((prev) => (prev ? prev.filter((c) => !gone.has(c.id)) : prev));
			setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
			if (ids.some((id) => pathname === `/chat/${id}`)) router.push("/");
			window.dispatchEvent(new CustomEvent("lh:graph-revision", { detail: { revision: graphRevision } }));
		},
		[pathname, router],
	);

	useEffect(() => {
		const onFocusSearch = () => {
			if (!visible) toggle();
			// Opening mounts the input with autoFocus; an already-open search
			// needs the explicit focus. A clipped (overflow-hidden) input still
			// focuses, so the slide-in doesn't gate the keystroke.
			setSearching(true);
			requestAnimationFrame(() => searchRef.current?.focus());
		};
		window.addEventListener("lh:kbd-sessions-search", onFocusSearch);
		return () => window.removeEventListener("lh:kbd-sessions-search", onFocusSearch);
	}, [visible, toggle]);

	// The phone drawer closes on navigation and on Esc.
	useEffect(() => {
		closeDrawer();
	}, [pathname, closeDrawer]);
	useEffect(() => {
		if (!drawer) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeDrawer();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [drawer, closeDrawer]);

	// Keep the kbd-selected row in view (the rows are the container's only
	// buttons, so the index matches).
	useEffect(() => {
		if (kbdIndex === null) return;
		listRef.current?.querySelectorAll("button")[kbdIndex]?.scrollIntoView({ block: "nearest" });
	}, [kbdIndex]);

	useEffect(() => {
		if (!visible) return;
		void refresh();
		// Sidebar opening refetch; while open, the events channel owns
		// freshness (S6) — no interval, nothing standing.
	}, [visible, refresh]);

	return (
		<>
			{drawer && <div className="fixed inset-0 z-40 bg-black/50" onClick={closeDrawer} aria-hidden="true" />}
			<aside data-sidebar=""
				className={cn(
					"sidebar-motion shrink-0 overflow-hidden duration-200",
					open ? "w-72" : "w-0",
					// Below md the sidebar floats over the page as a drawer instead of
					// squeezing it. CSS makes the call before hydration, so a phone
					// never paints the open column first.
					"max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 touch-narrow:fixed touch-narrow:inset-y-0 touch-narrow:left-0 touch-narrow:z-50",
					drawer ? "max-md:w-72 max-md:shadow-2xl touch-narrow:w-72 touch-narrow:shadow-2xl" : "max-md:w-0 touch-narrow:w-0",
				)}
				aria-hidden={!visible}
			>
				<div className="flex h-full w-72 flex-col border-r bg-background max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)] touch-narrow:pt-[env(safe-area-inset-top)] touch-narrow:pb-[env(safe-area-inset-bottom)]">
					{/* Merged chrome (2026-09-17): in Electron this band is the
					    window's drag surface and starts after the traffic lights
					    (.lh-lights-gutter); in the browser those classes are inert. */}
					<div className="lh-drag lh-lights-gutter flex items-center justify-between px-4 py-3">
						<Hint label="Home" action="jump-graph" side="right">
							<Link
								href="/"
								aria-label="Home"
								className="lh-no-drag flex size-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
							>
								<LhMark className="size-6" />
							</Link>
						</Hint>
						<Link href="/" tabIndex={-1} className="lh-no-drag mr-auto ml-1.5 text-[15px] font-extrabold tracking-tight">
							Lang<span className="text-sun">Harness</span>
						</Link>
						<Hint label="Close menu" action="toggle-sidebar">
							<Button variant="ghost" size="icon" aria-label="Close menu" onClick={toggle} className="lh-no-drag md:hidden touch-narrow:inline-flex">
								<PanelLeftCloseIcon className="size-4" />
							</Button>
						</Hint>
					</div>

					{/* On a short window the navigation scrolls on its own; the tutor below keeps a reserved height, so the chats are never squeezed or pushed out of sight. */}
					<div className="min-h-0 overflow-y-auto pt-1 [scrollbar-gutter:stable]" data-testid="sidebar-nav-scroll">
					<LanguageSwitcher />
					</div>

					{/* The tutor: two ways to start a chat, then the chats themselves.
					    Search and the kind filter sit behind one button: most days
					    the list is short and the controls are noise. */}
					<section aria-labelledby="sidebar-tutor" className="mx-3 mt-2 flex min-h-[16rem] shrink-0 flex-1 flex-col border-t border-border/50 pt-3">
						<h2 id="sidebar-tutor" className="px-2.5 pb-1 text-xs font-bold text-muted-foreground">
							Tutor
						</h2>
						<button
							type="button"
							data-testid="new-session"
							onClick={() => void newSession()}
							aria-label="Learn a topic: start a new teaching chat"
							className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
						>
							<BotMessageSquareIcon className="size-[18px]" />
							Learn a topic
						</button>
						<button
							type="button"
							data-testid="new-session-practice"
							onClick={() => router.push("/chat/new?mode=practice")}
							aria-label="Practice a topic: start a new practice chat"
							className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
						>
							<MessagesSquareIcon className="size-[18px]" />
							Practice a topic
						</button>

						<div ref={searchBoxRef} className="mt-3 flex flex-col gap-1.5">
							<div className="flex h-8 items-center">
								{searching ? (
									<span className="relative flex-1">
										<Input
											ref={searchRef}
											autoFocus
											data-testid="session-search"
											value={query}
											onChange={(e) => {
												setQuery(e.target.value);
												// The list reorders under the query every keystroke —
												// a stale walk index would point at the wrong row.
												setKbdIndex(null);
											}}
											onBlur={(e) => {
												// Moving to a filter chip or the close button keeps
												// search open; leaving with nothing typed closes it.
												if (e.relatedTarget instanceof Node && searchBoxRef.current?.contains(e.relatedTarget)) return;
												if (!query.trim() && kindFilter === "all") closeSearch();
											}}
											// THE SEARCH OWNS THE WALK (owner, 2026-10-10): ↑/↓ cycle
											// the filtered rows (wrap), Enter opens the walked row —
											// or the FIRST match when nothing is walked (the
											// quick-open pattern) — then blurs. Esc closes search and
											// claims the key so the window Esc chain doesn't fire.
											onKeyDown={(e) => {
												if (e.key === "Escape") {
													e.stopPropagation();
													closeSearch();
													return;
												}
												if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
												const n = shown?.length ?? 0;
												if (n === 0) return;
												if (e.key === "ArrowDown" || e.key === "ArrowUp") {
													e.preventDefault();
													const dir = e.key === "ArrowDown" ? 1 : -1;
													setKbdIndex((i) => (i === null || i >= n ? (dir === 1 ? 0 : n - 1) : (i + dir + n) % n));
													return;
												}
												if (e.key === "Enter") {
													const target = shown![kbdIndex !== null && kbdIndex < n ? kbdIndex : 0];
													if (!target) return;
													e.preventDefault();
													router.push(`/chat/${target.id}`);
													setKbdIndex(null);
													e.currentTarget.blur();
												}
											}}
											placeholder="Search chats"
											aria-label="Search chats"
											className="h-8 rounded-lg border-0 bg-card pl-8 pr-8 text-sm pointer-coarse:text-[16px] shadow-none placeholder:text-muted-foreground"
										/>
										<SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
										<button
											type="button"
											aria-label="Close search"
											data-testid="session-search-close"
											onClick={closeSearch}
											className="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
										>
											<XIcon className="size-3.5" />
										</button>
									</span>
								) : (
									<>
										<span className="px-2.5 text-xs font-bold text-muted-foreground">Your chats</span>
										<Hint label={selectMode ? "Done selecting" : "Select chats to delete"} side="bottom">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												aria-label={selectMode ? "Done selecting" : "Select chats"}
												aria-pressed={selectMode}
												data-testid="session-select-toggle"
												onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
												className={cn("ml-auto rounded-lg text-muted-foreground", selectMode && "bg-accent text-foreground")}
											>
												<ListChecksIcon className="size-3.5" />
												<span className="text-[12px] font-[550]">{selectMode ? "Done" : "Select"}</span>
											</Button>
										</Hint>
										<Hint label="Search chats" action="sessions-search" side="bottom">
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												aria-label="Search chats"
												data-testid="session-search-open"
												onClick={() => setSearching(true)}
												className="rounded-lg text-muted-foreground"
											>
												<SearchIcon className="size-3.5" />
											</Button>
										</Hint>
									</>
								)}
							</div>
							{searching && (
								<div className="flex items-center gap-1" role="group" aria-label="Show" data-testid="session-kind-filter">
									{(["all", "teach", "practice"] as const).map((f) => (
										<button
											key={f}
											type="button"
											data-testid={`kind-filter-${f}`}
											aria-pressed={kindFilter === f}
											onClick={() => {
												setKindFilter(f);
												setKbdIndex(null);
											}}
											className={cn(
												"rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
												kindFilter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
											)}
										>
											{f === "teach" ? "Learn" : f === "all" ? "All" : "Practice"}
										</button>
									))}
								</div>
							)}
							{selectMode && (
								<div className="flex h-8 items-center gap-1 pl-2.5 whitespace-nowrap" data-testid="session-select-bar">
									<span className="mr-1 text-xs font-bold tabular-nums text-foreground" aria-live="polite">
										{selectedChats.length} selected
									</span>
									<Button
										type="button"
										variant="ghost"
										size="xs"
										data-testid="session-select-all"
										onClick={() => setSelected(allShownSelected ? new Set() : new Set((shown ?? []).map((c) => c.id)))}
										className="text-muted-foreground"
									>
										{allShownSelected ? "Clear" : "Select all"}
									</Button>
									<Button type="button" variant="ghost" size="xs" data-testid="session-select-done" onClick={exitSelect} className="ml-auto text-muted-foreground">
										Done
									</Button>
								</div>
							)}
						</div>

						<div ref={listRef} className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
							{shown === null ? (
								<div aria-busy="true" aria-label="Loading chats" className="flex flex-col">
									{[0, 1, 2].map((i) => (
										<div key={i} className="flex flex-col gap-1.5 px-2.5 py-2">
											<div className="h-3.5 w-3/4 animate-pulse rounded bg-accent" />
											<div className="h-2.5 w-1/4 animate-pulse rounded bg-accent/60" />
										</div>
									))}
								</div>
							) : shown.length === 0 ? (
								<p className="px-2.5 py-2 text-xs text-muted-foreground">
									{query.trim()
										? `No chats match “${query.trim()}”.`
										: kindFilter !== "all"
											? `No ${kindFilter === "teach" ? "learning" : "practice"} chats yet.`
											: "Your chats with the tutor show up here."}
								</p>
							) : (
								shown.map((c, i) =>
									renamingId === c.id ? (
										<RenameRow
											key={c.id}
											chat={c}
											onCommit={(next) => void commitRename(c.id, next)}
											onCancel={() => setRenamingId(null)}
										/>
									) : (
										<SessionRow
											key={c.id}
											chat={c}
											active={pathname === `/chat/${c.id}`}
											kbdSelected={i === kbdIndex}
											selectMode={selectMode}
											selected={selected.has(c.id)}
											onOpen={(e) => onRowClick(e, c, i)}
											onContextMenu={(e) => openContext(e, c)}
										/>
									),
								)
							)}
						</div>
						{selectMode && (
							<div className="pt-3 pb-4">
								<Button
									type="button"
									variant="destructive-soft"
									data-testid="session-select-delete"
									onClick={() => setBulkOpen(true)}
									disabled={selectedChats.length === 0}
									className="w-full rounded-lg font-semibold"
								>
									<Trash2Icon />
									{selectedChats.length === 0 ? "Select chats to delete" : `Delete ${selectedChats.length} ${selectedChats.length === 1 ? "chat" : "chats"}`}
								</Button>
							</div>
						)}
					</section>

					{/* Background agents appear only while one runs: an idle header
					    told the learner nothing and read as machinery. */}
					{agentsRunning && <ActivitySection />}

					<div className="border-t border-border/50 px-3 py-2">
						<Hint label="Settings" action="open-settings" side="right">
							<button
								type="button"
								onClick={() => openSettings()}
								data-testid="settings-entry"
								className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
							>
								<SettingsIcon className="size-[18px]" />
								Settings
							</button>
						</Hint>
					</div>
				</div>

				{/* The context menu (wave 6 + the extraction-UX redesign): the
				    coverage block above, then exactly two management actions
				    (owner ruling — no more). MenuShell owns placement/focus/arrow
				    cycling; the dismissal effect above owns the contract. */}
				{ctxChatId !== null && (
					<MenuShell
						anchorRef={ctxAnchorRef}
						testid="session-context-menu"
						preferredSide="down"
						menuClass="flex w-52 flex-col gap-0.5 rounded-xl border bg-card p-2 text-xs shadow-xl"
					>
						{/* The two management actions first, then the extraction block
						    (owner refinement round, 2026-09-24): Rename/Delete stay at the
						    top, the coverage numbers + Extract affordance sit below the
						    hairline — the block is info + a stateful affordance, the
						    actions above it. Fetched on menu open (the block mounts WITH
						    the menu); 409 = benign. Renders nothing on a failed read. */}
						<button
							type="button"
							data-testid="ctx-rename"
							onClick={() => {
								setRenamingId(ctxChatId);
								setCtxChatId(null);
							}}
							className="flex items-center rounded-lg px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-accent"
						>
							Rename
						</button>
						{/* Export as Markdown (owner, release polish 2026-10-06): the
					    session-markdown engine's user-facing debut — same-origin
						    anchor download; the route's Content-Disposition names the
						    file. Sits with the management actions, above Delete (the
						    destructive action stays last — the danger-fence law). */}
						<button
							type="button"
							data-testid="ctx-export-md"
							onClick={() => {
								const chatId = ctxChatId;
								setCtxChatId(null);
								const a = document.createElement("a");
								a.href = `/api/chats/${chatId}/markdown`;
								a.download = ""; // the route's filename wins
								document.body.appendChild(a);
								a.click();
								a.remove();
							}}
							className="flex items-center rounded-lg px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-accent"
						>
							Save as text file…
						</button>
						<button
							type="button"
							data-testid="ctx-delete"
							onClick={() => {
								const target = chats?.find((c) => c.id === ctxChatId);
								if (target) setDeleting(target);
								setCtxChatId(null);
							}}
							className="flex items-center rounded-lg px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-miss-soft hover:text-miss"
						>
							Delete…
						</button>
						<div className="my-0.5 border-t border-border/60" aria-hidden="true" />
						<CoverageMenuBlock chatId={ctxChatId} />
					</MenuShell>
				)}

				{/* The two-option delete dialog (wave 6) — portaled to body
				    by the component itself, lives here for state locality. */}
				<DeleteSessionDialog
					chat={deleting}
					onClose={() => setDeleting(null)}
					onDeleted={onDeleted}
				/>
				<DeleteSessionsDialog
					open={bulkOpen}
					chats={selectedChats}
					onClose={() => setBulkOpen(false)}
					onDeleted={onBulkDeleted}
				/>
			</aside>
		</>
	);
}

/** The app frame: sidebar inline + content. Rendered once in the root layout. */
export function AppShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	useEffect(() => {
		stopSpeaking();
	}, [pathname]);

	// The pairing screen (E21) is for a device with no session yet: no sidebar, no data behind it.
	if (pathname === "/pair") return <>{children}</>;

	return (
		<SettingsDialogProvider>
			<JumpProvider>
			<SessionsSidebar />
			{/* The frame is one viewport tall; the content scrolls inside it so
			    the sidebar stays put. */}
			<main className="min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
				{/* The SCROLL-PROOF window-drag strip (owner bug report,
				    2026-10-28: "scrolled down, I can't grab the window"). The
				    per-page strips are absolute inside the scrolling content,
				    so they ride off-screen with it and a scrolled page has no
				    grab point left. This one is sticky inside the scroll frame —
				    glued to the top of the visible area at every scroll depth.
				    FIRST child so later lh-no-drag elements still subtract (the
				    DOM-order mask law), INSIDE main so it never spans the
				    sidebar, and -mb-13 pulls the page up over it so nothing
				    moves. The per-page strips stay for the surfaces they were
				    tuned for; this is the floor every page stands on. */}
				<div className="lh-drag sticky top-0 -mb-13 h-13" aria-hidden="true" />
				{children}
			</main>
			<SelectionWordBankBar />
			{/* The single document-level keydown listener (keyboard wave A) —
			    after the content in the tree, but it's window-level so order only
			    matters for the events it dispatches, never for DOM priority. */}
			<KeyboardShortcuts />
			</JumpProvider>
		</SettingsDialogProvider>
	);
}
