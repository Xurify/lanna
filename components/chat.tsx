"use client";

import { createContext, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useChatSession } from "@/components/session";
import { visibleQueuedSteers } from "@/components/session-core";
import { SetupDialog } from "@/components/setup-dialog";
import { Hint } from "@/components/ui/hint";
import { buttonVariants } from "@/components/ui/button";
import { useZeroKeys, ZeroKeysPill } from "@/components/setup-cta";
import { useStickToBottomContext, type StickToBottomContext } from "use-stick-to-bottom";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { DiacriticBar } from "@/components/diacritic-bar";
import { ChatAttachMenu } from "@/components/chat-attach-menu";
import { DraftPdfChips } from "@/components/chat-pdf-button";
import { DraftImageChips, uploadLearnerImage } from "@/components/chat-image-button";
import { joinDraft, splitDraft } from "@/src/core";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { BrailleSpinner } from "@/components/braille-spinner";
import { LiveToolCard } from "@/components/artifacts/live-tool-card";
import { ChatReplies } from "@/components/chat-replies";
import { CHAT_RECORD_TOOLS, learnerLines, messageText, questionOpen, repeatsEarlierText } from "@/src/core";
import { HeldLine, LearnerLineView, TutorWriting } from "@/components/chat-voice";
import { chatMdComponents } from "@/components/chat-link";
import { SketchFigure } from "@/components/sketch-figure";
import { ChatBoard, useDrill } from "@/components/chat-board";
import { ChatExportMenu } from "@/components/chat-export";
import { Separator } from "@/components/ui/separator";
import { artifactRenderers } from "@/components/artifacts";
import { Composer } from "@/components/composer";
import { useEnterSubmits } from "@/components/enter-submits";
import { blurAfterPointerClick } from "@/components/focus-hygiene";
import { dockStateKey } from "@/components/dock-state-key";
import { QueuedSteersBody, type QueuedSteerLine } from "@/components/queued-steers";
import { DictationBar, joinDictation, useDictation } from "@/components/dictation";
import { useFieldCycle } from "@/components/field-cycle";
import { StatsBar } from "@/components/stats-bar";
import { useServerEvent, useServerResync } from "@/components/server-events";
import {
	isProviderKeyRefusal,
	kbdEventForAction as kbdEventForChat,
	type LannaMessage,
	type ModelSlotName,
} from "@/src/core";
import { MermaidOverlay, SessionMermaidContext } from "@/components/session-overlay";
import { AbortTurnDialog, type AbortMode } from "@/components/abort-turn-dialog";
import { ArrowRightIcon, CogIcon, DumbbellIcon } from "lucide-react";
import { SessionFind } from "@/components/session-find";
import { PracticeDock } from "@/components/practice-dock";
import { ThinkingCard, type PracticeThinkingData } from "@/components/practice-cards";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/utils";
import { setShowWorking, useShowWorking, WORKING_TOOLS } from "@/components/show-working";
import type { ArtifactPartProps, TurnUsage, SessionPricing } from "@/src/core";
import type { LannaViewMessage } from "@/src/core";
import {
	CompactionCutDivider,
	CompactionMomentDivider,
	type CompactionDividerData,
} from "@/components/compaction-divider";
import { activeProblemOf } from "@/src/core";
import { currentUserThinkingOpen, setAllUserThinkingOpen } from "@/components/thinking-block";
import { slotsConfigured, type ModelsSettings } from "@/src/core";
import { useSettingsSaved } from "@/components/settings-signal";

/** One width for everything: transcript, cards, and the bottom blob share this column. */
/**
 * Width tokens (wave-5 reskin, owner decision): the transcript PROSE spans the
 * full session width with a thin px-6 margin; the composer/practice DOCK is
 * deliberately narrower (~46rem centered) per the reference. Same ELEMENT,
 * same place — width polish only.
 */
const COLUMN = "mx-auto w-full max-w-none px-6";
const DOCK = "mx-auto w-full max-w-[46rem] px-4";
// The dock overlay's gradient band (h-24) — part of the reserved tail.
const GRADIENT_H = 96;
// Fold thresholds (owner, scroll round 1, tuned round 3): pixel distance
// from the bottom — position, not velocity. Leave the bottom → the box
// folds (visual only); reach it again → it re-opens. 96 (was 64, owner
// round 3) tolerates a small peek upward without folding; the dead band
// vs EXPAND_DIST absorbs trackpad drift.
const COLLAPSE_DIST = 96;
const EXPAND_DIST = 16;

/**
 * Server-sync channel for artifact renderers: the CENTRAL jobs poll in Chat
 * calls syncFromServer() when a background job settles — the wake turn's
 * steer + response are already persisted by then, so fresh messages replace
 * local state in one pull.
 * (contracts.ts "THE ASYNC PROTOCOL" §4.)
 */
export const ChatActionsContext = createContext<{
	chatId: string;
	syncFromServer: () => Promise<void>;
	/** Opens the model setup dialog (BYOK, 2026-09-22): refused job cards
	 *  deep-link into the same SetupDialog the send interception uses. */
	openSetup: () => void;
} | null>(null);

/** The BYOK refusal envelope from the transport's error text: the
 *  DefaultChatTransport throws the 503 body VERBATIM as the error message,
 *  so the machine-readable {code, missing} shape survives to here. Real
 *  errors (any other text) read as null and keep the honest banner.
 *  Exported pure for tests. */
export function parseModelsRefusal(message: string | undefined): ModelSlotName[] | null {
	if (!message) return null;
	try {
		const body = JSON.parse(message) as { code?: unknown; missing?: unknown };
		if (
			body.code === "models_not_configured" &&
			Array.isArray(body.missing) &&
			body.missing.every((s) => typeof s === "string")
		) {
			return body.missing as ModelSlotName[];
		}
		return null;
	} catch {
		return null;
	}
}

/** The provider-key refusal's transport seam (zero-keys wave, Platform's
 *  66dbea9): same discipline as parseModelsRefusal — the 503 body rides
 *  the thrown error message verbatim, so the envelope's own matcher
 *  (core, invariant-tail) decides; the wording can never drift client-
 *  side. Exported pure for tests. */
export function parseProviderKeyRefusal(message: string | undefined): boolean {
	if (!message) return false;
	try {
		const body = JSON.parse(message) as { code?: unknown; error?: unknown };
		return body.code === "provider_key_missing" && typeof body.error === "string" && isProviderKeyRefusal(body.error);
	} catch {
		return false;
	}
}

/** useLayoutEffect that is silent during SSR (client components still render on the server in Next). */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A wake-pipeline steer message: user-role delivery whose metadata marks it
 * as a sub-agent result — rendered as an artifact card, never a bubble. */
/** The quiet system line (custom-message scheme rendering): centered, muted,
 *  small — the transcript's voice for events that are not speech (wake
 *  scaffolding). */
function SystemLine({ children, testId }: { children: React.ReactNode; testId?: string }) {
	return (
		<div data-testid={testId} className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
			{children}
		</div>
	);
}

function lastReplyText(messages: readonly LannaViewMessage[]): string {
	const last = messages.at(-1);
	if (!last || last.role !== "assistant") return "";
	return last.parts
		.flatMap((part, i) => (part.type === "text" && !repeatsEarlierText(last.parts, i) ? [part.text] : []))
		.join("\n\n");
}

/**
 * The chat and practice session. All chat state lives in useChatSession; the
 * server persists the canonical transcript after every turn.
 *
 * The bottom blob is ONE persistent shell whose contents swap (chat composer ↔
 * practice dock ↔ collapsed bar). The shell is sticky INSIDE the scroller —
 * never overlapping the transcript at rest, never covering the scrollbar —
 * and DockOverlay animates its height on variant changes.
 */
