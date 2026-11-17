import { Fragment, useMemo } from "react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { learnerLines, type LannaViewMessage } from "@/src/core";
import type { SessionError, SessionKind, SessionStatus } from "@/components/session/state";
import { cn } from "@/lib/utils";
import { TranscriptMessage } from "@/components/chat/transcript-message";
import { LiveStatus, type DrillState } from "@/components/chat/live-status";
import { AskedAbout } from "@/components/chat/asked-about";
import type { AskedAbout as AskedAboutData } from "@/src/core";

const COLUMN = "mx-auto w-full max-w-none px-6";

interface TranscriptProps {
	kind: SessionKind;
	messages: LannaViewMessage[];
	status: SessionStatus;
	busy: boolean;
	turnInFlight: boolean;
	compacting: boolean;
	error: SessionError | null;
	heldAnswer: string | null;
	showWorking: boolean;
	drill: DrillState;
	onPageTitle: (element: HTMLHeadingElement | null) => void;
	onPickReply: (reply: string) => void;
	about?: AskedAboutData | null;
}

export function Transcript({
	kind,
	messages,
	status,
	busy,
	turnInFlight,
	compacting,
	error,
	heldAnswer,
	showWorking,
	drill,
	onPageTitle,
	onPickReply,
	about = null,
}: TranscriptProps) {
	const lines = useMemo(() => (kind === "chat" ? learnerLines(messages) : null), [kind, messages]);
	const currentLine = useMemo(() => (lines ? Math.max(-1, ...lines.keys()) : -1), [lines]);

	return (
		<div
			data-session-find-root=""
			className={cn(COLUMN, "flex flex-1 flex-col gap-4 pt-4", kind === "chat" && "max-w-[42rem] gap-5 pt-10")}
		>
			{about && messages.length === 0 && <AskedAbout about={about} />}
			{!about && messages.length === 0 && !busy && (
				<ConversationEmptyState
					title="New chat"
					description={
						kind === "practice" ? "Your tutor starts with a first problem." : "Ask anything about the language."
					}
				/>
			)}
			{messages.map((message, index) => (
				<Fragment key={message.id || `m-${index}`}>
					<TranscriptMessage
						message={message}
						isLast={index === messages.length - 1}
						kind={kind}
						status={status}
						busy={busy}
						showWorking={showWorking}
						line={lines?.get(index)}
						recede={kind === "chat" && busy && index < currentLine}
						onPageTitle={onPageTitle}
					/>
					{about && index === 0 && <AskedAbout about={about} />}
				</Fragment>
			))}
			<LiveStatus
				kind={kind}
				status={status}
				busy={busy}
				turnInFlight={turnInFlight}
				compacting={compacting}
				error={error}
				heldAnswer={heldAnswer}
				messages={messages}
				drill={drill}
				onPickReply={onPickReply}
			/>
		</div>
	);
}
