import { useRef, useState } from "react";
import type { StickToBottomContext } from "use-stick-to-bottom";
import { useChatSession } from "@/components/session";
import { isTurnRunning, type SessionKind } from "@/components/session/state";
import { visibleQueuedSteers } from "@/components/session-core";
import { SetupDialog } from "@/components/setup-dialog";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { ChatBoard, useDrill } from "@/components/chat-board";
import { DictationBar } from "@/components/dictation";
import { useFieldCycle } from "@/components/field-cycle";
import { SessionFind } from "@/components/session-find";
import { MermaidOverlay, SessionMermaidContext } from "@/components/session-overlay";
import { AbortTurnDialog } from "@/components/abort-turn-dialog";
import { TopBar } from "@/components/top-bar";
import { useShowWorking } from "@/components/show-working";
import { activeProblemOf, type LannaMessage } from "@/src/core";
import { ChatActionsContext } from "@/components/chat/chat-actions";
import { SessionTitle } from "@/components/chat/header-title";
import { HeaderActions } from "@/components/chat/header-actions";
import { Transcript } from "@/components/chat/transcript";
import { ChatComposer } from "@/components/chat/chat-composer";
import { DockOverlay } from "@/components/chat/dock";
import { SetupCta } from "@/components/chat/setup-pill";
import { useSessionTitle } from "@/components/chat/use-session-title";
import { usePageTitleInView } from "@/components/chat/use-page-title-in-view";
import { useDraft } from "@/components/chat/use-draft";
import { useChatDictation } from "@/components/chat/use-chat-dictation";
import { useSetupDialog } from "@/components/chat/use-setup-dialog";
import { useRefusalRecovery } from "@/components/chat/use-refusal-recovery";
import { useSessionStart } from "@/components/chat/use-session-start";
import { useCompacting } from "@/components/chat/use-compacting";
import { useTurnFlight } from "@/components/chat/use-turn-flight";
import { useSessionRecord } from "@/components/chat/use-session-record";
import { useTurnStartAdoption } from "@/components/chat/use-turn-start-adoption";
import { useSettleSync, useStreamFailureRecovery } from "@/components/chat/use-settle-sync";
import { useServerTurnEvents } from "@/components/chat/use-server-turn-events";
import { useHeldAnswer } from "@/components/chat/use-held-answer";
import { useTurnAbort } from "@/components/chat/use-turn-abort";
import { useDiagramFocus } from "@/components/chat/use-diagram-focus";
import { useEscapeAbort } from "@/components/chat/use-escape-abort";
import { usePracticeNext } from "@/components/chat/use-practice-next";
import { sendActionsFor } from "@/components/chat/send-actions";
import { useThinkingToggle } from "@/components/chat/use-thinking-toggle";

const INITIAL_DOCK_RESERVE_PX = 208;

