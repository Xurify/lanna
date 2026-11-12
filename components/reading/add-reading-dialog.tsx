"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { useActiveLanguage } from "@/components/speech";
import { READING_DIFFICULTIES, type ReadingDifficulty } from "@/src/core";

export interface ReadingDraft {
	value: string;
	title: string;
	difficulty: ReadingDifficulty;
}

export const EMPTY_READING_DRAFT: ReadingDraft = { value: "", title: "", difficulty: "level" };

const SINGLE_LINK = /^https?:\/\/\S+$/i;

export function isSingleLink(value: string): boolean {
	return SINGLE_LINK.test(value.trim());
}

export function difficultyInfo(difficulty: ReadingDifficulty, language: string): { label: string; line: string } {
	if (difficulty === "harder") return { label: "A step up", line: `Retold in ${language} one level above yours. More new words, longer sentences.` };
	if (difficulty === "full") return { label: "Not simplified", line: `The whole text in ${language} as a native speaker would write it. Slow going with many words to tap, and the screen says how many you know.` };
	return { label: "My level", line: `Retold in ${language} with the words you know, in parts of a few minutes each. Easy enough to read without stopping.` };
}

export function AddReadingDialog({ initial, error, onClose, onSubmit }: { initial: ReadingDraft; error: string | null; onClose: () => void; onSubmit: (draft: ReadingDraft) => void }) {
	const language = useActiveLanguage()?.english ?? "the language you are learning";
	const [draft, setDraft] = useState<ReadingDraft>(initial);
	const dismiss = useBackdropDismiss(onClose);
	const isLink = isSingleLink(draft.value);
	const empty = draft.value.trim() === "";

	useEffect(() => {
		// Capture phase: the reader's own Escape handler leaves the page, and this dialog must close first.
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopImmediatePropagation();
			onClose();
		};
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [onClose]);

	return createPortal(
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100" {...dismiss}>
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby="add-reading-title"
				data-testid="add-reading-dialog"
				className="flex max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-y-auto rounded-xl bg-card p-5 shadow-raise-hi animate-in zoom-in-95 duration-150"
				onSubmit={(e) => {
					e.preventDefault();
					if (!empty) onSubmit(draft);
				}}
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 id="add-reading-title" className="text-base font-semibold text-foreground">
							Add something to read
						</h2>
						<p className="mt-1 text-[13px] leading-relaxed text-ink-3">An article, a newsletter, an email. The first part takes about a minute to write, then it is kept.</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 -mt-1.5 rounded-md p-2.5 text-ink-3 hover:bg-well hover:text-foreground">
						<XIcon className="size-4" />
					</button>
				</div>

				<label htmlFor="add-reading-input" className="mt-4 text-[13px] font-[550] text-ink-2">
					A link, or the text itself
				</label>
				<textarea
					id="add-reading-input"
					value={draft.value}
					onChange={(e) => setDraft({ ...draft, value: e.target.value })}
					rows={6}
					autoFocus
					className="q-field mt-1.5 w-full resize-none p-3 text-[14px] leading-relaxed"
					data-testid="add-reading-input"
				/>

				{!isLink && !empty && (
					<>
						<label htmlFor="add-reading-name" className="mt-3 text-[13px] font-[550] text-ink-2">
							Title (optional)
						</label>
						<input id="add-reading-name" type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="q-field mt-1.5 h-10 w-full px-3 text-[14px]" data-testid="add-reading-name" />
					</>
				)}

				<p id="add-reading-difficulty" className="mt-4 text-[13px] font-[550] text-ink-2">
					How hard
				</p>
				<div className="q-segc mt-1.5 self-start whitespace-nowrap" role="radiogroup" aria-labelledby="add-reading-difficulty">
					{READING_DIFFICULTIES.map((difficulty) => (
						<button key={difficulty} type="button" role="radio" aria-checked={draft.difficulty === difficulty} className={cn(draft.difficulty === difficulty && "on")} onClick={() => setDraft({ ...draft, difficulty })} data-testid={`add-reading-${difficulty}`}>
							{difficultyInfo(difficulty, language).label}
						</button>
					))}
				</div>
				<p className="mt-2 min-h-[2.75rem] text-[13px] leading-relaxed text-ink-3">{difficultyInfo(draft.difficulty, language).line}</p>

				{error && (
					<p role="alert" className="mt-2 text-[13px] text-[var(--q-miss)]" data-testid="add-reading-error">
						{error}
					</p>
				)}

				<div className="mt-4 flex items-center justify-end gap-2">
					<button type="button" onClick={onClose} className="q-btn ghost">
						Cancel
					</button>
					<button type="submit" disabled={empty} className="q-btn primary" data-testid="add-reading-submit">
						Add to my reading
					</button>
				</div>
			</form>
		</div>,
		document.body,
	);
}
