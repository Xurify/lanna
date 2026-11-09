"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, RepeatIcon, SnailIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { readOrigin } from "@/components/origin";
import { EmptyState } from "@/components/quiet/empty-state";
import { QIcon } from "@/components/quiet/icon";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { KBD } from "@/components/ui/learn-buttons";
import { COLUMN, Dock, endEnterBlocked, EnterHint, onFocusedControl, OptionTile, PracticeCard, PRIMARY, SECONDARY, TaskBar, TaskEnd, TaskFrame, TaskTop, VerdictDisc } from "@/components/task-frame";
import { sfx } from "@/components/lesson/sound";
import { SourcesNote } from "@/components/sources/sources-note";
import { speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { earGymRound, getPhonologyPairs, praiseFor, type EarGymExercise, type PhonologyFamily } from "@/src/core";
import { RhythmicVisualizer } from "./rhythmic-visualizer";

type View = "pairs" | "rhythm";
type FamilyChoice = PhonologyFamily | "all";
type Answer = string | null;

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
	{ id: "pairs", label: "Pairs" },
	{ id: "rhythm", label: "Rhythm" },
];

const FAMILIES: ReadonlyArray<{ value: FamilyChoice; label: string }> = [
	{ value: "all", label: "All contrasts" },
	{ value: "vowel_length", label: "Vowel length" },
	{ value: "palatals", label: "Soft consonants" },
	{ value: "syllabic_liquids", label: "Syllabic r and l" },
	{ value: "diphthongs", label: "Diphthongs" },
	{ value: "voicing", label: "Voicing" },
];

function familyLabel(family: PhonologyFamily): string {
	return FAMILIES.find((f) => f.value === family)?.label ?? family;
}

interface Side {
	word: string;
	meaning: string;
	ipa: string;
}

function hear(word: string) {
	void speak(word).catch(() => {});
}

function sides(trial: EarGymExercise): [Side, Side] {
	const target = { word: trial.targetWord, meaning: trial.targetMeaning, ipa: trial.targetIpa };
	const other = { word: trial.distractorWord, meaning: trial.distractorMeaning, ipa: trial.distractorIpa };
	return trial.targetMember === "a" ? [target, other] : [other, target];
}

