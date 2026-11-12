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
import { QUIET } from "@/components/ui/learn-buttons";
import { COLUMN, Dock, endEnterBlocked, EnterHint, NotSaved, Pips, PracticeCard, PRIMARY, Pulse, SECONDARY, SentenceRow, SentenceRows, Stat, Stats, TaskEnd, TaskFrame as Frame, TaskRound, VerdictDisc, type PipOutcome } from "@/components/task-frame";
import { cn } from "@/lib/utils";
import { useActiveTime } from "@/components/use-active-time";
import { speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { sfx, soundOn } from "@/components/lesson/sound";
import { DiacriticBar } from "@/components/diacritic-bar";
import { almostCount, isWatchItem, judgeTyped, LISTEN_XP, listenXp, PEEK_AFTER_REPLAYS, heardPieces, praiseFor, scoreLine, understood, type LineMark, type ListenItem, type ListenPlan, type ListenVerdict, type SheetProgress, type TodayExperimentStatus } from "@/src/core";
import { SourcesNote } from "@/components/sources/sources-note";
import { SheetProgressBar } from "@/components/words/sheet-progress";
import { keepSession, onSessionSaved, RefusedError, sendSession, type PendingSession } from "@/components/session-save";

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
	progress?: SheetProgress;
}

export interface ListenSheet {
	id: string;
	title: string;
	section?: string;
}

function sheetListenUrl(sheet: ListenSheet): string {
	const url = `/api/cheatsheets/${encodeURIComponent(sheet.id)}/listen`;
	return sheet.section ? `${url}?section=${encodeURIComponent(sheet.section)}` : url;
}

function sheetHref(sheet: ListenSheet): string {
	return `/words?tab=cheatsheets&sheet=${encodeURIComponent(sheet.id)}`;
}

const SHEET_GONE = "It was removed, or it belongs to another language.";

const TOUCH_TALL = "pointer-coarse:h-11";
const ENTER_KEY = "q-kbd hidden pointer-fine:inline-flex";

// Browsers move focus on mousedown, so a tap on Play would blur the answer field and close a phone's keyboard.
const keepFieldFocus = (e: React.MouseEvent) => e.preventDefault();

function pipOf(rep: Pick<Rep, "verdict" | "peeked">): PipOutcome {
	if (rep.peeked) return "shown";
	return rep.verdict === "exact" ? "right" : rep.verdict === "accents" ? "almost" : "miss";
}

function marksOf(rep: Pick<Rep, "item" | "given" | "verdict">): LineMark[] | undefined {
	return rep.verdict !== "exact" && rep.given ? scoreLine(rep.item.sentence, rep.given).marks : undefined;
}

function sourceOf(item: ListenItem): string {
	if (item.source) return item.source.kind === "sheet" ? item.source.title : `From a video you watched · ${item.source.title}`;
	if (isWatchItem(item.id)) return "From a video you watched";
	return item.stretch.length === 0 ? "Every word is yours" : item.stretch.length === 1 ? "One new word" : `${item.stretch.length} new words`;
}

