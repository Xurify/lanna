"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLUMN, PracticeCard } from "@/components/task-frame";
import { speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { IntroDock, StageDots } from "@/components/lesson/lesson-intro";
import { PictureBox } from "@/components/lesson/rep-panel";
import { pictureFor, unitInfo, type LessonPlan, type LessonWord } from "@/src/core";

/**
 * Meet the words: before the first rep of a new vocabulary lesson, one card
 * per word the lesson asks, with its picture or meaning and its sound.
 * Nothing here is graded; the reps that follow test each word in a sentence.
 */
export function WordIntro({
	plan,
	words,
	onStart,
}: {
	plan: LessonPlan;
	words: readonly LessonWord[];
	onStart: () => void;
}) {
	const [step, setStep] = useState(0);
	const lang = useActiveLanguage();
	const word = words[step]!;
	const last = words.length - 1;
	const finished = step === last;
	const picture = pictureFor(plan.unit, word.lemma);
	const meta = word.gender?.replace(/-/g, " ") ?? "";

	const intro = word.intro;
	const sentence = intro ? `${intro.before}${intro.word}${intro.after}` : "";
	const playing = useRef(0);
	const say = () => {
		if (!lang) return;
		const id = ++playing.current;
		void speak(word.lemma, lang)
			.then(() => (sentence && playing.current === id ? speak(sentence, lang) : undefined))
			.catch(() => {});
	};
	useEffect(() => {
		say();
		return () => {
			playing.current++;
			stopSpeaking();
		};
	}, [lang, word.lemma, sentence]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				if (e.target instanceof HTMLButtonElement) return;
				e.preventDefault();
				if (finished) onStart();
				else setStep(step + 1);
				return;
			}
			if (e.key === "ArrowRight" && step < last) setStep(step + 1);
			if (e.key === "ArrowLeft" && step > 0) setStep(step - 1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [finished, last, onStart, step]);

	return (
		<>
			<div className={cn(COLUMN, "lanna-rise flex flex-1 flex-col")}>
				<PracticeCard
					icon="words"
					title={unitInfo(plan.unit).title}
					sub="New words"
					right={`${step + 1} of ${words.length}`}
				>
					<figure key={word.lemma} className="lanna-rise flex flex-col items-center" data-testid="meet-word">
						{picture ? (
							<PictureBox picture={picture} label={word.gloss} className="aspect-[4/3] w-full max-w-[22rem]" />
						) : (
							<div
								className="flex aspect-[4/3] w-full max-w-[22rem] items-center justify-center rounded-[14px] bg-well px-6 text-center font-prose text-[26px] font-medium tracking-[-0.015em] text-ink-2"
								data-testid="meet-meaning"
							>
								{word.gloss}
							</div>
						)}
						<div className="mt-6 flex items-center gap-3">
							<p
								className="font-prose text-[40px] font-semibold leading-none tracking-[-0.03em] text-foreground"
								lang={lang?.code}
							>
								{word.lemma}
							</p>
							<button
								type="button"
								onClick={say}
								aria-label={`Play ${word.lemma}`}
								className="lanna-press inline-flex size-10 items-center justify-center rounded-full bg-well text-ink-2 hover:bg-well-2"
							>
								<Volume2Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
							</button>
						</div>
						<p className="mt-2 min-h-5 font-ui text-[13px] text-ink-3">
							{picture ? word.gloss : ""}
							{picture && meta ? " · " : ""}
							{meta}
						</p>
						{intro && (
							<div className="mt-5 max-w-md text-center" data-testid="meet-sentence">
								<p className="font-prose text-[19px] leading-snug text-foreground" lang={lang?.code}>
									{intro.before}
									<b className="rounded-[4px] bg-[var(--q-teal-wash)] px-0.5 font-semibold text-teal-2">{intro.word}</b>
									{intro.after}
								</p>
								<p className="mt-1 font-prose text-[15px] text-ink-3">{intro.en}</p>
							</div>
						)}
					</figure>
					<div className="mt-6 flex justify-center">
						<StageDots step={step} count={words.length} onPick={setStep} />
					</div>
				</PracticeCard>
			</div>
			<IntroDock
				step={step}
				finished={finished}
				onBack={() => setStep(step - 1)}
				onNext={() => setStep(step + 1)}
				onStart={onStart}
			/>
		</>
	);
}
