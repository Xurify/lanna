import { useRef, type CSSProperties, type ReactNode } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { ConversationScrollButton } from "@/components/ai-elements/conversation";
import { DiacriticBar } from "@/components/diacritic-bar";
import { dockStateKey } from "@/components/dock-state-key";
import { QueuedSteersBody, type QueuedSteerLine } from "@/components/queued-steers";
import { StatsBar } from "@/components/stats-bar";
import type { SessionPricing, TurnUsage } from "@/src/core";
import { cn } from "@/lib/utils";
import { useDockGeometry } from "@/components/chat/use-dock-geometry";
import { useDockFold } from "@/components/chat/use-dock-fold";
import { useWheelForward } from "@/components/chat/use-wheel-forward";
import { useDockReserve } from "@/components/chat/use-dock-reserve";
import { useDockMorph } from "@/components/chat/use-dock-morph";
import { PracticeDockBody, type ActivePracticeProblem } from "@/components/chat/practice-dock";

const DOCK = "mx-auto w-full max-w-[46rem] px-4";

interface DockOverlayProps {
	plain?: boolean;
	practice: ActivePracticeProblem | null;
	compactionRunning: boolean;
	onSubmitThinking: (text: string) => void;
	turns: TurnUsage[];
	contextTokens: number | null;
	pricing?: SessionPricing;
	composer: ReactNode;
	chatId: string;
	onReserve: (height: number) => void;
	dictationSlot?: ReactNode;
	dictationCancel?: () => void;
	queuedSteers: QueuedSteerLine[];
	setupCta?: ReactNode;
}

export function DockOverlay({
	plain = false,
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
}: DockOverlayProps) {
	const { isAtBottom, scrollToBottom, scrollRef } = useStickToBottomContext();
	const blockRef = useRef<HTMLDivElement>(null);
	const shellRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const dockOwned = practice !== null;
	const geometry = useDockGeometry({ scrollRef, blockRef });
	const fold = useDockFold({
		scrollRef,
		scrollToBottom,
		isAtBottom,
		dockOwned,
		isMuted: geometry.isMuted,
	});
	useWheelForward(blockRef, scrollRef);
	const reserve = useDockReserve({
		blockRef,
		dockOwned,
		stampGeometry: geometry.stampGeometry,
		onReserve,
	});

	const mode = practice ? `practice:${practice.toolCallId}` : "chat";
	const initialMode = useRef(mode);
	useDockMorph({
		shellRef,
		contentRef,
		stateKey: dockStateKey(mode, dockOwned, fold.expanded),
		expanded: fold.expanded,
		measureBlock: reserve.measureBlock,
	});

	const blockStyle = {
		"--dock-max-h": geometry.dockMaxHeight ? `${geometry.dockMaxHeight}px` : undefined,
	} as CSSProperties;

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ right: geometry.scrollbarInset }}>
			<div className="h-24" />
			<div
				ref={blockRef}
				className={cn("relative pb-5", plain ? "pt-1" : "bg-background shadow-[0_-1px_0_var(--q-line)]")}
				style={blockStyle}
			>
				<div className={cn(DOCK, plain && "max-w-[42rem]")}>
					{setupCta}
					<QueuedSteersBody steers={queuedSteers} />
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
						<div ref={contentRef} key={mode} className={mode === initialMode.current ? undefined : "dock-variant"}>
							{practice ? (
								<PracticeDockBody
									problem={practice}
									expanded={fold.expanded}
									onExpand={fold.expand}
									onSubmit={onSubmitThinking}
									onEscape={dictationCancel}
									compactionRunning={compactionRunning}
								/>
							) : (
								composer
							)}
						</div>
					</div>
					{!plain && (
						<StatsBar
							turns={turns}
							contextTokens={contextTokens}
							pricing={pricing}
							dictationSlot={dictationSlot}
							chatId={chatId}
						/>
					)}
					<ConversationScrollButton className="pointer-events-auto bottom-full mb-2" />
				</div>
			</div>
		</div>
	);
}
