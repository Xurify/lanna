import { LearnerLineView } from "@/components/chat-voice";
import { messageText, type LannaViewMessage, type LearnerLine } from "@/src/core";
import type { SessionKind, SessionStatus } from "@/components/session/state";
import { AssistantMessage } from "@/components/chat/assistant-message";
import { MarkerMessage, UserRow } from "@/components/chat/rows";

interface TranscriptMessageProps {
	message: LannaViewMessage;
	isLast: boolean;
	kind: SessionKind;
	status: SessionStatus;
	busy: boolean;
	showWorking: boolean;
	line: LearnerLine | undefined;
	recede: boolean;
	onPageTitle: (element: HTMLHeadingElement | null) => void;
}

export function TranscriptMessage({
	message,
	isLast,
	kind,
	status,
	busy,
	showWorking,
	line,
	recede,
	onPageTitle,
}: TranscriptMessageProps) {
	if (isMarkerMessage(message)) return <MarkerMessage message={message} />;
	if (message.role !== "user") {
		return (
			<AssistantMessage
				message={message}
				isLast={isLast}
				kind={kind}
				status={status}
				busy={busy}
				showWorking={showWorking}
				recede={recede}
			/>
		);
	}
	if (line) {
		return (
			<LearnerLineView
				line={line}
				text={messageText(message)}
				recede={recede}
				titleRef={line.kind === "title" ? onPageTitle : undefined}
			/>
		);
	}
	return <UserRow message={message} kind={kind} />;
}

function isMarkerMessage(message: LannaViewMessage): boolean {
	return (
		message.role === "user" && message.parts.length > 0 && message.parts.every((part) => part.type.startsWith("data-"))
	);
}
