"use client";

/**
 * Listen (LangHarness, 2026-10-28) — the input task's screen. Ten real
 * sentences the learner can follow (src/core/listen.ts picks them: at most
 * one unknown word each): each is played with the text hidden, and the
 * Slovak it said is typed (dictation). Picking one of three meanings was
 * dropped on 2026-11-03: it was too easy at the owner's level and could not
 * say why a sentence was missed. Then the Slovak appears with its one
 * stretch word marked and glossed. No grammar grading. A right answer shows
 * the typing matched, not that the meaning was understood.
 *
 * Full screen like a lesson (a focus mode; Escape leaves). Keys: Space plays
 * again, Enter checks the typed sentence or continues.
 * Space types a space when the answer field has focus. Audio comes from the
 * cached library (components/speech.tsx → /api/tts), so a sentence is
 * paid for once. The research the task rests on is in src/core/listen.ts.
 */

import { EmptyState } from "@/components/quiet/empty-state";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, EyeIcon, HeadphonesIcon, RepeatIcon, SnailIcon, Volume2Icon } from "lucide-react";
import { readOrigin } from "@/components/origin";
import { QIcon } from "@/components/quiet/icon";
import { COLUMN, Dock, endEnterBlocked, EnterHint, NotSaved, PracticeCard, PRIMARY, SECONDARY, SentenceRow, SentenceRows, Stat, Stats, TaskEnd, TaskFrame as Frame, TaskTop, VerdictDisc } from "@/components/task-frame";
import { cn } from "@/lib/utils";
import { useActiveTime } from "@/components/use-active-time";
import { speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { sfx, soundOn } from "@/components/lesson/sound";
import { DiacriticBar } from "@/components/diacritic-bar";
import { almostCount, isWatchItem, judgeTyped, LISTEN_XP, listenXp, PEEK_AFTER_REPLAYS, praiseFor, understood, type ListenItem, type ListenPlan, type ListenVerdict } from "@/src/core";
import { SourcesNote } from "@/components/sources/sources-note";
import { newSessionId, sendSession } from "@/components/session-save";

interface Rep {
	item: ListenItem;
	/** The Slovak typed; empty when the learner did not catch it. */
	given: string;
	verdict: ListenVerdict;
	/** The text was shown before the answer. */
	peeked: boolean;
	/** Sentence shown (audio starts) → answer checked. */
	ms: number;
	/** How long the first playback took, when it finished before the answer; the
	 *  speed model reads it (src/server/milestones.ts). */
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
}


export function ListenPlayer({ initialPlan = null }: { initialPlan?: ListenPlan | null }) {
	const lang = useActiveLanguage();
	const router = useRouter();
	const [plan, setPlan] = useState<ListenPlan | null>(initialPlan);
	const [error, setError] = useState<string | null>(null);
	const [index, setIndex] = useState(0);
	const [reps, setReps] = useState<Rep[]>([]);
	const [current, setCurrent] = useState<Rep | null>(null);
	const [peeked, setPeeked] = useState(false);
	const [draft, setDraft] = useState("");
	// Replays of the current sentence (mirrors timing.current for the
	// render): the text can be shown only once it has been heard twice.
	const [replays, setReplays] = useState(0);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const lastSave = useRef<string | null>(null);
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
		setSaveFailed(false);
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

	const item = plan?.items[index] ?? null;
	const total = plan?.items.length ?? 0;

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
		void speak(item.sentence, undefined, { slow }).catch(() => {});
	};

	const finish = useCallback(
		async (all: Rep[]) => {
			if (finishing.current) return;
			finishing.current = true;
			setSaving(true);
			sfx.done();
			// A right answer with the text shown first is not counted.
			const correct = understood(all);
			const almost = almostCount(all);
			try {
				lastSave.current = JSON.stringify({
						clientId: newSessionId(),
						reps: all.map((r) => ({
							itemId: r.item.id,
							slug: r.item.slug,
							lemma: r.item.lemma,
							gloss: r.item.gloss,
							sentence: r.item.sentence,
							translation: r.item.translation,
							given: r.given,
							answer: "type",
							verdict: r.verdict,
							stretch: r.item.stretch.map((w) => w.slug).filter((s): s is string => !!s),
							ms: r.ms,
							heardMs: r.heardMs,
							replays: r.replays,
							peeked: r.peeked,
							words: r.item.words,
							stretchText: r.item.stretch.map((w) => w.text),
						})),
						ms: Date.now() - startedAt.current,
						activeMs: activeTime.finish(),
						tz: new Date().getTimezoneOffset(),
				});
				setOutcome(await sendSession<Outcome>("/api/listen", lastSave.current));
			} catch {
				setSaveFailed(true);
				setOutcome({ xp: listenXp(correct, all.length, almost), correct, almost, total: all.length, queued: [] });
			} finally {
				setSaving(false);
			}
		},
		[activeTime],
	);

	const retrySave = async () => {
		if (!lastSave.current || saving) return;
		setSaving(true);
		try {
			setOutcome(await sendSession<Outcome>("/api/listen", lastSave.current));
			setSaveFailed(false);
		} catch {
			setSaveFailed(true);
		} finally {
			setSaving(false);
		}
	};

	/** Grade and show one answer. The time since the text was first shown
	 *  is the speed model's; the first playback's length is kept too. */
	const answerWith = (given: string, verdict: ListenVerdict) => {
		if (!item || current) return;
		if (verdict === "exact") sfx.right(1);
		else if (verdict === "accents") sfx.almost();
		else sfx.wrong();
		const t = timing.current;
		setCurrent({ item, given, verdict, peeked, ms: Date.now() - t.shownAt, heardMs: t.heardMs, replays: t.replays });
	};

	/** A typed sentence: the same grading the server repeats (judgeTyped). */
	const submit = () => {
		const given = draft.trim();
		if (!item || current || !given) return;
		answerWith(given, judgeTyped(given, item.sentence));
	};

	/** Nothing was caught: a miss, without typing something random to get past it. */
	const giveUp = () => {
		if (!item || current) return;
		answerWith("", "wrong");
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

	// Keys: Escape leaves, Space replays, Enter continues. While
	// the answer field has focus, only Escape and Enter reach the page: the
	// field needs Space for a space.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// The Enter that sends a typed answer is already handled by the field. This listener is re-registered on every render, so it is new by the time that same keypress reaches the window with the answer in place, and it would "continue" at once: the sentence and the verdict never showed. A held key must not skip a sentence either.
			if (e.defaultPrevented || e.repeat) return;
			if (e.key === "Escape") {
				router.push(readOrigin());
				return;
			}
			if (outcome) {
				if (e.key === "Enter" && !endEnterBlocked(e)) {
					e.preventDefault();
					router.push("/");
				}
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
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (error) {
		return (
			<Frame>
				<div className="mx-auto w-full max-w-3xl px-6 pt-[8vh]">
					<EmptyState
						testid="listen-error"
						title={/yet/i.test(error) ? "Nothing to listen to yet" : "Listen could not start"}
						action={
							/yet/i.test(error) ? (
								<Link href="/" className="q-btn primary">
									Go to Today
								</Link>
							) : (
								<button type="button" onClick={() => void load()} className="q-btn primary">
									Try again
								</button>
							)
						}
						secondary={/yet/i.test(error) ? undefined : <Link href="/" className="q-btn ghost">Back to Today</Link>}
					>
						{/yet/i.test(error) ? (
							<>
								<p>Listen uses sentences built from words you have met, so it opens after your first lessons.</p>
								<p>It needs no AI key.</p>
							</>
						) : (
							<p>{error}</p>
						)}
					</EmptyState>
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
				<EndScreen outcome={outcome} reps={reps} saving={saving} failed={saveFailed} onAgain={() => void load()} onRetrySave={() => void retrySave()} />
			</Frame>
		);
	}

	const progress = (index + (current ? 1 : 0)) / total;
	const praise = praiseFor(lang?.code, index);
	const tone = !current ? "plain" : current.verdict === "wrong" ? "miss" : current.verdict === "exact" ? "right" : "wait";

	return (
		<Frame strip={false}>
			<TaskTop progress={progress} label={`${index} of ${total} heard`} count={`${index + 1}/${total}`} />

			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
				<div key={item.id} className={cn(COLUMN, "lh-rise")}>
					<PracticeCard
						icon="listen"
						title="Listen"
						sub={`Sentence ${index + 1} of ${total}`}
					>
						{item.source ? (
							<p className="mb-4 flex min-w-0 items-center gap-2 font-ui text-[13px] text-ink-3" data-testid="listen-source">
								<span className="q-pill shrink-0">From a video you watched</span>
								<span className="truncate" title={item.source.title}>
									{item.source.title}
								</span>
							</p>
						) : (
							<p className="mb-4 font-ui text-[13px] text-ink-3">{isWatchItem(item.id) ? "From a video you watched" : item.stretch.length === 0 ? "Every word is yours" : item.stretch.length === 1 ? "One new word" : `${item.stretch.length} new words`}</p>
						)}
						<h2 className="mb-5 font-prose text-[22px] font-semibold tracking-[-0.02em] text-foreground">
							{!current ? "Type what you hear" : current.verdict === "exact" ? <span lang={praise.lang}>{praise.text}</span> : current.verdict === "accents" ? "So close" : "It says…"}
						</h2>

						{/* Hear it: the big play, the slow play, and the text behind a tap. */}
						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={() => replay()}
								aria-label="Play the sentence"
								className="lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-sun-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2"
								data-testid="listen-play"
							>
								<Volume2Icon className="size-6" strokeWidth={1.6} />
							</button>
							<button
								type="button"
								onClick={() => replay(true)}
								aria-label="Play slowly"
								title="Play slowly"
								className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-wash px-3.5 text-[13px] font-[550] text-teal-2 transition-colors hover:bg-well-2"
							>
								<SnailIcon className="size-5" strokeWidth={1.6} />
								Slowly
							</button>
							{/* The text, only after two listens, and it costs the sentence:
							    the ear has to try first (docs/research/desirable-difficulties.md). */}
							{!current && !peeked && (
								<button
									type="button"
									onClick={() => setPeeked(true)}
									disabled={replays < PEEK_AFTER_REPLAYS}
									title={replays < PEEK_AFTER_REPLAYS ? "Listen once more first" : "Show the text — this sentence then does not count as typed correctly"}
									className="q-why-off ml-auto !mt-0"
									data-testid="listen-peek"
								>
									<span className={cn("w", replays >= PEEK_AFTER_REPLAYS && "!text-ink-2")}>
										<EyeIcon className="size-3.5" strokeWidth={1.6} />
										{replays < PEEK_AFTER_REPLAYS ? "Show the text · listen once more first" : "Show the text · not counted"}
									</span>
								</button>
							)}
						</div>

						{/* The Slovak as heard, graded letter by letter. The field is the
						    answer, so it is locked once checked. */}
						<div className="mt-6">
								<input
									type="text"
									lang={lang?.code}
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
									className="w-full rounded-lg bg-well px-4 py-3.5 font-prose text-[26px] font-[550] tracking-[-0.02em] text-foreground shadow-[inset_0_0_0_1.5px_var(--q-line-2)] outline-none transition-shadow placeholder:font-normal placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--q-teal)] disabled:opacity-70 dark:bg-background"
									data-testid="listen-input"
								/>
								{!current && <DiacriticBar variant="keys" className="mt-4" />}
						</div>

						{/* The sentence: hidden until answered or peeked; then every word,
						    the stretch words marked and glossed. */}
						<div className="mt-6 min-h-[4.5rem]" data-testid="listen-sentence" data-word-lookup-enabled={current !== null || peeked ? "true" : "false"}>
							{current || peeked ? (
								<div className="lh-rise">
									<p className="font-prose text-[30px] font-[550] leading-[1.4] tracking-[-0.025em] text-foreground" lang={lang?.code}>
										<Marked sentence={item.sentence} stretch={item.stretch.map((w) => w.text)} />
									</p>
									{current && current.verdict !== "exact" && (
										<p className="mt-2 font-prose text-base text-ink-3" data-testid="listen-typed">
											{current.given ? (
												<>
													You typed · <span lang={lang?.code}>{current.given}</span>
												</>
											) : (
												"Not caught"
											)}
										</p>
									)}
									{item.stretch.length > 0 && (
										<ul className="mt-3 flex flex-wrap gap-2" aria-label="New words">
											{item.stretch.map((w) => (
												<li key={w.text} className="q-ex">
													<u lang={lang?.code}>{w.lemma}</u>
													{w.gloss && <span className="ml-1.5 font-normal text-ink-3">· {w.gloss}</span>}
												</li>
											))}
										</ul>
									)}
									{current && item.translation && (
										<p data-no-word-lookup="true" className="mt-3 font-prose text-base text-ink-2" data-testid="listen-translation">
											{item.translation}
										</p>
									)}
								</div>
							) : (
								<p className="font-ui text-[13px] leading-relaxed text-ink-3">Listen first. The text appears once you have typed what you heard
									{peeked ? "" : replays < PEEK_AFTER_REPLAYS ? " (or after a second listen, at a price)" : ""}.</p>
							)}
						</div>

					</PracticeCard>
				</div>
			</div>

			{/* One bar at the bottom: the hint and Check before, the verdict and Continue after. */}
			<Dock tone={tone} live>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					{current ? (
						<>
							<p className={cn("flex items-center gap-2.5 font-ui text-[15px] font-[600] tracking-[-0.01em]", current.verdict === "exact" ? "text-teal-2" : current.verdict === "accents" ? "text-ink-2" : "text-miss")} data-testid="listen-verdict">
								<VerdictDisc ok={current.verdict !== "wrong"} />
								{current.verdict === "exact"
									? `Typed correctly · +${LISTEN_XP} XP`
									: current.verdict === "accents"
										? `Almost · only an accent is missing · +${Math.ceil(LISTEN_XP / 2)} XP`
										: current.given
											? "Not quite"
											: "Not caught this time"}
							</p>
							<button type="button" onClick={advance} className={PRIMARY} data-testid="listen-continue" autoFocus>
								{index + 1 >= total ? "Finish" : "Continue"}
								<span className="q-kbd">
									<QIcon name="enter" />
								</span>
							</button>
						</>
					) : (
						<>
							<button type="button" onClick={giveUp} className={SECONDARY} data-testid="listen-give-up">
								I didn&apos;t catch it
							</button>
							<button type="button" onClick={submit} disabled={!draft.trim()} className={PRIMARY} data-testid="listen-check">
								Check
								<span className="q-kbd">
									<QIcon name="enter" />
								</span>
							</button>
						</>
					)}
				</div>
			</Dock>
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
					<mark key={i} className="bg-transparent px-0 font-semibold text-teal-2 underline decoration-teal decoration-2 underline-offset-[6px]">
						{p}
					</mark>
				) : (
					<span key={i}>{p}</span>
				),
			)}
		</>
	);
}

