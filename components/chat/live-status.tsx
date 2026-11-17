import { BrailleSpinner } from "@/components/braille-spinner";
import { ChatReplies } from "@/components/chat-replies";
import { HeldLine, TutorWriting } from "@/components/chat-voice";
import type { useDrill } from "@/components/chat-board";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { questionOpen, repeatsEarlierText, type LannaViewMessage } from "@/src/core";
import type { SessionError, SessionKind, SessionStatus } from "@/components/session/state";

export type DrillState = ReturnType<typeof useDrill>;

interface LiveStatusProps {
	kind: SessionKind;
	status: SessionStatus;
	busy: boolean;
	turnInFlight: boolean;
	compacting: boolean;
	error: SessionError | null;
	heldAnswer: string | null;
	messages: LannaViewMessage[];
	drill: DrillState;
	onPickReply: (reply: string) => void;
}

export function LiveStatus({
	kind,
	status,
	busy,
	turnInFlight,
	compacting,
	error,
	heldAnswer,
	messages,
	drill,
	onPickReply,
}: LiveStatusProps) {
	const awaitingTurn = status === "submitted" || turnInFlight;
	return (
		<>
			{kind === "chat" && heldAnswer !== null && <HeldLine text={heldAnswer} />}
			{kind === "chat" && !busy && !compacting && !error && (
				<ChatReplies
					reply={lastReplyText(messages)}
					open={questionOpen(messages) || undefined}
					onPick={onPickReply}
					drill={{ label: drill.label, onDrill: drill.drill, opening: drill.opening }}
				/>
			)}
			{compacting && (
				<span className="flex items-center gap-2 font-ui text-xs font-semibold text-muted-foreground">
					<BrailleSpinner label="Summarizing the chat so far" />
					<Shimmer duration={1}>Summarizing the chat so far…</Shimmer>
				</span>
			)}
			{awaitingTurn && kind === "chat" && <TutorWriting />}
			{awaitingTurn && kind !== "chat" && (
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
		</>
	);
}

function lastReplyText(messages: readonly LannaViewMessage[]): string {
	const last = messages.at(-1);
	if (!last || last.role !== "assistant") return "";
	return last.parts
		.flatMap((part, index) => (part.type === "text" && !repeatsEarlierText(last.parts, index) ? [part.text] : []))
		.join("\n\n");
}
