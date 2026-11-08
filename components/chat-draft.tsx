"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpIcon } from "lucide-react";
import { DictationBar, joinDictation, useDictation } from "@/components/dictation";
import { DiacriticBar } from "@/components/diacritic-bar";
import { InkBlot } from "@/components/ink-blot";
import { SidebarToggle } from "@/components/sidebar";
import { cn } from "@/lib/utils";

const IDEAS = ["Explain the cases with a drawing", "This, that and that over there", "The past tense", "How do I say that I like something?"];

export function ChatDraft({
	busy,
	text,
	onChange,
	onSend,
	language,
	setupCta,
}: {
	busy: boolean;
	text: string;
	onChange: (v: string) => void;
	onSend: () => void;
	language: string;
	setupCta?: ReactNode;
}) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const dictation = useDictation({ append: (t) => onChange(joinDictation(text, t)) });
	const canSend = !busy && (text.trim().length > 0 || dictation.active);
	const send = () => {
		if (!canSend) return;
		if (dictation.active) {
			void dictation.finish().then(onSend);
			return;
		}
		onSend();
	};
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<div className="relative flex h-dvh flex-col" data-testid="draft-surface">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-2">
				<div className="pointer-events-auto">
					<SidebarToggle />
				</div>
			</header>
			<main className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-[46rem] flex-col px-6 pt-[16vh] pb-16 max-sm:pt-20">
					<p className="flex items-center gap-2 font-ui text-sm text-muted-foreground">
						<InkBlot className="size-2.5 text-foreground" />
						Your {language} tutor
					</p>
					<h1 className="mt-5 font-ui text-5xl leading-[1.05] font-semibold tracking-[-0.03em] text-foreground max-sm:text-4xl">
						Ask, and it explains, draws and asks you back.
					</h1>
					<p className="mt-5 max-w-lg text-lg text-ink-2">A few lines at a time, a drawing when it helps, then one question for you.</p>

					<div className="mt-12" data-testid="composer">
						<textarea
							ref={inputRef}
							value={text}
							rows={1}
							onChange={(e) => onChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
									e.preventDefault();
									send();
								}
								if (e.key === "Escape" && dictation.active) dictation.cancel();
							}}
							placeholder="What do you want to understand?"
							aria-label="Ask your tutor"
							className="block max-h-60 w-full resize-none bg-transparent font-ui text-2xl leading-snug font-medium tracking-tight text-foreground outline-none [field-sizing:content] placeholder:text-ink-4"
						/>
						<div className="mt-3 border-b-[1.5px] border-dotted border-ink-3" />
						<div className="mt-3 flex min-h-10 items-center gap-3">
							<DictationBar dictation={dictation} />
							<span className="flex-1" />
							{setupCta}
							<span className="hidden font-ui text-xs text-muted-foreground pointer-fine:inline">Enter to ask</span>
							<button
								type="button"
								onClick={send}
								disabled={!canSend}
								aria-label="Ask"
								className={cn(
									"lh-press flex size-9 items-center justify-center rounded-full transition-colors",
									canSend ? "bg-foreground text-background" : "bg-well text-ink-4",
								)}
							>
								<ArrowUpIcon className="size-4" />
							</button>
						</div>
						<div className="mt-1">
							<DiacriticBar />
						</div>
					</div>

					<div className="mt-10 flex flex-wrap gap-2" data-testid="draft-suggestions">
						{IDEAS.map((idea) => (
							<button
								key={idea}
								type="button"
								onClick={() => {
									onChange(idea);
									inputRef.current?.focus();
								}}
								className="lh-press rounded-full border border-line-2 px-4 py-1.5 font-ui text-sm text-ink-2 transition-colors hover:bg-well hover:text-foreground"
							>
								{idea}
							</button>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
