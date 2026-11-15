"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpIcon } from "lucide-react";
import { DictationBar, joinDictation, useDictation } from "@/components/dictation";
import { DiacriticBar } from "@/components/diacritic-bar";
import { ChatPdfButton, DraftPdfChips } from "@/components/chat-pdf-button";
import { joinDraft, splitDraft } from "@/src/core";
import { Arrow, Box, Figure, Line, Loop, Note, Patch, Sheet } from "@/components/lesson/ink";
import { SidebarToggle } from "@/components/sidebar";
import { cn } from "@/lib/utils";

const IDEAS = ["Explain the cases with a drawing", "This, that and that over there", "The past tense", "How do I say that I like something?"];

export type ChatStarterTopic = { title: string; accuracy: number };
export type ChatStarterRecent = { id: string; title: string; when: string };

function DeskSketch() {
	return (
		<Sheet viewBox="0 0 340 132" className="h-auto w-full max-w-[340px]">
			<Line from={[14, 104]} to={[326, 104]} seed={1} tone="soft" />
			<Figure x={70} ground={104} seed={10} reach="right" />
			<Box x={170} y={52} width={92} height={52} seed={20} tone="soft" delay={0.3} />
			<Line from={[180, 66]} to={[232, 66]} seed={21} tone="soft" delay={0.4} />
			<Line from={[180, 78]} to={[250, 78]} seed={22} tone="soft" delay={0.45} />
			<Patch cx={222} cy={90} rx={24} ry={7} seed={30} delay={0.6} />
			<Line from={[200, 90]} to={[244, 90]} seed={23} delay={0.65} />
			<Arrow from={[100, 60]} to={[164, 72]} seed={40} bend={-14} delay={0.8} />
			<Loop cx={292} cy={44} rx={16} seed={50} tone="soft" delay={1} />
			<Note x={292} y={50} tone="mark" delay={1.1}>
				?
			</Note>
		</Sheet>
	);
}

function Starter({ children, onPick, detail }: { children: ReactNode; onPick: () => void; detail?: string }) {
	return (
		<button
			type="button"
			onClick={onPick}
			className="lh-press group flex w-full items-baseline justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-well"
		>
			<span className="font-ui text-[15px] text-foreground">{children}</span>
			{detail && <span className="shrink-0 font-ui text-xs tabular-nums text-muted-foreground">{detail}</span>}
		</button>
	);
}

export function ChatDraft({
	busy,
	text,
	onChange,
	onSend,
	language,
	setupCta,
	weakTopics = [],
	recent = [],
}: {
	busy: boolean;
	text: string;
	onChange: (v: string) => void;
	onSend: () => void;
	language: string;
	setupCta?: ReactNode;
	weakTopics?: readonly ChatStarterTopic[];
	recent?: readonly ChatStarterRecent[];
}) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const dictation = useDictation({ append: (t) => onChange(joinDictation(text, t)) });
	const canSend = !busy && (text.trim().length > 0 || dictation.active);
	const draft = splitDraft(text);
	const send = () => {
		if (!canSend) return;
		if (dictation.active) {
			void dictation.finish().then(onSend);
			return;
		}
		onSend();
	};
	const pick = (question: string) => {
		onChange(question);
		inputRef.current?.focus();
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
				<div className="mx-auto flex w-full max-w-[44rem] flex-col px-6 pt-16 pb-20 max-sm:px-4 max-sm:pt-14">
					<DeskSketch />
					<h1 className="mt-6 font-ui text-4xl leading-tight font-semibold tracking-[-0.025em] text-foreground max-sm:text-3xl">What's on your mind?</h1>
					<p className="mt-3 max-w-xl text-base leading-relaxed text-ink-2">
						A {language} word you keep forgetting, a sentence you got wrong, a rule that won’t stick.
					</p>

					<div data-testid="composer" className="mt-8 rounded-2xl border border-line-2 bg-card transition-colors focus-within:border-ink-3">
						<DraftPdfChips pdfs={draft.pdfs} onRemove={(pdf) => onChange(joinDraft(draft.pdfs.filter((p) => p !== pdf), draft.rest))} className="px-4 pt-3" />
						<textarea
							ref={inputRef}
							value={draft.rest}
							rows={2}
							onChange={(e) => onChange(joinDraft(draft.pdfs, e.target.value))}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
									e.preventDefault();
									send();
								}
								if (e.key === "Escape" && dictation.active) dictation.cancel();
							}}
							placeholder="Paste it or describe it"
							aria-label="Ask your tutor"
							className="block max-h-60 min-h-20 w-full resize-none bg-transparent px-5 pt-4 font-ui text-lg leading-snug text-foreground outline-none [field-sizing:content] placeholder:text-ink-4"
						/>
						<div className="flex items-center gap-2 px-3 pb-3">
							<DictationBar dictation={dictation} />
							<ChatPdfButton
								onAttached={(pdf) => {
									onChange(joinDraft([...draft.pdfs, pdf], draft.rest));
									inputRef.current?.focus();
								}}
							/>
							<span className="flex-1" />
							{setupCta}
							<span className="hidden font-ui text-xs text-muted-foreground pointer-fine:inline">Enter to ask</span>
							<button
								type="button"
								onClick={send}
								disabled={!canSend}
								aria-label="Ask"
								className={cn("lh-press flex size-9 items-center justify-center rounded-full transition-colors", canSend ? "bg-sun text-sun-ink" : "bg-well text-ink-4")}
							>
								<ArrowUpIcon className="size-4" />
							</button>
						</div>
					</div>
					<div className="mt-2">
						<DiacriticBar />
					</div>

					<div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2" data-testid="draft-suggestions">
						<section>
							<h2 className="px-3 font-ui text-xs font-semibold text-muted-foreground">{weakTopics.length > 0 ? "From your mistakes" : "Try one of these"}</h2>
							<div className="mt-1.5 flex flex-col">
								{weakTopics.length > 0
									? weakTopics.map((t) => (
											<Starter key={t.title} detail={`${Math.round(t.accuracy * 100)}% right`} onPick={() => pick(`Help me with ${t.title}: why do I get it wrong?`)}>
												{t.title}
											</Starter>
										))
									: IDEAS.map((idea) => (
											<Starter key={idea} onPick={() => pick(idea)}>
												{idea}
											</Starter>
										))}
							</div>
						</section>
						{recent.length > 0 ? (
							<section>
								<h2 className="px-3 font-ui text-xs font-semibold text-muted-foreground">Pick up again</h2>
								<div className="mt-1.5 flex flex-col">
									{recent.map((r) => (
										<Link key={r.id} href={`/chat/${r.id}`} className="flex items-baseline justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-well">
											<span className="truncate font-ui text-[15px] text-foreground">{r.title}</span>
											<span className="shrink-0 font-ui text-xs text-muted-foreground" suppressHydrationWarning>{r.when}</span>
										</Link>
									))}
								</div>
							</section>
						) : (
							weakTopics.length > 0 && (
								<section>
									<h2 className="px-3 font-ui text-xs font-semibold text-muted-foreground">Or try</h2>
									<div className="mt-1.5 flex flex-col">
										{IDEAS.slice(0, 3).map((idea) => (
											<Starter key={idea} onPick={() => pick(idea)}>
												{idea}
											</Starter>
										))}
									</div>
								</section>
							)
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
