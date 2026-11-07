"use client";

/**
 * The lesson player (LangHarness redesign): 12 quick reps, each answered
 * in a second or two, with instant color-and-sound feedback, a combo
 * meter, a progress bar and an end screen. Blitz mode is the same player
 * against a 60-second clock, choose-only, no feedback sheet.
 *
 * Everything here is local: the items come from /api/lesson (built from
 * the lexicon), grading is core/language.ts compareAnswer, and only the
 * finished lesson is posted back. The tutor is one click away on a miss
 * ("Why?"), never in the loop.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkCheckIcon, BookmarkIcon, BrainIcon, ChartColumnIcon, ChevronDownIcon, FlagIcon, LanguagesIcon, LoaderCircleIcon, SnailIcon, TimerIcon, Volume2Icon, WholeWordIcon, XIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiacriticBar } from "@/components/diacritic-bar";
import { KBD, PRIMARY, QUIET, SECONDARY } from "@/components/ui/learn-buttons";
import { useActiveTime } from "@/components/use-active-time";
import { prefetchSpeech, speak, useActiveLanguage } from "@/components/speech";
import { sfx, warmSound } from "@/components/lesson/sound";
import { SoundControl } from "@/components/sound-control";
import { QIcon } from "@/components/quiet/icon";
import type { QIconName } from "@/components/quiet/icon-paths";
import { COLUMN, Dock, OptionTile, PracticeCard, Pulse, Stat, Stats, TaskFrame as Frame, VerdictDisc } from "@/components/task-frame";
import { startTutorChat, whyPrompt } from "@/components/lesson/tutor";
import { GrammarExplain } from "@/components/lesson/grammar-explain";
import { TaskGrid } from "@/components/lesson/task-grid";
import { enqueueLesson, flushOutbox, onSettled, type Recorded } from "@/components/lesson/outbox";
import { StampDisc } from "@/components/stamp";
import {
	compareAnswer,
	diacriticSlips,
	formSlip,
	genderLabel,
	gradeListen,
	isVariantMatch,
	LESSONS_TO_COMPLETE,
	lessonScore,
	patternExamples,
	repXp,
	sameSentence,
	rankLabel,
	unitDone,
	unitBridges,
	unitInfo,
	type AtlasGender,
	type BridgeLang,
	type FirstAnswer,
	type ItemKind,
	type LessonItem,
	type LessonFocus,
	type LessonPlan,
	type LessonScore,
	type RepVerdict,
	type UnitId,
	lessonLanguage,
} from "@/src/core";
import { fillStyle } from "@/components/ui/fill";
import { shake as shakeEl } from "@/components/motion";
import { SourcesNote } from "@/components/sources/sources-note";

type Mode = "lesson" | "blitz";

/** The languages the hints bridge to, from the plan (the learner's
 *  profile). A plan built before profiles carried languages reads as
 *  Estonian, the app's first learner. */
const BridgesContext = createContext<readonly BridgeLang[]>(["et"]);

/** The bridge lines for a unit in the languages the learner knows, one
 *  line each, after the rule (the Estonian, Finnish, Russian or German way
 *  of the same point; src/core/unit-bridges.ts). `compact` (the retry
 *  hint) shows the strongest language and folds the rest behind one line,
 *  so the second try is not under a wall of text. */
function Bridges({ unit, compact = false }: { unit: UnitId; compact?: boolean }) {
	const langs = useContext(BridgesContext);
	const [all, setAll] = useState(false);
	const lines = unitBridges(unit, langs);
	if (lines.length === 0) return null;
	const shown = compact && !all ? lines.slice(0, 1) : lines;
	const rest = lines.slice(1);
	return (
		<>
			{shown.map((b) => (
				<p key={b.lang} className="text-muted-foreground" data-testid={`bridge-${b.lang}`}>
					<span className="font-semibold text-foreground">{b.name}:</span> {b.text}
				</p>
			))}
			{compact && !all && rest.length > 0 && (
				<button
					type="button"
					onClick={() => setAll(true)}
					className="self-start font-prose text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
					data-testid="bridges-more"
				>
					Show the {rest.map((b) => b.name).join(" and ")} parallels
				</button>
			)}
		</>
	);
}

interface Rep {
	item: LessonItem;
	given: string;
	verdict: RepVerdict;
	/** Right with help: on the second try after the cue, or with the
	 *  meaning shown early. Earns half (a priced hint). */
	assisted?: boolean;
	/** Right with a recognized valid variant (e.g. zas ↔ zase). */
	variant?: boolean;
	/** The answer before any cue: what the first-try measure counts. */
	first?: FirstAnswer;
	latencyMs?: number;
}

interface SavedLesson {
	plan: LessonPlan;
	index: number;
	reps: Rep[];
	current: Rep | null;
	combo: number;
	xp: number;
	miss: string | null;
	/** The first answer to the rep whose cue is showing (see Rep.first). */
	first?: FirstAnswer | null;
	peeked?: boolean;
	relearned: number;
	startedAt: number;
}

/** Missed reps asked again at the end of a lesson, at most (successive
 *  relearning: a miss retrieved again before the session ends is what
 *  fixes it; docs/research/desirable-difficulties.md). */
const RELEARN_MAX = 4;

/** Kinds with no second try and no typed comeback: a word bank (the
 *  mistake is visible) and a meaning rep (input, not a form to produce). */
const NO_RETRY = new Set<ItemKind>(["build", "meaning"]);

const BLITZ_SECONDS = 60;

const KIND_LABEL: Record<ItemKind, string> = {
	meaning: "What does it mean?",
	choose: "Choose the right form",
	type: "Type the missing word",
	build: "Build the sentence",
	listen: "Type what you hear",
};

/** A vocabulary rep blanks the word itself, so the ask is the word, not a form. */
function kindLabel(item: LessonItem): string {
	if (item.task) return item.task.kind === "grid" ? "Read the grid" : "Find the cue";
	if (item.kind === "choose" && unitInfo(item.unit).kind === "words") return "Choose the word";
	if (item.kind === "choose" && unitInfo(item.unit).kind === "pairs") return "Choose the twin";
	if (item.kind === "type" && unitInfo(item.unit).kind === "words") return "Type the word";
	return KIND_LABEL[item.kind];
}

const PRAISE = ["Výborne!", "Super!", "Presne tak!", "Skvelé!", "Bravo!", "Paráda!"];

