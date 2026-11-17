import { Message, MessageContent } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import type { LannaViewMessage } from "@/src/core";
import { isTurnRunning, type SessionKind, type SessionStatus } from "@/components/session/state";
import { AssistantPart, isRetryPart } from "@/components/chat/assistant-part";

type MessagePart = LannaViewMessage["parts"][number];

interface AssistantMessageProps {
	message: LannaViewMessage;
	isLast: boolean;
	kind: SessionKind;
	status: SessionStatus;
	busy: boolean;
	showWorking: boolean;
	recede: boolean;
}

export function AssistantMessage({ message, isLast, kind, status, busy, showWorking, recede }: AssistantMessageProps) {
	const writing = kind === "chat" && isTurnRunning(status) && isLast;
	return (
		<Message
			from="assistant"
			className={cn(
				"max-w-full",
				kind === "chat" && "lanna-voice",
				writing && "lanna-writing",
				kind === "chat" && recede && "lanna-recede",
			)}
		>
			<MessageContent className="w-full">
				{message.parts.map((part, index) => (
					<AssistantPart
						key={partKey(part, index, kind)}
						part={part}
						parts={message.parts}
						index={index}
						isLastPart={isLast && index === message.parts.length - 1}
						kind={kind}
						status={status}
						busy={busy}
						showWorking={showWorking}
					/>
				))}
			</MessageContent>
		</Message>
	);
}

function partKey(part: MessagePart, index: number, kind: SessionKind): string | number {
	if (isRetryPart(part, kind)) return `retry-${index}`;
	if (part.type === "text" && part.id) return part.id;
	return index;
}
