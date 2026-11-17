import type { RefObject } from "react";
import { Hint } from "@/components/ui/hint";
import { cn } from "@/lib/utils";
import type { SessionKind } from "@/components/session/state";

interface SessionTitleProps {
	kind: SessionKind;
	titleText: string;
	renaming: boolean;
	titleDraft: string;
	titleInputRef: RefObject<HTMLInputElement | null>;
	pageTitleInView: boolean;
	onDraftChange: (draft: string) => void;
	onBeginRename: () => void;
	onCommitRename: (next: string) => Promise<void>;
	onCancelRename: () => void;
}

export function SessionTitle(props: SessionTitleProps) {
	if (props.renaming) return <RenameField {...props} />;
	return <TitleButton {...props} />;
}

function RenameField({ titleDraft, titleInputRef, onDraftChange, onCommitRename, onCancelRename }: SessionTitleProps) {
	return (
		<>
			<input
				ref={titleInputRef}
				value={titleDraft}
				onChange={(event) => onDraftChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") void onCommitRename(titleDraft);
					else if (event.key === "Escape") {
						event.stopPropagation();
						onCancelRename();
					}
				}}
				onBlur={() => void onCommitRename(titleDraft)}
				spellCheck={false}
				aria-label="Chat title"
				title="Rename this chat"
				className="lanna-no-drag min-w-[8ch] max-w-[70%] shrink-0 bg-transparent font-title text-2xl font-semibold tracking-tight caret-current outline-none [field-sizing:content]"
			/>
			<div className="min-w-4 flex-1" aria-hidden="true" />
		</>
	);
}

function TitleButton({ kind, titleText, pageTitleInView, onBeginRename }: SessionTitleProps) {
	const hidden = kind === "chat" && pageTitleInView;
	return (
		<>
			<Hint label="Rename chat" action="rename-session" side="bottom">
				<button
					type="button"
					onClick={onBeginRename}
					className={cn(
						"lanna-no-drag -mx-1.5 min-w-4 shrink cursor-text truncate rounded-md px-1.5 text-left transition-colors hover:bg-accent",
						kind === "chat"
							? "font-ui text-sm font-medium text-muted-foreground transition-opacity"
							: "font-title text-2xl font-semibold tracking-tight",
						hidden && "pointer-events-none opacity-0",
					)}
					aria-hidden={hidden ? true : undefined}
					tabIndex={hidden ? -1 : undefined}
				>
					{titleText}
				</button>
			</Hint>
			<div className="min-w-4 flex-1" aria-hidden="true" />
		</>
	);
}