export function EarGym({ seed }: { seed: number }) {
	const router = useRouter();
	const lang = useActiveLanguage();
	const [view, setView] = useState<View>("pairs");
	const [family, setFamily] = useState<FamilyChoice>("all");
	const [round, setRound] = useState(0);
	const [index, setIndex] = useState(0);
	const [answers, setAnswers] = useState<Answer[]>([]);

	const trials = useMemo(() => earGymRound(getPhonologyPairs(family === "all" ? {} : { family }), seed + round), [family, seed, round]);
	const total = trials.length;
	const trial = trials[index] ?? null;
	const answered = answers.length > index;
	const finished = total > 0 && index >= total;

	useEffect(() => {
		if (view !== "pairs" || !trial || answered) return;
		void speak(trial.targetWord).catch(() => {});
		return () => stopSpeaking();
	}, [view, trial, answered]);

	const startRound = (next: FamilyChoice = family) => {
		setFamily(next);
		setRound((r) => r + 1);
		setIndex(0);
		setAnswers([]);
	};

	const replay = (slow = false) => {
		if (trial) void speak(trial.targetWord, undefined, { slow }).catch(() => {});
	};

	const answer = (word: Answer) => {
		if (!trial || answered) return;
		if (word === trial.targetWord) sfx.right(1);
		else sfx.wrong();
		setAnswers((all) => [...all, word]);
	};

	const advance = () => {
		if (!answered) return;
		if (index + 1 >= total) sfx.done();
		setIndex((i) => i + 1);
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.repeat) return;
			if (e.key === "Escape") {
				router.push(readOrigin());
				return;
			}
			if (view !== "pairs") return;
			if (finished) {
				if (e.key === "Enter" && !endEnterBlocked(e)) {
					e.preventDefault();
					router.push("/");
				}
				return;
			}
			if (!trial) return;
			if (e.key === "1" || e.key === "2") {
				e.preventDefault();
				const word = sides(trial)[e.key === "1" ? 0 : 1].word;
				if (answered) hear(word);
				else answer(word);
				return;
			}
			if (answered) {
				const onTile = e.target instanceof Element && !!e.target.closest("[data-testid^='ear-gym-option-']");
				if (e.key === "Enter" && (onTile || !onFocusedControl(e))) {
					e.preventDefault();
					advance();
				}
				return;
			}
			if (e.key === " " && !onFocusedControl(e)) {
				e.preventDefault();
				replay();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const switcher = <ViewSwitch view={view} onChange={setView} />;

	if (view === "rhythm") {
		return (
			<TaskFrame strip={false}>
				<TaskBar>{switcher}</TaskBar>
				<div className="flex-1 overflow-y-auto pb-16 pt-[4vh]">
					<div className={cn(COLUMN, "q-rise")}>
						<RhythmicVisualizer />
					</div>
				</div>
			</TaskFrame>
		);
	}

	if (finished) {
		return (
			<TaskFrame>
				<RoundEnd trials={trials} answers={answers} onAgain={() => startRound()} />
			</TaskFrame>
		);
	}

	if (!trial) {
		return (
			<TaskFrame strip={false}>
				<TaskBar>{switcher}</TaskBar>
				<div className={cn(COLUMN, "pt-[8vh]")}>
					<EmptyState
						testid="ear-gym-empty"
						title="No pairs for this contrast yet"
						action={
							<button type="button" onClick={() => startRound("all")} className="q-btn primary">
								Practice all contrasts
							</button>
						}
					>
						<p>The ear gym plays one word of a pair and asks which one it was. This contrast has no pairs to play.</p>
					</EmptyState>
				</div>
			</TaskFrame>
		);
	}

	const picked = answered ? answers[index] : undefined;
	const right = picked === trial.targetWord;
	const praise = praiseFor(lang?.code, index);

	return (
		<TaskFrame strip={false}>
			<TaskTop lead={switcher} progress={(index + (answered ? 1 : 0)) / total} label={`${index} of ${total} pairs heard`} count={`${index + 1}/${total}`} />

			<div className="flex flex-1 flex-col overflow-y-auto" data-testid="ear-gym">
				<div className="min-h-6 flex-[2]" />
				<div key={`${round}:${index}`} className={cn(COLUMN, "lh-rise shrink-0")}>
					<PracticeCard
						icon="ear"
						title="Ear gym"
						right={<ChoiceMenu value={family} options={FAMILIES} onChange={(next) => startRound(next as FamilyChoice)} ariaLabel="Contrast" className="w-44 [&>button]:h-8 [&>button]:text-[13px]" />}
					>
						<div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
							<button
								type="button"
								onClick={() => replay()}
								aria-label="Play the word"
								className="lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-sun-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2"
								data-testid="ear-gym-play"
							>
								<Volume2Icon className="size-6" strokeWidth={1.6} />
							</button>
							<div>
								<h2 className="font-prose text-[19px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[22px]">
									{!answered ? "Which word was it?" : right ? <span lang={praise.lang}>{praise.text}</span> : "Not this time"}
								</h2>
								<p className="mt-1 font-ui text-[13px] text-ink-3" data-testid="ear-gym-contrast">
									{familyLabel(trial.family)} · {trial.contrast}
								</p>
							</div>
							<button
								type="button"
								onClick={() => replay(true)}
								aria-label="Play slowly"
								title="Play slowly"
								className="col-start-2 flex h-11 shrink-0 items-center justify-center gap-2 justify-self-start rounded-xl bg-teal-wash px-3.5 text-[13px] font-[550] text-teal-2 transition-colors hover:bg-well-2 sm:col-start-auto"
							>
								<SnailIcon className="size-5" strokeWidth={1.6} />
								Slowly
							</button>
						</div>

						<div className="mt-6 grid grid-cols-2 gap-3">
							{sides(trial).map((side, i) => (
								<OptionTile
									key={side.word}
									n={i + 1}
									onClick={() => (answered ? hear(side.word) : answer(side.word))}
									state={!answered ? "idle" : side.word === trial.targetWord ? "right" : side.word === picked ? "wrong" : "idle"}
									testId={`ear-gym-option-${i + 1}`}
									trail={<Volume2Icon className={cn("size-4 opacity-70", !answered && "invisible")} strokeWidth={1.6} aria-hidden="true" />}
								>
									<span className="block">
										<span lang={lang?.code}>{side.word}</span>
										{answered && <span className="ml-2 hidden font-ui text-[13px] font-normal tracking-normal text-ink-3 sm:inline">[{side.ipa}]</span>}
									</span>
									<span className="block font-ui text-[13px] font-normal tracking-normal text-ink-3">{side.meaning}</span>
								</OptionTile>
							))}
						</div>

						<div className="mt-4 flex min-h-[4.75rem] items-center sm:min-h-[3.25rem]" data-testid="ear-gym-cue">
							{answered ? (
								<p className="lh-rise font-prose text-[15px] leading-relaxed text-ink-2">{trial.cue}</p>
							) : (
								<p className="font-ui text-[13px] leading-relaxed text-ink-3">Listen first, then pick. After that, each word plays when you tap it.</p>
							)}
						</div>
					</PracticeCard>
				</div>
				<div className="min-h-8 flex-[3]" />
			</div>

			<Dock tone={!answered ? "plain" : right ? "right" : "miss"} live>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					{answered ? (
						<>
							<p className={cn("flex items-center gap-2.5 font-ui text-[15px] font-[600] tracking-[-0.01em]", right ? "text-teal-2" : "text-miss")} data-testid="ear-gym-verdict">
								<VerdictDisc ok={right} />
								{right ? (
									"Heard right"
								) : (
									<span>
										It said <span lang={lang?.code}>{trial.targetWord}</span>
									</span>
								)}
							</p>
							<div className="flex items-center gap-4">
								<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 sm:pointer-fine:flex">
									<kbd className={KBD}>1</kbd>
									<kbd className={KBD}>2</kbd> play each word
								</p>
								<button type="button" onClick={advance} className={PRIMARY} data-testid="ear-gym-continue" autoFocus>
									{index + 1 >= total ? "Finish" : "Continue"}
									<span className="q-kbd">
										<QIcon name="enter" />
									</span>
								</button>
							</div>
						</>
					) : (
						<>
							<button type="button" onClick={() => answer(null)} className={SECONDARY} data-testid="ear-gym-cannot-tell">
								I can&apos;t tell
							</button>
							<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 sm:pointer-fine:flex">
								<kbd className={KBD}>Space</kbd> plays it again
							</p>
						</>
					)}
				</div>
			</Dock>
		</TaskFrame>
	);
}

function ViewSwitch({ view, onChange }: { view: View; onChange: (next: View) => void }) {
	return (
		<div className="q-segc shrink-0" role="group" aria-label="View">
			{VIEWS.map((v) => (
				<button key={v.id} type="button" aria-pressed={view === v.id} className={cn(view === v.id && "on")} onClick={() => onChange(v.id)}>
					{v.label}
				</button>
			))}
		</div>
	);
}

function HearWord({ side }: { side: Side }) {
	const lang = useActiveLanguage();
	return (
		<button type="button" onClick={() => hear(side.word)} aria-label={`Play ${side.word}`} className={cn(SECONDARY, "h-10 gap-2.5 pointer-coarse:h-11")}>
			<Volume2Icon className="size-4 text-ink-3" strokeWidth={1.6} />
			<span className="font-prose text-[16px] font-semibold" lang={lang?.code}>
				{side.word}
			</span>
			<span className="font-normal text-ink-3">[{side.ipa}]</span>
		</button>
	);
}

interface Heard {
	trial: EarGymExercise;
	answer: Answer;
}

function RoundEnd({ trials, answers, onAgain }: { trials: EarGymExercise[]; answers: Answer[]; onAgain: () => void }) {
	const heard: Heard[] = trials.map((trial, i) => ({ trial, answer: answers[i] ?? null }));
	const missed = heard.filter((h) => h.answer !== h.trial.targetWord);
	const right = heard.filter((h) => h.answer === h.trial.targetWord);
	return (
		<TaskEnd
			testId="ear-gym-end"
			hint={<EnterHint>for Today</EnterHint>}
			actions={
				<>
					<button type="button" onClick={onAgain} className={SECONDARY} data-testid="ear-gym-again">
						<RepeatIcon className="size-4" />
						Another round
					</button>
					<Link href="/" className={PRIMARY} data-testid="ear-gym-today">
						Today
					</Link>
				</>
			}
		>
			<p className="q-date flex items-center gap-1.5">
				<QIcon name="ear" className="text-teal" />
				Ear gym · done
			</p>
			<h1 className="q-hello">
				{right.length} of {heard.length} heard right
			</h1>
			<p className="q-line dim mt-2">Practice only: a round earns no XP and is not saved.</p>
			{missed.length > 0 && (
				<div className="mt-8">
					<h2 className="q-sh">Missed</h2>
					<HeardRows rows={missed} />
				</div>
			)}
			{right.length > 0 && (
				<details className="group mt-6" data-testid="ear-gym-right">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 font-ui text-[13px] font-[550] text-ink-3 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
						<ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden="true" />
						Heard right · {right.length} {right.length === 1 ? "pair" : "pairs"}
					</summary>
					<HeardRows rows={right} />
				</details>
			)}
			<SourcesNote feature="ear-gym" className="mt-14" />
		</TaskEnd>
	);
}

function HeardRows({ rows }: { rows: Heard[] }) {
	const lang = useActiveLanguage();
	return (
		<ul className="mt-2 divide-y divide-[var(--q-line)]">
			{rows.map(({ trial, answer }, i) => (
				<li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
					<div className="flex flex-wrap gap-2">
						{sides(trial).map((side) => (
							<HearWord key={side.word} side={side} />
						))}
					</div>
					<p className="font-ui text-[12.5px] text-ink-3">
						It said{" "}
						<span className="font-medium text-ink-2" lang={lang?.code}>
							{trial.targetWord}
						</span>
						{answer === trial.targetWord ? null : answer ? (
							<>
								{" "}
								· you chose{" "}
								<span className="font-medium text-miss" lang={lang?.code}>
									{answer}
								</span>
							</>
						) : (
							" · you could not tell"
						)}
					</p>
				</li>
			))}
		</ul>
	);
}
