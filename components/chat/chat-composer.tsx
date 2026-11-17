import type { ClipboardEvent, RefObject } from "react";
import { Composer } from "@/components/composer";
import { ChatAttachMenu } from "@/components/chat-attach-menu";
import { DraftPdfChips } from "@/components/chat-pdf-button";
import { DraftImageChips, uploadLearnerImage } from "@/components/chat-image-button";
import { DiacriticBar } from "@/components/diacritic-bar";
import { DictationBar } from "@/components/dictation";
import { joinDraft, questionOpen, type DraftParts, type LannaViewMessage } from "@/src/core";
import type { SessionKind } from "@/components/session/state";
import type { ChatDictation } from "@/components/chat/use-chat-dictation";

interface ChatComposerProps {
	kind: SessionKind;
	busy: boolean;
	messages: LannaViewMessage[];
	parts: DraftParts;
	applyText: (text: string) => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	dictation: ChatDictation;
	canSend: boolean;
	nextReady: boolean;
	onSend: () => void;
	onStop: () => void;
	onNext: () => void;
}

export function ChatComposer({
	kind,
	busy,
	messages,
	parts,
	applyText,
	inputRef,
	dictation,
	canSend,
	nextReady,
	onSend,
	onStop,
	onNext,
}: ChatComposerProps) {
	return (
		<Composer
			busy={busy}
			value={parts.rest}
			onChange={(value) => applyText(joinDraft(parts.pdfs, value, parts.images))}
			onPaste={(event) => void pasteImages(event, parts, applyText)}
			attachments={hasAttachments(parts) ? <DraftAttachments parts={parts} applyText={applyText} /> : undefined}
			inputRef={inputRef}
			onSend={onSend}
			onStop={onStop}
			canSend={canSend}
			onEscape={dictation.active ? dictation.cancel : undefined}
			nextProblem={nextReady}
			onNext={onNext}
			placeholder={composerPlaceholder({ kind, busy, nextReady, messages })}
			toolbar={
				kind === "chat" ? (
					<ChatToolbar parts={parts} applyText={applyText} dictation={dictation} inputRef={inputRef} />
				) : undefined
			}
		/>
	);
}

function hasAttachments(parts: DraftParts): boolean {
	return parts.pdfs.length > 0 || parts.images.length > 0;
}

function composerPlaceholder({
	kind,
	busy,
	nextReady,
	messages,
}: {
	kind: SessionKind;
	busy: boolean;
	nextReady: boolean;
	messages: LannaViewMessage[];
}): string | undefined {
	if (nextReady) return "Ask anything, or press Enter for the next one.";
	if (kind !== "chat") return undefined;
	if (busy) return "Write ahead while the tutor writes";
	return questionOpen(messages) ? "Write your answer" : "Ask something else";
}

async function pasteImages(
	event: ClipboardEvent<HTMLTextAreaElement>,
	parts: DraftParts,
	applyText: (text: string) => void,
): Promise<void> {
	const items = event.clipboardData?.items;
	if (!items) return;
	for (const item of Array.from(items)) {
		if (!item.type.startsWith("image/")) continue;
		const file = item.getAsFile();
		if (!file) continue;
		event.preventDefault();
		try {
			const image = await uploadLearnerImage(file);
			applyText(joinDraft(parts.pdfs, parts.rest, [...parts.images, image]));
		} catch (error) {
			console.error("Failed to upload pasted image", error);
		}
	}
}

function DraftAttachments({ parts, applyText }: { parts: DraftParts; applyText: (text: string) => void }) {
	return (
		<div className="flex flex-col gap-2">
			<DraftPdfChips
				pdfs={parts.pdfs}
				onRemove={(pdf) =>
					applyText(
						joinDraft(
							parts.pdfs.filter((attached) => attached !== pdf),
							parts.rest,
							parts.images,
						),
					)
				}
			/>
			<DraftImageChips
				images={parts.images}
				onRemove={(image) =>
					applyText(
						joinDraft(
							parts.pdfs,
							parts.rest,
							parts.images.filter((attached) => attached !== image),
						),
					)
				}
			/>
		</div>
	);
}

function ChatToolbar({
	parts,
	applyText,
	dictation,
	inputRef,
}: {
	parts: DraftParts;
	applyText: (text: string) => void;
	dictation: ChatDictation;
	inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
	return (
		<>
			<DictationBar dictation={dictation} compact />
			<ChatAttachMenu
				compact
				onPdfAttached={(pdf) => {
					applyText(joinDraft([...parts.pdfs, pdf], parts.rest, parts.images));
					inputRef.current?.focus();
				}}
				onImageAttached={(image) => {
					applyText(joinDraft(parts.pdfs, parts.rest, [...parts.images, image]));
					inputRef.current?.focus();
				}}
			/>
			<DiacriticBar className="min-w-0 flex-1 px-0 pb-0 sm:justify-start" />
		</>
	);
}
