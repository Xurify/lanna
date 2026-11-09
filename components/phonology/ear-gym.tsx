"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, RepeatIcon, SnailIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { readOrigin } from "@/components/origin";
import { EmptyState } from "@/components/quiet/empty-state";
import { QIcon } from "@/components/quiet/icon";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { KBD } from "@/components/ui/learn-buttons";
import { COLUMN, Dock, endEnterBlocked, EnterHint, onFocusedControl, PracticeCard, PRIMARY, SECONDARY, TaskBar, TaskEnd, TaskFrame, VerdictDisc } from "@/components/task-frame";
import { sfx } from "@/components/lesson/sound";
import { SourcesNote } from "@/components/sources/sources-note";
import { speak, stopSpeaking } from "@/components/speech";
import { contrastSpans, earGymRound, getPhonologyData, getPhonologyPairs, hasRhythmPage, praiseFor, type EarGymExercise, type PhonologyFamily } from "@/src/core";
import { RhythmicVisualizer } from "./rhythmic-visualizer";

type View = "pairs" | "rhythm";
type FamilyChoice = PhonologyFamily | "all";
type Answer = string | null;
type Span = [start: number, end: number];
type TileState = "idle" | "right" | "wrong";
type Outcome = "right" | "miss" | "now" | "ahead";

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
	{ id: "pairs", label: "Pairs" },
	{ id: "rhythm", label: "Rhythm" },
];

interface Side {
	word: string;
	meaning: string;
	ipa: string;
	span: Span | null;
}

interface Playing {
	word: string;
	hidden: boolean;
}

function sides(trial: EarGymExercise): [Side, Side] {
	const target = { word: trial.targetWord, meaning: trial.targetMeaning, ipa: trial.targetIpa };
	const other = { word: trial.distractorWord, meaning: trial.distractorMeaning, ipa: trial.distractorIpa };
	const [a, b] = trial.targetMember === "a" ? [target, other] : [other, target];
	const spans = contrastSpans({ a: a.word, b: b.word, contrast: trial.contrast });
	return [
		{ ...a, span: spans?.a ?? null },
		{ ...b, span: spans?.b ?? null },
	];
}

