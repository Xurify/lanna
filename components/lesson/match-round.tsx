"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { COLUMN, Dock, PracticeCard } from "@/components/task-frame";
import { KBD, PRIMARY, QUIET } from "@/components/ui/learn-buttons";
import { speak, useActiveLanguage } from "@/components/speech";
import { PictureBox } from "@/components/lesson/rep-panel";
import { sfx } from "@/components/lesson/sound";
import { pictureFor, rng, shuffle, unitInfo, type LessonWord, type UnitId } from "@/src/core";

const TILE =
	"lanna-press flex h-[4.5rem] w-full items-center justify-center rounded-[10px] bg-card px-3 py-2 text-center shadow-[0_0_0_1px_var(--q-line-2),0_1px_2px_rgb(var(--q-shadow-rgb)/0.05)] transition-colors";

/**
 * The lesson's last round: every word it taught, matched to its picture or
 * meaning. A quick recall of the whole set after the sentence reps, ungraded:
 * the lesson's score is already in.
 */
export function MatchRound({
	unit,
	words,
	seed,
	onDone,
}: {
	unit: UnitId;
	words: readonly LessonWord[];
	seed: number;
	onDone: () => void;
}) {
	const lang = useActiveLanguage();
	const { left, right } = useMemo(() => {
		const rand = rng(seed);
		return { left: shuffle(words, rand), right: shuffle(words, rand) };
	}, [seed, words]);
	const [picked, setPicked] = useState<string | null>(null);
	const [matched, setMatched] = useState<ReadonlySet<string>>(new Set());
	const [wrong, setWrong] = useState<string | null>(null);
	const [status, setStatus] = useState("");
	const done = matched.size === words.length;
	const wordButtons = useRef(new Map<string, HTMLButtonElement>());
	const finishButton = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!done) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			onDone();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [done, onDone]);

	const pickWord = (slug: string) => {
		if (matched.has(slug)) return;
		setPicked(slug);
		setWrong(null);
		const word = words.find((w) => w.slug === slug)!;
		if (lang) void speak(word.lemma, lang).catch(() => {});
	};
	const pickMeaning = (slug: string) => {
		if (!picked || matched.has(slug)) return;
		const word = words.find((w) => w.slug === picked)!;
		if (slug === picked) {
			sfx.right(matched.size + 1);
			const now = new Set([...matched, slug]);
			setMatched(now);
			// The matched button is disabled now, which would drop keyboard focus to the page.
			const next = left.find((w) => !now.has(w.slug));
			requestAnimationFrame(() =>
				(next ? wordButtons.current.get(next.slug) : finishButton.current)?.focus({ preventScroll: true }),
			);
			setPicked(null);
			setWrong(null);
			setStatus(`${word.lemma}: ${word.gloss}. Matched.`);
		} else {
			sfx.wrong();
			setWrong(slug);
			const clicked = words.find((w) => w.slug === slug)!;
			setStatus(`${clicked.gloss} is not ${word.lemma}. Try another.`);
		}
	};

	return (
		<>
			<div className={cn(COLUMN, "lanna-rise flex flex-1 flex-col")} data-testid="match-round">
				<PracticeCard
					icon="words"
					title={unitInfo(unit).title}
					sub="Match the words"
					right={`${matched.size} of ${words.length}`}
				>
					<div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:gap-x-8">
						<ul className="flex flex-col gap-2.5" aria-label="Words">
							{left.map((w) => (
								<li key={w.slug}>
									<button
										type="button"
										ref={(el) => {
											if (el) wordButtons.current.set(w.slug, el);
										}}
										onClick={() => pickWord(w.slug)}
										disabled={matched.has(w.slug)}
										aria-pressed={picked === w.slug}
										data-testid="match-word"
										className={cn(
											TILE,
											"font-prose text-[19px] font-medium text-foreground",
											picked === w.slug && "bg-well shadow-[inset_0_0_0_1.5px_var(--q-ink-3)]",
											matched.has(w.slug) && "bg-teal-wash text-teal-2 shadow-none",
										)}
										lang={lang?.code}
									>
										{w.lemma}
									</button>
								</li>
							))}
						</ul>
						<ul className="flex flex-col gap-2.5" aria-label="Meanings">
							{right.map((w) => {
								const picture = pictureFor(unit, w.lemma);
								return (
									<li key={w.slug}>
										<button
											type="button"
											onClick={() => pickMeaning(w.slug)}
											disabled={matched.has(w.slug) || !picked}
											aria-label={w.gloss}
											data-testid="match-meaning"
											className={cn(
												TILE,
												"font-prose text-[16px] text-ink-2",
												picture && "p-1",
												wrong === w.slug && "lanna-shake bg-miss-soft shadow-[inset_0_0_0_1.5px_var(--q-miss)]",
												matched.has(w.slug) && "bg-teal-wash text-teal-2 shadow-none",
											)}
										>
											{picture ? (
												<PictureBox
													picture={picture}
													label={w.gloss}
													className="h-full w-full bg-transparent [&_span]:max-w-none [&_span]:p-0"
												/>
											) : (
												w.gloss
											)}
										</button>
									</li>
								);
							})}
						</ul>
					</div>
					<p className="mt-5 min-h-5 font-ui text-[13px] text-ink-3">
						{done ? "All matched." : picked ? "Now its meaning." : "Pick a word, then its meaning."}
					</p>
					<p role="status" className="sr-only">
						{status}
					</p>
				</PracticeCard>
			</div>
			<Dock>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 pointer-fine:flex">
						{done && (
							<>
								<kbd className={KBD}>Enter</kbd> to finish
							</>
						)}
					</p>
					<div className="flex flex-1 justify-end gap-3">
						<button
							ref={finishButton}
							type="button"
							onClick={onDone}
							className={done ? PRIMARY : QUIET}
							data-testid="match-done"
						>
							{done ? "Finish" : "Skip"}
						</button>
					</div>
				</div>
			</Dock>
		</>
	);
}