function EndScreen({ outcome, reps, saving, failed, onAgain, onRetrySave }: { outcome: Outcome; reps: Rep[]; saving: boolean; failed: boolean; onAgain: () => void; onRetrySave: () => void }) {
	const lang = useActiveLanguage();
	const words = reps.flatMap((r) => r.item.stretch).filter((w, i, all) => all.findIndex((x) => x.lemma === w.lemma) === i);
	// Missing an accent counts too: those sentences are worth hearing again.
	const missed = reps.filter((r) => r.verdict !== "exact");
	// The ones that went right are kept out of sight until asked for, but never lost: the sentence you got right is one you may want to see too.
	const understood = reps.filter((r) => r.verdict === "exact");
	return (
		<TaskEnd
			testId="listen-end"
			hint={failed ? <NotSaved onRetry={onRetrySave} busy={saving} /> : <EnterHint>for Today</EnterHint>}
			actions={
				<>
					<button type="button" onClick={onAgain} className={SECONDARY} data-testid="listen-again">
						<RepeatIcon className="size-4" />
						Ten more
					</button>
					<Link href="/" className={PRIMARY} data-testid="listen-today">
						Today
					</Link>
				</>
			}
		>
			<p className="q-date flex items-center gap-1.5">
				<QIcon name="listen" className="text-teal" />
				Listen · done
			</p>
			<h1 className="q-hello">
				{outcome.correct} of {outcome.total} typed correctly, without the text
			</h1>
			{outcome.almost > 0 && <p className="q-line dim mt-2">{outcome.almost} typed with only a missing accent (half XP)</p>}
			<Stats className="mt-7 max-w-none">
				<Stat label="XP" value={saving ? null : failed ? "Not saved" : `+${outcome.xp}`} ink={failed ? "text-ink-3" : "text-teal-2"} />
				<Stat label="New words met" value={String(words.length)} />
				<Stat label="Added to Review" value={saving ? null : failed ? "Not saved" : outcome.queued.length ? `${outcome.queued.length} ${outcome.queued.length === 1 ? "word" : "words"}` : "None"} ink={failed ? "text-ink-3" : undefined} />
			</Stats>
			<Link href="/mistakes#mistakes-listening" className="mt-3 inline-block font-ui text-[13px] font-[550] text-ink-3 underline decoration-[var(--q-line-2)] underline-offset-[3px] hover:text-ink-2" data-testid="listen-trends">
				How your listening is going
			</Link>
			{words.length > 0 && (
				<div className="mt-8">
					<h2 className="q-sh">Words you met today</h2>
					<ul className="mt-2 flex flex-wrap gap-2">
						{words.map((w) => (
							<li key={w.lemma} className="rounded-md bg-well px-2.5 py-1 font-prose text-[14px]">
									<span className="font-[600] text-teal-2" lang={lang?.code}>
									{w.lemma}
								</span>
								{w.gloss && <span className="text-ink-3"> · {w.gloss}</span>}
							</li>
						))}
					</ul>
					{!failed && <p className="mt-2 font-prose text-sm text-ink-3">They are in Review now, so you meet them again before you forget them.</p>}
				</div>
			)}
			{missed.length > 0 && (
				<div className="mt-8">
					<h2 className="q-sh">Missed</h2>
					<ListenRows reps={missed} />
				</div>
			)}
			{understood.length > 0 && (
				<details className="group mt-6" data-testid="listen-understood">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 font-ui text-[13px] font-[550] text-ink-3 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
						<ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden="true" />
						Typed correctly · {understood.length} {understood.length === 1 ? "sentence" : "sentences"}
					</summary>
					<ListenRows reps={understood} />
				</details>
			)}
			<SourcesNote feature="listen" className="mt-14" />
		</TaskEnd>
	);
}

function ListenRows({ reps }: { reps: Rep[] }) {
	const lang = useActiveLanguage();
	return (
		<SentenceRows className="mt-2">
			{reps.map((r) => (
				<SentenceRow
					key={r.item.id}
					sentence={r.item.sentence}
					lang={lang?.code}
					translation={r.item.translation}
					onPlay={() => void speak(r.item.sentence)}
					note={
						r.verdict === "exact" ? undefined : r.verdict === "accents" ? (
							<span>
								Accents off: <span className="font-medium text-ink-2" lang={lang?.code}>“{r.given}”</span>
							</span>
						) : r.given ? (
							<span>
								You typed <span className="font-medium text-miss" lang={lang?.code}>“{r.given}”</span>
							</span>
						) : (
							<span>You didn&apos;t know it</span>
						)
					}
				/>
			))}
		</SentenceRows>
	);
}