interface ChatProps {
	chatId: string;
	title: string;
	initialMessages: LannaMessage[];
	initialError?: string;
	kind?: SessionKind;
	initialPrompt?: string;
	initiallyInFlight?: boolean;
	initiallyCompacting?: boolean;
	initialConfigured?: boolean;
}

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
}: ChatProps) {
	const {
		messages,
		nativeMessages,
		contextTokens,
		status,
		error,
		steerQueue,
		send,
		steer,
		continueIfOwed,
		dismissProblem,
		setMessages,
		adoptRecord,
		stop,
		clearError,
		resumeStream,
		setReattachSettled,
	} = useChatSession({ chatId, initialMessages, initialError, initiallyInFlight });

	const sessionFindScopeRef = useRef<HTMLDivElement | null>(null);
	const scrollContextRef = useRef<StickToBottomContext | null>(null);
	const sessionTitle = useSessionTitle({ chatId, initialTitle: title });
	const { pageTitleInView, setPageTitle } = usePageTitleInView();
	const draft = useDraft();
	const composerInputRef = useRef<HTMLTextAreaElement>(null);
	const draftRef = useRef<string | null>(null);
	const setup = useSetupDialog(initialConfigured);
	useRefusalRecovery({
		chatId,
		error,
		setMessages,
		clearError,
		draftRef,
		applyText: draft.applyText,
		openSetup: setup.openSetup,
	});
	const dictation = useChatDictation({ textRef: draft.textRef, applyText: draft.applyText, composerInputRef });
	useFieldCycle(chatFieldsInOrder);
	const compacting = useCompacting(chatId, initiallyCompacting);

	const record = useSessionRecord({ chatId, kind, setMessages, continueIfOwed, adoptRecord });
	const turnFlight = useTurnFlight({
		initiallyInFlight,
		status,
		resumeStream,
		syncFromServer: record.syncFromServer,
	});
	const { turnInFlight, setTurnInFlight, attachToRunningTurn } = turnFlight;
	setReattachSettled(turnFlight.settleAttachedTurn);
	useSessionStart({ initialMessages, initialPrompt, kind, turnInFlight, send, continueIfOwed });

	const localStream = isTurnRunning(status);
	const busy = localStream || turnInFlight;
	const activeProblem = activeProblemOf(nativeMessages);
	const settleAnnouncedRef = useRef(false);

	useTurnStartAdoption(status, record.adoptAppendOnly);
	useSettleSync({
		status,
		syncTurns: record.syncTurns,
		syncFromServer: record.syncFromServer,
		settleAnnouncedRef,
	});
	useStreamFailureRecovery({ chatId, status, setTurnInFlight, syncFromServer: record.syncFromServer });
	useServerTurnEvents({
		chatId,
		status,
		localStream,
		turnInFlight,
		attachToRunningTurn,
		setTurnInFlight,
		clearError,
		syncFromServer: record.syncFromServer,
		settleAnnouncedRef,
	});

	const held = useHeldAnswer({ busy, compacting, error, send, applyText: draft.applyText, draftRef });
	const abortInFlightTurn = useTurnAbort({
		chatId,
		localStream,
		stop,
		releaseHeldAnswer: held.releaseHeldAnswer,
	});
	const diagrams = useDiagramFocus();
	const escape = useEscapeAbort({
		mermaidOpen: diagrams.mermaidOpen,
		setupOpen: setup.setupOpen,
		activeProblem,
		busy,
		closeMermaid: diagrams.closeMermaid,
		abortTurn: abortInFlightTurn,
		dismissProblem,
	});
	const practiceNext = usePracticeNext({ kind, activeProblem, compacting, busy, nativeMessages, send });
	const sendActions = sendActionsFor({
		kind,
		busy,
		compacting,
		dictation,
		textRef: draft.textRef,
		applyText: draft.applyText,
		draftRef,
		send,
		steer,
		holdAnswer: held.holdAnswer,
	});
	useThinkingToggle();

	const showWorking = useShowWorking();
	const drill = useDrill(messages, sessionTitle.titleText);
	const [dockReserve, setDockReserve] = useState(INITIAL_DOCK_RESERVE_PX);
	const canSend = (draft.text.trim().length > 0 || dictation.active) && !activeProblem && !compacting;

	const submitThinking = (text: string) => {
		if (!activeProblem) return;
		send({ type: "thinking", problemCallId: activeProblem.toolCallId, text });
	};

	const composer = (
		<ChatComposer
			kind={kind}
			busy={busy}
			messages={messages}
			parts={draft.parts}
			applyText={draft.applyText}
			inputRef={composerInputRef}
			dictation={dictation}
			canSend={canSend}
			nextReady={practiceNext.nextReady}
			onSend={sendActions.onSend}
			onStop={abortInFlightTurn}
			onNext={practiceNext.sendNext}
		/>
	);

	return (
		<ChatActionsContext.Provider
			value={{
				chatId,
				syncFromServer: record.syncFromServer,
				openSetup: setup.openSetup,
			}}
		>
			<SessionMermaidContext.Provider
				value={{
					openMermaid: diagrams.openMermaid,
					openFigure: diagrams.openFigure,
				}}
			>
				<div className="flex h-dvh">
					<div className="flex min-w-0 flex-1 flex-col">
						<TopBar
							bare={kind === "chat"}
							drag={!sessionTitle.renaming}
							onMouseDown={(event) => {
								if (sessionTitle.renaming && event.target !== sessionTitle.titleInputRef.current)
									sessionTitle.titleInputRef.current?.blur();
							}}
						>
							<SessionTitle
								kind={kind}
								titleText={sessionTitle.titleText}
								renaming={sessionTitle.renaming}
								titleDraft={sessionTitle.titleDraft}
								titleInputRef={sessionTitle.titleInputRef}
								pageTitleInView={pageTitleInView}
								onDraftChange={sessionTitle.setTitleDraft}
								onBeginRename={sessionTitle.beginRename}
								onCommitRename={sessionTitle.commitRename}
								onCancelRename={sessionTitle.cancelRename}
							/>
							<HeaderActions
								kind={kind}
								chatId={chatId}
								titleText={sessionTitle.titleText}
								messages={messages}
								nativeMessages={nativeMessages}
								showWorking={showWorking}
							/>
						</TopBar>

						<SessionFind scopeRef={sessionFindScopeRef} scrollContextRef={scrollContextRef} />
						<div ref={sessionFindScopeRef} className="relative flex min-h-0 flex-1">
							<Conversation className="h-full min-w-0 flex-1" initial="instant" contextRef={scrollContextRef}>
								<ConversationContent
									className="min-h-full gap-0 p-0"
									scrollClassName={kind === "chat" ? "lanna-fade-out" : undefined}
								>
									<Transcript
										kind={kind}
										messages={messages}
										status={status}
										busy={busy}
										turnInFlight={turnInFlight}
										compacting={compacting}
										error={error}
										heldAnswer={held.heldAnswer}
										showWorking={showWorking}
										drill={drill}
										onPageTitle={setPageTitle}
										onPickReply={sendActions.sendQuickReply}
									/>
									<div aria-hidden data-testid="dock-spacer" style={{ height: dockReserve }} />
								</ConversationContent>
								<DockOverlay
									plain={kind === "chat"}
									practice={activeProblem}
									compactionRunning={compacting}
									onSubmitThinking={submitThinking}
									chatId={chatId}
									turns={record.turns}
									contextTokens={contextTokens}
									pricing={record.pricing}
									onReserve={setDockReserve}
									dictationSlot={<DictationBar dictation={dictation} />}
									dictationCancel={dictation.cancel}
									queuedSteers={visibleQueuedSteers(steerQueue, nativeMessages)}
									setupCta={
										<SetupCta zeroKeys={setup.zeroKeys} configured={setup.configured} onOpen={setup.openSetup} />
									}
									composer={composer}
								/>
							</Conversation>
							{kind === "chat" && <ChatBoard messages={messages} drill={drill} />}

							{diagrams.mermaidFocus !== null && (
								<MermaidOverlay chart={diagrams.mermaidFocus} onClose={diagrams.closeMermaid} />
							)}
							{diagrams.figureFocus !== null && (
								<MermaidOverlay
									svg={diagrams.figureFocus.svg}
									inverted={diagrams.figureFocus.inverted}
									onClose={diagrams.closeFigure}
								/>
							)}
							<AbortTurnDialog
								mode={escape.abortAsk}
								onClose={escape.closeAbortAsk}
								onConfirm={escape.confirmAbort}
								busy={busy}
							/>
						</div>
					</div>
				</div>
			</SessionMermaidContext.Provider>
			<SetupDialog open={setup.setupOpen} onClose={setup.closeSetup} onDone={setup.finishSetup} />
		</ChatActionsContext.Provider>
	);
}

function chatFieldsInOrder(): readonly HTMLElement[] {
	const pick = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));
	return [...pick('[data-testid="practice-dock"] textarea'), ...pick('[data-testid="composer"] textarea')];
}
