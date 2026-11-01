"use client";

/**
 * Listen (LangHarness, 2026-10-28) — the input task's screen. Ten real
 * sentences the learner can follow (src/core/listen.ts picks them at
 * 95–98% known words): each is played with the text hidden, then answered
 * one of two ways, chosen with the Pick / Type switch: pick what it meant
 * from three English meanings, or type the Slovak it said (dictation,
 * 2026-10-31). Then the Slovak appears with its one stretch word marked
 * and glossed. No grammar grading; understanding is the whole task.
 *
 * Full screen like a lesson (a focus mode; Escape leaves). Keys: 1–3 pick
 * a meaning, Space plays again, Enter checks a typed sentence or continues.
 * Space types a space when the answer field has focus. Audio comes from the
 * cached library (components/speech.tsx → /api/tts), so a sentence is
 * paid for once. The research the task rests on is in src/core/listen.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, EyeIcon, HeadphonesIcon, KeyboardIcon, RepeatIcon, SnailIcon, Volume2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveTime } from "@/components/use-active-time";
import { setSpeed, speak, SPEEDS, stopSpeaking } from "@/components/speech";
import { sfx, soundOn } from "@/components/lesson/sound";
import { DiacriticBar } from "@/components/diacritic-bar";
import { almostCount, judgeTyped, LISTEN_XP, listenXp, PEEK_AFTER_REPLAYS, understood, type ListenAnswer, type ListenItem, type ListenPlan, type ListenVerdict } from "@/src/core";

interface Rep {
	item: ListenItem;
	/** The meaning picked, or the Slovak typed. */
	given: string;
	answer: ListenAnswer;
	verdict: ListenVerdict;
	/** The text was shown before the meaning was picked. */
	peeked: boolean;
	/** Sentence shown (audio starts) → meaning picked, for the speed model
	 *  (src/core/milestones.ts). */
	ms: number;
	/** How long the first playback took, when it finished before the pick. */
	heardMs?: number;
	/** Plays after the first (the slow play counts). */
	replays: number;
}

interface Outcome {
	xp: number;
	correct: number;
	/** Typed, with only a missing accent (half XP). */
	almost: number;
	total: number;
	queued: string[];
	summary: { todayXp: number; dailyGoal: number; streak: { days: number } };
}

const COLUMN = "mx-auto w-full max-w-3xl px-6";
const BUTTON = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-ui text-base font-extrabold transition-[filter,transform,background-color] active:scale-[0.98]";
const PRIMARY = cn(BUTTON, "bg-go text-go-ink hover:brightness-110 disabled:cursor-not-allowed disabled:bg-accent disabled:text-muted-foreground disabled:hover:brightness-100 disabled:active:scale-100");
const SECONDARY = cn(BUTTON, "bg-foreground/10 px-5 text-foreground hover:bg-foreground/15");

const PRAISE = ["Rozumieš!", "Presne tak!", "Áno!", "Super!", "Výborne!"];
/** The learner's answer style, remembered in this browser. */
const ANSWER_KEY = "lh-listen-answer";

