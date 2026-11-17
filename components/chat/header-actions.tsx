import { CogIcon, DumbbellIcon } from "lucide-react";
import { Hint } from "@/components/ui/hint";
import { ChatExportMenu } from "@/components/chat-export";
import { blurAfterPointerClick } from "@/components/focus-hygiene";
import { setShowWorking } from "@/components/show-working";
import { cn } from "@/lib/utils";
import type { LannaMessage, LannaViewMessage } from "@/src/core";
import type { SessionKind } from "@/components/session/state";

interface HeaderActionsProps {
	kind: SessionKind;
	chatId: string;
	titleText: string;
	messages: LannaViewMessage[];
	nativeMessages: LannaMessage[];
	showWorking: boolean;
}

export function HeaderActions({ kind, chatId, titleText, messages, nativeMessages, showWorking }: HeaderActionsProps) {
	return (
		<>
			{kind !== "chat" && <ShowWorkingChip showWorking={showWorking} />}
			{messages.length > 0 && (
				<ChatExportMenu
					chatId={chatId}
					title={titleText}
					messages={messages}
					nativeMessages={nativeMessages}
					plain={kind === "chat"}
				/>
			)}
			{kind === "practice" && <PracticeTag />}
		</>
	);
}

function ShowWorkingChip({ showWorking }: { showWorking: boolean }) {
	return (
		<Hint label={showWorking ? "Hide the tutor's working" : "Show the tutor's working"} side="bottom">
			<button
				type="button"
				data-testid="show-working"
				aria-pressed={showWorking}
				onClick={(event) => {
					blurAfterPointerClick(event);
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
	);
}

function PracticeTag() {
	return (
		<span
			data-testid="practice-tag"
			data-phase="practice"
			aria-hidden="true"
			className="pointer-events-none flex shrink-0 select-none items-center gap-1 text-xs font-semibold text-muted-foreground"
		>
			<DumbbellIcon className="size-3" />
			Practice
		</span>
	);
}