export function LessonPlayer({ unit, mode, gender, focus, initialPlan = null }: { unit?: UnitId; mode: Mode; gender?: AtlasGender; focus?: LessonFocus; initialPlan?: LessonPlan | null }) {
	const router = useRouter();
	const lang = useActiveLanguage();
	const tag = lang?.tag ?? "sk-SK";
	// The first plan renders with the page (server-built), so the first
	// question never swaps for another one after load.
	const [plan, setPlan] = useState<LessonPlan | null>(initialPlan);
	const [error, setError] = useState<string | null>(null);
	const [index, setIndex] = useState(0);
	const [reps, setReps] = useState<Rep[]>([]);
	const [current, setCurrent] = useState<Rep | null>(null);
	const [combo, setCombo] = useState(0);
	const [xp, setXp] = useState(0);
	const [floater, setFloater] = useState<{ key: number; text: string } | null>(null);
	// The lesson's own score, known the moment the last answer is in. The
	// server's answer (streak, goal, unit progress) lands behind it.
	const [score, setScore] = useState<LessonScore | null>(null);
	const [recorded, setRecorded] = useState<Recorded | null>(null);
	const [saveFailed, setSaveFailed] = useState(false);
	// The lesson whose save the end screen is waiting on (a new lesson clears it).
	const pendingId = useRef<string | null>(null);
	const [left, setLeft] = useState(BLITZ_SECONDS);
	const [shake, setShake] = useState(0);
	// The first wrong answer on this rep: the learner gets a hint and one
	// more try before the answer is shown (a prompt, not a recast: classroom
	// studies found prompts at least as good, a design choice and not proven here).
	const [miss, setMiss] = useState<string | null>(null);
	// The first answer to this rep, held while the cue is showing: a miss
	// comes back right on the second try, and the first try is what counts
	// for the grammar atlas (src/core/first-try.ts).
	const [firstTry, setFirstTry] = useState<FirstAnswer | null>(null);
	// The translation asked for before the answer (hidden from the
	// practiced stage on): a priced hint, the rep earns half.
	const [peeked, setPeeked] = useState(false);
	// Whether the rep has an answer to check (drives the footer's Check).
	const [ready, setReady] = useState(false);
	const relearned = useRef(0);
	const repBox = useRef<HTMLDivElement>(null);
	// A miss shakes the rep without remounting it (the typed text stays).
	useEffect(() => {
		if (shake === 0) return;
		shakeEl(repBox.current);
	}, [shake]);
	const startedAt = useRef(Date.now());
	const shownAt = useRef(Date.now());
	const firstLatency = useRef<number | null>(null);
	// The day's minutes count active time, not the wall-clock `ms` (which the
	// lesson log keeps): the gaps between answers, each capped.
	const activeTime = useActiveTime(mode === "blitz" ? "blitz" : "lesson", "interactive");
	const finishing = useRef(false);

	// A lesson survives leaving the page (the tutor chat, Today, a reload):
	// its state is kept in this tab's sessionStorage until it is finished
	// or left on purpose (X, Escape). Blitz is a 60 s sprint and is not kept.
	const saveKey = mode !== "lesson" ? null : focus ? `lh-lesson:${focus}` : unit ? `lh-lesson:${unit}${gender ? `:${gender}` : ""}` : null;
	const restoring = useRef(saveKey !== null);
	useEffect(() => {
		restoring.current = false;
		if (!saveKey) return;
		try {
			const raw = sessionStorage.getItem(saveKey);
			if (!raw) return;
			const saved = JSON.parse(raw) as SavedLesson;
			if (!saved.plan || (saved.reps.length === 0 && saved.index === 0 && !saved.current)) return;
			setPlan(saved.plan);
			setIndex(saved.index);
			setReps(saved.reps);
			setCurrent(saved.current);
			setCombo(saved.combo);
			setXp(saved.xp);
			setMiss(saved.miss);
			setFirstTry(saved.first ?? null);
			setPeeked(saved.peeked === true);
			relearned.current = saved.relearned;
			startedAt.current = saved.startedAt;
		} catch {
			// storage blocked or stale: start fresh
		}
	}, [saveKey]);
	useEffect(() => {
		if (!saveKey || !plan || score || restoring.current) return;
		const saved: SavedLesson = { plan, index, reps, current, combo, xp, miss, first: firstTry, peeked, relearned: relearned.current, startedAt: startedAt.current };
		try {
			sessionStorage.setItem(saveKey, JSON.stringify(saved));
		} catch {
			// storage blocked: the lesson is not kept
		}
	}, [saveKey, plan, index, reps, current, combo, xp, miss, firstTry, peeked, score]);
	const forget = useCallback(() => {
		if (!saveKey) return;
		try {
			sessionStorage.removeItem(saveKey);
		} catch {
			// nothing kept
		}
	}, [saveKey]);
	// Leaving on purpose drops the lesson, so once anything is answered the
	// X and Escape ask first: one stray key should not cost five answers.
	const [leaving, setLeaving] = useState(false);
	const leave = useCallback(() => {
		forget();
		router.push("/");
	}, [forget, router]);


	// Only the latest request may land: a slower earlier response must
	// never replace the plan on screen.
	const loadSeq = useRef(0);
	const load = useCallback(async () => {
		const seq = ++loadSeq.current;
		setPlan(null);
		setError(null);
		setIndex(0);
		setReps([]);
		setCurrent(null);
		setCombo(0);
		setXp(0);
		setScore(null);
		setRecorded(null);
		setSaveFailed(false);
		pendingId.current = null;
		setMiss(null);
		relearned.current = 0;
		setLeft(BLITZ_SECONDS);
		setFirstTry(null);
		setPeeked(false);
		finishing.current = false;
		try {
			const res = await fetch(mode === "blitz" ? "/api/lesson?mode=blitz" : focus ? `/api/lesson?mode=${focus}` : `/api/lesson?unit=${unit}${gender ? `&gender=${gender}` : ""}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const next = (await res.json()) as LessonPlan;
			if (seq !== loadSeq.current) return;
			if (next.items.length === 0) throw new Error(focus === "mixups" ? "No mix-ups on record yet. When you give one word for another, the pair shows up here." : focus === "personal" ? "No plan practice yet. Write your guide on Mistakes, and its practice shows up here." : "There are no sentences for this unit yet.");
			setPlan(next);
			startedAt.current = Date.now();
			activeTime.restart();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [mode, unit, gender, focus, activeTime]);

	// Fetch on mount only when the server could not build the plan.
	const hadInitial = useRef(initialPlan !== null);
	useEffect(() => {
		if (hadInitial.current) return;
		void load();
	}, [load]);

	const item = plan?.items[index] ?? null;
	const total = plan?.items.length ?? 0;

	useEffect(() => {
		shownAt.current = Date.now();
		firstLatency.current = null;
	}, [index, item?.id]);
	// The next sentence's audio is fetched while this one is on screen, so it starts at once.
	const nextSentence = plan?.items[index + 1]?.sentence;
	const thisSentence = item?.sentence;
	useEffect(() => {
		if (thisSentence && lang) prefetchSpeech(thisSentence, lang.code);
		if (nextSentence && lang) prefetchSpeech(nextSentence, lang.code);
		warmSound();
	}, [thisSentence, nextSentence, lang]);
	const done = !!score;

	const finish = useCallback(
	(all: Rep[]) => {
		if (finishing.current || !plan) return;
		finishing.current = true;
		sfx.done();
		setScore(
			lessonScore(
				all.map((r) => ({ kind: r.item.kind, verdict: r.verdict, assisted: r.assisted === true })),
				mode,
			),
		);
		// Kept in the outbox before anything waits on the network: the lesson
		// survives a closed window, and the end screen fills in once it is recorded.
		const entry = enqueueLesson(lang?.code ?? "sk", {
			unit: plan.unit,
			mode,
			...(focus ? { focus } : {}),
			reps: all.map((r) => ({
				itemId: r.item.id,
				slug: r.item.slug,
				kind: r.item.kind,
				verdict: r.verdict,
				assisted: r.assisted === true,
				...(r.latencyMs !== undefined ? { latencyMs: r.latencyMs } : {}),
				// The answer before any cue: the server counts it as the first try.
				...(r.first ? { first: r.first } : {}),
				// Everything shown and answered, for the lesson log on disk.
				detail: {
					unit: r.item.unit,
					lemma: r.item.lemma,
					gloss: r.item.gloss,
					sentence: r.item.sentence,
					translation: r.item.translation,
					answer: r.item.answer,
					given: r.given,
					trigger: r.item.trigger,
					options: r.item.options,
					mixed: r.item.mixed === true,
					again: r.item.again === true,
					...(r.item.task ? { task: r.item.task.kind } : {}),
					latencyMs: r.latencyMs,
				},
			})),
			ms: Date.now() - startedAt.current,
			activeMs: activeTime.finish(),
			tz: new Date().getTimezoneOffset(),
		});
		forget();
		pendingId.current = entry.id;
		const off = onSettled(entry.id, (recorded) => {
			off();
			if (pendingId.current !== entry.id) return;
			if (recorded) setRecorded(recorded);
			else setSaveFailed(true);
		});
		void flushOutbox(entry.lang);
	},
	[plan, mode, focus, lang, forget, activeTime],
);

	// Blitz clock.
	useEffect(() => {
		if (mode !== "blitz" || !plan || done) return;
		const t = window.setInterval(() => {
			setLeft((s) => {
				if (s <= 1) {
					window.clearInterval(t);
					return 0;
				}
				if (s <= 6) sfx.tick();
				return s - 1;
			});
		}, 1000);
		return () => window.clearInterval(t);
	}, [mode, plan, done]);

	useEffect(() => {
		if (mode === "blitz" && left === 0 && plan && !done) void finish(reps);
	}, [left, mode, plan, done, finish, reps]);

	const grade = (given: string, verdict: RepVerdict, reveal = false) => {
		if (!item || current) return;
		// The first answer to this rep, before any cue. A second try (after a
		// miss) keeps the first one; a rep with a cue showing and no first
		// answer held has none to count.
		const first: FirstAnswer | undefined = firstTry ?? (miss === null ? { given, verdict, ...(peeked ? { peeked: true } : {}) } : undefined);
		const elapsed = Math.max(0, Date.now() - shownAt.current);
		if (firstLatency.current === null) firstLatency.current = elapsed;
		const latencyMs = firstLatency.current;
		// "I don't know" (reveal) skips the cue and the second try: the answer
		// shows at once, the rep counts as a miss and comes back at the end.
		if (mode === "lesson" && verdict === "wrong" && miss === null && !NO_RETRY.has(item.kind) && !item.task && !reveal) {
			setMiss(given);
			setFirstTry(first ?? null);
			setCombo(0);
			sfx.wrong();
			setShake((s) => s + 1);
			return;
		}
		const isVariant = verdict === "exact" && isVariantMatch(item.answer, given, tag, item.alternatives);
		const assisted = mode === "lesson" && (miss !== null || peeked) && verdict !== "wrong";
		const rep: Rep = { item, given, verdict, assisted, ...(isVariant ? { variant: true } : {}), ...(first ? { first } : {}), latencyMs };
		const nextCombo = verdict === "wrong" ? 0 : combo + 1;
		const gained = repXp(item.kind, verdict, nextCombo, assisted);
		setCombo(nextCombo);
		setXp((x) => x + gained);
		if (gained > 0) setFloater({ key: Date.now(), text: `+${gained}` });
		if (verdict === "exact") sfx.right(nextCombo);
		else if (verdict === "accents") sfx.almost();
		else {
			sfx.wrong();
			setShake((s) => s + 1);
		}
		if (mode === "blitz") {
			const all = [...reps, rep];
			setReps(all);
			setCurrent(rep);
			window.setTimeout(
				() => {
					setCurrent(null);
					if (index + 1 >= total) void finish(all);
					else setIndex((i) => i + 1);
				},
				verdict === "wrong" ? 650 : 280,
			);
			return;
		}
		setCurrent(rep);
		if (item.kind !== "listen") void speak(item.sentence).catch(() => {});
	};

	const giveUp = () => grade("", "wrong", true);

	const advance = () => {
		if (!current || !plan) return;
		const all = [...reps, current];
		setReps(all);
		setCurrent(null);
		setMiss(null);
		setFirstTry(null);
		setPeeked(false);
		// A miss comes back once at the end, typed (successive relearning:
		// a retrieval that succeeds after a failure is what fixes the form).
		let nextTotal = total;
		const it = current.item;
		if ((current.verdict === "wrong" || current.assisted) && !it.again && !NO_RETRY.has(it.kind) && relearned.current < RELEARN_MAX) {
			relearned.current++;
			const again: LessonItem = {
				...it,
				id: `${it.id}~again`,
				kind: "type",
				again: true,
				options: undefined,
			};
			setPlan({ ...plan, items: [...plan.items, again] });
			nextTotal++;
		}
		if (index + 1 >= nextTotal) void finish(all);
		else setIndex((i) => i + 1);
	};

	const why = async () => {
		if (!current) return;
		try {
			// The same sentence asked before reopens that chat (data/profiles/
			// <language>/lessons/why-index.json) instead of paying for a new one.
			await startTutorChat(router, {
				title: `Why ${current.item.answer}?`,
				prompt: whyPrompt({
					sentence: current.item.sentence,
					answer: current.item.answer,
					given: current.given,
					lemma: current.item.lemma,
				}),
				reuse: { sentence: current.item.sentence, answer: current.item.answer, lemma: current.item.lemma, given: current.given },
			});
		} catch {
			setError("Couldn't open the tutor. Check Settings → AI models.");
		}
	};

	const answered = reps.length + (current ? 1 : 0);
	const askLeave = () => {
		if (mode === "lesson" && !done && (answered > 0 || miss !== null)) setLeaving(true);
		else leave();
	};

	// Enter continues from the feedback sheet; Escape leaves.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				askLeave();
				return;
			}
			if (mode === "lesson" && current && e.key === "Enter") {
				e.preventDefault();
				advance();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	// While the leave question is up, it owns the keyboard: the rep's own
	// keys (1–4, Backspace, Enter) must not answer behind it. Capture on
	// window runs before every other listener; Enter still clicks the
	// focused button because only propagation stops, not the default.
	useEffect(() => {
		if (!leaving) return;
		const onKey = (e: KeyboardEvent) => {
			e.stopImmediatePropagation();
			if (e.key === "Escape") setLeaving(false);
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [leaving]);

	if (error) {
		return (
			<Frame>
				<div className="m-auto max-w-md text-center">
					<p className="font-prose text-lg text-foreground">{error}</p>
					<div className="mt-6 flex justify-center gap-2">
						<button type="button" onClick={() => void load()} className={PRIMARY}>
							Try again
						</button>
						<Link href="/" className={SECONDARY}>
							Back to Today
						</Link>
					</div>
				</div>
			</Frame>
		);
	}

	if (!plan || !item) {
		return (
			<Frame>
				<div className="m-auto flex items-center gap-3 text-ink-3" data-testid="lesson-loading">
					<LoaderCircleIcon className="size-5 animate-spin" strokeWidth={1.6} />
					<span className="font-prose">Picking your sentences…</span>
				</div>
			</Frame>
		);
	}

	if (score) {
		return (
			<Frame>
				<EndScreen
					mode={mode}
					focus={focus}
					unit={plan.unit}
					reps={reps}
					score={score}
					recorded={recorded}
					failed={saveFailed}
					onAgain={() => void load()}
					onNext={(u) => (u === plan.unit ? void load() : router.push(`/lesson?unit=${u}${gender ? `&gender=${gender}` : ""}`))}
				/>
			</Frame>
		);
	}

	const progress = mode === "blitz" ? left / BLITZ_SECONDS : (index + (current ? 1 : 0)) / total;
	const comesBack = !!current && (current.verdict === "wrong" || !!current.assisted) && !current.item.again && !NO_RETRY.has(current.item.kind) && !current.item.task && relearned.current < RELEARN_MAX;
	const examples = patternExamples(plan.items, current?.item);

	return (
		<BridgesContext.Provider value={plan.bridges ?? ["et"]}>
			<Frame strip={false}>
				{/* Top bar: exit · progress · combo · sound. The whole band drags the
			    window (its buttons carve themselves out, app/globals.css). */}
				<div className="lh-drag lh-wco-gutter shrink-0 select-none">
					<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
						<button type="button" aria-label="Leave the lesson" onClick={askLeave} data-testid="lesson-leave" className="-ml-1.5 pointer-coarse:-ml-3 rounded-lg p-1.5 pointer-coarse:p-3 text-ink-3 transition-colors hover:bg-well hover:text-ink-2">
								<XIcon className="size-5" strokeWidth={1.6} />
						</button>
						{mode === "blitz" ? (
							<div
								role="progressbar"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={Math.round(progress * 100)}
								className="relative h-1 flex-1 overflow-hidden rounded-full bg-well-2"
								aria-label={`${left} seconds left`}
							>
								<div className={cn("lh-fill rounded-full", left <= 10 ? "bg-miss" : "bg-teal")} style={fillStyle(Math.max(0.03, progress))} />
							</div>
						) : (
							<LessonTrail reps={reps} index={index} total={total} answered={!!current} />
						)}
						{mode === "blitz" && (
							<span className={cn("flex items-center gap-1 font-ui text-[13px] font-[550] tabular-nums", left <= 10 ? "text-miss" : "text-ink-2")}>
									<TimerIcon className="size-4" strokeWidth={1.6} />
								{left}s
							</span>
						)}
						<div
							className={cn("relative flex min-w-12 items-center gap-1 font-ui text-[13px] font-[550] tabular-nums", combo >= 3 ? "text-teal-2" : "text-ink-3")}
							data-testid="combo"
							title="Right in a row"
						>
							<ZapIcon className={cn("size-4", combo >= 3 && "fill-teal lh-flicker")} strokeWidth={1.6} aria-hidden="true" />
							{combo}
							<span className="sr-only"> right in a row</span>
							{floater && (
								<span key={floater.key} className="lh-float-up pointer-events-none absolute left-7 top-5 font-ui text-xs font-[550] text-teal-2">
									{floater.text}
								</span>
							)}
						</div>
						<SoundControl className="-mr-1.5" />
					</div>
				</div>

				{/* The rep */}
				<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
					<div key={`${item.id}-${index}`} ref={repBox} className={cn(COLUMN, "lh-rise")}>
						<RepView
							key={`${item.id}-${index}`}
							item={item}
							tag={tag}
							locked={!!current}
							result={current}
							miss={miss}
							hideMeaning={mode === "lesson" && hidesMeaning(plan.stage, item) && !peeked}
							onPeek={() => setPeeked(true)}
							onGrade={grade}
							onReady={setReady}
															place={mode === "blitz" ? undefined : `${index + 1} of ${total}`}
								eyebrow={mode === "blitz" ? `Blitz · ${reps.filter((r) => r.verdict !== "wrong").length} right` : focus === "mixups" ? "Mix-ups" : focus === "personal" ? "Your plan" : plan.gender ? `${unitInfo(item.unit).title} · ${genderLabel(plan.gender)}` : unitInfo(item.unit).title}
						/>
					</div>
				</div>

				{/* One bar at the bottom, always in the same place: Check before the
			    answer, the verdict and Continue after it (lessons only — blitz
			    flashes and moves on). */}
				{mode === "lesson" && current ? (
					<FeedbackSheet rep={current} tag={tag} onContinue={advance} onAskTutor={() => void why()} last={index + 1 >= total} comesBack={comesBack} examples={examples} />
				) : (
					<ActionBar kind={miss !== null && item.kind === "choose" ? "type" : item.kind} options={item.options?.length ?? 0} ready={ready} blitz={mode === "blitz"} onDontKnow={giveUp} />
				)}
				{leaving && <LeaveDialog answered={answered} total={total} onStay={() => setLeaving(false)} onLeave={leave} />}
			</Frame>
		</BridgesContext.Provider>
	);
}

/** The lesson's progress as one dash per question (the mockup's dots): teal
 *  once answered right, red for a miss, the one in front of you pale teal,
 *  the rest ahead grey. The bar is also the lesson's record. */
function LessonTrail({ reps, index, total, answered }: { reps: Rep[]; index: number; total: number; answered: boolean }) {
	const n = Math.max(total, 1);
	return (
		<ol className="flex flex-1 items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((index / n) * 100)} aria-label={`${index} of ${total} done`} data-testid="lesson-trail">
			{Array.from({ length: n }, (_, i) => {
				const rep = i < index ? reps[i] : i === index && answered ? reps[i] : undefined;
				const current = i === index && !answered;
				const tone = !rep ? (current ? "bg-teal-line" : "bg-well-2") : rep.verdict === "wrong" ? "bg-miss" : rep.verdict === "accents" ? "bg-teal/60" : "bg-teal";
					return <li key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", tone)} />;
			})}
		</ol>
	);
}

/** The keys that answer this kind of rep, shown beside the actions. Hidden
 *  on phone widths, where there is no keyboard to press. */
function ActionHint({ kind, options }: { kind: ItemKind; options: number }) {
	const key = (k: string) => <kbd className={KBD}>{k}</kbd>;
	return (
		<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 pointer-fine:flex">
			{kind === "type" || kind === "listen" ? (
				<>{key("Enter")} to check</>
			) : kind === "build" ? (
				<>Tap the words in order · {key("Backspace")} takes one back</>
			) : options > 1 ? (
				<>
					{key("1")}–{key(String(options))} to pick
				</>
			) : null}
		</p>
	);
}

function ActionBar({ kind, options, ready, blitz, onDontKnow }: { kind: ItemKind; options: number; ready: boolean; blitz: boolean; onDontKnow: () => void }) {
	return (
		<Dock>
			<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
				<ActionHint kind={kind} options={options} />
				<div className="ml-auto flex items-center gap-2">
					{/* Always there, even before anything is typed: a learner who does
					    not know the answer can leave the rep without typing a guess. */}
					{!blitz && (
						<button type="button" onClick={onDontKnow} className={QUIET} data-testid="lesson-dont-know">
							I don&apos;t know
						</button>
					)}
					{kind !== "choose" && !blitz && (
						<button type="submit" form={REP_FORM} disabled={!ready} className={PRIMARY} data-testid="lesson-check">
							Check
						</button>
					)}
				</div>
						</div>
		</Dock>
	);
}

/** The leave question: staying is the default (focused, and what Escape
 *  does), leaving is the deliberate second choice. */
function LeaveDialog({ answered, total, onStay, onLeave }: { answered: number; total: number; onStay: () => void; onLeave: () => void }) {
	return (
		<div className="lh-fade fixed inset-0 z-50 grid place-items-center bg-[rgb(var(--q-shadow-rgb)/0.45)] p-6" onClick={onStay}>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="lesson-leave-title"
				aria-describedby="lesson-leave-body"
				onClick={(e) => e.stopPropagation()}
				className="lh-menu-in q-card w-full max-w-sm p-6 text-center shadow-raise-hi"
				data-testid="lesson-leave-confirm"
			>
				<h2 id="lesson-leave-title" className="font-ui text-xl font-semibold tracking-[-0.018em] text-foreground">
					Leave this lesson?
				</h2>
				<p id="lesson-leave-body" className="mt-2 font-prose text-[15px] leading-relaxed text-ink-3">
						You have answered {answered} of {total}. If you leave now, {answered === 1 ? "that answer is" : "those answers are"} dropped and the lesson does not count.
				</p>
				<div className="mt-6 flex flex-col gap-2">
					<button type="button" autoFocus onClick={onStay} className={PRIMARY} data-testid="lesson-leave-stay">
						Keep going
					</button>
					<button type="button" onClick={onLeave} className={QUIET} data-testid="lesson-leave-confirm-leave">
						Leave
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── One rep ────────────────────────────────────────────────────────────────

/** The rep's form: the footer's Check submits it from outside. */
const REP_FORM = "lesson-rep";

/** From the practiced stage on, a type or choose rep hides the English
 *  until the answer: the Slovak sentence has to be parsed to know the
 *  form (parsing at speed is the gap the lessons found), and the
 *  dictionary-form chip is cue enough. A relearn rep and a new unit keep
 *  it (docs/research/desirable-difficulties.md). */
function hidesMeaning(stage: LessonPlan["stage"], item: LessonItem): boolean {
	if (!stage || stage === "new") return false;
	if (item.again) return false;
	return item.kind === "type" || item.kind === "choose";
}

function hintFor(item: LessonItem): string {
	// A vocabulary rep blanks the word itself, so its hint is the meaning;
	// a grammar rep shows the dictionary form (core/lesson.ts decides).
	return item.hint ?? item.lemma;
}

/** The cue under the sentence, labeled so it never reads as a stray word:
 *  "means" for a vocabulary rep (the English), "base form" for a grammar
 *  rep (the dictionary form to inflect). */
function HintChip({ item }: { item: LessonItem }) {
	const lang = useActiveLanguage();
	const pairs = unitInfo(item.unit).kind === "pairs";
	const meaning = (unitInfo(item.unit).kind === "words" || pairs) && !!item.hint;
	return (
		<span className="q-pair mr-2" data-testid="lesson-hint-chip">
			<s>{pairs ? "twins" : meaning ? "means" : "base form"}</s>
			<span lang={meaning && !pairs ? undefined : lang?.code}>{hintFor(item)}</span>
		</span>
	);
}

function repIcon(item: LessonItem): QIconName {
	if (item.kind === "listen" || item.kind === "meaning") return "listen";
	return unitInfo(item.unit).kind === "words" ? "words" : "grammar";
}

const PLAY_BIG = "lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-[var(--q-on-teal)] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2";
const PLAY_SLOW = "lh-press flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-card text-ink-3 shadow-[0_0_0_1px_var(--q-line-2)] hover:bg-well hover:text-ink-2";
const PLAY_SMALL = "lh-press flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-wash text-teal-2 hover:bg-[var(--q-teal-line)]";
/** The target form in a sentence that is read, not blanked (a meaning rep, a twin). */
const MARKED = "bg-transparent px-0.5 font-semibold text-teal-2 underline decoration-teal decoration-2 underline-offset-[6px]";
/** The slot the answer sits in: the mockup's `.q-slot`, sized to the 44px sentence. */
const SLOT = "inline-flex h-12 items-center align-baseline sm:h-[58px]";

function RepView({
	item,
	tag,
	locked,
	result,
	miss,
	hideMeaning,
	onPeek,
	onGrade,
		onReady,
		eyebrow,
		place,
	}: {
	item: LessonItem;
	tag: string;
	locked: boolean;
	result: Rep | null;
	miss: string | null;
	hideMeaning: boolean;
	onPeek: () => void;
	onGrade: (given: string, verdict: RepVerdict) => void;
	onReady: (ready: boolean) => void;
			eyebrow: string;
		place?: string;
	}) {
		return (
			<div data-word-lookup-enabled={locked ? "true" : "false"}>
				<PracticeCard icon={repIcon(item)} title={item.again ? `${eyebrow} · Once more` : eyebrow} sub={miss !== null && item.kind === "choose" ? kindLabel({ ...item, kind: "type" }) : kindLabel(item)} right={place}>
					{item.task ? (
						<TaskRep item={item} locked={locked} result={result} onGrade={onGrade} />
					) : item.kind === "build" ? (
						<BuildRep item={item} locked={locked} onGrade={onGrade} onReady={onReady} />
					) : (
						<ClozeRep item={item} tag={tag} locked={locked} result={result} miss={miss} hideMeaning={hideMeaning} onPeek={onPeek} onGrade={onGrade} onReady={onReady} />
					)}
				</PracticeCard>
			</div>
		);
}

/** After a first miss: the smallest cue and one more try. The trigger word
 *  (the preposition that decides the case) when there is one, else which
 *  form is wanted in plain words; never the rule, never the bridge — those
 *  come with the answer after the second miss. A graded hint keeps the
 *  retry a retrieval, not a reading (Aleven & Koedinger 2002; docs/
 *  research/desirable-difficulties.md). A missed choice retries typed. */
function HintPanel({ item, miss, wasChoice }: { item: LessonItem; miss: string; wasChoice: boolean }) {
	const vocabulary = unitInfo(item.unit).kind === "words";
	const pairs = unitInfo(item.unit).kind === "pairs";
	const slip = !vocabulary && !pairs ? formSlip({ answer: item.answer, lemma: item.lemma, given: miss }) : undefined;
	return (
		<div className="lh-rise mt-6 rounded-[14px] bg-well px-5 py-4" role="status" aria-live="polite" data-testid="lesson-hint">
			<p className="font-ui text-[15px] font-semibold tracking-[-0.01em] text-foreground">
				Not “<span lang={lessonLanguage()}>{miss}</span>”. {item.kind === "listen" ? "Listen again and try once more." : wasChoice ? "Now type it." : "One more try."}
			</p>
			<div className="mt-2 flex flex-col gap-1 font-prose text-[15px] leading-relaxed">
				{item.pair?.cue ? (
					<p className="text-foreground">{item.pair.cue}</p>
				) : slip === "base" ? (
					<p className="text-foreground">
						<span className="font-semibold text-miss">“{miss}”</span> is the base form.{" "}
						{item.trigger ? (
							<>
								Look at <span className="rounded-[5px] bg-card px-1.5 font-semibold text-teal-2" lang={lessonLanguage()}>{item.trigger}</span>: it needs a case ending.
							</>
						) : item.form ? (
							<>Wanted: <span className="font-semibold">{item.form}</span>.</>
						) : (
							<>Change the ending to fit this sentence.</>
						)}
					</p>
				) : slip === "same-word" ? (
					<p className="text-foreground">
						<span className="font-semibold text-miss">“{miss}”</span> has another ending.{" "}
						{item.trigger ? (
							<>
								Look at <span className="rounded-[5px] bg-card px-1.5 font-semibold text-teal-2" lang={lessonLanguage()}>{item.trigger}</span>: it decides the case ending.
							</>
						) : item.form ? (
							<>Wanted: <span className="font-semibold">{item.form}</span>.</>
						) : (
							<>Check which case is needed here.</>
						)}
					</p>
				) : item.trigger ? (
					<p className="text-foreground">
						Look at{" "}
						<span className="rounded-[5px] bg-card px-1.5 font-semibold text-teal-2" lang={lessonLanguage()}>
							{item.trigger}
						</span>
						: it decides the form.
					</p>
				) : item.form && !vocabulary ? (
					// A pairs rep is typed as the twin's dictionary form (what the
					// options showed), not the inflected form the sentence has.
					<p className="text-foreground">Wanted: {pairs ? item.answer : item.form}.</p>
				) : (
					<p className="text-foreground">
						{vocabulary ? (
							<>
								Find the word for “{hintFor(item)}”.
							</>
						) : (
							"Read the whole sentence again: who does what, and which case follows."
						)}
					</p>
				)}
			</div>
		</div>
	);
}

function ClozeRep({
	item,
	tag,
	locked,
	result,
	miss,
	hideMeaning,
	onPeek,
	onGrade,
	onReady,
}: {
	item: LessonItem;
	tag: string;
	locked: boolean;
	result: Rep | null;
	miss: string | null;
	hideMeaning: boolean;
	onPeek: () => void;
	onGrade: (given: string, verdict: RepVerdict) => void;
	onReady: (ready: boolean) => void;
}) {
	const lang = useActiveLanguage();
	const [given, setGiven] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	// A missed choice retries typed: recognition failed, so the second try
	// is production (recall beats recognition; a second pick from three
	// would be a guess).
	const retypes = item.kind === "choose" && miss !== null;
	const typed = item.kind === "type" || item.kind === "listen" || retypes;
	const listen = item.kind === "listen";
	// A meaning rep is input: the whole sentence, spoken as it appears, the
	// target form marked, and three meanings to choose from.
	const meaning = item.kind === "meaning";
	// A pairs rep (Dvojičky): the sentence shows the twin's real form, and
	// the choice between the pair's two lemmas is the question.
	const pairsRep = unitInfo(item.unit).kind === "pairs";
	const target = pairsRep ? (item.form ?? item.answer) : item.answer;

	useEffect(() => {
		if (typed) inputRef.current?.focus();
		if (listen || meaning) void speak(item.sentence).catch(() => {});
	}, [item, typed, listen, meaning]);

	useEffect(() => onReady(given.trim().length > 0), [given, onReady]);

	// The retry: select the wrong answer so typing replaces it; a missed
	// choice starts an empty field.
	useEffect(() => {
		if (miss === null || !typed) return;
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [miss, typed]);

	const submit = () => {
		if (locked || !given.trim()) return;
		onGrade(given, listen ? gradeListen(item, given, tag) : compareAnswer(item.answer, given, tag, item.alternatives));
	};

	/** An option's verdict: a form against the answer, a meaning against
	 *  the translation. */
	const judge = (o: string): RepVerdict => (meaning ? (o === item.translation ? "exact" : "wrong") : compareAnswer(item.answer, o, tag, item.alternatives));

	// 1–4 pick an option (not during a typed retry).
	useEffect(() => {
		if ((item.kind !== "choose" && !meaning) || locked || retypes) return;
		const onKey = (e: KeyboardEvent) => {
			const n = Number(e.key);
			const opt = item.options?.[n - 1];
			if (opt && opt !== miss) {
				e.preventDefault();
				onGrade(opt, judge(opt));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	// The filled-in word is the right form, so it reads as right (green) even
	// after a miss; the bar below says what was wrong.
	const verdictInk = result ? (result.verdict === "accents" ? "text-ink-2 underline decoration-ink-3 decoration-2 underline-offset-[8px]" : "text-teal-2 underline decoration-teal decoration-2 underline-offset-[8px]") : "";
	// During the retry the trigger word is underlined: noticing it is the skill.
	const triggerAt = miss !== null && item.trigger ? item.before.trimEnd().lastIndexOf(" ") + 1 : -1;
	const beforeText =
		triggerAt >= 0 &&
		item.before
			.trimEnd()
			.slice(triggerAt)
			.toLocaleLowerCase("sk-SK")
			.replace(/^[„“"'(]+/, "") === item.trigger ? (
			<span>
				{item.before.slice(0, triggerAt)}
				<span className="underline decoration-teal decoration-[3px] underline-offset-[8px]">{item.before.trimEnd().slice(triggerAt)}</span>
				{item.before.slice(item.before.trimEnd().length)}
			</span>
		) : (
			<span>{item.before}</span>
		);

	const input = (className: string) => (
		<input
			ref={inputRef}
			value={given}
			onChange={(e) => setGiven(e.target.value)}
			aria-label={listen ? "What you hear" : "Missing word"}
			placeholder={listen ? "Type what you hear" : undefined}
			data-testid="lesson-input"
			autoComplete="off"
			autoCorrect="off"
			autoCapitalize="off"
			spellCheck={false}
			className={cn(
								"rounded-[10px] caret-teal outline-none transition-shadow selection:bg-teal/25 placeholder:font-normal placeholder:text-ink-4",
				className,
			)}
		/>
	);

	// Listening before the answer: nothing to read, only to hear and type.
	if (listen && !locked) {
		return (
			<form id={REP_FORM} onSubmit={(e) => (e.preventDefault(), submit())}>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => void speak(item.sentence)}
						aria-label="Play the sentence"
						className={PLAY_BIG}
						>
							<Volume2Icon className="size-6" strokeWidth={1.6} />
					</button>
					<button
						type="button"
						onClick={() => void speak(item.sentence, undefined, { slow: true })}
						aria-label="Play slowly"
						title="Play slowly"
						className={PLAY_SLOW}
						>
							<SnailIcon className="size-5" strokeWidth={1.6} />
					</button>
				</div>
				{input("mt-6 block h-14 w-full bg-card px-4 font-prose text-2xl font-medium tracking-[-0.01em] text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)] focus:shadow-[inset_0_0_0_1.5px_var(--q-teal)]")}
				<DiacriticBar variant="keys" className="mt-4" />
				{miss !== null && <HintPanel item={item} miss={miss} wasChoice={false} />}
			</form>
		);
	}

	return (
		<div>
			{meaning && (
				<div className="mb-6 flex items-center gap-3">
					<button
						type="button"
						onClick={() => void speak(item.sentence)}
						aria-label="Play the sentence"
						className={PLAY_BIG}
						>
							<Volume2Icon className="size-6" strokeWidth={1.6} />
					</button>
					<button
						type="button"
						onClick={() => void speak(item.sentence, undefined, { slow: true })}
						aria-label="Play slowly"
						title="Play slowly"
						className={PLAY_SLOW}
						>
							<SnailIcon className="size-5" strokeWidth={1.6} />
					</button>
				</div>
			)}
			<div className="relative">
				<form id={REP_FORM} onSubmit={(e) => (e.preventDefault(), submit())}>
					<p className="font-prose text-[28px] font-semibold leading-[1.5] tracking-[-0.032em] text-foreground sm:text-[44px] sm:leading-[64px]" lang={lessonLanguage()}>
						{beforeText}
						{meaning ? (
							// Input: the form is there to be met, not produced — marked, never blanked.
							<mark className={MARKED}>{item.answer}</mark>
						) : locked ? (
							<span className={cn("lh-pop", SLOT, verdictInk)}>
									{pairsRep ? target : item.answer}
								</span>
						) : pairsRep && !typed ? (
							// Dvojičky: the twin's form is the evidence, so it stays marked
							// and the choice between the two lemmas is the question.
							<mark className={MARKED}>{target}</mark>
						) : typed ? (
							// Grows with what is typed (a hidden twin sizes it), so a long
							// answer is never clipped.
							<span className="mx-1 inline-grid max-w-full align-baseline" style={{ minWidth: `${Math.max(4, item.answer.length + 2)}ch` }}>
								<span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre px-3.5 font-semibold">
									{given || " "}
								</span>
								{input("q-write col-start-1 row-start-1 h-12 w-px min-w-full self-center px-1 py-0 font-semibold text-foreground outline-none sm:h-[58px]")}
							</span>
						) : (
							<span className="q-blank mx-1 w-[5ch]" aria-label="blank" />
						)}
						<span>{item.after}</span>
					</p>
					<p className="mt-3 font-prose text-base text-ink-2">
							<HintChip item={item} />
						{/* The meaning is the question, so it shows only once answered;
						    from the practiced stage on it hides until the answer, and
						    asking for it early halves the rep. */}
						{meaning && !locked ? (
							<span className="text-ink-3">Hear it, then pick what it means.</span>
						) : hideMeaning && !locked ? (
							<button
								type="button"
								onClick={onPeek}
								className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-ui text-[13px] font-[550] text-ink-3 hover:bg-well hover:text-ink-2"
									data-testid="lesson-peek"
								title="Show the English sentence. This answer then earns half XP."
							>
								<LanguagesIcon className="size-4" strokeWidth={1.6} aria-hidden="true" />
								Show translation · half XP
							</button>
						) : (
							item.translation
						)}
						{locked && !meaning && (
							<button
								type="button"
								onClick={() => void speak(item.sentence)}
								aria-label="Play the sentence"
								title="Play again"
								className="lh-press ml-2 inline-flex size-8 translate-y-[3px] items-center justify-center rounded-full bg-well align-baseline text-ink-2 hover:bg-well-2"
							>
								<Volume2Icon className="size-4" strokeWidth={1.6} />
							</button>
						)}
					</p>
					{typed && !locked && <DiacriticBar variant="keys" className="mt-5" />}
				</form>
			</div>

			{miss !== null && !locked && <HintPanel item={item} miss={miss} wasChoice={retypes} />}

			{(item.kind === "choose" || meaning) && !retypes && (
				<div className={cn("mt-7 grid gap-3", meaning ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")} data-testid="lesson-options">
					{item.options!.map((o, i) => {
						const picked = result?.given === o;
						const right = locked && judge(o) === "exact";
						const ruledOut = !locked && miss === o;
						return (
							<OptionTile key={o} n={i + 1} lang={meaning ? undefined : lang?.code} disabled={locked || ruledOut} onClick={() => onGrade(o, judge(o))} state={right ? "right" : picked ? "wrong" : locked ? "dim" : ruledOut ? "ruled-out" : "idle"}>
								{o}
							</OptionTile>
						);
					})}
				</div>
			)}
		</div>
	);
}

/** A form-reading task (aspect chapters, src/core/aspect-tasks.ts). A grid
 *  shows its forms and asks which cell holds one; a cue shows the sentence and
 *  asks which word decided its form. Both are a choice, never typed and never
 *  retried; the answer and the Why? panel follow the choice. */
function TaskRep({ item, locked, result, onGrade }: { item: LessonItem; locked: boolean; result: Rep | null; onGrade: (given: string, verdict: RepVerdict) => void }) {
	const lang = useActiveLanguage();
	const task = item.task!;
	const options = item.options ?? [];
	const grid = task.kind === "grid";
	const judge = (o: string): RepVerdict => (o === item.answer ? "exact" : "wrong");

	useEffect(() => {
		if (locked) return;
		const onKey = (e: KeyboardEvent) => {
			const opt = options[Number(e.key) - 1];
			if (opt) {
				e.preventDefault();
				onGrade(opt, judge(opt));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	return (
		<div>
			{task.kind === "grid" ? (
				<>
					<p className="font-prose text-xl leading-snug text-foreground">
						Which cell does <span className="font-semibold" lang={lessonLanguage()}>{task.form}</span> belong in?
					</p>
					<TaskGrid task={task} revealed={locked} />
				</>
			) : (
				<>
					<p className="font-ui text-[14px] text-ink-3">{task.question}</p>
					<p className="mt-3 font-prose text-[28px] font-semibold leading-[1.5] tracking-[-0.032em] text-foreground sm:text-[44px] sm:leading-[64px]" lang={lessonLanguage()}>
						{item.sentence}
					</p>
				</>
			)}
			<div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="lesson-options">
				{options.map((o, i) => {
					const picked = result?.given === o;
					const right = locked && judge(o) === "exact";
					return (
						<OptionTile key={o} n={i + 1} lang={grid ? undefined : lang?.code} disabled={locked} onClick={() => onGrade(o, judge(o))} state={right ? "right" : picked ? "wrong" : locked ? "dim" : "idle"}>
							{o}
						</OptionTile>
					);
				})}
			</div>
		</div>
	);
}

function BuildRep({ item, locked, onGrade, onReady }: { item: LessonItem; locked: boolean; onGrade: (given: string, verdict: RepVerdict) => void; onReady: (ready: boolean) => void }) {
	// Bank entries by position (words can repeat in a sentence).
	const [picked, setPicked] = useState<number[]>([]);
	const bank = item.bank ?? [];
	const tokens = item.tokens ?? [];

	useEffect(() => onReady(picked.length > 0), [picked, onReady]);

	const check = () => {
		if (locked || picked.length === 0) return;
		const given = picked.map((i) => bank[i]!);
		onGrade(given.join(" "), sameSentence(tokens, given) ? "exact" : "wrong");
	};

	useEffect(() => {
		if (locked) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Backspace") {
				e.preventDefault();
				setPicked((p) => p.slice(0, -1));
			} else if (e.key === "Enter") {
				e.preventDefault();
				check();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const tile = "rounded-[10px] bg-card px-3.5 py-2 font-prose text-xl font-medium tracking-[-0.01em] text-foreground shadow-raise";
	return (
		<form id={REP_FORM} onSubmit={(e) => (e.preventDefault(), check())}>
			<p data-no-word-lookup="true" className="font-prose text-[22px] font-medium leading-snug tracking-[-0.018em] text-foreground">“{item.translation}”</p>
			{/* After the answer: the sentence as one line, with a replay button
			    (it also plays on its own when the answer lands). */}
			{locked && (
				<div className="lh-pop mt-6 flex items-center gap-3" data-testid="build-sentence">
					<button
						type="button"
						onClick={() => void speak(item.sentence)}
						aria-label="Play the sentence"
						className={PLAY_SMALL}
						>
							<Volume2Icon className="size-[18px]" strokeWidth={1.6} />
					</button>
					<p className="font-prose text-[22px] font-semibold tracking-[-0.018em] text-foreground" lang={lessonLanguage()}>
							{item.sentence}
					</p>
				</div>
			)}
			<div className="mt-6 flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-[10px] bg-well p-3" data-testid="build-answer">
				{picked.map((bi, k) => (
					<button key={`${bi}-${k}`} type="button" disabled={locked} onClick={() => setPicked((p) => p.filter((_, j) => j !== k))} className={cn("lh-pop", tile)} lang={lessonLanguage()}>
						{bank[bi]}
					</button>
				))}
			</div>
			<div className="mt-8 flex flex-wrap justify-center gap-2">
				{bank.map((w, bi) => {
					const used = picked.includes(bi);
					return (
						<button
							key={bi}
							type="button"
							disabled={locked || used}
							onClick={() => {
								sfx.tap();
								setPicked((p) => [...p, bi]);
							}}
							className={cn(tile, "transition-colors", used ? "bg-well-2 text-transparent shadow-none" : "hover:bg-well")}
							lang={lessonLanguage()}
						>
							{w}
						</button>
					);
				})}
			</div>
		</form>
	);
}

// ─── Feedback ───────────────────────────────────────────────────────────────

function FeedbackSheet({
	rep,
	tag,
	onContinue,
	onAskTutor,
	last,
	comesBack,
	examples,
}: {
	rep: Rep;
	tag: string;
	onContinue: () => void;
	onAskTutor: () => void;
	last: boolean;
	comesBack: boolean;
	examples: LessonItem[];
}) {
	const lang = useActiveLanguage();
	const praise = useMemo(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]!, []);
	const { item, verdict, given } = rep;
	// After a miss the rule opens by itself: feedback after a failed
	// retrieval should explain, not only correct (Butler, Godbole & Marsh
	// 2013). A right answer keeps it behind Why?.
	const [open, setOpen] = useState(verdict === "wrong" && item.kind !== "build" && item.kind !== "meaning");
	const bridgeLangs = useContext(BridgesContext);
	const info = unitInfo(item.unit);
	// A whole typed sentence (listening) is answered with the whole sentence.
	const expected = item.kind === "meaning" ? item.translation : item.kind === "build" || (item.kind === "listen" && given.trim().includes(" ")) ? item.sentence : item.answer;
	const slips = verdict === "accents" ? new Set(diacriticSlips(expected, given, tag)) : new Set<number>();
	const tone =
		verdict === "exact"
			? {
						bg: "bg-teal-wash",
						ink: "text-teal-2",
						title: rep.assisted ? "Got it, with help" : praise,
					}
			: verdict === "accents"
				? {
							bg: "bg-well",
							ink: "text-ink-2",
							title: "Almost! Check the accents",
						}
				: {
							bg: "bg-miss-soft",
							ink: "text-miss",
							title: "Not quite",
						};
	const canExplain = item.kind !== "build";
	const [more, setMore] = useState(false);
	const hasMore = !!item.pair?.bridge || !!item.pair?.explain || unitBridges(item.unit, bridgeLangs).length > 0 || examples.length > 0;
	const [marked, setMarked] = useState(false);
	// "Tricky": put the word in the review deck now, ahead of its turn.
	const mark = async () => {
		setMarked(true);
		try {
			await fetch("/api/review/enqueue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: [item.slug] }) });
		} catch {
			setMarked(false);
		}
	};
	const inDeck = marked || (item.known !== null && item.known !== undefined);
	return (
		<div className={cn("lh-rise shadow-[0_-1px_0_var(--q-line)]", tone.bg)} data-testid="lesson-feedback" data-verdict={verdict} data-word-lookup-enabled="true" role="status" aria-live="polite">
			<div className={cn(COLUMN, "py-4")}>
				{/* Header row: verdict on the left, actions on the right, on one line. */}
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
					<div className="flex items-center gap-3">
						{verdict === "accents" ? (
							<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-3 font-ui text-xs font-semibold text-[var(--q-bg)]" aria-hidden="true">
								!
							</span>
						) : (
							<VerdictDisc ok={verdict === "exact"} />
						)}
						<p className={cn("font-ui text-[19px] font-semibold leading-tight tracking-[-0.015em]", tone.ink)}>{tone.title}</p>
						{comesBack && <span className="font-ui text-[13px] text-ink-3">Comes back once more at the end</span>}
					</div>
					<div className="flex items-center gap-2">
						{verdict === "exact" && (
							<button
								type="button"
								onClick={() => void mark()}
								disabled={inDeck}
								className={cn(SECONDARY, "gap-1.5 disabled:opacity-70")}
								data-testid="lesson-tricky"
								title={inDeck ? "This word is in your review deck" : "Add this word to your review deck"}
							>
								{inDeck ? <BookmarkCheckIcon className="size-4" strokeWidth={1.6} /> : <BookmarkIcon className="size-4" strokeWidth={1.6} />}
								{inDeck ? "In your deck" : "Add to deck"}
							</button>
						)}
						{canExplain && (
							<button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={SECONDARY} data-testid="lesson-why">
								{open ? "Hide" : "Why?"}
							</button>
						)}
						<button type="button" autoFocus onClick={onContinue} data-testid="lesson-continue" className={PRIMARY}>
							{last ? "Finish" : "Continue"}
						</button>
					</div>
				</div>

				{/* Details, aligned under the title (past the badge). */}
				<div className="mt-3 flex flex-col gap-3 sm:pl-9">
					{verdict !== "exact" && (
						<p className="font-prose text-[17px] text-foreground">
							{item.kind === "meaning" ? "It meant:" : "Correct answer:"}{" "}
							<span className="font-semibold" lang={item.kind === "meaning" || item.task?.kind === "grid" ? undefined : lang?.code}>
								{[...expected].map((ch, i) => (
									<span key={i} className={slips.has(i) ? `underline decoration-2 underline-offset-4 ${tone.ink}` : undefined}>
										{ch}
									</span>
								))}
							</span>
							{verdict === "wrong" && given && (
								<span className="text-[15px] text-ink-3">
									{" "}
									· {item.kind === "meaning" ? "you picked" : "you wrote"} “<span lang={item.kind === "meaning" || item.task?.kind === "grid" ? undefined : lang?.code}>{given}</span>”
								</span>
							)}
						</p>
					)}
					{verdict === "exact" && rep.variant && (
						<div className="rounded-[10px] bg-card px-3.5 py-2.5 font-prose text-[15px] shadow-[inset_0_0_0_1px_var(--q-teal-line)]" data-testid="variant-accepted">
						<span className="font-semibold text-teal-2">Also accepted: “{given}”</span>
							<span className="text-muted-foreground"> · This sentence uses </span>
							<b className="font-semibold text-foreground" lang={lessonLanguage()}>{item.answer}</b>.
						</div>
					)}
					{verdict === "exact" && item.kind !== "build" && (
						<div className="flex items-start gap-3" data-testid="right-sentence">
							<button
								type="button"
								onClick={() => void speak(item.sentence)}
								className={cn("mt-0.5", PLAY_SMALL)}
								aria-label="Play the sentence again"
								title="Play again"
							>
								<Volume2Icon className="size-4" strokeWidth={1.6} />
							</button>
							<div className="min-w-0">
								<p className="font-prose text-[17px] font-medium leading-snug tracking-[-0.008em] text-foreground" lang={lessonLanguage()}>
									{item.before}
									<b className={tone.ink}>{item.pair ? (item.form ?? item.answer) : item.answer}</b>
									{item.after}
								</p>
								<p data-no-word-lookup="true" className="font-prose text-[15px] text-ink-3">{item.translation}</p>
							</div>
						</div>
					)}
					{verdict === "exact" && (
						<dl className="flex flex-wrap gap-2" data-testid="right-meta">
							<Fact icon={<WholeWordIcon className="size-4" strokeWidth={1.6} />} label={item.form ? "Form" : "Word"} value={item.form ?? `${item.lemma} · ${item.gloss.split(/[;,(]/)[0]!.trim()}`} />
							{rankLabel(item.rank, item.cat) && <Fact icon={<ChartColumnIcon className="size-4" strokeWidth={1.6} />} label="How common" value={rankLabel(item.rank, item.cat)!} />}
							<Fact icon={<BrainIcon className="size-4" strokeWidth={1.6} />} label="Memory" value={knownLine(item.known)!} />
						</dl>
					)}
				</div>

				{/* "Why?" opens here, under the verdict: the lesson stays where it is. */}
				{open && (
					<div className="lh-rise mt-3 sm:pl-9" data-testid="lesson-why-panel">
						<div className="rounded-[10px] bg-card px-3.5 py-2.5 font-prose text-[15px] leading-relaxed text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)]">
							<span className={cn(WHY_LABEL, "mr-2")}>{info.kind === "words" ? "Tip" : "Rule"}</span>
							{item.trigger && (
								<>
									<span className="rounded-[5px] bg-card px-1.5 font-semibold text-teal-2" lang={lessonLanguage()}>
										{item.trigger}
									</span>{" "}
									decides the form here.{" "}
								</>
							)}
							{item.pair?.rule ?? info.rule}
						</div>
						{hasMore && (
							<button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} data-testid="lesson-more" className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-ui text-[13px] font-[550] text-ink-3 hover:bg-card hover:text-ink-2">
								{more ? "Less" : "Parallels and examples"}
								<ChevronDownIcon className={cn("size-3.5 transition-transform", more && "rotate-180")} strokeWidth={1.8} aria-hidden="true" />
							</button>
						)}
						{(more || !hasMore) && (
							<div className="lh-rise mt-2 flex flex-col gap-4">
							{item.pair?.explain && <GrammarExplain explain={item.pair.explain} />}
							<dl className="grid gap-x-6 gap-y-2 font-prose text-[15px] leading-relaxed sm:grid-cols-[6rem_1fr]">
							{item.pair?.bridge ? (
								<>
									<dt className={WHY_LABEL}>Parallels</dt>
									<dd className="text-foreground">{item.pair.bridge}</dd>
								</>
							) : (
								unitBridges(item.unit, bridgeLangs).length > 0 && (
									<>
										<dt className={WHY_LABEL}>Parallels</dt>
										<dd className="flex flex-col gap-1">
											<Bridges unit={item.unit} />
										</dd>
									</>
								)
							)}
							{examples.length > 0 && (
								<>
									<dt className={WHY_LABEL}>Same pattern</dt>
									<dd>
										<ul className="flex flex-col gap-0.5">
											{examples.map((ex) => (
												<li key={ex.id} className="text-muted-foreground">
													<span className="text-foreground" lang={lessonLanguage()}>
														{ex.before}
														<b>{ex.answer}</b>
														{ex.after}
													</span>{" "}
													<span data-no-word-lookup="true">· {ex.translation}</span>
												</li>
											))}
										</ul>
									</dd>
								</>
							)}
							<dt className={WHY_LABEL} />
							<dd>
								<button type="button" onClick={onAskTutor} className="font-ui text-[13px] font-[550] text-ink-3 underline decoration-[var(--q-line-2)] underline-offset-[3px] hover:text-ink-2">
									Still unsure? Ask the tutor (opens a chat)
								</button>
							</dd>
							</dl>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

const WHY_LABEL = "font-ui text-[12.5px] font-semibold text-ink-3 sm:pt-0.5";

/** One labeled fact chip under a right answer: a small caption and the
 *  value, so the footer scans as "Form / How common / Memory". */
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<div className="flex items-center gap-2.5 rounded-[10px] bg-card py-1.5 pl-2.5 pr-3.5 shadow-raise">
			<span className="text-ink-3" aria-hidden="true">
				{icon}
			</span>
			<div className="min-w-0">
				<dt className="font-ui text-xs text-ink-3">{label}</dt>
				<dd className="font-prose text-sm font-medium leading-tight text-foreground">{value}</dd>
			</div>
		</div>
	);
}

// ─── End screen ─────────────────────────────────────────────────────────────

function EndScreen({
	mode,
	focus,
	unit,
	reps,
	score,
	recorded,
	failed,
	onAgain,
	onNext,
}: {
	mode: Mode;
	focus?: LessonFocus;
	unit: UnitId;
	reps: Rep[];
	score: LessonScore;
	recorded: Recorded | null;
	failed: boolean;
	onAgain: () => void;
	onNext: (unit: UnitId) => void;
}) {
	const { correct, xp, perfect } = score;
	const accuracy = reps.length ? Math.round((correct / reps.length) * 100) : 0;
	// One line per sentence: a miss and its "once more" rep are the same item.
	const missed = reps.filter((r, i) => (r.verdict !== "exact" || r.assisted) && reps.findIndex((o) => o.item.sentence === r.item.sentence) === i);
	// The score is the lesson's own and shows at once. What the server keeps
	// (streak, goal, unit progress) fills its slot when it lands; each slot
	// keeps its size until then, so nothing moves.
	const goalMet = recorded ? recorded.summary.todayXp >= recorded.summary.dailyGoal : false;
	// A Mix-ups lesson moves no unit, so it has no place on the path to show.
	const here = focus ? null : (recorded?.summary.units.find((u) => u.id === unit) ?? null);
	const pairs = new Set(reps.map((r) => r.item.pair?.id).filter(Boolean)).size;
	const wasDone = here ? unitDone(here.lessons - 1, here.accuracy) : false;
	const nextUnit = recorded ? (recorded.summary.units.find((u) => u.id === recorded.summary.next) ?? null) : null;
	const stayHere = !!recorded && recorded.summary.next === unit;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Enter") return;
			if (mode === "blitz" || focus) {
				e.preventDefault();
				onAgain();
			} else if (recorded) {
				e.preventDefault();
				onNext(recorded.summary.next);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [recorded, mode, focus, onAgain, onNext]);

	const title = mode === "blitz" ? (recorded?.newBest ? "New best." : "Time's up.") : focus === "mixups" ? (perfect ? "No mix-ups." : "Mix-ups done.") : focus === "personal" ? (perfect ? "Perfect plan practice." : "Plan practice done.") : here?.done && !wasDone ? "Unit complete." : perfect ? "Perfect lesson." : "Lesson complete.";
	const where = mode === "blitz" ? `${correct} right in 60 seconds` : focus === "mixups" ? `${pairs} ${pairs === 1 ? "pair" : "pairs"} of look-alike words` : focus === "personal" ? "Built from your own mistakes" : here ? whereLine(here, nextUnit) : unitInfo(unit).title;

	return (
		<div className="q-rise m-auto w-full max-w-xl px-5" data-testid="lesson-end">
			<p className="q-date flex items-center gap-1.5">
				<QIcon name={mode === "blitz" ? "fast" : "check"} className="text-teal" />
				{mode === "blitz" ? "Blitz" : focus === "mixups" ? "Mix-ups" : focus === "personal" ? "Your plan" : unitInfo(unit).title}
			</p>
			<h1 className="q-hello">{title}</h1>
			<p className="q-line dim mt-2 min-h-7" data-testid="lesson-end-where">
				{where}
			</p>
			{mode === "lesson" && !focus && (
				<ol className="q-dots mt-3 ml-0" aria-label={here ? `${Math.min(here.lessons, LESSONS_TO_COMPLETE)} of ${LESSONS_TO_COMPLETE} lessons done` : undefined}>
					{!here?.done &&
						Array.from({ length: LESSONS_TO_COMPLETE }, (_, i) => (
							<li key={i} className={cn("h-1 w-8 rounded-full", !here ? "animate-pulse bg-well-2" : i < here.lessons ? "bg-teal" : "bg-well-2")} />
						))}
				</ol>
			)}

			{/* A stamp earned by this lesson is pressed onto the page (src/core/stamps.ts). */}
			{recorded?.newStamps && recorded.newStamps.length > 0 && (
				<ul className="mt-6 flex flex-col gap-2" aria-label="New stamps" data-testid="lesson-new-stamps">
					{recorded.newStamps.map((st) => (
						<li key={st.id} className="q-card flex items-center gap-3 py-2 pl-2 pr-4 text-left">
							<StampDisc state={st} size="sm" pressed />
							<span className="min-w-0">
								<span className="block font-ui text-xs font-semibold text-teal-2">New stamp</span>
								<span className="block font-ui text-sm font-semibold text-foreground" lang={lessonLanguage()}>
									{st.name}
								</span>
								<span className="block font-ui text-xs text-ink-3">{st.line}</span>
							</span>
						</li>
					))}
				</ul>
			)}
			<Stats className="mt-6">
				<Stat label="XP" value={`+${xp}`} ink="text-teal-2" />
				<Stat label={mode === "blitz" ? "Best" : "Right"} value={mode === "blitz" ? String(Math.max(recorded?.summary.bestBlitz ?? 0, correct)) : `${accuracy}%`} ink={mode === "blitz" || accuracy >= 80 ? "text-teal-2" : "text-foreground"} />
				<Stat label="Days in a row" value={recorded ? String(recorded.summary.streak.days) : null} ink="text-foreground" icon={<FlagIcon className="size-4 text-teal" strokeWidth={1.6} />} />
			</Stats>

			<p className="mt-3 min-h-5 font-prose text-[13px] text-ink-3" data-testid="lesson-end-recorded">
				{recorded ? (
					<>
						{goalMet ? "Today's XP goal reached. " : `${Math.max(0, recorded.summary.dailyGoal - recorded.summary.todayXp)} XP to today's XP goal. `}
						{recorded.queued.length > 0 && `${recorded.queued.length} missed word${recorded.queued.length === 1 ? "" : "s"} added to your review deck.`}
					</>
				) : failed ? (
					"Not saved yet. The app will try again."
				) : (
					<Pulse className="h-3.5 w-64 align-middle" />
				)}
			</p>

			{missed.length > 0 && (
				<div className="q-card mt-6 px-[22px] py-[18px] text-left">
					<p className="q-lbl">
						<QIcon name="rule" />
						What you worked for
					</p>
					<p className="mt-1 font-prose text-[13px] text-ink-3">A miss you then got right is the rep that sticks.</p>
					<ul className="mt-3 flex flex-col gap-2.5">
						{missed.slice(0, 5).map((r, i) => (
							<li key={i} className="font-prose text-base leading-snug">
								<span className="text-foreground" lang={lessonLanguage()}>
									{r.item.before}
									<b className="font-semibold text-teal-2">{r.item.answer}</b>
									{r.item.after}
								</span>
								<span data-no-word-lookup="true" className="block text-sm text-ink-3">{r.item.translation}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="q-acts mt-6">
				<Link href="/" className={SECONDARY}>
					Today
				</Link>
				{mode === "blitz" ? (
					<button type="button" onClick={onAgain} className={PRIMARY}>
						Go again
					</button>
				) : focus ? (
					<button type="button" onClick={onAgain} className={PRIMARY} data-testid="lesson-next">
						Another round
					</button>
				) : (
					<button type="button" disabled={!recorded} onClick={() => recorded && onNext(recorded.summary.next)} className={PRIMARY} data-testid="lesson-next">
						{!recorded || stayHere || !nextUnit ? "Next lesson" : `Next: ${nextUnit.title}`}
					</button>
				)}
			</div>
			<SourcesNote feature="lesson" className="mt-6" />
		</div>
	);
}

/** How well the review deck knows this word, in one phrase. */
function knownLine(known: LessonItem["known"]): string | undefined {
	if (!known) return "not in review yet";
	if (known.state === "new" || known.reps === 0) return "new in review";
	const days = Math.round((Date.parse(known.due) - Date.now()) / 86_400_000);
	const when = days <= 0 ? "due now" : days === 1 ? "back tomorrow" : `back in ${days} days`;
	return known.state === "learning" ? `learning · ${when}` : `known · ${when}`;
}

/** The line under the end-screen heading: lesson N of 3 in this unit, or
 *  the unit is done and here is what follows. */
function whereLine(here: { title: string; lessons: number; done: boolean; accuracy: number | null }, next: { id: UnitId; title: string } | null): string {
	if (!here.done) return `Lesson ${Math.min(here.lessons, LESSONS_TO_COMPLETE)} of ${LESSONS_TO_COMPLETE} in ${here.title}`;
	if (here.lessons === LESSONS_TO_COMPLETE || !next || next.title === here.title) return `${here.title} · ${here.lessons} lessons · ${Math.round((here.accuracy ?? 0) * 100)}% right`;
	return `${here.title} is done. Up next: ${next.title}`;
}
