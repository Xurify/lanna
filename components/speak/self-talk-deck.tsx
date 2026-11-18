"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, MicIcon, ShuffleIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskFrame } from "@/components/task-frame";
import { KBD, PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import { CapLabel } from "@/components/ui/cap-label";
import { SpeakHeader } from "@/components/speak/speak-header";
import { speak } from "@/components/speech";
import { SELF_TALK_CATEGORIES, SELF_TALK_PROMPTS, type SelfTalkPrompt } from "@/src/core";

export interface SelfTalkDeckProps {
	selected: string;
	onSelect: (id: string) => void;
	onStart: () => void;
	lang?: string;
	error: string | null;
}

const clockOf = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const categoryOf = (p: SelfTalkPrompt) => SELF_TALK_CATEGORIES.find((c) => c.id === p.category)?.label ?? "";
const CATEGORIES = SELF_TALK_CATEGORIES.filter((c) => SELF_TALK_PROMPTS.some((p) => p.category === c.id));

const CHIP =
	"lanna-press rounded-full px-3 py-1.5 font-ui text-[13px] font-[550] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const ROUND =
	"lanna-press flex size-10 items-center justify-center rounded-full bg-card text-ink-2 shadow-[0_0_0_1px_var(--q-line-2)] hover:bg-well hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function Frame({ lead, error, children }: { lead: string; error: string | null; children: React.ReactNode }) {
	return (
		<TaskFrame>
			<div className="@container flex flex-1 flex-col overflow-y-auto">
				<div className="mx-auto w-full max-w-5xl px-5 pt-[5vh] pb-12 @md:px-6">
					<SpeakHeader title="On your own" lead={lead} />
					{error && (
						<p
							className="mt-5 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss"
							role="alert"
							data-testid="self-talk-error"
						>
							{error}
						</p>
					)}
					{children}
				</div>
			</div>
		</TaskFrame>
	);
}

function Starters({ prompt, lang }: { prompt: SelfTalkPrompt; lang?: string }) {
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="Ways to begin">
			{prompt.starters.map((s) => (
				<li key={s.sk}>
					<button
						type="button"
						onClick={() => void speak(s.sk.replace(/…/g, "").trim()).catch(() => {})}
						title={s.en}
						aria-label={`Play: ${s.sk}, ${s.en}`}
						className="lanna-press inline-flex items-center gap-1.5 rounded-md bg-well px-2.5 py-1 text-left font-prose text-[14px] text-foreground transition-colors hover:bg-well-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						lang={lang}
					>
						<Volume2Icon className="size-3.5 text-teal-2" />
						{s.sk}
					</button>
				</li>
			))}
		</ul>
	);
}

export function SelfTalkDeck({ selected, onSelect, onStart, lang, error }: SelfTalkDeckProps) {
	const [category, setCategory] = useState<string | null>(null);
	const pool = category ? SELF_TALK_PROMPTS.filter((p) => p.category === category) : SELF_TALK_PROMPTS;
	const index = Math.max(
		0,
		pool.findIndex((p) => p.id === selected),
	);
	const prompt = pool[index] ?? pool[0]!;
	const [dealt, setDealt] = useState(0);

	const show = (next: SelfTalkPrompt | undefined) => {
		if (!next) return;
		onSelect(next.id);
		setDealt((d) => d + 1);
	};
	const shuffle = () => {
		const others = pool.filter((p) => p.id !== prompt.id);
		show(others[Math.floor(Math.random() * others.length)]);
	};

	return (
		<Frame lead="Draw a topic and talk until the clock reaches the goal. Nobody answers, nobody grades." error={error}>
			<div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Topics">
				{[{ id: null, label: "All topics" }, ...CATEGORIES].map((c) => {
					const on = category === c.id;
					return (
						<button
							key={c.id ?? "all"}
							type="button"
							aria-pressed={on}
							onClick={() => {
								setCategory(c.id);
								const first = c.id ? SELF_TALK_PROMPTS.find((p) => p.category === c.id) : SELF_TALK_PROMPTS[0];
								show(first);
							}}
							className={cn(CHIP, on ? "bg-foreground text-background" : "bg-well text-ink-2 hover:text-foreground")}
						>
							{c.label}
						</button>
					);
				})}
			</div>

			<div className="relative mx-auto mt-10 max-w-2xl">
				<div
					aria-hidden="true"
					className="absolute inset-0 translate-x-1 translate-y-3 rotate-[1.2deg] @md:translate-x-3 @md:rotate-[2.2deg] rounded-2xl bg-well/70 shadow-[0_0_0_1px_var(--q-line)]"
				/>
				<div
					aria-hidden="true"
					className="absolute inset-0 translate-x-0.5 translate-y-1.5 -rotate-[0.8deg] @md:translate-x-1.5 @md:-rotate-[1.4deg] rounded-2xl bg-well shadow-[0_0_0_1px_var(--q-line)]"
				/>
				<article
					key={`${prompt.id}-${dealt}`}
					className="speak-deal relative rounded-2xl bg-card p-6 shadow-[0_0_0_1px_var(--q-line-2),0_10px_30px_-18px_rgb(var(--q-shadow-rgb)/0.35)] @md:p-9"
					aria-label={prompt.title}
					data-testid="self-talk-sheet"
				>
					<p className="flex items-center justify-between font-ui text-[13px] font-[550] text-teal-2">
						<span>{categoryOf(prompt)}</span>
						<span className="tabular-nums text-ink-3">
							{index + 1} / {pool.length} · {prompt.level}
						</span>
					</p>
					<h2
						className="mt-3 font-prose text-[34px] leading-tight font-semibold tracking-[-0.015em] text-foreground @md:text-[40px]"
						lang={lang}
					>
						{prompt.title}
					</h2>
					<p className="mt-1 font-prose text-base text-ink-3">{prompt.titleEn}</p>
					<p className="mt-6 font-prose text-lg text-foreground" lang={lang}>
						{prompt.prompt}
					</p>
					<p className="mt-1 font-prose text-[14px] text-ink-3">{prompt.promptEn}</p>
					<div className="mt-6">
						<Starters prompt={prompt} lang={lang} />
					</div>
					<div className="mt-8 flex flex-wrap items-center gap-3">
						<button type="button" onClick={onStart} className={PRIMARY} data-testid="self-talk-start">
							<MicIcon className="size-4" />
							Talk for {clockOf(prompt.targetSec)}
							<kbd className={cn(KBD, "hidden bg-white/15 text-current shadow-none pointer-fine:inline-flex")}>
								Enter
							</kbd>
						</button>
						<button type="button" onClick={shuffle} className={SECONDARY} data-testid="self-talk-shuffle">
							<ShuffleIcon className="size-4" />
							<CapLabel>Another topic</CapLabel>
						</button>
						<span className="ml-auto flex gap-2">
							<button
								type="button"
								className={ROUND}
								onClick={() => show(pool[(index - 1 + pool.length) % pool.length])}
								aria-label="Previous topic"
							>
								<ChevronLeftIcon className="size-5" />
							</button>
							<button
								type="button"
								className={ROUND}
								onClick={() => show(pool[(index + 1) % pool.length])}
								aria-label="Next topic"
							>
								<ChevronRightIcon className="size-5" />
							</button>
						</span>
					</div>
				</article>
			</div>
			<p className="mt-10 text-center font-ui text-xs text-ink-3">
				The time you talk counts toward Speaking. With a speech-to-text key the app also listens for the words on the
				list.
			</p>
		</Frame>
	);
}
