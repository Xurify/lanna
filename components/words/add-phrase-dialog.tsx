"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { useActiveLanguage } from "@/components/speech";
import { Button } from "@/components/ui/button";

export type PhraseDraft = { text: string; translation: string; context: string };

export function AddPhraseDialog({
	onClose,
	onSave,
}: {
	onClose: () => void;
	/** Resolves false when the phrase could not be saved, so the dialog stays open with the draft. */
	onSave: (draft: PhraseDraft) => Promise<boolean>;
}) {
	const language = useActiveLanguage()?.english ?? "the language you are learning";
	const [draft, setDraft] = useState<PhraseDraft>({ text: "", translation: "", context: "" });
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const dismiss = useBackdropDismiss(() => {
		if (!busy) onClose();
	});

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopImmediatePropagation();
			onClose();
		};
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [onClose]);

	const empty = draft.text.trim() === "";
	const field = (key: keyof PhraseDraft) => ({
		value: draft[key],
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value })),
	});

	return createPortal(
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100"
			{...dismiss}
		>
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby="add-phrase-title"
				data-testid="add-phrase-dialog"
				className="flex max-h-[calc(100dvh-2rem)] w-[28rem] max-w-full flex-col overflow-y-auto rounded-xl bg-card p-6 shadow-raise-hi animate-in zoom-in-95 duration-150"
				onSubmit={(e) => {
					e.preventDefault();
					if (empty || busy) return;
					setBusy(true);
					setFailed(false);
					void onSave(draft).then((saved) => {
						setBusy(false);
						if (!saved) setFailed(true);
					});
				}}
			>
				<div className="flex items-start justify-between gap-3">
					<h2 id="add-phrase-title" className="text-base font-semibold text-foreground">
						Add a phrase
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="-mr-1.5 -mt-1.5 rounded-md p-2.5 text-ink-3 hover:bg-well hover:text-foreground"
					>
						<XIcon className="size-4" />
					</button>
				</div>

				<label htmlFor="add-phrase-text" className="mt-4 text-[13px] font-[550] text-ink-2">
					Phrase in {language}
				</label>
				<input
					id="add-phrase-text"
					type="text"
					required
					autoFocus
					{...field("text")}
					className="q-field mt-1.5 h-10 w-full px-3 text-[15px]"
				/>

				<label htmlFor="add-phrase-translation" className="mt-4 text-[13px] font-[550] text-ink-2">
					English translation <span className="font-normal text-ink-3">(optional)</span>
				</label>
				<input
					id="add-phrase-translation"
					type="text"
					{...field("translation")}
					className="q-field mt-1.5 h-10 w-full px-3 text-[15px]"
				/>

				<label htmlFor="add-phrase-context" className="mt-4 text-[13px] font-[550] text-ink-2">
					Context or note <span className="font-normal text-ink-3">(optional)</span>
				</label>
				<input
					id="add-phrase-context"
					type="text"
					placeholder="Where you heard it, or when to use it"
					{...field("context")}
					className="q-field mt-1.5 h-10 w-full px-3 text-[15px]"
				/>

				{failed && (
					<p role="alert" className="mt-4 rounded-lg bg-miss-soft px-3.5 py-2.5 text-sm text-foreground">
						The phrase was not saved. Try again.
					</p>
				)}

				<div className="mt-6 flex flex-wrap items-center justify-end gap-3">
					<Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button type="submit" size="sm" disabled={empty || busy} data-testid="add-phrase-save">
						{busy ? "Saving…" : "Save phrase"}
					</Button>
				</div>
			</form>
		</div>,
		document.body,
	);
}