export function EarGym({ seed, languageId, languageName, languageCode }: { seed: number; languageId: string; languageName: string; languageCode: string }) {
	const router = useRouter();
	const hasRhythm = hasRhythmPage(languageId);
	const dataset = getPhonologyData(languageId);

	const [view, setView] = useState<View>("pairs");
	const [family, setFamily] = useState<FamilyChoice>("all");
	const [round, setRound] = useState(0);
	const [index, setIndex] = useState(0);
	const [answers, setAnswers] = useState<Answer[]>([]);
	const [playing, setPlaying] = useState<Playing | null>(null);
	const playSeq = useRef(0);

	const contrasts = dataset?.families ?? [];
	const menu: ReadonlyArray<{ value: FamilyChoice; label: string }> = [{ value: "all", label: "All contrasts" }, ...contrasts.map((f) => ({ value: f.id, label: f.label }))];
	const familyLabel = (id: PhonologyFamily): string => contrasts.find((f) => f.id === id)?.label ?? id;

	const trials = useMemo(() => earGymRound(getPhonologyPairs(languageId, family === "all" ? {} : { family }), seed + round), [languageId, family, seed, round]);

	const total = trials.length;
	const trial = trials[index] ?? null;
	const answered = answers.length > index;
	const finished = total > 0 && index >= total;

	const play = (word: string, hidden: boolean, gender: "female" | "male", slow = false) => {
		const seq = ++playSeq.current;
		setPlaying({ word, hidden });
		void speak(word, undefined, { gender, slow })
			.catch(() => {})
			.finally(() => {
				if (playSeq.current === seq) setPlaying(null);
			});
	};

	useEffect(() => {
		if (view !== "pairs" || !trial || answered) return;
		const seq = ++playSeq.current;
		setPlaying({ word: trial.targetWord, hidden: true });
		void speak(trial.targetWord, undefined, { gender: trial.genderPrompt })
			.catch(() => {})
			.finally(() => {
				if (playSeq.current === seq) setPlaying(null);
			});
		return () => stopSpeaking();
	}, [view, trial, answered]);

	const startRound = (next: FamilyChoice = family) => {
		setFamily(next);
		setRound((r) => r + 1);
		setIndex(0);
		setAnswers([]);
	};

	const replay = (slow = false) => {
		if (trial) play(trial.targetWord, true, trial.genderPrompt, slow);
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
				if (answered) play(word, false, trial.genderPrompt);
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

	const switcher = hasRhythm ? <ViewSwitch view={view} onChange={setView} /> : undefined;

	if (!dataset || dataset.pairs.length === 0) {
		return (
			<TaskFrame strip={false}>
				<TaskBar>{switcher}</TaskBar>
				<div className={cn(COLUMN, "pt-[8vh]")}>
					<EmptyState
						testid="ear-gym-no-pairs"
						title={`No pairs for ${languageName} yet`}
						action={
							<Link href="/" className="q-btn primary">
								Go to Today
							</Link>
						}
					>
						<p>The ear gym has pairs for some languages only.</p>
					</EmptyState>
				</div>
			</TaskFrame>
		);
	}

	if (hasRhythm && view === "rhythm") {
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
				<RoundEnd trials={trials} answers={answers} contrasts={family === "all" ? contrasts : []} onAgain={() => startRound()} onTrain={(id) => startRound(id)} langCode={languageCode} />
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
	const praise = praiseFor(languageCode, index);
	const heardRight = answers.filter((a, i) => a === trials[i]?.targetWord).length;

	return (
		<TaskFrame strip={false}>
			<TaskBar>
				{switcher}
				<div
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={total}
					aria-valuenow={answers.length}
					aria-label={`${answers.length} of ${total} pairs answered, ${heardRight} heard right`}
					className="flex min-w-0 flex-1 items-center gap-[3px]"
					data-testid="ear-gym-strip"
				>
					{trials.map((t, i) => (
						<Pip key={i} className="flex-1" outcome={i < answers.length ? (answers[i] === t.targetWord ? "right" : "miss") : i === index ? "now" : "ahead"} />
					))}
				</div>
				<span className="font-ui text-[12.5px] font-[450] tabular-nums text-ink-3" data-testid="task-count">
					{index + 1}/{total}
				</span>
			</TaskBar>

			<div className="flex flex-1 flex-col overflow-y-auto" data-testid="ear-gym">
				<div className="min-h-6 flex-[2]" />
				<div key={`${round}:${index}`} className={cn(COLUMN, "lh-rise shrink-0")}>
					<PracticeCard
						icon="ear"
						title="Ear gym"
						right={<ChoiceMenu value={family} options={menu} onChange={(next) => startRound(next as FamilyChoice)} ariaLabel="Contrast" className="w-52 [&>button]:h-8 [&>button]:text-[13px]" />}
					>
						<div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
							<button
								type="button"
								onClick={() => replay()}
								aria-label="Play the word"
								className="lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-sun-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2"
								data-testid="ear-gym-play"
								data-playing={playing?.hidden ? "" : undefined}
							>
								<SoundIcon on={!!playing?.hidden} className="size-6" />
							</button>
							<div>
								<h2 className="font-prose text-[19px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[22px]">
									{!answered ? "Which word was it?" : right ? <span lang={praise.lang}>{praise.text}</span> : "Not this time"}
								</h2>
								<p className="mt-1 font-ui text-[13px] text-ink-3" data-testid="ear-gym-contrast">
									{familyLabel(trial.family) === trial.contrast ? trial.contrast : `${familyLabel(trial.family)} · ${trial.contrast}`}
								</p>
							</div>
							<button
								type="button"
								onClick={() => replay(true)}
								aria-label="Play slowly"
								title="Play slowly"
								className="lh-press col-start-2 flex h-11 shrink-0 items-center justify-center gap-2 justify-self-start rounded-xl bg-teal-wash px-3.5 text-[13px] font-[550] text-teal-2 hover:bg-well-2 sm:col-start-auto"
							>
								<SnailIcon className="size-5" strokeWidth={1.6} />
								Slowly
							</button>
						</div>

						<div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
							{sides(trial).map((side, i) => (
								<WordTile
									key={side.word}
									n={i + 1}
									side={side}
									answered={answered}
									sounding={!!playing && !playing.hidden && playing.word === side.word}
									state={!answered ? "idle" : side.word === trial.targetWord ? "right" : side.word === picked ? "wrong" : "idle"}
									langCode={languageCode}
									onClick={() => (answered ? play(side.word, false, trial.genderPrompt) : answer(side.word))}
								/>
							))}
						</div>

						<div className="mt-4 flex min-h-[4.75rem] items-center sm:min-h-[3.25rem]" data-testid="ear-gym-cue">
							{answered ? (
								<p className="lh-rise font-prose text-[15px] leading-relaxed text-ink-2">{trial.cue}</p>
							) : (
								<p className="font-ui text-[13px] leading-relaxed text-ink-3">The underlined letters are where the two words differ. After you pick, each word plays when you tap it.</p>
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
										It said <span lang={languageCode}>{trial.targetWord}</span>
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
		<div className="q-segc shrink-0 pointer-coarse:[&>button]:h-10" role="group" aria-label="View">
			{VIEWS.map((v) => (
				<button key={v.id} type="button" aria-pressed={view === v.id} className={cn(view === v.id && "on")} onClick={() => onChange(v.id)}>
					{v.label}
				</button>
			))}
		</div>
	);
}

function Pip({ outcome, className }: { outcome: Outcome; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"h-1.5 rounded-full transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none",
				outcome === "right" && "bg-teal",
				outcome === "miss" && "shadow-[inset_0_0_0_1.5px_var(--q-miss)]",
				outcome === "now" && "bg-teal-line",
				outcome === "ahead" && "bg-well-2",
				className,
			)}
		/>
	);
}

function SoundIcon({ on, className }: { on: boolean; className?: string }) {
	const layer = "col-start-1 row-start-1 size-full transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";
	const shown = "scale-100 opacity-100 blur-none";
	const gone = "scale-[0.25] opacity-0 blur-[4px]";
	return (
		<span className={cn("grid shrink-0 place-items-center", className)} aria-hidden="true">
			<Volume2Icon className={cn(layer, on ? gone : shown)} strokeWidth={1.6} />
			<QIcon name="listen" className={cn(layer, on ? shown : gone)} />
		</span>
	);
}

function Marked({ word, span, state }: { word: string; span: Span | null; state: TileState }) {
	if (!span) return <>{word}</>;
	return (
		<>
			{word.slice(0, span[0])}
			<span className={cn("underline decoration-[0.07em] underline-offset-[0.17em]", state === "right" ? "decoration-teal" : state === "wrong" ? "decoration-miss" : "decoration-[var(--q-ink-4)]")}>{word.slice(span[0], span[1])}</span>
			{word.slice(span[1])}
		</>
	);
}

function WordTile({ n, side, state, answered, sounding, langCode, onClick }: { n: number; side: Side; state: TileState; answered: boolean; sounding: boolean; langCode: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={answered ? `Play ${side.word}` : `${side.word}: ${side.meaning}`}
			data-testid={`ear-gym-option-${n}`}
			data-state={state}
			className={cn(
				"lh-press relative flex items-center gap-4 rounded-xl bg-card p-4 text-start shadow-[0_0_0_1px_var(--q-line-2),0_1px_2px_rgb(var(--q-shadow-rgb)/0.05)] sm:min-h-[9.25rem] sm:flex-col sm:items-start sm:justify-between sm:gap-5 sm:p-5",
				state === "idle" && "hover:bg-well",
				state === "right" && "bg-teal-wash shadow-[inset_0_0_0_1.5px_var(--q-teal)]",
				state === "wrong" && "bg-miss-soft shadow-[inset_0_0_0_1.5px_var(--q-miss)]",
			)}
		>
			<span className="q-kbd shrink-0 justify-center">{n}</span>
			<span className="block min-w-0 flex-1 sm:flex-none">
				<span className={cn("block font-prose text-[28px] font-semibold leading-none tracking-[-0.03em] sm:text-[40px]", state === "right" ? "text-teal-2" : state === "wrong" ? "text-miss" : "text-foreground")} lang={langCode}>
					<Marked word={side.word} span={side.span} state={state} />
				</span>
				<span className="mt-2.5 block font-ui text-[13.5px] leading-snug text-ink-3">
					{side.meaning}
					<span className={cn("ms-2 hidden whitespace-nowrap sm:inline", !answered && "sm:invisible")}>[{side.ipa}]</span>
				</span>
			</span>
			<SoundIcon on={sounding} className={cn("size-[18px] text-ink-3 sm:absolute sm:end-5 sm:top-5", !answered && "invisible")} />
		</button>
	);
}

function HearWord({ side, gender, langCode }: { side: Side; gender: "female" | "male"; langCode: string }) {
	return (
		<button type="button" onClick={() => void speak(side.word, undefined, { gender }).catch(() => {})} aria-label={`Play ${side.word}`} className={cn(SECONDARY, "h-10 gap-2.5 pointer-coarse:h-11")}>
			<Volume2Icon className="size-4 text-ink-3" strokeWidth={1.6} />
			<span className="font-prose text-[16px] font-semibold" lang={langCode}>
				<Marked word={side.word} span={side.span} state="idle" />
			</span>
			<span className="font-normal text-ink-3">[{side.ipa}]</span>
		</button>
	);
}

interface Heard {
	trial: EarGymExercise;
	answer: Answer;
}

function heardRight(h: Heard): boolean {
	return h.answer === h.trial.targetWord;
}

function RoundEnd({
	trials,
	answers,
	contrasts,
	onAgain,
	onTrain,
	langCode,
}: {
	trials: EarGymExercise[];
	answers: Answer[];
	contrasts: ReadonlyArray<{ id: string; label: string }>;
	onAgain: () => void;
	onTrain: (family: PhonologyFamily) => void;
	langCode: string;
}) {
	const heard: Heard[] = trials.map((trial, i) => ({ trial, answer: answers[i] ?? null }));
	const missed = heard.filter((h) => !heardRight(h));
	const right = heard.filter(heardRight);
	const byContrast = contrasts
		.map((c) => {
			const own = heard.filter((h) => h.trial.family === c.id);
			return { ...c, results: own.map(heardRight), right: own.filter(heardRight).length };
		})
		.filter((c) => c.results.length > 0)
		.sort((x, y) => x.right / x.results.length - y.right / y.results.length);
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
			<div className="mt-4 flex max-w-xs items-center gap-[3px]" aria-hidden="true">
				{heard.map((h, i) => (
					<Pip key={i} className="flex-1" outcome={heardRight(h) ? "right" : "miss"} />
				))}
			</div>
			<p className="q-sub !mt-3">Practice only: a round earns no XP and is not saved.</p>
			{byContrast.length > 1 && (
				<div className="mt-8" data-testid="ear-gym-by-contrast">
					<h2 className="q-sh">
						By contrast<small>Pick one to train it</small>
					</h2>
					<ul className="divide-y divide-[var(--q-line)]">
						{byContrast.map((c) => (
							<li key={c.id}>
								<button
									type="button"
									onClick={() => onTrain(c.id)}
									aria-label={`Train ${c.label}: ${c.right} of ${c.results.length} heard right`}
									className="group -mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-4 rounded-lg px-2 py-2.5 text-start transition-colors duration-150 hover:bg-well motion-reduce:transition-none"
								>
									<span className="min-w-0 flex-1 font-ui text-[14.5px] font-medium tracking-[-0.006em] text-foreground">{c.label}</span>
									<span className="flex shrink-0 items-center gap-[3px]">
										{c.results.map((ok, i) => (
											<Pip key={i} className="w-4" outcome={ok ? "right" : "miss"} />
										))}
									</span>
									<span className="w-12 shrink-0 text-end font-ui text-[13px] tabular-nums text-ink-3">
										{c.right} of {c.results.length}
									</span>
									<QIcon name="chev" className="shrink-0 text-ink-4 group-hover:text-ink-2" />
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			{missed.length > 0 && (
				<div className="mt-8">
					<h2 className="q-sh">Missed</h2>
					<HeardRows rows={missed} langCode={langCode} />
				</div>
			)}
			{right.length > 0 && (
				<details className="group mt-6" data-testid="ear-gym-right">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 font-ui text-[13px] font-[550] text-ink-3 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
						<ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden="true" />
						Heard right · {right.length} {right.length === 1 ? "pair" : "pairs"}
					</summary>
					<HeardRows rows={right} langCode={langCode} />
				</details>
			)}
			<SourcesNote feature="ear-gym" className="mt-14" />
		</TaskEnd>
	);
}

function HeardRows({ rows, langCode }: { rows: Heard[]; langCode: string }) {
	return (
		<ul className="divide-y divide-[var(--q-line)]">
			{rows.map(({ trial, answer }, i) => (
				<li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
					<div className="flex flex-wrap gap-2">
						{sides(trial).map((side) => (
							<HearWord key={side.word} side={side} gender={trial.genderPrompt} langCode={langCode} />
						))}
					</div>
					<p className="font-ui text-[12.5px] text-ink-3">
						It said{" "}
						<span className="font-medium text-ink-2" lang={langCode}>
							{trial.targetWord}
						</span>
						{answer === trial.targetWord ? null : answer ? (
							<>
								{" "}
								· you chose{" "}
								<span className="font-medium text-miss" lang={langCode}>
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