export function Chat({
	chatId,
	title,
	initialMessages,
	initialError,
	initialPrompt,
	initiallyInFlight,
	initiallyCompacting = false,
	initialConfigured = false,
	kind = "chat",
}: {
	chatId: string;
	title: string;
	initialMessages: LannaMessage[];
	/** Memory-only settlement notice supplied on reopening. */
	initialError?: string;
	/** The session kind: a practice session carries a Practice tag in the
	 *  header; a chat session is the plain Ask chat. */
	kind?: "practice" | "chat";
	initialPrompt?: string;
	/** A turn is running server-side but attached to no client
	 * (navigated away mid-turn, returned while in flight). */
	initiallyInFlight?: boolean;
	/** A compaction holds the chat's model gate at mount (navigated away
	 * mid-compaction — the registry is live server state, the
	 * compaction-changed event already fired). The transcript spinner
	 * and send gates key on it. */
	initiallyCompacting?: boolean;
	/** slotsConfigured(server record) — the persistent setup CTA keys on
	 *  it (BYOK, owner 2026-09-22). The server gate stays the truth; this
	 *  only decides whether the pill rides the composer. */
	initialConfigured?: boolean;
}) {
	// Reattach plumbing (background-turn runner wave): the hook holds the
	// settled terminal's callback — a stable ref assigned below, once
	// syncFromServer exists (refs, not closures: no stale capture).
	const reattachSettledRef = useRef<() => void>(() => {});

	// THE SESSION HOOK (Wave D, owner-approved 2026-09-26): the app-owned
	// replacement for useChat + the AI-SDK transport. The record is native
	// history; the VIEW (grouped, golden-master) is derived client-side
	// (core/view.ts projectView); sends are ONE explicit input event each
	// ({chatId, input} — the stash indirection died with the SDK), and the
	// turn stream is the VERBATIM AgentEvent passthrough the server emits.
	const {
		messages,
		nativeMessages,
		contextTokens,
		send,
		continueIfOwed,
		steer,
		steerQueue,
		dismissProblem,
		setMessages,
		adoptRecord,
		status,
		error,
		stop,
		clearError,
		resumeStream,
		setReattachSettled,
	} = useChatSession({ chatId, initialMessages, initialError, initiallyInFlight });

	const sessionFindScopeRef = useRef<HTMLDivElement | null>(null);
	const scrollContextRef = useRef<StickToBottomContext | null>(null);

	// The reattach settled terminal → the sync-and-continue seam (below).
	setReattachSettled(() => reattachSettledRef.current());

	// New chat with a topic: send the first message exactly once
	// (initialPromptOwed — the pure gate, pinned in the test suite).
	const sentInitial = useRef(false);
	useEffect(() => {
		if (!sentInitial.current && initialPromptOwed(initialMessages, initialPrompt)) {
			sentInitial.current = true;
			void send({ type: "text", text: initialPrompt! });
		}
	}, [initialPrompt, initialMessages, send]);

	// A turn running server-side, attached to no live view of ours (navigate
	// away mid-turn, or a wake turn discovered mid-session): the reattach
	// stream is the primary channel (resumeStream — the same rendering path
	// as a live turn); this flag is the FALLBACK liveness source — it gates
	// the composer, shows the pre-first-chunk shimmer, and drives the 1500ms
	// record poll that adopts at settle if the stream can't attach.
	const [turnInFlight, setTurnInFlight] = useState(initiallyInFlight ?? false);

	// Session title: click-to-rename (owner, 2026-09-17). Clicking the header
	// title opens edit mode with everything selected — typing replaces, arrows
	// move inside. Enter or a click away commits (PUT /api/chats/:id); Escape
	// discards. The server never bumps updatedAt on a rename (sidebar order
	// must not churn), and the sidebar patch is instant via the window event —
	// its 2.5s poll is only a backstop.
	const [titleText, setTitleText] = useState(title);
	const [renaming, setRenaming] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const titleInputRef = useRef<HTMLInputElement | null>(null);

	const commitRename = useCallback(
		async (next: string) => {
			setRenaming(false);
			const t = next.trim();
			if (t === "" || t === titleText) return; // empty commit = discard
			try {
				const res = await fetch(`/api/chats/${chatId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: t }),
				});
				if (!res.ok) throw new Error(`rename failed: ${res.status}`);
				setTitleText(t);
				window.dispatchEvent(new CustomEvent("lanna:chat-renamed", { detail: { id: chatId, title: t } }));
			} catch (err) {
				console.error("rename failed:", err); // keep the old title
			}
		},
		[chatId, titleText],
	);

	// Select-all when edit mode opens: the click means "replace", so the
	// whole title highlights on entry (owner ask, 2026-09-17).
	useEffect(() => {
		if (renaming) {
			const el = titleInputRef.current;
			if (el) {
				el.focus();
				el.select();
			}
		}
	}, [renaming]);

	// ── Keyboard seams (shortcut wave A, 2026-09-17) ──
	// F2 opens the title rename (the chat header owns the editing state).
	useEffect(() => {
		const onRename = () => {
			setTitleDraft(titleText);
			setRenaming(true);
		};
		window.addEventListener("lanna:kbd-rename-session", onRename);
		return () => window.removeEventListener("lanna:kbd-rename-session", onRename);
	}, [titleText]);

	// The OTHER rename surface (wave 6: the sidebar's inline rename): its
	// commit dispatches the same lanna:chat-renamed event this header's rename
	// does — if it renamed THIS chat, patch the header title in place (the
	// event is the single source of truth; the header is one more listener).
	useEffect(() => {
		const onRenamed = (e: Event) => {
			const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
			if (id === chatId) setTitleText((prev) => (title !== prev ? title : prev));
		};
		window.addEventListener("lanna:chat-renamed", onRenamed);
		return () => window.removeEventListener("lanna:chat-renamed", onRenamed);
	}, [chatId]);

	// A chat turn ends right after its record calls, so a steer would wait for the next run; the chat
	// holds what the learner sends during a turn and sends it the moment the turn is over.
	const applyTextRef = useRef<(v: string) => void>(() => {});
	const heldAnswerRef = useRef<string | null>(null);
	const [heldAnswer, setHeldAnswer] = useState<string | null>(null);

	// The Esc chain's last link: abort the turn. The background runner
	// decoupled turns from views, so the abort is ALWAYS the remote kill
	// (POST /api/activity/abort — any in-flight turn dies server-side, our
	// view renders the aborted-partial close when the finish arrives). A
	// LOCAL view also detaches first — stop() settles the client instantly
	// and keeps the partial; the server-side partial persists via the
	// abort's own onFinish. Inert when nothing runs (busyRef gate).
	const abortInFlightTurn = useCallback(() => {
		if (heldAnswerRef.current !== null) {
			applyTextRef.current(heldAnswerRef.current);
			heldAnswerRef.current = null;
			setHeldAnswer(null);
		}
		if (localStreamRef.current) stop();
		void fetch("/api/activity/abort", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kind: "turn", id: chatId }),
		}).catch(() => {
			/* transient — the turn settles on its own; the record poll adopts */
		});
		// 409 not_running is the benign raced-settle: the stream's finish
		// already settled the view (or the poll fallback adopts) — nothing owed.
	}, [chatId, stop]);
	// ESC-abort guard (owner, 2026-10-02): the abort chain opens a confirm
	// popup. Both window listeners fire per Esc, so the state gate here — not
	// stopPropagation ordering — is what keeps the popup's own Esc from chaining.
	// LAYERED ESC (owner, 2026-10-04): an open overlay CLAIMS Esc — closing
	// itself — before the abort chain may open its confirm. A mermaid focus or
	// the setup dialog must not dismiss a practice problem underneath.
	const [abortAsk, setAbortAsk] = useState<AbortMode | null>(null);
	const abortAskRef = useRef<AbortMode | null>(null);
	abortAskRef.current = abortAsk;
	useEffect(() => {
		const onAbort = () => {
			const target = escAbortTarget({
				abortAsk: abortAskRef.current !== null,
				mermaidFocus: mermaidFocusRef.current !== null || figureFocusRef.current !== null,
				setupOpen: setupOpenRef.current,
				problem: activeProblemRef.current !== null,
				busy: busyRef.current,
			});
			if (target === "problem") setAbortAsk("problem");
			else if (target === "turn") setAbortAsk("turn");
			else if (target === "mermaid") setMermaidFocus(null);
			// setup closes itself; null = nothing to do — both claimed.
		};
		window.addEventListener("lanna:kbd-abort-turn", onAbort);
		return () => window.removeEventListener("lanna:kbd-abort-turn", onAbort);
	}, []);
	const confirmAbort = useCallback(
		(mode: AbortMode) => {
			setAbortAsk(null);
			if (mode === "turn") {
				abortInFlightTurn();
				return;
			}
			// The practice discard (owner, 2026-10-04): ask-style — the
			// silent marker route; the conclude synthesis rides the user's
			// next input. The composer returns immediately. Mid-turn the
			// discard also kills the running turn (same park + settle law).
			const problem = activeProblemRef.current;
			if (problem) {
				void dismissProblem(problem.toolCallId);
				if (busyRef.current) abortInFlightTurn();
			}
		},
		[abortInFlightTurn, dismissProblem],
	);
	// Mount continuation: if the stored transcript ends with a fulfilled tool
	// (a job result landed while no client was open), resume the lesson — the
	// SDK's sendAutomaticallyWhen only fires inside addToolOutput, so reloads
	// need this nudge. Once per mount; the turn that follows ends in text (or
	// an open practice problem), so no loop. NEVER while a turn is already running
	// server-side — that would double-run the turn (the server would 409
	// it; the poll below resumes instead).
	const mountContinuation = useRef(false);
	useEffect(() => {
		if (mountContinuation.current) return;
		mountContinuation.current = true;
		if (!turnInFlight) continueIfOwed(initialMessages);
		// mount-only by design (turnInFlight read at initial value)
	}, []);

	// THE ACTIVE PRACTICE PROBLEM (practice sessions, 2026-10-04): the
	// dock-ownership rule — an active problem replaces the composer. Computed from the NATIVE record (the fold is
	// the gate the tools themselves read), not the projected view.
	const activeProblem = activeProblemOf(nativeMessages);
	const activeProblemRef = useRef(activeProblem);
	activeProblemRef.current = activeProblem;

	const localStream = status === "submitted" || status === "streaming";
	const busy = localStream || turnInFlight;
	const busyRef = useRef(busy);
	busyRef.current = busy;

	// The attach handoff (stream-reattach wave): the moment a resumed
	// stream takes over the rendering — the SDK left "ready", so
	// submitted/streaming means chunks are flowing — localStream covers
	// busy/shimmer/gates on its own. Keeping turnInFlight set would only
	// double-render the shimmer and keep the 1500ms fallback poll fighting
	// the live stream it was a fallback FOR.
	useEffect(() => {
		if (turnInFlight && (status === "submitted" || status === "streaming")) setTurnInFlight(false);
	}, [status, turnInFlight]);

	// Mid-session discovery (jobs poll, handoff watch): a server-side turn
	// exists that none of our views holds — attach to it through the same
	// resume path as mount reattach (live rendering, instant catch-up). The
	// flag stays as the fallback until the stream attaches (watcher above);
	// concurrent resume calls are SDK-guarded (a newer one aborts the older
	// request), so discovery ticks re-firing this are harmless.
	const turnInFlightRef = useRef(turnInFlight);
	turnInFlightRef.current = turnInFlight;
	const attachToRunningTurn = useCallback(() => {
		setTurnInFlight(true);
		void resumeStream();
	}, [resumeStream]);

	// The practice dock's send (ONE lane, owner 2026-10-05): POSTs the
	// thinking against the ACTIVE problem — whether it claims an answer is
	// read from the text by the agent, not declared here. Starts a turn;
	// the dock stays mounted (the problem is still active until the agent
	// concludes).
	const submitThinking = useCallback(
		(text: string) => {
			const problem = activeProblemRef.current;
			if (!problem) return;
			void send({ type: "thinking", problemCallId: problem.toolCallId, text });
		},
		[send],
	);

	// ⌘T (toggle-user-thinking, owner round 2026-10-07): set EVERY user
	// thinking row to one state — transcript rows default open, so the
	// first press collapses everything, the second re-expands.
	useEffect(() => {
		const onToggle = () => setAllUserThinkingOpen(!currentUserThinkingOpen());
		window.addEventListener(kbdEventForChat("toggle-user-thinking"), onToggle);
		return () => window.removeEventListener(kbdEventForChat("toggle-user-thinking"), onToggle);
	}, []);
	const lines = useMemo(() => (kind === "chat" ? learnerLines(messages) : null), [kind, messages]);
	const currentLine = useMemo(() => (lines ? Math.max(-1, ...lines.keys()) : -1), [lines]);
	const [pageTitle, setPageTitle] = useState<HTMLHeadingElement | null>(null);
	const [pageTitleInView, setPageTitleInView] = useState(false);
	useEffect(() => {
		if (!pageTitle) {
			setPageTitleInView(false);
			return;
		}
		const observer = new IntersectionObserver(([entry]) => setPageTitleInView(entry?.isIntersecting ?? false));
		observer.observe(pageTitle);
		return () => observer.disconnect();
	}, [pageTitle]);

	const [text, setText] = useState("");
	const draftParts = splitDraft(text);
	/* The composer's value MIRROR ("nothing gets lost" round, owner
	 * 2026-10-01): a dictation flush lands via setState, which a closure
	 * waiting through `await finish()` cannot observe in time. Kept
	 * current at every write site via applyText. */
	const textRef = useRef("");
	const applyText = useCallback((v: string) => {
		textRef.current = v;
		setText(v);
	}, []);
	applyTextRef.current = applyText;
	// The BYOK setup flow (owner, 2026-09-22): the persistent CTA and the
	// refusal interception share one SetupDialog mount. `configured` is
	// seeded server-side (slotsConfigured on the record) and flips on Save.
	const [configured, setConfigured] = useState(initialConfigured);
	// The zero-keys truth (zero-keys wave): no provider key = the pill
	// takes precedence over the models CTA (keys come first in the chain).
	// Reads once on mount, re-reads on the "keys" signal.
	const zeroKeys = useZeroKeys();
	// Cross-surface freshness (fix wave): another surface's models write —
	// setup save, composer pick, a settings write — re-reads the record so
	// the setup CTA appears/disappears live (it used to lag until reload).
	useSettingsSaved((section) => {
		if (section !== "models") return;
		fetch("/api/settings")
			.then((r) => r.json() as Promise<{ settings?: { models?: ModelsSettings } | null } | null>)
			.then((body) => setConfigured(slotsConfigured(body?.settings?.models)))
			.catch(() => {});
	});
	const [setupOpen, setSetupOpen] = useState(false);
	/** The last explicitly-sent draft (composer send): the
	 *  refusal flow restores it into the composer, where it waits for the
	 *  learner to re-send (Save never auto-sends, owner 2026-10-09).
	 *  Auto-continuations never set it — their refusal
	 *  opens the dialog with no replay. */
	const draftRef = useRef<string | null>(null);

	// THE BYOK REFUSAL (owner, 2026-09-22): a send that lands the server's
	// 503 models_not_configured envelope renders as the SETUP FLOW, never
	// the error banner. The gate refuses BEFORE the write-ahead persist,
	// so the server record is the truth minus the refused send — the
	// optimistic message is an orphan that goes HOME: refetch the record,
	// drop the orphan, put the draft back in the composer, open the
	// dialog (the prefilled tiers carry their picks, the unpinned ones the
	// "needed" marks). The draft stays in the composer until the learner
	// re-sends it (owner ruling 2026-10-09).
	useEffect(() => {
		if (!error) return;
		const missing = parseModelsRefusal(error.message);
		// The key-refusal twin (zero-keys wave): a pinned model whose
		// provider key is gone gets the SAME treatment — revert-draft and
		// open setup (the dialog derives to its first-key stage on its own).
		const keyRefused = parseProviderKeyRefusal(error.message);
		if (!missing && !keyRefused) return; // a real error keeps the honest banner
		// ORDER MATTERS: clearError() flips this effect's own dep (`error`)
		// and would cancel the in-flight work below — so the banner dismiss,
		// the draft restore, and the dialog open all land TOGETHER after the
		// record refetch (the honest truth minus the refused send).
		let cancelled = false;
		void (async () => {
			const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
			if (!cancelled && res.ok) {
				const record = (await res.json().catch(() => null)) as { messages?: LannaMessage[] } | null;
				if (Array.isArray(record?.messages)) setMessages(record.messages);
			}
			if (cancelled) return;
			if (draftRef.current !== null) {
				applyText(draftRef.current);
				draftRef.current = null;
			}
			clearError();
			setSetupOpen(true);
		})();
		return () => {
			cancelled = true;
		};
		// (setMessages/clearError are stable per useChat instance — the
		//  dep pair [error, chatId] is what the flow actually keys on.)
	}, [error, chatId]);
	// Voice dictation (STT wave, 2026-09-17): finals append at the end of
	// the current text (the page owns the separator, dictate-flush style);
	// interims ghost in the stats bar's middle slot next to the meter.
	// TAB CYCLES THE CHAT'S FIELDS (owner, keyboard round 2026-10-06):
	// the active dock's field → the composer, in visual order,
	// forward-only with wrap; Tab from anywhere else focuses the first
	// live field (navigate IN). Gathered from live DOM at event time — the
	// docks mount and unmount, refs would go stale.
	const cycleChatFields = useCallback((): readonly HTMLElement[] => {
		const pick = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
		return [...pick('[data-testid="practice-dock"] textarea'), ...pick('[data-testid="composer"] textarea')];
	}, []);
	useFieldCycle(cycleChatFields);
	const dictation = useDictation({
		// Ref-first (see textRef): the join is computed from the mirror so a
		// send resuming after `await finish()` reads the dictated tail.
		append: (t) => applyText(joinDictation(textRef.current, t)),
	});
	/* When a dictation run ends, the bare composer takes focus (owner
	 * 2026-10-01) — the hands are already on the keyboard from the stop.
	 * Falling edge of `active` only (idle→idle never focuses), and ONLY the
	 * composer: with a practice problem owning the dock the Composer is
	 * unmounted and the ref is null. */
	const dictationWasActiveRef = useRef(false);
	const composerInputRef = useRef<HTMLTextAreaElement>(null);
	useEffect(() => {
		if (dictation.active) {
			dictationWasActiveRef.current = true;
		} else if (dictationWasActiveRef.current) {
			dictationWasActiveRef.current = false;
			composerInputRef.current?.focus();
		}
	}, [dictation.active]);

	// Jobs never gate the composer (contracts.ts "THE ASYNC PROTOCOL" §4): job
	// tools resolve with an ack mid-turn, so the learner can interject while
	// sub-agents run — a feature, not a race: the wake pipeline queues steers
	// until the current turn ends.
	// A LIVE dictation also makes the composer sendable (owner 2026-10-01):
	// the spoken text is deferred in the run's buffer — Enter must be able
	// to trigger the finish-first send (see onSend), not be gated out by an
	// empty textarea. If nothing was said, the send is a harmless no-op.
	// Steering (2026-10-03): a turn in flight no longer gates the composer —
	// Enter while a turn runs STEERS it (the quiet queue above the composer).
	// Compaction (owner round 14): the RUNNING state — compaction-changed
	// flips it; the send paths, canSend, and the docks gate on it (the
	// server's registry mutex is the structural gate; this is the
	// affordance).
	const [compacting, setCompacting] = useState(initiallyCompacting);
	const canSend = (text.trim().length > 0 || dictation.active) && !activeProblem && !compacting;

	/* THE PRACTICE PAUSE (owner round 16): between problems — practice
	 * kind, nothing active, nothing in flight, and at least one problem
	 * has ever been posed (the fresh session's opening turn is owed, not
	 * the move-on). Enter-on-empty and the Next chip both key on it. */
	const nextReady =
		kind === "practice" &&
		!activeProblem &&
		!compacting &&
		!busy &&
		nativeMessages.some(
			(m) =>
				(m as { role?: string }).role === "assistant" &&
				Array.isArray((m as { content?: unknown[] }).content) &&
				(m as { content: Array<{ type?: string; name?: string }> }).content.some(
					(b) => b.type === "toolCall" && b.name === "problem",
				),
		);
	const sendNext = useCallback(() => {
		if (!nextReady) return;
		void send({ type: "next" });
	}, [nextReady, send]);

	/* ENTER FROM ANYWHERE (owner round 16 refinement, 2026-10-06 —
	 * keyboard-first): the move-on must not require composer focus. The
	 * window-level Enter (typing surfaces and buttons excluded — a
	 * focused composer/button keeps its own lane, so no double fire)
	 * fires the signal from body focus, a scroll, anywhere. sendNext
	 * self-guards on nextReady, so the listener is inert outside the
	 * pause — the dock-mounted listeners are gone by then (docks unmount
	 * when nothing is active; the two never overlap). */
	useEnterSubmits(sendNext);

	const syncFromServer = useCallback(async () => {
		const res = await fetch(`/api/chats/${chatId}`);
		if (!res.ok) return;
		const record = (await res.json()) as {
			messages?: LannaMessage[];
			turns?: TurnUsage[];
			pricing?: SessionPricing;
			turnError?: string;
		};
		if (Array.isArray(record.turns)) setTurns(record.turns);
		setPricing(record.pricing);
		if (!Array.isArray(record.messages)) return;
		setMessages(record.messages, record.turnError);
		// The continuation seam (contracts.ts protocol §4): a job result
		// landing in the record leaves the agent owing a continuation — the
		// record ENDS on un-consumed results, and nothing runs. The native fold (needsContinuation) is the old SDK
		// lastAssistantMessageIsCompleteWithToolCalls check.
		// Current model truth also guards retained/live failures: canonical
		// sync must never automatically replace a reply that failed to save.
		continueIfOwed(record.messages);
	}, [chatId, setMessages, continueIfOwed]);

	// The settled terminal's other half (stream-reattach wave): the
	// transport resolved turn-settled — no turn running, the record is
	// current. Drop the fallback busy state and adopt the record (its
	// continuation check fires the owed next turn, exactly as the poll's
	// settle branch always did).
	reattachSettledRef.current = () => {
		setTurnInFlight(false);
		void syncFromServer();
	};

	// ── Append-only record adoption (owner ground rules, 2026-09-15) ──
	// Content delivered into the record server-side — sub-agent
	// artifacts, abort notes — must become visible the
	// moment it persists, mid-turn included: it sits between messages, and
	// nothing about a running turn should hide it. The full snapshot sync
	// mid-stream is forbidden (it breaks the SDK's in-place continuation
	// merge — the stale-snapshot lesson), so adoption here is APPEND-ONLY
	// (the session hook's adoptRecord): insert the record's new ids in their canonical
	// order, never rewrite a local one, keep the in-flight tail last. The
	// full syncFromServer stays the net at idle (reorder, plan blocks, turns).
	const adoptAppendOnly = useCallback(async () => {
		try {
			const res = await fetch(`/api/chats/${chatId}`);
			if (!res.ok) return;
			const record = (await res.json()) as { messages?: LannaMessage[] };
			if (!Array.isArray(record.messages)) return;
			adoptRecord(record.messages);
		} catch {
			/* transient — the idle full sync is the net */
		}
	}, [chatId, adoptRecord]);

	// Turn-start window: the server inserts claimed steers right after our
	// outgoing message, BEFORE the stream produces anything — so a bounded,
	// self-terminating window of three record fetches (400ms/1s/2s) catches
	// the insert and shows the marker during the turn, then stops. No
	// standing poll — the window exists only for these seconds.
	const turnStartStatusRef = useRef(status);
	// The window must survive the submitted→streaming flip (the stream starts
	// in well under 400ms), so the timers are guarded by this ref — dropped at
	// unmount, left alone otherwise: the window self-terminates after 2s.
	const adoptionWindowOpenRef = useRef(false);
	const turnStartTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
	useEffect(() => {
		const was = turnStartStatusRef.current;
		turnStartStatusRef.current = status;
		if (was === "submitted" || status !== "submitted") return;
		// A turn just started (status flipped ready → submitted): open the
		// bounded adoption window.
		adoptionWindowOpenRef.current = true;
		const timers = [400, 1000, 2000].map((ms) =>
			setTimeout(() => {
				if (adoptionWindowOpenRef.current) {
					void adoptAppendOnly();
				}
			}, ms),
		);
		// Deliberately no cleanup here: this effect re-runs on every status
		// flip, which would cancel the window at submitted→streaming.
		timers.forEach((t) => {
			turnStartTimerRefs.current.push(t);
		});
	}, [status, adoptAppendOnly]);
	useEffect(() => {
		const timers = turnStartTimerRefs;
		return () => {
			adoptionWindowOpenRef.current = false;
			timers.current.forEach(clearTimeout);
			timers.current = [];
		};
	}, []);

	const showWorking = useShowWorking();
	// The mermaid focus (chrome-melt wave, 2026-09-19): md-blocks' expand
	// button registers the chart source here; the overlay mounts INSIDE the
	// session-area div — it is session-scoped, so the drag bar stays sharp and
	// draggable while a focus owns the area.
	const [mermaidFocus, setMermaidFocus] = useState<string | null>(null);
	// Figure focus (2026-10-07): the figure card's fullscreen button — same
	// overlay shell as mermaid, but carrying the raw svg + the card's invert
	// state so the fullscreen view stays faithful to the toggled card.
	const [figureFocus, setFigureFocus] = useState<{ svg: string; inverted: boolean } | null>(null);

	// Overlay mirrors for the layered-Esc gate (owner 2026-10-04): the
	// lanna:kbd-abort-turn handler reads these at EVENT time — declared here
	// beside their states, consumed below wherever the states live.
	const mermaidFocusRef = useRef(mermaidFocus);
	mermaidFocusRef.current = mermaidFocus;
	// The figure focus rides the mermaid layer in the Esc gate — the same
	// overlay class (session-scoped diagram focus, Esc claimed at the
	// document level by the overlay itself); the window chain must stay out.
	const figureFocusRef = useRef(figureFocus);
	figureFocusRef.current = figureFocus;
	const setupOpenRef = useRef(setupOpen);
	setupOpenRef.current = setupOpen;

	// ── Session usage (wave-4 stats bar) ──
	// The money channel: the record's turns log and read-time server Pi
	// pricing projection. Seeded once on mount (the page doesn't carry turns),
	// refreshed when the local stream settles (each turn appends to the log
	// server-side), and kept fresh by syncFromServer whenever it already
	// fetches the record. No turns yet → the bar renders "—" everywhere.
	const [turns, setTurns] = useState<TurnUsage[]>([]);
	const [pricing, setPricing] = useState<SessionPricing | undefined>();
	// The per-chat model control state (model-picker writes via PUT; the
	// record is the source of truth, lifted here so the stats bar re-renders).
	// The dock's reserved tail height (DockOverlay reports it; the spacer at
	// the end of the transcript renders it). Lives here because the spacer is
	// inside the scroller while the dock overlays OUTSIDE it — two parents.
	// 208 ≈ gradient(96) + composer block(~112): the SSR/pre-hydration
	// guess so the static paint has a sane tail. The first layout effect
	// replaces it with the measured truth before paint.
	const [dockReserve, setDockReserve] = useState(208);
	const syncTurns = useCallback(async () => {
		try {
			const res = await fetch(`/api/chats/${chatId}`);
			if (!res.ok) return;
			const record = (await res.json()) as { turns?: TurnUsage[]; pricing?: SessionPricing };
			if (Array.isArray(record.turns)) setTurns(record.turns);
			setPricing(record.pricing);
		} catch {
			// transient blip: stats stay on the last known figures
		}
	}, [chatId]);
	useEffect(() => {
		void syncTurns();
	}, [syncTurns]);
	// After the learner's own turn ends the log has a fresh entry — and the
	// Post-turn settle (the SLIMMED watch — push-architecture S3,
	// 2026-10-02): our own stream just ended. Two instant LOCAL actions
	// only — the turns-only refetch lands the log entry while the server's
	// persist/endTurn lags by milliseconds, and the coverage ring re-reads
	// (this turn's messages just joined the uncovered mass). The ADOPTION
	// LOOP and the HANDOFF WATCH that lived here are RETIRED: a
	// server-initiated turn (a job wake, another
	// tab) is now ANNOUNCED on the events channel — the turn-started
	// subscription (below the jobs poll) attaches to it live. No polling
	// window can expire; the freeze class is gone.
	const prevStatusRef = useRef(status);
	useEffect(() => {
		const transitioned = prevStatusRef.current !== "ready" && status === "ready";
		// Every path (the old early-return skipped this on the transition
		// branch — the re-fire-on-dep-churn wart, fixed S3).
		prevStatusRef.current = status;
		if (!transitioned) return;
		// immediate: turns-only refetch — the stats bar updates even while
		// the server's persist/endTurn lags the client by milliseconds
		void syncTurns();
		// CANONIZATION (fix B, the duplicate-previous-message bug, 2026-10-02):
		// turn-settled for OUR OWN turn arrives while the stream is still open
		// (endTurn emits from onFinish before the response terminates, so the
		// SSE frame reliably beats [DONE]) — the handler below cannot sync
		// there, it flags instead, and THIS flip consumes the flag: the record
		// reflects durable truth (a failed settlement retains its notice,
		// not its unsaved reply), so replacing the view absorbs the tail's
		// streamed c_-id copies into base under their server ids. Without
		// this the tail kept those copies forever and the next send's
		// steer-adoption window rendered them a second time. The wake handoff
		// cannot be missed by this sync: the wake fires only after the idle
		// gates + grace (≥750ms past this flip), so its turn-started event
		// lands at an idle, already-canonical view and attaches normally.
		if (settleAnnouncedRef.current) {
			settleAnnouncedRef.current = false;
			void syncFromServer();
		}
		// (The extraction-discovery nudges that lived here died at S5: the
		// pipeline announces every phase on the events channel.)
	}, [status, syncTurns, syncFromServer]);

	// A stream that died MID-FLIGHT (network): the runner decoupled the turn
	// from its view, so the server turn runs ON behind the error banner —
	// re-enter the in-flight watch (the 1500ms fallback poll adopts at
	// settle) instead of leaving the session blind until the next send's
	// 409 merge-retry heals it. One record check per error transition.
	const prevErrorStatusRef = useRef(status);
	useEffect(() => {
		const was = prevErrorStatusRef.current;
		prevErrorStatusRef.current = status;
		if (was === "error" || status !== "error") return;
		let cancelled = false;
		void (async () => {
			try {
				const res = await fetch(`/api/chats/${chatId}`);
				if (!res.ok || cancelled) return;
				const record = (await res.json()) as { turnInFlight?: boolean };
				if (cancelled) return;
				if (record.turnInFlight === true) setTurnInFlight(true);
				else void syncFromServer();
			} catch {
				/* transient — the banner stands; the next send's merge-retry heals */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [status, chatId, syncFromServer]);

	const localStreamRef = useRef(false);
	localStreamRef.current = localStream;

	// ── Server-initiated turn discovery (push-architecture S3, 2026-10-02) ──
	// Every turn THIS chat runs is announced on the events channel — the
	// a job wake, another tab's send, the
	// missed-on-mount case. This replaces the retired watch loop and the
	// 1500ms fallback record poll: discovery is no longer a polling window
	// that can expire. Handlers read REFS, not closure state — events fire
	// between renders, and a ref holds the live value at event time.
	const statusRef = useRef(status);
	statusRef.current = status;
	/** Fix B (2026-10-02): turn-settled arrived for OUR OWN turn — the
	 * record is durable (endTurn fires only after persistTurn); the ready
	 * flip consumes this flag to canonize the view onto the record. See the
	 * settle effect and the turn-settled handler below. */
	const settleAnnouncedRef = useRef(false);
	useServerEvent("turn-started", (p) => {
		// Known non-issue: beginTurn emits before registerTurn in the same
		// synchronous request flow; a GET /stream inside that sub-ms window
		// gets a settled response — unwinnable by a network round-trip,
		// self-healing via the eventual turn-settled. Do not engineer around.
		if (p.chatId !== chatId) return;
		if (localStreamRef.current) return; // our OWN turn — the 409-race guard
		if (turnInFlightRef.current) return; // already attached
		attachToRunningTurn();
	});
	useServerEvent("turn-settled", (p) => {
		if (p.chatId !== chatId) return;
		if (localStreamRef.current) {
			// Our own [DONE] path owns the BUSY settle — but not a no-op (fix B,
			// 2026-10-02): the event is the record-durable guarantee (endTurn
			// fires only after persistTurn), and it reliably beats [DONE] here
			// (endTurn emits from onFinish before the response terminates). Flag
			// it; the ready flip consumes the flag and canonizes the view onto
			// the record. (If [DONE] somehow won this race instead, this branch
			// didn't run and the fully-idle branch below already synced.)
			settleAnnouncedRef.current = true;
			return;
		}
		if (turnInFlightRef.current) {
			// The attached stream's terminal frame owns the normal settle —
			// syncing HERE would swap a stale snapshot mid-stream (the
			// continuation-coalescing law, see the jobs poll above). Only
			// the error case heals: the attached stream died, and the settle
			// says persistTurn has made the record durable truth.
			if (statusRef.current === "error") {
				setTurnInFlight(false);
				clearError();
				void syncFromServer();
			}
			return;
		}
		// Fully idle — a turn we never saw (every window missed): adopt now.
		void syncFromServer();
	});
	useServerEvent("compaction-changed", (p) => {
		// The settle-kick's background summary: while it runs, sends gate
		// (the next turn's server-side ensureCompacted awaits it anyway —
		// this only keeps the affordance honest). On finish, record-changed
		// (emitted by the compaction write itself) carries the marker in.
		if (p.chatId !== chatId) return;
		setCompacting(p.running);
	});
	useServerEvent("record-changed", (p) => {
		// The silent dismissal write (A2, 2026-10-03): no turn ever ran, so
		// only the record moved. Other tabs and post-error windows adopt;
		// our OWN dismissal already rendered its optimistic append — syncing
		// here too is harmless (the adoption law swaps local ids for the
		// server's). Busy states ignore it: a running turn owns the view,
		// and the write is 409-guarded against exactly that anyway.
		if (p.chatId !== chatId) return;
		if (localStreamRef.current || turnInFlightRef.current) return;
		void syncFromServer();
	});

	const onSend = () => {
		if (compacting) return;
		/* FINISH DICTATION FIRST (owner, 2026-10-01): a learner who keeps
		 * talking right through Enter must not lose the tail — stop the run,
		 * let the last finals land in the composer, then send the REF value
		 * (the flush lands via setState, invisible to this closure). */
		if (!dictation.active) {
			doSteerOrSend();
			return;
		}
		void dictation.finish().then(doSteerOrSend);
	};
	const drillState = useDrill(messages, titleText);
	const sendQuickReply = (reply: string) => {
		if (busy || compacting) return;
		void send({ type: "text", text: reply });
	};
	const doSend = () => {
		if (busy || compacting) return;
		const t = textRef.current.trim();
		if (!t) return;
		draftRef.current = t; // the refusal flow's preserve-and-replay seam
		applyText("");
		void send({ type: "text", text: t });
	};

	useEffect(() => {
		if (busy || compacting || heldAnswer === null) return;
		if (error) {
			applyText(heldAnswer);
			heldAnswerRef.current = null;
			setHeldAnswer(null);
			return;
		}
		const answer = heldAnswer;
		draftRef.current = answer;
		heldAnswerRef.current = null;
		setHeldAnswer(null);
		send({ type: "text", text: answer });
	}, [busy, compacting, error, heldAnswer, send, applyText]);

	/* STEER VS SEND (owner arc 2026-10-03): a send while a turn runs steers
	 * it — the quiet queue + the live agent's steering rail; the turn's own
	 * stream lands the card when pi drains it. The branch is BUSY, not
	 * turnInFlight: the own-stream case CLEARS turnInFlight (the local
	 * dedup, chat.tsx ~370), so branching there swallowed Enter entirely
	 * during our own turn (owner live report, fixed same day). busy covers
	 * own stream AND foreign/wake turns — both have a live agent by the
	 * time the send's POST resolved, so the steer lands. Idle takes the
	 * plain send; a raced settle 409s and falls back to exactly that. */
	const doSteerOrSend = () => {
		if (compacting) return;
		const t = textRef.current.trim();
		if (!t) return;
		if (busy && kind === "chat") {
			applyText("");
			setHeldAnswer((held) => {
				const next = held ? `${held}\n${t}` : t;
				heldAnswerRef.current = next;
				return next;
			});
			return;
		}
		if (busy) {
			applyText("");
			void steer(t);
			return;
		}
		doSend();
	};

	return (
		<ChatActionsContext.Provider
			value={{
				chatId,
				syncFromServer,
				openSetup: () => setSetupOpen(true),
			}}
		>
			<SessionMermaidContext.Provider
				value={{
					openMermaid: setMermaidFocus,
					openFigure: (svg, inverted) => setFigureFocus({ svg, inverted }),
				}}
			>
				{/* The session surface: the transcript column (header + scroller). The dock overlays the column bottom (outside the scroller); a spacer in the transcript reserves its height. */}
				<div className="flex h-dvh">
					<div className="flex min-w-0 flex-1 flex-col">
						{/* The top bar is its own block (owner, top-fade round 4): in flow
				    above the scroller on the plain page background — no gradient. Its
				    bottom outline (border-b border-border) matches the one that
				    separates the left sidebar — same width, same color (owner, r5).
				    h-15 (60px), not py-2: the toggle (a size-9 icon button) renders
				    only while the sidebar is CLOSED — an auto-height row would
				    collapse when it disappears and slide the title + chip up.
				    60px is an ALIGNMENT, not just a size: it equals the sidebar's
				    Lanna wordmark band, so the header's border-b continues that
				    band's bottom edge as one line across the app (owner, round 6). */}
						<TopBar
							bare={kind === "chat"}
							// While renaming the bar is NOT a drag surface: app-region:drag
							// would eat the mousedown, so click-to-escape (below) could
							// never fire. Rename mode is interactive mode (owner ask) —
							// TopBar's one escape hatch.
							drag={!renaming}
							onMouseDown={(e) => {
								// Escape hitbox: any mousedown outside the input itself blurs
								// it, running the existing onBlur commit path. The input is
								// shrink-to-fit (field-sizing), so the rest of the bar is
								// this spacer + inert chips — all click-to-exit (owner ask).
								if (renaming && e.target !== titleInputRef.current) titleInputRef.current?.blur();
							}}
						>
							{renaming ? (
								<>
									<input
										ref={titleInputRef}
										value={titleDraft}
										onChange={(e) => setTitleDraft(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") void commitRename(titleDraft);
											// stopPropagation claims the Esc (keyboard wave A):
											// closing rename must not also abort a turn.
											else if (e.key === "Escape") {
												e.stopPropagation();
												setRenaming(false);
											}
										}}
										onBlur={() => void commitRename(titleDraft)}
										spellCheck={false}
										aria-label="Chat title"
										title="Rename this chat"
										className="lanna-no-drag min-w-[8ch] max-w-[70%] shrink-0 bg-transparent font-title text-2xl font-semibold tracking-tight caret-current outline-none [field-sizing:content]"
									/>
									{/* flex-1 spacer during rename too, so the chips stay at
							    the right edge; clicks here commit via the header
							    mousedown handler. */}
									<div className="min-w-4 flex-1" aria-hidden="true" />
								</>
							) : (
								<>
									<Hint
										// F2 renames (registry) — surfaced on the hover.
										label="Rename chat"
										action="rename-session"
										side="bottom"
									>
										<button
											type="button"
											onClick={() => {
												setTitleDraft(titleText);
												setRenaming(true);
											}}
											className={cn(
												"lanna-no-drag -mx-1.5 min-w-4 shrink cursor-text truncate rounded-md px-1.5 text-left transition-colors hover:bg-accent",
												kind === "chat"
													? "font-ui text-sm font-medium text-muted-foreground transition-opacity"
													: "font-title text-2xl font-semibold tracking-tight",
												kind === "chat" && pageTitleInView && "pointer-events-none opacity-0",
											)}
											aria-hidden={kind === "chat" && pageTitleInView ? true : undefined}
											tabIndex={kind === "chat" && pageTitleInView ? -1 : undefined}
										>
											{titleText}
										</button>
									</Hint>
									{/* flex-1 spacer: keeps the chips at the right edge AND stays a
							    drag surface (no carve-out) — the freed bar is grippable. */}
									<div className="min-w-4 flex-1" aria-hidden="true" />
								</>
							)}
							{/* Show working (redesign 2026-10-27): reasoning + bookkeeping
					    tool calls are hidden by default; this chip brings them back. */}
							{kind !== "chat" && (
								<Hint label={showWorking ? "Hide the tutor's working" : "Show the tutor's working"} side="bottom">
									<button
										type="button"
										data-testid="show-working"
										aria-pressed={showWorking}
										onClick={(e) => {
											blurAfterPointerClick(e);
											setShowWorking(!showWorking);
										}}
										className={cn(
											"lanna-no-drag flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors hover:text-foreground",
											showWorking ? "border-border text-foreground" : "border-border/60 text-muted-foreground",
										)}
									>
										<CogIcon className="size-3.5" aria-hidden />
										{showWorking ? "Hide working" : "Show working"}
									</button>
								</Hint>
							)}
							{messages.length > 0 && (
								<ChatExportMenu
									chatId={chatId}
									title={titleText}
									messages={messages}
									nativeMessages={nativeMessages}
									plain={kind === "chat"}
								/>
							)}
							{kind === "practice" && (
								<span
									data-testid="practice-tag"
									data-phase="practice"
									aria-hidden="true"
									className="pointer-events-none flex shrink-0 select-none items-center gap-1 text-xs font-semibold text-muted-foreground"
								>
									<DumbbellIcon className="size-3" />
									Practice
								</span>
							)}
						</TopBar>

						<SessionFind scopeRef={sessionFindScopeRef} scrollContextRef={scrollContextRef} />
						<div ref={sessionFindScopeRef} className="relative flex min-h-0 flex-1">
							<Conversation className="h-full min-w-0 flex-1" initial="instant" contextRef={scrollContextRef}>
								<ConversationContent
									className="min-h-full gap-0 p-0"
									scrollClassName={kind === "chat" ? "lanna-fade-out" : undefined}
								>
									<div
										data-session-find-root=""
										className={cn(
											COLUMN,
											"flex flex-1 flex-col gap-4 pt-4",
											kind === "chat" && "max-w-[42rem] gap-5 pt-10",
										)}
									>
										{messages.length === 0 && !busy && (
											<ConversationEmptyState
												title="New chat"
												description={
													kind === "practice"
														? "Your tutor starts with a first problem."
														: "Ask anything about the language."
												}
											/>
										)}

										{messages.map((m, mi) =>
											m.role === "user" && m.parts.length > 0 && m.parts.every((p) => p.type.startsWith("data-")) ? (
												// Marker cards (custom messages, 2026-10-04): user-side
												// scaffolding — the graph-context pick, the practice
												// thinking trace — render as cards in the transcript
												// column directly, NO chat bubble (the subagent-steer
												// precedent). The user branch below renders text only;
												// without this hoist a data-only message read as an
												// EMPTY bubble (owner report, 2026-10-04).
												<Fragment key={m.id || `m-${mi}`}>
													{m.parts.map((part, pi) => {
														switch (part.type) {
															case "data-compaction":
																return <CompactionMomentDivider key={pi} data={part.data as CompactionDividerData} />;
															case "data-compaction-cut":
																return <CompactionCutDivider key={pi} data={part.data as CompactionDividerData} />;
															case "data-practice-thinking":
																return <ThinkingCard key={pi} data={part.data as PracticeThinkingData} />;
															case "data-practice-next":
																// The learner's move-on signal (owner round 16): a compact
																// centered mono-caps line — chrome, the dismissal register.
																return (
																	<div
																		key={pi}
																		data-testid="practice-next-line"
																		className="my-4 flex items-center justify-center gap-1.5 font-ui text-xs font-semibold text-muted-foreground"
																	>
																		<ArrowRightIcon className="size-3" />
																		Next problem
																	</div>
																);
															default:
																return null;
														}
													})}
												</Fragment>
											) : (
												<Fragment key={m.id || `m-${mi}`}>
													{m.role === "user" && lines?.get(mi) ? (
														<LearnerLineView
															line={lines.get(mi)!}
															text={messageText(m)}
															recede={busy && mi < currentLine}
															titleRef={lines.get(mi)!.kind === "title" ? setPageTitle : undefined}
														/>
													) : m.role === "user" ? (
														/* THE DOCUMENT ROW (owner round, 2026-10-05): no right-aligned
										    bubble — the transcript reads as a document. User text is a
										    full-width quote block: muted "You" label, muted rail,
										    FULL-opacity text (learner words are content, not whisper).
										    Distinguished from user thinking at a glance: thinking is
										    collapsed + 50% italic; this is upright and present.
										    User text renders plain — the model's LaTeX pipeline is not
										    applied to learner-authored text ($ stays $, no surprises).
										    Rendered WITHOUT the Message wrapper — that is the bubble. */
														<div
															data-testid="user-message"
															/* THE DOCUMENT, ALL-IN (owner rounds two+three, 2026-10-07):
										    no chat side — the user message is a full-width card-color
										    BAND, the IDENTICAL geometry as the thinking rows: 5px band
										    padding, the left gap matches it, the rail fills the 3ch
										    inset (the band is the authorship mark against the agent's
										    transparent prose). The "You" label stays — one register
										    with the thinking labels. */
															className={
																kind === "chat"
																	? "mt-12 font-ui text-xl font-semibold leading-snug tracking-[-0.015em] text-foreground first:mt-0"
																	: "my-3 ml-auto w-fit max-w-[85%] rounded-xl bg-well px-4 py-2.5 font-ui text-sm"
															}
														>
															{/* The rail GROUPS (owner round 4, 2026-10-05): the YOU heading
												    sits INSIDE the rail, same mono-xs register and same 1ch
												    rail as the thinking rows — one quote geometry. */}
															<div className="sr-only">You</div>
															<div
																className={
																	kind === "chat"
																		? "whitespace-pre-wrap"
																		: "lanna-prose whitespace-pre-wrap text-foreground"
																}
															>
																{m.parts
																	.filter((p) => p.type === "text")
																	.map((p) => p.text)
																	.join("\n")}
															</div>
														</div>
													) : (
														<Message
															from="assistant"
															className={cn(
																"max-w-full",
																kind === "chat" && "lanna-voice",
																kind === "chat" && localStream && mi === messages.length - 1 && "lanna-writing",
																kind === "chat" && busy && mi < currentLine && "lanna-recede",
															)}
														>
															<MessageContent className="w-full">
																{m.parts.map((part, pi) => {
																	const isLastPart = mi === messages.length - 1 && pi === m.parts.length - 1;
																	// A tool call that errored BACK TO THE AGENT (validation
																	// failure, malformed args) is invisible work — the agent
																	// reads the error and retries. Owner ruling 2026-09-26:
																	// surface the retry loop as one quiet line, any tool,
																	// instead of silence,
																	// so a flailing loop reads as a stall. Aborts are
																	// terminal — nothing retries — so they stay silent.
																	if (
																		part.state === "output-error" &&
																		part.type.startsWith("tool-") &&
																		part.errorText !== "Operation aborted" &&
																		!(kind === "chat" && CHAT_RECORD_TOOLS.has(part.type.slice("tool-".length)))
																	) {
																		return (
																			<SystemLine key={`retry-${pi}`} testId="tool-retry">
																				Retrying…
																			</SystemLine>
																		);
																	}
																	switch (part.type) {
																		case "text": {
																			if (kind === "chat" && repeatsEarlierText(m.parts, pi)) return null;
																			return (
																				<div key={part.id || pi} className="lanna-source-passage">
																					<MessageResponse
																						{...(kind === "chat" ? { components: chatMdComponents } : {})}
																					>
																						{part.text}
																					</MessageResponse>
																				</div>
																			);
																		}
																		case "reasoning":
																			// Hidden unless "Show working" is on — except the live
																			// row while this turn streams, which is the activity signal.
																			if (kind === "chat")
																				return status === "streaming" && isLastPart ? <TutorWriting key={pi} /> : null;
																			if (!showWorking && !(status === "streaming" && isLastPart)) return null;
																			return (
																				<Reasoning
																					key={pi}
																					isStreaming={status === "streaming" && isLastPart}
																					className="mb-2"
																				>
																					<ReasoningTrigger />
																					<ReasoningContent>{part.text ?? ""}</ReasoningContent>
																				</Reasoning>
																			);
																		case "step-start":
																			return pi > 0 && kind !== "chat" ? <Separator key={pi} className="my-3" /> : null;
																		case "tool-draw": {
																			const drawn =
																				part.state === "output-available"
																					? (part.output as { svg?: string } | null)?.svg
																					: undefined;
																			if (drawn) return <SketchFigure key={pi} source={drawn} incomplete={false} />;
																			return part.state !== "output-available" &&
																				part.state !== "output-error" &&
																				busy ? (
																				<SketchFigure key={pi} source="" incomplete />
																			) : null;
																		}
																		default: {
																			// A tool call being WRITTEN (owner, streaming round 2026-10-01):
																			// input-streaming spans the whole execution, and the live card —
																			// spinner + shimmered activity label, the input watchable on expand
																			// — replaces the retired transcript bottom line. On settling, the
																			// registry's card takes over below.
																			if (part.type.startsWith("tool-") && part.state === "input-streaming") {
																				if (kind === "chat") return null;
																				return <LiveToolCard key={pi} part={part as ArtifactPartProps["part"]} />;
																			}
																			// Artifact extension point (contracts.ts): job
																			// parts and future artifacts render via the
																			// registry — add renderers there, not here.
																			if (part.type.startsWith("tool-")) {
																				if (!showWorking && WORKING_TOOLS.has(part.type.slice("tool-".length)))
																					return null;
																				const Renderer = artifactRenderers[part.type.slice("tool-".length)];
																				if (Renderer)
																					return <Renderer key={pi} part={part as ArtifactPartProps["part"]} />;
																			}
																			return null;
																		}
																	}
																})}
															</MessageContent>
														</Message>
													)}
												</Fragment>
											),
										)}

										{/* THE placeholder, ACTION-gated (owner, optimistic round
							    3, 2026-10-02): spinner + shimmered Thinking… from the
							    instant of any action that produces tokens — send,
							    session start, reattach (status flips to
							    submitted SYNCHRONOUSLY with the action) — until the
							    turn's first APPLIED event, where the stream takes over
							    with the same look: an arrived-but-empty message renders
							    the thinking ROW (view.ts projects one empty reasoning
							    part), so submitted ⟺ placeholder and streaming ⟺ a
							    rendered row, mutually exclusive by construction.
							    Protocol events (agent_start) apply nothing and release
							    nothing — the placeholder covers the whole
							    provider-connect gap. turnInFlight: the same state
							    entered by external discovery (wake) / the poll
							    fallback. Never collapsible itself. */}
										{/* Compaction (owner round 15): the same register as the
						    thinking placeholder — a visible session-wide state while
						    the summarizer holds the model gate. Mutually exclusive with
						    the THINKING placeholder by construction (the gate sits
						    BEFORE beginTurn; the settle kick runs after endTurn). */}
										{kind === "chat" && heldAnswer !== null && <HeldLine text={heldAnswer} />}
										{kind === "chat" && !busy && !compacting && !error && (
											<ChatReplies
												reply={lastReplyText(messages)}
												open={questionOpen(messages) || undefined}
												onPick={sendQuickReply}
												drill={{ label: drillState.label, onDrill: drillState.drill, opening: drillState.opening }}
											/>
										)}
										{compacting && (
											<span className="flex items-center gap-2 font-ui text-xs font-semibold text-muted-foreground">
												<BrailleSpinner label="Summarizing the chat so far" />
												<Shimmer duration={1}>Summarizing the chat so far…</Shimmer>
											</span>
										)}
										{(status === "submitted" || turnInFlight) && kind === "chat" && <TutorWriting />}
										{(status === "submitted" || turnInFlight) && kind !== "chat" && (
											<span className="flex items-center gap-2 font-ui text-xs font-semibold text-muted-foreground">
												<BrailleSpinner label="Thinking" />
												<Shimmer duration={1}>Thinking…</Shimmer>
											</span>
										)}
										{error && (
											<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
												Something went wrong: {error.message}
											</div>
										)}
									</div>

									{/* The dock's reserved tail (DockOverlay reports its height):
						    keeps at-rest transcript content scrolling fully clear of
						    the overlay — the flow-space replacement for the old
						    sticky dock. Zero only pre-measurement (the first layout
						    effect reports before paint). */}
									<div aria-hidden data-testid="dock-spacer" style={{ height: dockReserve }} />
								</ConversationContent>
								{/* The dock: an overlay sibling of the scroller (the
				    use-stick-to-bottom pattern). The scroll-down button lives
				    INSIDE the overlay now (owner refinement round, 2026-09-24):
				    anchored to the dock block's top edge, so it rides every
				    height morph (typing, the band growing, the
				    fold) and NEVER overlaps the composer. */}
								<DockOverlay
									plain={kind === "chat"}
									practice={activeProblem}
									compactionRunning={compacting}
									onSubmitThinking={submitThinking}
									chatId={chatId}
									turns={turns}
									contextTokens={contextTokens}
									pricing={pricing}
									onReserve={setDockReserve}
									dictationSlot={<DictationBar dictation={dictation} />}
									dictationCancel={dictation.cancel}
									queuedSteers={visibleQueuedSteers(steerQueue, nativeMessages)}
									setupCta={
										zeroKeys ? (
											<ZeroKeysPill onOpen={() => setSetupOpen(true)} />
										) : (
											!configured && (
												<div className="relative h-0">
													<div className="pointer-events-auto absolute inset-x-0 bottom-2 flex justify-center">
														<button
															type="button"
															data-testid="setup-cta"
															onClick={() => setSetupOpen(true)}
															className={cn(
																buttonVariants({ variant: "accent-soft", size: "sm" }),
																"cursor-pointer rounded-full font-ui font-semibold",
															)}
														>
															Add an AI key
														</button>
													</div>
												</div>
											)
										)
									}
									composer={
										<Composer
											// Stop aborts ANY in-flight turn (stream-reattach wave): the
											// square renders while a reattached/wake turn runs too — the
											// abort channel kills it server-side; stop() alone would
											// only detach our view.
											busy={busy}
											value={draftParts.rest}
											onChange={(v) => applyText(joinDraft(draftParts.pdfs, v, draftParts.images))}
											onPaste={async (e) => {
												const items = e.clipboardData?.items;
												if (!items) return;
												for (const item of Array.from(items)) {
													if (item.type.startsWith("image/")) {
														const file = item.getAsFile();
														if (file) {
															e.preventDefault();
															try {
																const img = await uploadLearnerImage(file);
																applyText(joinDraft(draftParts.pdfs, draftParts.rest, [...draftParts.images, img]));
															} catch (err) {
																console.error("Failed to upload pasted image", err);
															}
														}
													}
												}
											}}
											attachments={
												(draftParts.pdfs.length > 0 || draftParts.images.length > 0) && (
													<div className="flex flex-col gap-2">
														<DraftPdfChips
															pdfs={draftParts.pdfs}
															onRemove={(pdf) =>
																applyText(
																	joinDraft(
																		draftParts.pdfs.filter((p) => p !== pdf),
																		draftParts.rest,
																		draftParts.images,
																	),
																)
															}
														/>
														<DraftImageChips
															images={draftParts.images}
															onRemove={(img) =>
																applyText(
																	joinDraft(
																		draftParts.pdfs,
																		draftParts.rest,
																		draftParts.images.filter((i) => i !== img),
																	),
																)
															}
														/>
													</div>
												)
											}
											inputRef={composerInputRef}
											onSend={onSend}
											onStop={abortInFlightTurn}
											canSend={canSend}
											onEscape={dictation.active ? dictation.cancel : undefined}
											// The pause affordance (owner round 16): the placeholder
											// IS the hint — empty state, exactly where Enter-on-empty
											// applies.
											nextProblem={nextReady}
											onNext={sendNext}
											placeholder={
												nextReady
													? "Ask anything, or press Enter for the next one."
													: kind === "chat"
														? busy
															? "Write ahead while the tutor writes"
															: questionOpen(messages)
																? "Write your answer"
																: "Ask something else"
														: undefined
											}
											toolbar={
												kind === "chat" ? (
													<>
														<DictationBar dictation={dictation} compact />
														<ChatAttachMenu
															compact
															onPdfAttached={(pdf) => {
																applyText(joinDraft([...draftParts.pdfs, pdf], draftParts.rest, draftParts.images));
																composerInputRef.current?.focus();
															}}
															onImageAttached={(img) => {
																applyText(joinDraft(draftParts.pdfs, draftParts.rest, [...draftParts.images, img]));
																composerInputRef.current?.focus();
															}}
														/>
														<DiacriticBar className="min-w-0 flex-1 px-0 pb-0 sm:justify-start" />
													</>
												) : undefined
											}
										/>
									}
								/>
							</Conversation>
							{kind === "chat" && <ChatBoard messages={messages} drill={drillState} />}

							{/* The session-scoped focuses (chrome-melt wave, 2026-09-19): mounted
				    INSIDE the session area — absolute inset-0 siblings of the scroller,
				    so they own the area below the drag bar, right of the sidebar, and
				    the top bar stays sharp + draggable while a focus is open. */}
							{mermaidFocus !== null && <MermaidOverlay chart={mermaidFocus} onClose={() => setMermaidFocus(null)} />}
							{figureFocus !== null && (
								<MermaidOverlay
									svg={figureFocus.svg}
									inverted={figureFocus.inverted}
									onClose={() => setFigureFocus(null)}
								/>
							)}
							<AbortTurnDialog mode={abortAsk} onClose={() => setAbortAsk(null)} onConfirm={confirmAbort} busy={busy} />
						</div>
					</div>
				</div>
			</SessionMermaidContext.Provider>
			{/* The BYOK setup flow (owner, 2026-09-22): one mount serves the
		    persistent CTA, the refused-send interception, and the job cards'
		    deep-link. Save keeps the draft in the composer — it never sends
		    (owner ruling 2026-10-09); Esc also keeps it (the dialog is
		    closable by design — the gate is the server, not this modal). */}
			<SetupDialog
				open={setupOpen}
				onClose={() => setSetupOpen(false)}
				onDone={() => {
					setSetupOpen(false);
					setConfigured(true);
					// Save only saves (owner ruling 2026-10-09): the draft went
					// home into the composer at refusal time and STAYS there —
					// the learner sends it themselves.
				}}
			/>
		</ChatActionsContext.Provider>
	);
}

/**
 * The floating blob: ONE persistent shell, OVERLAID at the bottom of the
 * column (absolute — a sibling of the scroller, the use-stick-to-bottom
 * pattern; it replaced the old in-flow sticky dock, which died of the
 * fold-latency problem below). Contents swap between the chat composer and
 * the practice dock; shell height morphs between variants (WAAPI, quick). A
 * spacer at the end of the transcript (rendered by ChatView from onReserve
 * reports) holds the dock's flow-space, so at-rest content scrolls fully
 * clear of the overlay.
 *
 * Why an overlay (owner, scroll round 1): an in-flow dock IS scroll geometry
 * — folding it shrinks the scroll content, so the fold had to wait until the
 * learner was a full dock-height past the bottom (any closer and the browser
 * clamp pinned them back, re-expanding the box: the oscillation). Decoupled
 * from the flow, the fold is VISUAL ONLY: it fires as soon as the learner
 * leaves the bottom, and the reserved tail only ever GROWS while a practice problem
 * is open (a shrinking tail would reintroduce the clamp).
 *
 * Collapse: scroll up past COLLAPSE_DIST and the dock folds into a slim bar;
 * click it (or scroll back to the bottom) to re-expand. The practice dock
 * stays MOUNTED while collapsed (hidden, not unmounted) so a half-written
 * thinking survives.
 */
/** The layered-Esc ruling (owner, 2026-10-04): an open overlay claims Esc —
 *  closing itself — before the abort chain may open its confirm. A mermaid
 *  focus or the setup dialog must close the OVERLAY, never dismiss the
 *  practice problem underneath. Priority is stacking order: the abort confirm
 *  (topmost, claims via its own dialog), then the mermaid focus, then setup
 *  (self-closing — the gate only must not fire), then the abort chain proper
 *  (a practice problem before the turn). */
type EscAbortTarget = "mermaid" | "setup" | "problem" | "turn" | null;
/**
 * Does the ?prompt topic still owe its first send? The gate is "no real
 * conversation yet" (no user/assistant message) — NOT emptiness: a
 * session started with map picks carries a graph-context MARKER as
 * message[0], and that scaffolding must never swallow the first send
 * (owner report, 2026-10-04: the turn went dead behind it — the old
 * `length === 0` check saw the marker and refused to fire).
 */
function initialPromptOwed(messages: readonly { role: string }[], prompt: string | undefined): boolean {
	if (!prompt) return false;
	return !messages.some((m) => m.role === "user" || m.role === "assistant");
}

function escAbortTarget(s: {
	abortAsk: boolean;
	mermaidFocus: boolean;
	setupOpen: boolean;
	/** An active practice problem: Esc opens the discard confirm, above the turn abort. */
	problem: boolean;
	busy: boolean;
}): EscAbortTarget {
	if (s.abortAsk) return null; // the popup's own Esc — claimed by the dialog
	if (s.mermaidFocus) return "mermaid";
	if (s.setupOpen) return "setup";
	if (s.problem) return "problem";
	if (s.busy) return "turn";
	return null;
}

/**
 * The geometry-mute's growth rule (flicker round, 2026-09-26): a reserve
 * GROWTH while a dock owns the band is the dock stretching (the dictation
 * flush landing many lines at once) — the spacer lands in that commit, the
 * smooth catch-up lags by exactly the growth, and that lag is our own
 * motion, not the learner leaving, so the fold machine ignores scroll
 * events for the mute window after (reproduced d≈152 > COLLAPSE_DIST).
 * Shrinks never stamp — that path self-muted the at-bottom re-expand and
 * left the box stuck collapsed (resize round, verified live). Pure for
 * tests.
 */
export function shouldStampGeometryMute(nextH: number, prevH: number, dockOwned: boolean): boolean {
	return dockOwned && nextH > prevH + 1;
}

function DockOverlay({
	practice,
	compactionRunning,
	onSubmitThinking,
	turns,
	contextTokens,
	pricing,
	composer,
	chatId,
	onReserve,
	dictationSlot,
	dictationCancel,
	queuedSteers,
	setupCta,
	plain = false,
}: {
	plain?: boolean;
	/** Compaction running for this chat (round 14) — the dock's submit
	 *  affordance gate (the server's registry is the real one). */
	compactionRunning: boolean;
	/** The ACTIVE practice problem (practice sessions, 2026-10-04):
	 *  {toolCallId, input} — the dock owns the band and the composer is
	 *  replaced. null when no problem is active. */
	practice: { toolCallId: string; input: unknown } | null;
	/** (commit, text) — the practice dock's two submit lanes. */
	onSubmitThinking: (text: string) => void;
	/** The session's usage log — the stats bar beneath the composer folds it. */
	turns: TurnUsage[];
	contextTokens: number | null;
	pricing?: SessionPricing;
	composer: React.ReactNode;
	/** The model control's pass-through (the stats bar hosts it). */
	chatId: string;
	/** Reports the dock's settled height (block + gradient) — ChatView's
	 *  dockReserve state feeds the transcript's spacer from it. */
	onReserve: (h: number) => void;
	/** The dictation strip (STT wave): rendered in the stats bar's middle
	 *  slot — the mic button + live meter (components/dictation.tsx). */
	dictationSlot?: React.ReactNode;
	/** Esc in a practice field stops dictation (the strip is the stats bar's;
	 *  the stop belongs to the page-owned hook, threaded down). */
	dictationCancel?: () => void;
	/** The queued-steer indicator's lines (composer steering, 2026-10-03):
	 *  already filtered by visibleQueuedSteers — only undrained steers. */
	queuedSteers: QueuedSteerLine[];
	/** The persistent setup CTA (BYOK, owner 2026-09-22): the same pill
	 *  home and /chat/new carry, above the composer while slots are unset. */
	setupCta?: React.ReactNode;
}) {
	const { isAtBottom, scrollToBottom, scrollRef } = useStickToBottomContext();
	// Assigned per render so the scroll handler reads the live bottom state.
	const atBottomRef = useRef(isAtBottom);
	atBottomRef.current = isAtBottom;
	const [expanded, setExpanded] = useState(true);

	// ── Fold machine (position, not velocity — owner, scroll round 1) ──
	// The dock is an overlay: folding is visual-only and scroll geometry never
	// moves, so the thresholds can hug the bottom. Leave it → fold; reach it
	// again → re-open. The dead band keeps trackpad drift from chattering.
	const expandedRef = useRef(expanded);
	expandedRef.current = expanded;
	// Dock ownership (the fold machine, the reserve immunity): an active practice
	// problem replaces the composer and owns the band.
	const dockOwnedRef = useRef(!!practice);
	dockOwnedRef.current = !!practice;

	// Resize mute (owner, resize round): any block width change stamps this — the
	// fold machine ignores scroll events for a beat after, because a resize or
	// rewrap re-clamps scrollTop and emits PHANTOM scroll events mid-transient
	// (the box flickered to the bar and back).
	const geometryAtRef = useRef(0);
	useIsoLayoutEffect(() => {
		const block = blockRef.current;
		if (!block) return;
		let width = 0;
		const measure = () => {
			if (Math.abs(block.offsetWidth - width) <= 2) return;
			width = block.offsetWidth;
			geometryAtRef.current = Date.now();
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(block);
		return () => ro.disconnect();
	}, []);

	// The overlay must not paint over the scroller's scrollbar (owner, scroll
	// round 2): the scroller reserves symmetric gutters (scrollbar-gutter:
	// stable both-edges), so inset the overlay's right edge by the gutter —
	// zero on macOS overlay scrollbars, the real width on classic platforms.
	// The same measure owns the PROBLEM HEIGHT CAP (owner round,
	// 2026-10-05): the old fixed fractions (55dvh / 40vh) cut long problems
	// off absurdly short — the cap is now the AVAILABLE COLUMN (the
	// scroller already starts below the top bar) minus a 2rem breathing
	// gap, carried as --dock-max-h for the docks' scroll areas.
	const [sbInset, setSbInset] = useState(0);
	const [dockMaxH, setDockMaxH] = useState<number | null>(null);
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const measure = () => {
			setSbInset(Math.round((el.offsetWidth - el.clientWidth) / 2));
			setDockMaxH(Math.max(el.clientHeight - 32, 160));
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [scrollRef]);

	// GROWTH MUTE (owner round, 2026-10-05 — the generation churn): during a
	// live turn the transcript content grows and stick-to-bottom chases it;
	// the transient distance-from-bottom used to read as the learner
	// leaving, folding the dock open↔bar ("disappear and appear again").
	// A ResizeObserver on the scroller's content stamps the SAME mute the
	// dock's own resizes use — growth frames can never fold. Shrinks stamp
	// nothing (the fold's own morph shrinks the reserve; muting that would
	// self-mute the at-bottom re-expand).
	const growthAtRef = useRef(0);
	useEffect(() => {
		const el = scrollRef.current;
		const content = el?.firstElementChild as HTMLElement | null | undefined;
		if (!el || !content) return;
		let prevH = content.getBoundingClientRect().height;
		const ro = new ResizeObserver(() => {
			const h = content.getBoundingClientRect().height;
			if (h > prevH + 0.5) growthAtRef.current = Date.now();
			prevH = Math.max(prevH, h);
		});
		ro.observe(content);
		return () => ro.disconnect();
	}, [scrollRef]);

	// Wheel over the dock must still scroll the transcript (owner, scroll
	// round 2): the overlay is a SIBLING of the scroller, so the browser's
	// native scroll chaining stops at the overlay (the old in-flow dock
	// chained for free). Internal scrollers — the practice problem, textarea
	// overflow, the model menus — keep native scrolling, including their
	// own edge chaining; only when nothing under the cursor can take the
	// delta do we forward it to the transcript.
	useEffect(() => {
		const root = blockRef.current;
		const el = scrollRef.current;
		if (!root || !el) return;
		const canScroll = (n: HTMLElement, dir: number) => {
			if (n.scrollHeight - n.clientHeight < 2) return false; // not scrollable
			return dir < 0 ? n.scrollTop > 0 : n.scrollTop < n.scrollHeight - n.clientHeight - 0.5;
		};
		const onWheel = (e: WheelEvent) => {
			if (e.deltaY === 0) return;
			for (let n = e.target as HTMLElement | null; n && n !== root; n = n.parentElement) {
				if (n instanceof HTMLElement && canScroll(n, e.deltaY)) return; // native
			}
			e.preventDefault();
			el.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
		};
		root.addEventListener("wheel", onWheel, { passive: false });
		return () => root.removeEventListener("wheel", onWheel);
	}, [scrollRef]);

	// ── The reserve: the spacer's height, reported upward ──
	// Grows immediately (typing, new variants). NEVER drops while a practice
	// problem is open — a shrinking reserved tail is scroll geometry and the
	// browser clamp would pin a nearby learner to the bottom (the old oscillation).
	// In chat mode drops apply (the composer's typing shrink is today's
	// harmless in-flow behavior; nothing auto-expands there).
	const reserveRef = useRef(0);
	const blockRef = useRef<HTMLDivElement>(null);
	const offer = (blockH: number) => {
		const next = blockH + GRADIENT_H;
		if (next <= reserveRef.current + 0.5 && dockOwnedRef.current) return; // fold immunity
		// Reserve GROWTH is the phantom-scroll SOURCE (flicker round,
		// 2026-09-26): the spacer's height lands in this commit, the smooth
		// catch-up lags it by the growth amount, and the position machine
		// used to read that lag as the learner leaving — form → bar → form
		// (the dictation flush, reproduced d≈152 > COLLAPSE_DIST). Stamp the
		// mute right where the spacer grows: it covers the scroll events of
		// THIS growth no matter how long after the field stretched (the
		// field grows on its own render; the offer lands on the NEXT
		// DockOverlay render — ~1s apart live). Shrinks never stamp (the
		// fold's own give-back must not self-mute the re-expand).
		if (shouldStampGeometryMute(next, reserveRef.current, dockOwnedRef.current)) geometryAtRef.current = Date.now();
		reserveRef.current = next;
		onReserve(next);
	};

	// Explicit expand (bar click): the smooth scroll to the bottom takes
	// hundreds of ms, during which the position is still legitimately inside
	// the collapse zone — the machine would instantly re-collapse the dock
	// (open → snap shut → reopen at the bottom, the flicker). Suppress the
	// collapse branch until the reveal scroll settles or is interrupted.
	const expandIntentRef = useRef(false);
	const intentTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const suppressFoldDuringReveal = () => {
		expandIntentRef.current = true;
		clearTimeout(intentTimerRef.current);
		intentTimerRef.current = setTimeout(() => {
			expandIntentRef.current = false;
		}, 2000);
		return Promise.resolve(scrollToBottom()).finally(() => {
			clearTimeout(intentTimerRef.current);
			expandIntentRef.current = false;
		});
	};

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => {
			if (!dockOwnedRef.current) return;
			// Resize mute (owner, resize round): a geometry change re-clamps
			// scrollTop and the browser emits the clamp as a scroll event —
			// reading the transient position folded the box to the bar for a
			// flicker. Real scrolling resumes after the brief mute window.
			if (Date.now() - geometryAtRef.current < 400) return;
			// Growth mute (owner round, 2026-10-05): the transcript growing
			// under a live turn is not the learner leaving.
			if (Date.now() - growthAtRef.current < 400) return;
			const d = el.scrollHeight - el.clientHeight - el.scrollTop;
			if (expandedRef.current) {
				// INTENT-GATED FOLD (owner ruling, 2026-10-05): distance alone
				// folded on stick-to-bottom's catch-up transients; a real fold
				// needs the distance AND stick-to-bottom agreeing the learner
				// left the bottom.
				if (d > COLLAPSE_DIST && !expandIntentRef.current && !atBottomRef.current) setExpanded(false);
			} else if (d < EXPAND_DIST) {
				setExpanded(true);
				void scrollToBottom();
			}
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [scrollRef, scrollToBottom]);

	// The settled block height (gradient excluded), offered to the spacer.
	// Only ever called with NATURAL heights — never the animated mid-morph
	// value (the iso effect's getAnimations guard wraps every call).
	const measureBlock = () => {
		const b = blockRef.current;
		if (b) offer(b.getBoundingClientRect().height);
	};

	const mode = practice ? `practice:${practice.toolCallId}` : "chat";
	// The opening variant of a session appears instantly — the fade/rise is
	// reserved for mid-session transitions.
	const initialModeRef = useRef(mode);

	// Height morph: animate the shell from its previous height to its new one
	// whenever the variant (chat ↔ practice ↔ collapsed bar) changes. Typing
	// growth keeps the same stateKey and is NOT animated.
	const shellRef = useRef<HTMLDivElement>(null);
	// The fold's CONTENT fade (owner round, 2026-10-05): the shell height
	// morphs, but the bar↔form content used to hard-swap. A WAAPI fade/rise
	// on the toggle — no remount, so the dock's own state survives.
	const contentRef = useRef<HTMLDivElement>(null);
	const prevExpandedForFadeRef = useRef(expanded);
	useIsoLayoutEffect(() => {
		if (prevExpandedForFadeRef.current === expanded) return;
		prevExpandedForFadeRef.current = expanded;
		contentRef.current?.animate(
			[
				{ opacity: 0, transform: "translateY(6px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
		);
	}, [expanded]);
	// The height-morph key (components/dock-state-key.ts): the expanded
	// term (the fold) belongs to the practice dock as well as the composer.
	// Typing growth keeps the key and never animates; the fold/unfold morphs
	// as it always has.
	const stateKey = dockStateKey(mode, !!practice, expanded);
	const prevRef = useRef<{ key: string; height: number } | null>(null);
	useIsoLayoutEffect(() => {
		const el = shellRef.current;
		if (!el) return;
		const p = prevRef.current;
		if (p && p.key === stateKey) {
			// Same variant: keep the settled height fresh, but never measure while
			// a morph is in flight — getBoundingClientRect would read the ANIMATED
			// value and corrupt the start height of the next morph.
			if (el.getAnimations().length === 0) {
				const h = el.getBoundingClientRect().height;
				p.height = h;
				measureBlock(); // typing growth → the spacer grows with the box
			}
			return;
		}
		el.getAnimations().forEach((a) => a.cancel()); // flush to natural height before measuring
		const h = el.getBoundingClientRect().height;
		// Variant change → re-reserve. Growth applies instantly; a drop (the
		// fold, or practice problem → composer) is filtered by the offer policy.
		measureBlock();
		if (p && Math.abs(p.height - h) > 1) {
			el.animate([{ height: `${p.height}px` }, { height: `${h}px` }], {
				duration: 120,
				easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
			});
		}
		prevRef.current = { key: stateKey, height: h };
	});

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ right: sbInset }}>
			<div className="h-24" />
			<div
				ref={blockRef}
				className={cn("relative pb-5", plain ? "pt-1" : "bg-background shadow-[0_-1px_0_var(--q-line)]")}
				style={{ "--dock-max-h": dockMaxH ? `${dockMaxH}px` : undefined } as React.CSSProperties}
			>
				<div className={cn(DOCK, plain && "max-w-[42rem]")}>
					{setupCta}
					{/* The queued-steer indicator (owner spec 2026-10-03): quiet
					    one-liners above the shell - right-aligned to where its corner
					    rounding starts, truncated, no background, no container. A
					    line dies when its card lands (visibleQueuedSteers). */}
					<QueuedSteersBody steers={queuedSteers} />
					{/* Lanna: one-click target-language letters + playback
					    speed, typing into whichever field was focused last. */}
					{!plain && <DiacriticBar />}
					<div
						ref={shellRef}
						className={cn(
							"pointer-events-auto overflow-hidden",
							plain
								? "rounded-[20px] bg-card shadow-raise-hi outline-1 outline-transparent transition-[outline-color] focus-within:outline-ink-4"
								: "rounded-xl bg-card shadow-raise-hi",
						)}
					>
						<div ref={contentRef} key={mode} className={mode === initialModeRef.current ? undefined : "dock-variant"}>
							{practice ? (
								<PracticeDock
									problemCallId={practice.toolCallId}
									input={practice.input as { statement: string }}
									expanded={expanded}
									onExpand={() => {
										setExpanded(true);
										void suppressFoldDuringReveal();
									}}
									onSubmit={onSubmitThinking}
									onEscape={dictationCancel}
									compactionRunning={compactionRunning}
								/>
							) : (
								composer
							)}
						</div>
					</div>
					{/* The stats row: beneath the composer/practice shell, not
					    flush to the screen bottom — static height, outside the
					    morphing shell so it never joins a height animation. */}
					{!plain && (
						<StatsBar
							turns={turns}
							contextTokens={contextTokens}
							pricing={pricing}
							dictationSlot={dictationSlot}
							chatId={chatId}
						/>
					)}
					{/* The scroll-down disc (moved here from the Conversation,
					    owner refinement round 2026-09-24): anchored to the BLOCK's
					    top edge — above the composer shell AND the stats row, in
					    the gradient's transparent band — so it never overlaps
					    any dock element. Because the anchor is the block itself
					    (not the scroller's bottom), it rides every height change
					    LIVE: typing growth, a practice problem expanding the
					    band, the 180ms fold morph. pointer-events-auto: the
					    overlay is none by default. The isAtBottom/scrollToBottom
					    context still reaches it — DockOverlay is a Conversation
					    child. */}
					<ConversationScrollButton className="pointer-events-auto bottom-full mb-2" />
				</div>
			</div>
		</div>
	);
}