export function ListenPlayer({
	initialPlan = null,
	sheet,
	initialExperiment = null,
}: {
	initialPlan?: ListenPlan | null;
	sheet?: ListenSheet;
	initialExperiment?: TodayExperimentStatus | null;
}) {
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
	const [saveRefused, setSaveRefused] = useState(false);
	const lastSave = useRef<PendingSession | null>(null);
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
		setSaveRefused(false);
		finishing.current = false;
		try {
			const res = await fetch(sheet ? sheetListenUrl(sheet) : "/api/listen");
			if (sheet && res.status === 404) throw new Error(SHEET_GONE);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const next = (await res.json()) as ListenPlan;
			if (seq !== loadSeq.current) return;
			if (next.items.length === 0) throw new Error(sheet ? "This cheatsheet has no phrase to play. A phrase with … in it is skipped." : "No sentences to listen to yet. Finish a lesson or two first.");
			setPlan(next);
			startedAt.current = Date.now();
			activeTime.restart();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [activeTime, sheet]);

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
				const timed = { ms: Date.now() - startedAt.current, activeMs: activeTime.finish(), tz: new Date().getTimezoneOffset() };
				lastSave.current = sheet
					? keepSession(lang?.code ?? "sk", sheetListenUrl(sheet), {
							reps: all.map((r) => ({ itemId: r.item.id, given: r.given, peeked: r.peeked, replays: r.replays, ms: r.ms, heardMs: r.heardMs })),
							section: sheet.section,
							...timed,
						})
					: keepSession(lang?.code ?? "sk", "/api/listen", {
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
						...timed,
				});
				setOutcome(await sendSession<Outcome>(lastSave.current));
			} catch (err) {
				setSaveFailed(true);
				setSaveRefused(err instanceof RefusedError);
				setOutcome({ xp: sheet ? 0 : listenXp(correct, all.length, almost), correct, almost, total: all.length, queued: [] });
			} finally {
				setSaving(false);
			}
		},
		[activeTime, lang, sheet],
	);

	const retrySave = async () => {
		if (!lastSave.current || saving) return;
		setSaving(true);
		try {
			setOutcome(await sendSession<Outcome>(lastSave.current));
			setSaveFailed(false);
			setSaveRefused(false);
		} catch (err) {
			setSaveFailed(true);
			setSaveRefused(err instanceof RefusedError);
		} finally {
			setSaving(false);
		}
	};

	useEffect(() => {
		const session = lastSave.current;
		if (!saveFailed || saveRefused || !session) return;
		return onSessionSaved(session.id, (saved) => {
			setOutcome(saved as Outcome);
			setSaveFailed(false);
		});
	}, [saveFailed, saveRefused]);

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
		answerWith(given, sheet ? judgeTyped(given, item.sentence, lang?.tag) : judgeTyped(given, item.sentence));
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
				router.push(sheet ? sheetHref(sheet) : readOrigin());
				return;
			}
			if (outcome) {
				if (e.key === "Enter" && !endEnterBlocked(e)) {
					e.preventDefault();
					router.push(sheet ? sheetHref(sheet) : "/");
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

	if (error && sheet) {
		return (
			<Frame>
				<div className="mx-auto w-full max-w-3xl px-6 pt-[8vh]">
					<EmptyState
						testid="listen-error"
						title={error === SHEET_GONE ? "This cheatsheet is not here" : "Nothing to listen to in this cheatsheet"}
						action={
							<Link href={error === SHEET_GONE ? "/words?tab=cheatsheets" : sheetHref(sheet)} className="q-btn primary">
								{error === SHEET_GONE ? "All cheatsheets" : "Back to the cheatsheet"}
							</Link>
						}
					>
						<p>{error}</p>
					</EmptyState>
				</div>
			</Frame>
		);
	}

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
					{sheet ? "Picking phrases from your cheatsheet…" : "Choosing sentences you can follow…"}
				</div>
			</Frame>
		);
	}

	if (outcome) {
		return (
			<Frame>
				<EndScreen outcome={outcome} reps={reps} sheet={sheet} saving={saving} failed={saveFailed} refused={saveRefused} onAgain={() => void load()} onRetrySave={() => void retrySave()} />
			</Frame>
		);
	}

	const praise = praiseFor(lang?.code, index);
	const tone = !current ? "plain" : current.verdict === "wrong" ? "miss" : current.verdict === "exact" ? "right" : "wait";
	const unit = sheet ? "phrase" : "sentence";
	const canPeek = replays >= PEEK_AFTER_REPLAYS;
	const outcomes = plan.items.map((_, i): PipOutcome => (i < reps.length ? pipOf(reps[i]!) : i > index ? "ahead" : current ? pipOf(current) : "now"));
	const stretch = item.stretch.map((w) => w.text);

	const sessionStudyReps = reps.length + (current ? 1 : 0);
	const studyReps = initialExperiment?.runningLanguageReps ?? null;
	const liveStudyReps = (studyReps?.dictationReps ?? 0) + sessionStudyReps;
	const studyActive = !sheet && initialExperiment?.active && studyReps !== null;

	return (
		<Frame strip={false}>
			<TaskRound outcomes={outcomes} label={`${unit} ${index + 1} of ${total}`} count={`${index + 1}/${total}`} href={sheet ? sheetHref(sheet) : "/"} />

			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-1 sm:pt-[4vh]">
				<div key={item.id} className={cn(COLUMN, "lh-rise")}>
					<PracticeCard
						icon="listen"
						title="Listen"
						sub={sourceOf(item)}
						right={
							studyActive ? (
								<span className={cn("tabular-nums", liveStudyReps >= 5 && "text-teal-2")} title={`Study day ${initialExperiment?.dayNumber}: ${liveStudyReps} of 5 sentences toward a day that counts`} data-testid="listen-study-banner">
									Study day {initialExperiment?.dayNumber} · {Math.min(liveStudyReps, 5)} of 5
								</span>
							) : undefined
						}
					>
						<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4">
							<button
								type="button"
								onMouseDown={keepFieldFocus}
								onClick={() => replay()}
								aria-label={`Play the ${unit}`}
								className="lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-sun-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2"
								data-testid="listen-play"
							>
								<Volume2Icon className="size-6" strokeWidth={1.6} />
							</button>
							<h2 className="min-w-0 font-prose text-[19px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[22px]">
								{!current ? "Type what you hear" : current.verdict === "exact" ? <span lang={praise.lang}>{praise.text}</span> : current.verdict === "accents" ? "So close" : "It says…"}
							</h2>
							<button
								type="button"
								onMouseDown={keepFieldFocus}
								onClick={() => replay(true)}
								aria-label="Play slowly"
								title="Play slowly"
								className="lh-press flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-teal-wash px-3 text-[13px] font-[550] text-teal-2 hover:bg-well-2 sm:gap-2 sm:px-3.5"
								data-testid="listen-slow"
							>
								<SnailIcon className="size-5" strokeWidth={1.6} />
								<span className="hidden min-[360px]:inline">Slowly</span>
							</button>
						</div>

						{(current || peeked) && (
							<div className="lh-rise mt-6" data-testid="listen-sentence" data-word-lookup-enabled="true">
								<p className="font-prose text-[24px] font-[550] leading-[1.35] tracking-[-0.025em] text-foreground sm:text-[30px]" lang={lang?.code} data-testid="listen-marks">
									<Heard sentence={item.sentence} stretch={stretch} marks={current ? marksOf(current) : undefined} tag={lang?.tag} />
								</p>
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
								{current && item.source?.kind === "sheet" && item.source.note && (
									<p data-no-word-lookup="true" className="mt-1 font-ui text-[13px] text-ink-3" data-testid="listen-note">
										{item.source.note}
									</p>
								)}
							</div>
						)}

						{!current && (
							<div className="mt-3 sm:mt-4">
								<input
									type="text"
									lang={lang?.code}
									autoComplete="off"
									autoCapitalize="off"
									autoCorrect="off"
									spellCheck={false}
									enterKeyHint="done"
									autoFocus
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											submit();
										}
									}}
									aria-label={`Type the ${unit} you heard`}
									className="q-write h-12 w-full px-0.5 font-prose text-[22px] font-[550] tracking-[-0.02em] text-foreground outline-none sm:text-[26px]"
									data-testid="listen-input"
								/>
								<DiacriticBar variant="keys" className="mt-4" />
								<div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[13px] text-ink-3">
									{peeked ? (
										<p data-testid="listen-hint">The text is shown, so this {unit} is not counted.</p>
									) : (
										<>
											<button
												type="button"
												onMouseDown={keepFieldFocus}
												onClick={() => setPeeked(true)}
												disabled={!canPeek}
												className={cn("lh-press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 font-medium shadow-[inset_0_0_0_1px_var(--q-line-2)] pointer-coarse:h-11", canPeek ? "text-ink-2 hover:bg-well" : "text-ink-4")}
												data-testid="listen-peek"
											>
												<EyeIcon className="size-4" strokeWidth={1.6} />
												{canPeek ? "Show the text (not counted)" : "Show the text"}
											</button>
											{!canPeek && <p data-testid="listen-hint">after one more listen</p>}
										</>
									)}
								</div>
							</div>
						)}
					</PracticeCard>
				</div>
			</div>

			<Dock tone={tone} live>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-3 py-4")}>
					{current ? (
						<>
							<p className={cn("flex min-w-0 items-center gap-2.5 font-ui text-[15px] font-[600] leading-snug tracking-[-0.01em]", current.verdict === "exact" ? "text-teal-2" : current.verdict === "accents" ? "text-ink-2" : "text-miss")} data-testid="listen-verdict">
								<VerdictDisc ok={current.verdict !== "wrong"} />
								{current.verdict === "exact"
									? `Typed correctly${sheet ? "" : ` · +${LISTEN_XP} XP`}`
									: current.verdict === "accents"
										? `Almost · only an accent is missing${sheet ? "" : ` · +${Math.ceil(LISTEN_XP / 2)} XP`}`
										: current.given
											? "Not quite"
											: "Not caught this time"}
							</p>
							<button type="button" onClick={advance} className={cn(PRIMARY, TOUCH_TALL, "shrink-0")} data-testid="listen-continue" autoFocus>
								{index + 1 >= total ? "Finish" : "Continue"}
								<span className={ENTER_KEY}>
									<QIcon name="enter" />
								</span>
							</button>
						</>
					) : (
						<>
							<button type="button" onClick={giveUp} className={cn(QUIET, TOUCH_TALL)} data-testid="listen-give-up">
								I didn&apos;t catch it
							</button>
							<button type="button" onClick={submit} disabled={!draft.trim()} className={cn(PRIMARY, TOUCH_TALL)} data-testid="listen-check">
								Check
								<span className={ENTER_KEY}>
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

const WORD_LINE = "underline decoration-2 underline-offset-[6px]";

function Heard({ sentence, stretch, marks, tag }: { sentence: string; stretch: string[]; marks?: LineMark[]; tag?: string }) {
	const pieces = heardPieces(sentence, { newWords: stretch, marks, tag });
	return (
		<span className={cn(pieces.some((piece) => piece.given) && "leading-[calc(1.35em_+_max(11px,0.48em)_+_6px)]")}>
			{pieces.map((piece, i) => {
				const word = (
					<span
						title={piece.mark === "missed" ? (piece.given ? `You typed “${piece.given}”` : "Not typed") : piece.mark === "almost" ? "The right word, an accent missing" : undefined}
						className={cn(
							piece.newWord && "font-semibold text-teal-2",
							piece.mark === "missed" && "rounded-[0.18em] bg-miss-soft px-[0.1em]",
							(piece.mark === "almost" || (piece.newWord && piece.mark !== "missed")) && cn(WORD_LINE, "decoration-teal"),
						)}
					>
						{piece.text}
					</span>
				);
				if (!piece.given) return <span key={i}>{word}</span>;
				return (
					<ruby key={i} className="[ruby-position:under]">
						{word}
						<rt data-no-word-lookup="true" className={cn("pt-0.5 font-prose text-[max(11px,0.48em)] font-[450] leading-none tracking-normal", piece.mark === "missed" ? "text-miss" : "text-ink-3")}>
							{piece.given}
						</rt>
					</ruby>
				);
			})}
		</span>
	);
}

interface EndScreenProps {
	outcome: Outcome;
	reps: Rep[];
	saving: boolean;
	failed: boolean;
	refused: boolean;
	onAgain: () => void;
	onRetrySave: () => void;
}

function SheetEndScreen({ outcome, reps, sheet, saving, failed, refused, onAgain, onRetrySave }: EndScreenProps & { sheet: ListenSheet }) {
	const missed = reps.filter((r) => r.verdict !== "exact");
	const typedCorrectly = reps.filter((r) => r.verdict === "exact");
	const shown = reps.filter((r) => r.peeked).length;
	const asides = [outcome.almost > 0 && `${outcome.almost} with only an accent missing`, shown > 0 && `${shown} with the text shown, not counted`].filter(Boolean);
	return (
		<TaskEnd
			testId="listen-end"
			hint={failed ? <NotSaved onRetry={onRetrySave} busy={saving} refused={refused} /> : <EnterHint>for the cheatsheet</EnterHint>}
			actions={
				<>
					<button type="button" onClick={onAgain} className={cn(SECONDARY, TOUCH_TALL)} data-testid="listen-again">
						<RepeatIcon className="size-4" />
						Ten more
					</button>
					<Link href={sheetHref(sheet)} className={cn(PRIMARY, TOUCH_TALL)} data-testid="listen-sheet">
						Back to the cheatsheet
					</Link>
				</>
			}
		>
			<p className="q-date flex items-center gap-1.5">
				<QIcon name="listen" className="text-teal" />
				Listen · {sheet.title || "your cheatsheet"}
			</p>
			<h1 className="q-hello">
				{outcome.correct + outcome.almost} of {outcome.total} caught by ear
			</h1>
			<Pips outcomes={reps.map(pipOf)} className="mt-4 max-w-xs" />
			{asides.length > 0 && <p className="q-sub !mt-3">{asides.join(" · ")}</p>}
			<div className="mt-8" data-testid="listen-sheet-progress">
				<h2 className="q-sh">{sheet.section ? "This section" : "This cheatsheet"}</h2>
				{saving ? (
					<div className="flex flex-col gap-2.5">
						<Pulse className="h-2 w-full" />
						<Pulse className="h-4 w-56" />
					</div>
				) : failed || !outcome.progress ? (
					<p className="font-ui text-[13px] text-ink-3">{refused ? "Not counted" : "Not counted yet"}</p>
				) : (
					<SheetProgressBar progress={outcome.progress} />
				)}
				<p className="q-sub !mt-4 max-w-prose" data-testid="listen-sheet-terms">
					These are your own phrases, as you wrote them. Nothing checked them against the dictionary. The time counts as listening; it earns no XP and adds nothing to Review.
				</p>
			</div>
			{missed.length > 0 && (
				<div className="mt-8">
					<h2 className="q-sh">Missed · these come back first</h2>
					<ListenRows reps={missed} />
				</div>
			)}
			{typedCorrectly.length > 0 && (
				<details className="group mt-6" data-testid="listen-understood">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 font-ui text-[13px] font-[550] text-ink-3 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
						<ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden="true" />
						Typed correctly · {typedCorrectly.length} {typedCorrectly.length === 1 ? "phrase" : "phrases"}
					</summary>
					<ListenRows reps={typedCorrectly} />
				</details>
			)}
			<SourcesNote feature="cheatsheet-listen" className="mt-14" />
		</TaskEnd>
	);
}

function EndScreen({ sheet, ...props }: EndScreenProps & { sheet?: ListenSheet }) {
	return sheet ? <SheetEndScreen sheet={sheet} {...props} /> : <DictionaryEndScreen {...props} />;
}

function DictionaryEndScreen({ outcome, reps, saving, failed, refused, onAgain, onRetrySave }: EndScreenProps) {
	const lang = useActiveLanguage();
	const words = reps.flatMap((r) => r.item.stretch).filter((w, i, all) => all.findIndex((x) => x.lemma === w.lemma) === i);
	// Missing an accent counts too: those sentences are worth hearing again.
	const missed = reps.filter((r) => r.verdict !== "exact");
	// The ones that went right are kept out of sight until asked for, but never lost: the sentence you got right is one you may want to see too.
	const understood = reps.filter((r) => r.verdict === "exact");
	return (
		<TaskEnd
			testId="listen-end"
			hint={failed ? <NotSaved onRetry={onRetrySave} busy={saving} refused={refused} /> : <EnterHint>for Today</EnterHint>}
			actions={
				<>
					<button type="button" onClick={onAgain} className={cn(SECONDARY, TOUCH_TALL)} data-testid="listen-again">
						<RepeatIcon className="size-4" />
						Ten more
					</button>
					<Link href="/" className={cn(PRIMARY, TOUCH_TALL)} data-testid="listen-today">
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
			<Pips outcomes={reps.map(pipOf)} className="mt-4 max-w-xs" />
			{outcome.almost > 0 && <p className="q-sub !mt-3">{outcome.almost} typed with only a missing accent (half XP)</p>}
			<Stats className="mt-7 max-w-none">
				<Stat label="XP" value={saving ? null : failed ? (refused ? "Not counted" : "Not counted yet") : `+${outcome.xp}`} ink={failed ? "text-ink-3" : "text-teal-2"} />
				<Stat label="New words met" value={String(words.length)} />
				<Stat label="Added to Review" value={saving ? null : failed ? (refused ? "Not counted" : "Not counted yet") : outcome.queued.length ? `${outcome.queued.length} ${outcome.queued.length === 1 ? "word" : "words"}` : "None"} ink={failed ? "text-ink-3" : undefined} />
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
						r.peeked ? <span>The text was shown</span> : r.verdict === "exact" || r.given ? undefined : <span>Not caught</span>
					}
				>
					<Heard sentence={r.item.sentence} stretch={[]} marks={marksOf(r)} tag={lang?.tag} />
				</SentenceRow>
			))}
		</SentenceRows>
	);
}