export function ListenPlayer({ initialPlan = null }: { initialPlan?: ListenPlan | null }) {
	const router = useRouter();
	const [plan, setPlan] = useState<ListenPlan | null>(initialPlan);
	const [error, setError] = useState<string | null>(null);
	const [index, setIndex] = useState(0);
	const [reps, setReps] = useState<Rep[]>([]);
	const [current, setCurrent] = useState<Rep | null>(null);
	const [peeked, setPeeked] = useState(false);
	// Pick a meaning (the default) or type the Slovak that was heard.
	const [answer, setAnswer] = useState<ListenAnswer>("pick");
	const [draft, setDraft] = useState("");
	// Replays of the current sentence (mirrors timing.current for the
	// render): the text can be shown only once it has been heard twice.
	const [replays, setReplays] = useState(0);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [saving, setSaving] = useState(false);
	const startedAt = useRef(Date.now());
	// Listening is mostly hearing, not clicking: the day's minutes count the
	// time this tab is visible and focused (`ms` stays the wall-clock).
	const activeTime = useActiveTime("listen", "passive");
	// Per-sentence timing: when it was shown, how long the first playback
	// took, how many times it was played again. The milestones page reads
	// these as parsing speed, so they travel with every rep.
	const timing = useRef<{ shownAt: number; heardMs?: number; replays: number }>({ shownAt: Date.now(), replays: 0 });
	const finishing = useRef(false);
	const loadSeq = useRef(0);

	const load = useCallback(async () => {
		const seq = ++loadSeq.current;
		setPlan(null);
		setError(null);
		setIndex(0);
		setReps([]);
		setCurrent(null);
		setPeeked(false);
		setOutcome(null);
		finishing.current = false;
		try {
			const res = await fetch("/api/listen");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const next = (await res.json()) as ListenPlan;
			if (seq !== loadSeq.current) return;
			if (next.items.length === 0) throw new Error("No sentences to listen to yet. Finish a lesson or two first.");
			setPlan(next);
			startedAt.current = Date.now();
			activeTime.restart();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [activeTime]);

	const hadInitial = useRef(initialPlan !== null);
	useEffect(() => {
		if (hadInitial.current) return;
		void load();
	}, [load]);

	// Read the saved answer style after mount, so the first paint matches the
	// server render (pick) and the switch never flickers.
	useEffect(() => {
		try {
			if (localStorage.getItem(ANSWER_KEY) === "type") setAnswer("type");
		} catch {
			// storage blocked — stays on pick
		}
	}, []);

	const chooseAnswer = (next: ListenAnswer) => {
		if (current || next === answer) return;
		setAnswer(next);
		setDraft("");
		try {
			localStorage.setItem(ANSWER_KEY, next);
		} catch {
			// not remembered
		}
	};

	const item = plan?.items[index] ?? null;
	const total = plan?.items.length ?? 0;
	// The answer style in use: the open rep's own, so a finished rep keeps its
	// look even if the switch is changed for the next one.
	const mode: ListenAnswer = current ? current.answer : answer;

	// Stop any active audio when leaving the Listen page
	useEffect(() => {
		return () => {
			stopSpeaking();
		};
	}, []);

	// Each sentence plays as it arrives: the ear meets it before the eye.
	useEffect(() => {
		if (!item || current) return;
		const t0 = Date.now();
		timing.current = { shownAt: t0, replays: 0 };
		setReplays(0);
		void speak(item.sentence)
			.then(() => {
				if (soundOn() && timing.current.shownAt === t0 && timing.current.heardMs === undefined) timing.current.heardMs = Date.now() - t0;
			})
			.catch(() => {});
		return () => {
			stopSpeaking();
		};
	}, [item, current]);

	const replay = (slow = false) => {
		if (!item) return;
		timing.current.replays++;
		setReplays(timing.current.replays);
		void (slow ? slowSpeak(item.sentence) : speak(item.sentence)).catch(() => {});
	};

	const finish = useCallback(
		async (all: Rep[]) => {
			if (finishing.current) return;
			finishing.current = true;
			setSaving(true);
			sfx.done();
			// Understood by ear only: a right answer with the text shown is not counted.
			const correct = understood(all);
			const almost = almostCount(all);
			try {
				const res = await fetch("/api/listen", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						reps: all.map((r) => ({
							itemId: r.item.id,
							slug: r.item.slug,
							lemma: r.item.lemma,
							gloss: r.item.gloss,
							sentence: r.item.sentence,
							translation: r.item.translation,
							given: r.given,
							answer: r.answer,
							// The server grades typed answers itself; this verdict is for picks.
							verdict: r.verdict,
							options: r.answer === "pick" ? r.item.options : undefined,
							stretch: r.item.stretch.map((w) => w.slug).filter((s): s is string => !!s),
							ms: r.ms,
							heardMs: r.heardMs,
							replays: r.replays,
							peeked: r.peeked,
							words: r.item.words,
						})),
						ms: Date.now() - startedAt.current,
						activeMs: activeTime.finish(),
						tz: new Date().getTimezoneOffset(),
					}),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setOutcome((await res.json()) as Outcome);
			} catch {
				setOutcome({ xp: listenXp(correct, all.length, almost), correct, almost, total: all.length, queued: [], summary: { todayXp: 0, dailyGoal: 50, streak: { days: 0 } } });
			} finally {
				setSaving(false);
			}
		},
		[activeTime],
	);

	/** Grade and show one answer. The time since the text was first shown
	 *  is the speed model's; the first playback's length is kept too. */
	const answerWith = (given: string, answerKind: ListenAnswer, verdict: ListenVerdict) => {
		if (!item || current) return;
		if (verdict === "exact") sfx.right(1);
		else if (verdict === "accents") sfx.almost();
		else sfx.wrong();
		const t = timing.current;
		setCurrent({ item, given, answer: answerKind, verdict, peeked, ms: Date.now() - t.shownAt, heardMs: t.heardMs, replays: t.replays });
	};

	const pick = (given: string) => {
		if (!item || current) return;
		answerWith(given, "pick", given === item.translation ? "exact" : "wrong");
	};

	/** A typed sentence: the same grading the server repeats (judgeTyped). */
	const submit = () => {
		const given = draft.trim();
		if (!item || current || !given) return;
		answerWith(given, "type", judgeTyped(given, item.sentence));
	};

	const advance = () => {
		if (!current) return;
		const all = [...reps, current];
		setReps(all);
		setCurrent(null);
		setPeeked(false);
		setDraft("");
		if (index + 1 >= total) void finish(all);
		else setIndex((i) => i + 1);
	};

	// Keys: Escape leaves, 1–3 pick, Space replays, Enter continues. While
	// the answer field has focus, only Escape and Enter reach the page: the
	// field needs Space for a space.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				router.push("/");
				return;
			}
			if (outcome) {
				if (e.key === "Enter") router.push("/");
				return;
			}
			if (!item) return;
			const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
			if (inField && !(e.key === "Enter" && current)) return;
			if (current && e.key === "Enter") {
				e.preventDefault();
				advance();
				return;
			}
			if (!current && e.key === " ") {
				e.preventDefault();
				replay();
				return;
			}
			if (!current && answer === "pick") {
				const n = Number(e.key);
				const opt = item.options[n - 1];
				if (opt) {
					e.preventDefault();
					pick(opt);
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (error) {
		return (
			<Frame>
				<div className="m-auto max-w-md text-center" data-testid="listen-error">
					<p className="font-prose text-lg text-foreground">{error}</p>
					<div className="mt-6 flex flex-wrap justify-center gap-3">
						<button type="button" onClick={() => void load()} className={PRIMARY}>
							Try again
						</button>
						<Link href="/" className={SECONDARY}>
							Today
						</Link>
					</div>
				</div>
			</Frame>
		);
	}

	if (!plan || !item) {
		return (
			<Frame>
				<div className="m-auto flex items-center gap-3 font-ui text-sm text-muted-foreground" data-testid="listen-loading">
					<HeadphonesIcon className="size-5 animate-pulse" />
					Choosing sentences you can follow…
				</div>
			</Frame>
		);
	}

	if (outcome) {
		return (
			<Frame>
				<EndScreen outcome={outcome} reps={reps} saving={saving} onAgain={() => void load()} />
			</Frame>
		);
	}

	const progress = (index + (current ? 1 : 0)) / total;
	const praise = PRAISE[index % PRAISE.length]!;

	return (
		<Frame strip={false}>
			{/* Top bar: exit · progress · count. The band drags the window. */}
			<div className="lh-drag lh-wco-gutter shrink-0 select-none">
				<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
					<Link href="/" aria-label="Leave" className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</Link>
					<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="relative h-3 flex-1 overflow-hidden rounded-full bg-accent" aria-label={`${index} of ${total} heard`}>
						<div className="h-full rounded-full bg-sky transition-[width] duration-500 ease-out" style={{ width: `${Math.max(3, progress * 100)}%` }} />
					</div>
					<span className="font-ui text-sm font-semibold tabular-nums text-muted-foreground" data-testid="listen-count">
						{index + 1}/{total}
					</span>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[9vh]">
				<div key={item.id} className={cn(COLUMN, "lh-rise")}>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="font-ui text-sm font-bold text-muted-foreground">
							Listen · {item.stretch.length === 0 ? "every word is yours" : item.stretch.length === 1 ? "one new word" : `${item.stretch.length} new words`}
						</p>
						<AnswerSwitch answer={answer} disabled={!!current} onChange={chooseAnswer} />
					</div>
					<h2 className="mb-6 mt-1 font-prose text-2xl font-semibold text-foreground">
						{!current ? (mode === "type" ? "Type what you hear" : "What does it mean?") : current.verdict === "exact" ? praise : current.verdict === "accents" ? "So close" : mode === "type" ? "It says…" : "It meant…"}
					</h2>

					{/* Hear it: the big play, the slow play, and the text behind a tap. */}
					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={() => replay()}
							aria-label="Play the sentence"
							className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-sky text-background transition-transform hover:scale-105 active:scale-95"
							data-testid="listen-play"
						>
							<Volume2Icon className="size-8" />
						</button>
						<button
							type="button"
							onClick={() => replay(true)}
							aria-label="Play slowly"
							title="Play slowly"
							className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky/15 text-sky transition-transform hover:scale-105"
						>
							<SnailIcon className="size-6" />
						</button>
						{/* The text, only after two listens, and it costs the sentence:
						    the ear has to try first (docs/research/desirable-difficulties.md). */}
						{!current && !peeked && (
							<button
								type="button"
								onClick={() => setPeeked(true)}
								disabled={replays < PEEK_AFTER_REPLAYS}
								title={replays < PEEK_AFTER_REPLAYS ? "Listen once more first" : "Show the text — this sentence then does not count as understood"}
								className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 font-ui text-sm font-bold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
								data-testid="listen-peek"
							>
								<EyeIcon className="size-4" />
								{replays < PEEK_AFTER_REPLAYS ? "Text · listen again first" : "Show the text · not counted"}
							</button>
						)}
					</div>

					{/* Type it: the Slovak as heard, graded letter by letter. The field is
					    the answer, so it is locked once checked. */}
					{mode === "type" && (
						<div className="mt-6">
							<input
								type="text"
								lang="sk"
								autoComplete="off"
								autoCapitalize="off"
								spellCheck={false}
								autoFocus
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										submit();
									}
								}}
								disabled={!!current}
								aria-label="Type the sentence you heard"
								placeholder="Type what you hear"
								className="w-full rounded-xl border-2 border-border bg-card px-4 py-3.5 font-prose text-[26px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-sky disabled:opacity-70"
								data-testid="listen-input"
							/>
							{!current && <DiacriticBar variant="keys" className="mt-4" />}
						</div>
					)}

					{/* The sentence: hidden until answered or peeked; then every word,
					    the stretch words marked and glossed. */}
					<div className="mt-6 min-h-[4.5rem]" data-testid="listen-sentence" data-word-lookup-enabled={current !== null || peeked ? "true" : "false"}>
						{current || peeked ? (
							<div className="lh-rise">
								<p className="font-prose text-[30px] leading-[1.6] text-foreground" lang="sk">
									<Marked sentence={item.sentence} stretch={item.stretch.map((w) => w.text)} />
								</p>
								{current?.answer === "type" && current.verdict !== "exact" && (
									<p className="mt-2 font-prose text-base text-muted-foreground" data-testid="listen-typed">
										You typed · <span lang="sk">{current.given}</span>
									</p>
								)}
								{item.stretch.length > 0 && (
									<ul className="mt-2 flex flex-wrap gap-2" aria-label="New words">
										{item.stretch.map((w) => (
											<li key={w.text} className="rounded-lg bg-xp/15 px-2.5 py-1 font-prose text-base text-foreground">
												<span className="font-bold" lang="sk">
													{w.lemma}
												</span>
												{w.gloss && <span className="text-muted-foreground"> · {w.gloss}</span>}
											</li>
										))}
									</ul>
								)}
								{current && (
									<p data-no-word-lookup="true" className="mt-3 font-prose text-lg text-muted-foreground" data-testid="listen-translation">
										{item.translation}
									</p>
								)}
							</div>
						) : (
							<p className="font-ui text-sm text-muted-foreground">Listen first. The text appears once you have {mode === "type" ? "typed what you heard" : "picked a meaning"}
								{peeked ? "" : replays < PEEK_AFTER_REPLAYS ? " (or after a second listen, at a price)" : ""}.</p>
						)}
					</div>

					{/* Three meanings, stacked (English runs long). Pick mode only. */}
					{mode === "pick" && (
					<div className="mt-6 grid gap-3" data-testid="listen-options">
						{item.options.map((o, i) => {
							const picked = current?.given === o;
							const right = !!current && o === item.translation;
							return (
								<button
									key={o}
									type="button"
									disabled={!!current}
									onClick={() => pick(o)}
									className={cn(
										"flex items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3.5 text-left font-prose text-xl text-foreground transition-colors",
										!current && "hover:border-foreground/40 hover:bg-accent",
										right && "border-go bg-go-soft",
										picked && !right && "border-miss bg-miss-soft",
										current && !right && !picked && "opacity-50",
									)}
								>
									<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-ui text-sm text-muted-foreground">{i + 1}</span>
									<span>{o}</span>
									{right && <CheckIcon className="ml-auto size-5 shrink-0 text-go" strokeWidth={3} />}
								</button>
							);
						})}
					</div>
					)}
				</div>
			</div>

			{/* One bar at the bottom: the hint and Check before, the verdict and Continue after. */}
			<div className={cn("border-t border-border", current && (current.verdict === "exact" ? "bg-go-soft" : current.verdict === "accents" ? "bg-warn-soft" : "bg-miss-soft"))}>
				<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
					{current ? (
						<>
							<p className={cn("font-ui text-lg font-extrabold", current.verdict === "exact" ? "text-go" : current.verdict === "accents" ? "text-warn" : "text-miss")} data-testid="listen-verdict">
								{current.verdict === "exact"
									? `Understood · +${LISTEN_XP} XP`
									: current.verdict === "accents"
										? `Almost · the letters are right, a mark is missing · +${Math.ceil(LISTEN_XP / 2)} XP`
										: mode === "type"
											? "Not quite"
											: "Not that one"}
							</p>
							<button
								type="button"
								onClick={advance}
								className={cn(BUTTON, current.verdict === "exact" ? "bg-go text-go-ink" : current.verdict === "accents" ? "bg-warn text-background" : "bg-miss text-background")}
								data-testid="listen-continue"
								autoFocus
							>
								{index + 1 >= total ? "Finish" : "Continue"}
							</button>
						</>
					) : mode === "type" ? (
						<>
							<p className="font-prose text-sm text-muted-foreground">
								<KeyboardIcon className="mr-1.5 inline size-4 align-[-2px]" aria-hidden="true" />
								Enter checks · the play button hears it again
							</p>
							<button type="button" onClick={submit} disabled={!draft.trim()} className={PRIMARY} data-testid="listen-check">
								Check
							</button>
						</>
					) : (
						<p className="font-prose text-sm text-muted-foreground">Pick a meaning, or press its number · Space plays it again</p>
					)}
				</div>
			</div>
		</Frame>
	);
}

/** The sentence with its stretch words marked. */
function Marked({ sentence, stretch }: { sentence: string; stretch: string[] }) {
	if (stretch.length === 0) return <>{sentence}</>;
	const set = new Set(stretch.map((s) => s.toLocaleLowerCase("sk-SK")));
	const parts = sentence.split(/(\p{L}+(?:[-'’]\p{L}+)*)/u);
	return (
		<>
			{parts.map((p, i) =>
				set.has(p.toLocaleLowerCase("sk-SK")) ? (
					<mark key={i} className="rounded-lg bg-xp/20 px-1 font-bold text-foreground underline decoration-xp decoration-[3px] underline-offset-[6px]">
						{p}
					</mark>
				) : (
					<span key={i}>{p}</span>
				),
			)}
		</>
	);
}

async function slowSpeak(text: string) {
	let previous = 1;
	try {
		previous = Number(localStorage.getItem("lh-tts-speed")) || 1;
	} catch {
		// storage blocked
	}
	setSpeed(SPEEDS[0]);
	await speak(text).catch(() => {});
	setSpeed(previous);
}

function Frame({ children, strip = true }: { children: React.ReactNode; strip?: boolean }) {
	return (
		<div className="fixed inset-0 z-40 flex flex-col bg-background">
			{strip && <div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
			{children}
		</div>
	);
}

function EndScreen({ outcome, reps, saving, onAgain }: { outcome: Outcome; reps: Rep[]; saving: boolean; onAgain: () => void }) {
	const words = reps.flatMap((r) => r.item.stretch).filter((w, i, all) => all.findIndex((x) => x.lemma === w.lemma) === i);
	// Missing an accent counts too: those sentences are worth hearing again.
	const missed = reps.filter((r) => r.verdict !== "exact");
	return (
		<div className={cn(COLUMN, "my-auto py-10")} data-testid="listen-end">
			<div className="flex items-center gap-4">
				<span className="flex size-16 items-center justify-center rounded-2xl bg-sky/15 text-sky">
					<HeadphonesIcon className="size-8" />
				</span>
				<div>
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Listen · done</p>
					<h1 className="font-ui text-3xl font-black text-foreground">
						{outcome.correct} of {outcome.total} understood by ear
					</h1>
					{outcome.almost > 0 && <p className="mt-1 font-ui text-sm text-warn">{outcome.almost} typed with only a missing accent (half XP)</p>}
				</div>
			</div>
			<div className="mt-6 flex flex-wrap gap-6 font-ui text-sm">
				<Stat label="XP" value={`+${outcome.xp}`} ink="text-xp" />
				<Stat label="New words met" value={String(words.length)} ink="text-sky" />
				<Stat label="In your deck" value={saving ? "…" : String(outcome.queued.length)} ink="text-go" />
			</div>
			{words.length > 0 && (
				<div className="mt-8">
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Words you met today</p>
					<ul className="mt-2 flex flex-wrap gap-2">
						{words.map((w) => (
							<li key={w.lemma} className="rounded-lg border border-border bg-card px-2.5 py-1 font-prose text-base">
								<span className="font-bold" lang="sk">
									{w.lemma}
								</span>
								{w.gloss && <span className="text-muted-foreground"> · {w.gloss}</span>}
							</li>
						))}
					</ul>
					<p className="mt-2 font-prose text-sm text-muted-foreground">They are in your review deck now, so you meet them again before you forget them.</p>
				</div>
			)}
			{missed.length > 0 && (
				<div className="mt-8">
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Worth hearing again</p>
					<ul className="mt-2 flex flex-col gap-2">
						{missed.map((r) => (
							<li key={r.item.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
								<button type="button" onClick={() => void speak(r.item.sentence)} aria-label="Play" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sky/20 text-sky hover:bg-sky/30">
									<Volume2Icon className="size-4" />
								</button>
								<div className="min-w-0">
									<p className="font-prose text-lg text-foreground" lang="sk">
										{r.item.sentence}
									</p>
									<p data-no-word-lookup="true" className="font-prose text-sm text-muted-foreground">{r.item.translation}</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
			<div className="mt-10 flex flex-wrap gap-3">
				<Link href="/" className={PRIMARY} data-testid="listen-today">
					Today
				</Link>
				<button type="button" onClick={onAgain} className={SECONDARY} data-testid="listen-again">
					<RepeatIcon className="size-4" />
					Ten more
				</button>
				<span className="self-center font-ui text-xs text-muted-foreground">Enter goes to Today</span>
			</div>
		</div>
	);
}

/** Pick a meaning or type the Slovak. A segmented control: the chosen style
 *  is filled and marked aria-pressed; locked while a sentence is open. */
function AnswerSwitch({ answer, disabled, onChange }: { answer: ListenAnswer; disabled: boolean; onChange: (next: ListenAnswer) => void }) {
	const options: { id: ListenAnswer; label: string; icon: typeof KeyboardIcon }[] = [
		{ id: "pick", label: "Pick a meaning", icon: CheckIcon },
		{ id: "type", label: "Type it", icon: KeyboardIcon },
	];
	return (
		<div role="group" aria-label="How to answer" className="inline-flex rounded-xl bg-accent p-1 font-ui text-sm font-bold" data-testid="listen-answer-switch">
			{options.map((o) => {
				const on = answer === o.id;
				const Icon = o.icon;
				return (
					<button
						key={o.id}
						type="button"
						disabled={disabled}
						aria-pressed={on}
						onClick={() => onChange(o.id)}
						className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 transition-colors disabled:cursor-not-allowed", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground", disabled && !on && "opacity-50")}
						data-testid={`listen-answer-${o.id}`}
					>
						<Icon className="size-4" aria-hidden="true" />
						{o.label}
					</button>
				);
			})}
		</div>
	);
}

function Stat({ label, value, ink }: { label: string; value: string; ink: string }) {
	return (
		<div>
			<p className="text-xs font-bold tracking-wide text-muted-foreground">{label}</p>
			<p className={cn("text-2xl font-black tabular-nums", ink)}>{value}</p>
		</div>
	);
}
