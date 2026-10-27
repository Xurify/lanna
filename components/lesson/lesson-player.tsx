"use client";

/**
 * The lesson player (LangHarness redesign): 12 quick reps, each answered
 * in a second or two, with instant colour-and-sound feedback, a combo
 * meter, a progress bar and an end screen. Blitz mode is the same player
 * against a 60-second clock, choose-only, no feedback sheet.
 *
 * Everything here is local: the items come from /api/lesson (built from
 * the lexicon), grading is core/language.ts compareAnswer, and only the
 * finished lesson is posted back. The tutor is one click away on a miss
 * ("Why?"), never in the loop.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, FlameIcon, LoaderCircleIcon, SnailIcon, TimerIcon, TrophyIcon, Volume2Icon, VolumeXIcon, XIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiacriticBar } from "@/components/diacritic-bar";
import { setSpeed, speak, SPEEDS, useActiveLanguage } from "@/components/speech";
import { setSoundOn, sfx, soundOn } from "@/components/lesson/sound";
import { startTutorChat, whyPrompt } from "@/components/lesson/tutor";
import {
	compareAnswer,
	diacriticSlips,
	gradeListen,
	LESSONS_TO_COMPLETE,
	repXp,
	sameSentence,
	unitDone,
	unitInfo,
	type ItemKind,
	type LessonItem,
	type LessonPlan,
	type RepVerdict,
	type UnitId,
} from "@/src/core";

type Mode = "lesson" | "blitz";

interface Rep {
	item: LessonItem;
	given: string;
	verdict: RepVerdict;
	/** Right on the second try, after the hint. */
	assisted?: boolean;
}

interface SavedLesson {
	plan: LessonPlan;
	index: number;
	reps: Rep[];
	current: Rep | null;
	combo: number;
	xp: number;
	miss: string | null;
	relearned: number;
	startedAt: number;
}

/** Missed reps asked again at the end of a lesson, at most. */
const RELEARN_MAX = 3;

interface Outcome {
	xp: number;
	correct: number;
	total: number;
	perfect: boolean;
	queued: string[];
	newBest?: number;
	summary: {
		streak: { days: number; activeToday: boolean };
		todayXp: number;
		dailyGoal: number;
		next: UnitId;
		bestBlitz: number;
		units: Array<{ id: UnitId; title: string; lessons: number; done: boolean; accuracy: number | null }>;
	};
}

const BLITZ_SECONDS = 60;

const KIND_LABEL: Record<ItemKind, string> = {
	choose: "Choose the right form",
	type: "Type the missing word",
	build: "Build the sentence",
	listen: "Type what you hear",
};

/** A vocabulary rep blanks the word itself, so the ask is the word, not a form. */
function kindLabel(item: LessonItem): string {
	if (item.kind === "choose" && unitInfo(item.unit).kind === "words") return "Choose the word";
	if (item.kind === "type" && unitInfo(item.unit).kind === "words") return "Type the word";
	return KIND_LABEL[item.kind];
}

const PRAISE = ["Výborne!", "Super!", "Presne tak!", "Skvelé!", "Bravo!", "Paráda!"];

export function LessonPlayer({ unit, mode, initialPlan = null }: { unit?: UnitId; mode: Mode; initialPlan?: LessonPlan | null }) {
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
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [saving, setSaving] = useState(false);
	const [sound, setSound] = useState(true);
	const [left, setLeft] = useState(BLITZ_SECONDS);
	const [shake, setShake] = useState(0);
	// The first wrong answer on this rep: the learner gets a hint and one
	// more try before the answer is shown (a prompt, not a recast — making
	// the learner find the form is what moves grammar, telling them is not).
	const [miss, setMiss] = useState<string | null>(null);
	// Whether the rep has an answer to check (drives the footer's Check).
	const [ready, setReady] = useState(false);
	const relearned = useRef(0);
	const repBox = useRef<HTMLDivElement>(null);
	// A miss shakes the rep without remounting it (the typed text stays).
	useEffect(() => {
		if (shake === 0) return;
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
		repBox.current?.animate?.(
			[{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
			{ duration: 320 },
		);
	}, [shake]);
	const startedAt = useRef(Date.now());
	const finishing = useRef(false);
	// A lesson survives leaving the page (the tutor chat, Today, a reload):
	// its state is kept in this tab's sessionStorage until it is finished
	// or left on purpose (X, Escape). Blitz is a 60 s sprint and is not kept.
	const saveKey = mode === "lesson" && unit ? `lh-lesson:${unit}` : null;
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
			relearned.current = saved.relearned;
			startedAt.current = saved.startedAt;
		} catch {
			// storage blocked or stale: start fresh
		}
	}, [saveKey]);
	useEffect(() => {
		if (!saveKey || !plan || outcome || restoring.current) return;
		const saved: SavedLesson = { plan, index, reps, current, combo, xp, miss, relearned: relearned.current, startedAt: startedAt.current };
		try {
			sessionStorage.setItem(saveKey, JSON.stringify(saved));
		} catch {
			// storage blocked: the lesson is not kept
		}
	}, [saveKey, plan, index, reps, current, combo, xp, miss, outcome]);
	const forget = useCallback(() => {
		if (!saveKey) return;
		try {
			sessionStorage.removeItem(saveKey);
		} catch {
			// nothing kept
		}
	}, [saveKey]);

	useEffect(() => setSound(soundOn()), []);

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
		setOutcome(null);
		setMiss(null);
		relearned.current = 0;
		setLeft(BLITZ_SECONDS);
		finishing.current = false;
		try {
			const res = await fetch(mode === "blitz" ? "/api/lesson?mode=blitz" : `/api/lesson?unit=${unit}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const next = (await res.json()) as LessonPlan;
			if (seq !== loadSeq.current) return;
			if (next.items.length === 0) throw new Error("There are no sentences for this unit yet.");
			setPlan(next);
			startedAt.current = Date.now();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [mode, unit]);

	// Fetch on mount only when the server could not build the plan.
	const hadInitial = useRef(initialPlan !== null);
	useEffect(() => {
		if (hadInitial.current) return;
		void load();
	}, [load]);

	const item = plan?.items[index] ?? null;
	const total = plan?.items.length ?? 0;
	const done = !!outcome;

	const finish = useCallback(
		async (all: Rep[]) => {
			if (finishing.current || !plan) return;
			finishing.current = true;
			setSaving(true);
			sfx.done();
			try {
				const res = await fetch("/api/lesson", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						unit: plan.unit,
						mode,
						reps: all.map((r) => ({
							itemId: r.item.id,
							slug: r.item.slug,
							kind: r.item.kind,
							verdict: r.verdict,
							assisted: r.assisted === true,
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
							},
						})),
						ms: Date.now() - startedAt.current,
						tz: new Date().getTimezoneOffset(),
					}),
				});
				setOutcome((await res.json()) as Outcome);
				forget();
			} catch {
				setOutcome({
					xp,
					correct: all.filter((r) => r.verdict !== "wrong").length,
					total: all.length,
					perfect: false,
					queued: [],
					summary: {
						streak: { days: 0, activeToday: false },
						todayXp: xp,
						dailyGoal: 50,
						next: plan.unit,
						bestBlitz: 0,
						units: [],
					},
				});
			} finally {
				setSaving(false);
			}
		},
		[plan, mode, xp, forget],
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

	const grade = (given: string, verdict: RepVerdict) => {
		if (!item || current) return;
		if (mode === "lesson" && verdict === "wrong" && miss === null && item.kind !== "build") {
			setMiss(given);
			setCombo(0);
			sfx.wrong();
			setShake((s) => s + 1);
			return;
		}
		const assisted = mode === "lesson" && miss !== null && verdict !== "wrong";
		const rep: Rep = { item, given, verdict, assisted };
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

	const advance = () => {
		if (!current || !plan) return;
		const all = [...reps, current];
		setReps(all);
		setCurrent(null);
		setMiss(null);
		// A miss comes back once at the end, typed (successive relearning:
		// a retrieval that succeeds after a failure is what fixes the form).
		let nextTotal = total;
		const it = current.item;
		if ((current.verdict === "wrong" || current.assisted) && !it.again && it.kind !== "build" && relearned.current < RELEARN_MAX) {
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
			setError("Couldn't open the tutor. Check Settings → Models.");
		}
	};

	// Enter continues from the feedback sheet; Escape leaves.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				forget();
				router.push("/");
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

	const toggleSound = () => {
		setSound((s) => {
			setSoundOn(!s);
			return !s;
		});
	};

	if (error) {
		return (
			<Frame>
				<div className="m-auto max-w-md text-center">
					<p className="font-prose text-lg text-foreground">{error}</p>
					<div className="mt-6 flex justify-center gap-3">
						<button type="button" onClick={() => void load()} className="rounded-xl bg-go px-5 py-2.5 font-semibold text-go-ink">
							Try again
						</button>
						<Link href="/" className="rounded-xl border px-5 py-2.5 text-foreground">
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
				<div className="m-auto flex items-center gap-3 text-muted-foreground" data-testid="lesson-loading">
					<LoaderCircleIcon className="size-5 animate-spin" />
					<span className="font-prose">Picking your sentences…</span>
				</div>
			</Frame>
		);
	}

	if (done || saving) {
		return (
			<Frame>
				<EndScreen
					mode={mode}
					unit={plan.unit}
					reps={reps}
					outcome={outcome}
					saving={saving}
					onAgain={() => void load()}
					onNext={(u) => (u === plan.unit ? void load() : router.push(`/lesson?unit=${u}`))}
				/>
			</Frame>
		);
	}

	const progress = mode === "blitz" ? left / BLITZ_SECONDS : (index + (current ? 1 : 0)) / total;
	const comesBack = !!current && (current.verdict === "wrong" || !!current.assisted) && !current.item.again && current.item.kind !== "build" && relearned.current < RELEARN_MAX;
	const examples = current ? plan.items.filter((o) => o.unit === current.item.unit && o.sentence !== current.item.sentence && !o.again).slice(0, 2) : [];

	return (
		<Frame strip={false}>
			{/* Top bar: exit · progress · combo · sound. The whole band drags the
			    window (its buttons carve themselves out, app/globals.css). */}
			<div className="lh-drag lh-wco-gutter shrink-0 select-none">
				<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
					<Link href="/" aria-label="Leave the lesson" onClick={forget} className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</Link>
					<div
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(progress * 100)}
						className="relative h-3 flex-1 overflow-hidden rounded-full bg-accent"
						aria-label={mode === "blitz" ? `${left} seconds left` : `${index} of ${total} done`}
					>
						<div
							className={cn("h-full rounded-full transition-[width] duration-500 ease-out", mode === "blitz" ? (left <= 10 ? "bg-miss" : "bg-sky") : "bg-go")}
							style={{ width: `${Math.max(3, progress * 100)}%` }}
						/>
					</div>
					{mode === "blitz" && (
						<span className={cn("flex items-center gap-1 font-ui text-sm font-semibold tabular-nums", left <= 10 ? "text-miss" : "text-sky")}>
							<TimerIcon className="size-5" />
							{left}s
						</span>
					)}
					<div
						className={cn("relative flex min-w-12 items-center gap-1 font-ui text-sm font-semibold tabular-nums", combo >= 3 ? "text-flame" : "text-muted-foreground")}
						data-testid="combo"
						title="Right in a row"
					>
						<FlameIcon className={cn("size-5", combo >= 3 && "lh-flicker")} />
						{combo}
						{floater && (
							<span key={floater.key} className="lh-float-up pointer-events-none absolute left-7 top-5 font-ui text-xs font-bold text-xp">
								{floater.text}
							</span>
						)}
					</div>
					<button
						type="button"
						onClick={toggleSound}
						aria-label={sound ? "Mute sounds" : "Turn sounds on"}
						className="-mr-1.5 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
					>
						{sound ? <Volume2Icon className="size-5" /> : <VolumeXIcon className="size-5" />}
					</button>
				</div>
			</div>

			{/* The rep */}
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[9vh]">
				<div key={`${item.id}-${index}`} ref={repBox} className={cn(COLUMN, "lh-rise")}>
					<RepView
						key={`${item.id}-${index}`}
						item={item}
						tag={tag}
						locked={!!current}
						result={current}
						miss={miss}
						onGrade={grade}
						onReady={setReady}
						eyebrow={mode === "blitz" ? `Blitz · ${reps.filter((r) => r.verdict !== "wrong").length} right` : unitInfo(item.unit).title}
					/>
				</div>
			</div>

			{/* One bar at the bottom, always in the same place: Check before the
			    answer, the verdict and Continue after it (lessons only — blitz
			    flashes and moves on). */}
			{mode === "lesson" && current ? (
				<FeedbackSheet rep={current} tag={tag} onContinue={advance} onAskTutor={() => void why()} last={index + 1 >= total} comesBack={comesBack} examples={examples} />
			) : (
				<ActionBar kind={item.kind} ready={ready} blitz={mode === "blitz"} />
			)}
		</Frame>
	);
}

/** The one content column every row lines up on: top bar, rep and footer. */
const COLUMN = "mx-auto w-full max-w-3xl px-6";

/** Flat buttons, one height. No faux-3D bottom edge: on the tinted
 *  feedback bar it read as a muddy stripe under the label. */
const BUTTON = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-ui text-base font-extrabold transition-[filter,transform,background-color] active:scale-[0.98]";
const PRIMARY = cn(
	BUTTON,
	"bg-go text-go-ink hover:brightness-110 disabled:cursor-not-allowed disabled:bg-accent disabled:text-muted-foreground disabled:hover:brightness-100 disabled:active:scale-100",
);
const SECONDARY = cn(BUTTON, "border-2 border-foreground/20 px-5 text-foreground hover:bg-foreground/5");

const ACTION_HINT: Record<ItemKind, string> = {
	choose: "Pick one, or press its number",
	type: "Press Enter to check",
	listen: "Press Enter to check",
	build: "Tap the words in order · Backspace takes the last one back",
};

function ActionBar({ kind, ready, blitz }: { kind: ItemKind; ready: boolean; blitz: boolean }) {
	return (
		<div className="border-t border-border">
			<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
				<p className="font-prose text-sm text-muted-foreground">{ACTION_HINT[kind]}</p>
				{kind !== "choose" && !blitz && (
					<button type="submit" form={REP_FORM} disabled={!ready} className={PRIMARY} data-testid="lesson-check">
						Check
					</button>
				)}
			</div>
		</div>
	);
}

function Frame({ children, strip = true }: { children: React.ReactNode; strip?: boolean }) {
	// Full screen, over the sidebar: a lesson is a focus mode (Esc leaves).
	// It covers the app's own title bar, so it brings a drag band: the top
	// bar is one, and the other states (loading, end) get a plain strip.
	return (
		<div className="fixed inset-0 z-40 flex flex-col bg-background">
			{strip && <div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
			{children}
		</div>
	);
}

// ─── One rep ────────────────────────────────────────────────────────────────

/** The rep's form: the footer's Check submits it from outside. */
const REP_FORM = "lesson-rep";

function hintFor(item: LessonItem): string {
	// A vocabulary rep blanks the word itself, so its hint is the meaning;
	// a grammar rep shows the dictionary form (core/lesson.ts decides).
	return item.hint ?? item.lemma;
}

function RepView({
	item,
	tag,
	locked,
	result,
	miss,
	onGrade,
	onReady,
	eyebrow,
}: {
	item: LessonItem;
	tag: string;
	locked: boolean;
	result: Rep | null;
	miss: string | null;
	onGrade: (given: string, verdict: RepVerdict) => void;
	onReady: (ready: boolean) => void;
	eyebrow: string;
}) {
	return (
		<div>
			<p className="font-ui text-sm font-bold text-muted-foreground first-letter:uppercase">
				{eyebrow}
				{item.again && <span className="text-xp"> · Once more</span>}
			</p>
			<h2 className="mb-6 mt-1 font-prose text-2xl font-semibold text-foreground">{kindLabel(item)}</h2>
			{item.kind === "build" ? (
				<BuildRep item={item} locked={locked} onGrade={onGrade} onReady={onReady} />
			) : (
				<ClozeRep item={item} tag={tag} locked={locked} result={result} miss={miss} onGrade={onGrade} onReady={onReady} />
			)}
		</div>
	);
}

/** After a first miss: what decides the form, in his terms, and one more try. */
function HintPanel({ item, miss }: { item: LessonItem; miss: string }) {
	const info = unitInfo(item.unit);
	return (
		<div className="lh-rise mt-8 rounded-2xl border border-warn/40 bg-warn-soft px-5 py-4" role="status" aria-live="polite" data-testid="lesson-hint">
			<p className="font-ui text-base font-extrabold text-warn">
				Not “<span lang="sk">{miss}</span>”. {item.kind === "listen" ? "Listen again and try once more." : "One more try."}
			</p>
			<div className="mt-2 flex flex-col gap-1 font-prose text-base leading-relaxed">
				{item.trigger && (
					<p className="text-foreground">
						Look at{" "}
						<span className="rounded bg-background/50 px-1 font-bold" lang="sk">
							{item.trigger}
						</span>
						: it decides the form.
					</p>
				)}
				<p className="text-muted-foreground">{info.rule}</p>
				{info.bridge && (
					<p className="text-muted-foreground">
						<span className="font-semibold text-foreground">Estonian:</span> {info.bridge}
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
	onGrade,
	onReady,
}: {
	item: LessonItem;
	tag: string;
	locked: boolean;
	result: Rep | null;
	miss: string | null;
	onGrade: (given: string, verdict: RepVerdict) => void;
	onReady: (ready: boolean) => void;
}) {
	const [given, setGiven] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const typed = item.kind === "type" || item.kind === "listen";
	const listen = item.kind === "listen";

	useEffect(() => {
		if (typed) inputRef.current?.focus();
		if (listen) void speak(item.sentence).catch(() => {});
	}, [item, typed, listen]);

	useEffect(() => onReady(given.trim().length > 0), [given, onReady]);

	// The retry: select the wrong answer so typing replaces it.
	useEffect(() => {
		if (miss !== null && typed) inputRef.current?.select();
	}, [miss, typed]);

	const submit = () => {
		if (locked || !given.trim()) return;
		onGrade(given, listen ? gradeListen(item, given, tag) : compareAnswer(item.answer, given, tag));
	};

	// 1–4 pick an option.
	useEffect(() => {
		if (item.kind !== "choose" || locked) return;
		const onKey = (e: KeyboardEvent) => {
			const n = Number(e.key);
			const opt = item.options?.[n - 1];
			if (opt && opt !== miss) {
				e.preventDefault();
				onGrade(opt, compareAnswer(item.answer, opt, tag));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [item, locked, onGrade, tag, miss]);

	// The filled-in word is the right form, so it reads as right (green) even
	// after a miss; the bar below says what was wrong.
	const verdictInk = result ? (result.verdict === "accents" ? "text-warn" : "text-go") : "";
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
				<span className="underline decoration-warn decoration-[3px] underline-offset-[6px]">{item.before.trimEnd().slice(triggerAt)}</span>
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
				"rounded-xl border-2 border-border bg-card text-foreground caret-go outline-none transition-colors selection:bg-go/30 placeholder:font-normal placeholder:text-muted-foreground/70 focus:border-go",
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
						className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-sky text-background transition-transform hover:scale-105 active:scale-95"
					>
						<Volume2Icon className="size-8" />
					</button>
					<button
						type="button"
						onClick={() => void slowSpeak(item.sentence)}
						aria-label="Play slowly"
						title="Play slowly"
						className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky/15 text-sky transition-transform hover:scale-105"
					>
						<SnailIcon className="size-6" />
					</button>
				</div>
				{input("mt-6 block w-full px-4 py-3 font-prose text-2xl font-semibold")}
				<DiacriticBar variant="keys" className="mt-4" />
				{miss !== null && <HintPanel item={item} miss={miss} />}
			</form>
		);
	}

	return (
		<div>
			<div className="relative">
				{/* The play button hangs in the left margin, so the sentence lines
				    up with the heading and never moves when the button appears. */}
				{locked && (
					<button
						type="button"
						onClick={() => void speak(item.sentence)}
						aria-label="Play the sentence"
						className="lh-pop absolute -left-14 top-2.5 flex size-10 items-center justify-center rounded-xl bg-sky text-background transition-transform hover:scale-105 active:scale-95"
					>
						<Volume2Icon className="size-5" />
					</button>
				)}
				<form id={REP_FORM} onSubmit={(e) => (e.preventDefault(), submit())}>
					<p className="font-prose text-[30px] leading-[1.6] text-foreground" lang="sk">
						{beforeText}
						{locked ? (
							<span className={cn("lh-pop inline-block rounded-lg px-1.5 font-bold", verdictInk, result?.verdict === "accents" ? "bg-warn-soft" : "bg-go-soft")}>{item.answer}</span>
						) : typed ? (
							// Grows with what is typed (a hidden twin sizes it), so a long
							// answer is never clipped.
							<span className="mx-1 inline-grid max-w-full align-baseline" style={{ minWidth: `${Math.max(4, item.answer.length + 2)}ch` }}>
								<span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre border-2 px-3 font-bold">
									{given || " "}
								</span>
								{input("col-start-1 row-start-1 w-full min-w-0 px-3 py-0 font-bold")}
							</span>
						) : (
							<span className="mx-1 inline-block h-[1.1em] w-[5ch] translate-y-[0.2em] rounded-lg border-2 border-dashed border-muted-foreground/50" aria-label="blank" />
						)}
						<span>{item.after}</span>
					</p>
					<p className="mt-2 font-prose text-lg text-muted-foreground">
						<span className="mr-2 rounded-md bg-accent px-2 py-0.5 font-medium text-foreground">{hintFor(item)}</span>
						{item.translation}
					</p>
					{typed && !locked && <DiacriticBar variant="keys" className="mt-6" />}
				</form>
			</div>

			{miss !== null && !locked && <HintPanel item={item} miss={miss} />}

			{item.kind === "choose" && (
				<div className="mt-8 grid grid-cols-2 gap-3" data-testid="lesson-options">
					{item.options!.map((o, i) => {
						const picked = result?.given === o;
						const right = locked && compareAnswer(item.answer, o, tag) === "exact";
						const ruledOut = !locked && miss === o;
						return (
							<button
								key={o}
								type="button"
								disabled={locked || ruledOut}
								onClick={() => onGrade(o, compareAnswer(item.answer, o, tag))}
								className={cn(
									"flex items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3.5 text-left font-prose text-xl text-foreground transition-colors",
									!locked && !ruledOut && "hover:border-foreground/40 hover:bg-accent",
									right && "border-go bg-go-soft",
									picked && !right && "border-miss bg-miss-soft",
									locked && !right && !picked && "opacity-50",
									ruledOut && "border-miss/40 bg-transparent line-through opacity-50",
								)}
							>
								<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-ui text-sm text-muted-foreground">{i + 1}</span>
								<span lang="sk">{o}</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

async function slowSpeak(text: string) {
	// The speed preference is global; a slow replay is a one-off.
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

	const tile = "rounded-xl border-2 border-border bg-card px-3.5 py-2 font-prose text-xl text-foreground";
	return (
		<form id={REP_FORM} onSubmit={(e) => (e.preventDefault(), check())}>
			<p className="font-prose text-2xl text-foreground">“{item.translation}”</p>
			{/* After the answer: the sentence as one line, with a replay button
			    (it also plays on its own when the answer lands). */}
			{locked && (
				<div className="lh-pop mt-6 flex items-center gap-3" data-testid="build-sentence">
					<button
						type="button"
						onClick={() => void speak(item.sentence)}
						aria-label="Play the sentence"
						className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky text-background transition-transform hover:scale-105 active:scale-95"
					>
						<Volume2Icon className="size-5" />
					</button>
					<p className="font-prose text-2xl text-foreground" lang="sk">
						{item.sentence}
					</p>
				</div>
			)}
			<div className="mt-6 flex min-h-[4.5rem] flex-wrap items-center gap-2 border-b-2 border-border pb-3" data-testid="build-answer">
				{picked.map((bi, k) => (
					<button key={`${bi}-${k}`} type="button" disabled={locked} onClick={() => setPicked((p) => p.filter((_, j) => j !== k))} className={cn("lh-pop", tile)} lang="sk">
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
							className={cn(tile, "transition-colors", used ? "border-transparent bg-accent text-transparent" : "hover:border-foreground/40 hover:bg-accent")}
							lang="sk"
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
	const praise = useMemo(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]!, []);
	const [open, setOpen] = useState(false);
	const { item, verdict, given } = rep;
	const info = unitInfo(item.unit);
	// A whole typed sentence (listening) is answered with the whole sentence.
	const expected = item.kind === "build" || (item.kind === "listen" && given.trim().includes(" ")) ? item.sentence : item.answer;
	const slips = verdict === "accents" ? new Set(diacriticSlips(expected, given, tag)) : new Set<number>();
	const tone =
		verdict === "exact"
			? {
					bg: "bg-go-soft",
					ink: "text-go",
					badge: "bg-go text-go-ink",
					btn: "bg-go text-go-ink",
					title: rep.assisted ? "Got it on the second try" : praise,
				}
			: verdict === "accents"
				? {
						bg: "bg-warn-soft",
						ink: "text-warn",
						badge: "bg-warn text-background",
						btn: "bg-warn text-background",
						title: "Almost! Check the accents",
					}
				: {
						bg: "bg-miss-soft",
						ink: "text-miss",
						badge: "bg-miss text-background",
						btn: "bg-miss text-background",
						title: "Not quite",
					};
	const canExplain = verdict === "wrong" && item.kind !== "build";
	return (
		<div className={cn("lh-rise", tone.bg)} data-testid="lesson-feedback" data-verdict={verdict} role="status" aria-live="polite">
			<div className={cn(COLUMN, "py-5")}>
				<div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-3">
					<div className="flex min-w-0 flex-1 items-start gap-3">
						<span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", tone.badge)} aria-hidden="true">
							{verdict === "wrong" ? <XIcon className="size-5" strokeWidth={3} /> : <CheckIcon className="size-5" strokeWidth={3} />}
						</span>
						<div className="min-w-0">
							<p className={cn("font-ui text-2xl font-bold leading-tight", tone.ink)}>{tone.title}</p>
							{verdict !== "exact" && (
								<p className="mt-1 font-prose text-lg text-foreground">
									Correct answer:{" "}
									<span className="font-bold" lang="sk">
										{[...expected].map((ch, i) => (
											<span key={i} className={slips.has(i) ? `underline decoration-2 underline-offset-4 ${tone.ink}` : undefined}>
												{ch}
											</span>
										))}
									</span>
								</p>
							)}
							{verdict === "wrong" && given && (
								<p className="font-prose text-base text-muted-foreground">
									You wrote “<span lang="sk">{given}</span>”
								</p>
							)}
							{item.kind === "listen" && verdict === "exact" && (
								<p className="mt-1 font-prose text-base text-muted-foreground" lang="sk">
									{item.sentence} <span className="text-muted-foreground/80">· {item.translation}</span>
								</p>
							)}
							{comesBack && <p className="mt-1 font-prose text-sm text-muted-foreground">It comes back once more at the end.</p>}
						</div>
					</div>
					<div className="flex items-center gap-2">
						{canExplain && (
							<button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={SECONDARY} data-testid="lesson-why">
								{open ? "Hide" : "Why?"}
							</button>
						)}
						<button type="button" autoFocus onClick={onContinue} data-testid="lesson-continue" className={cn(BUTTON, "hover:brightness-110", tone.btn)}>
							{last ? "Finish" : "Continue"}
						</button>
					</div>
				</div>

				{/* "Why?" opens here, under the verdict: the lesson stays where it is. */}
				{open && (
					<div className="lh-rise mt-4 border-t border-foreground/10 pt-4 font-prose text-base leading-relaxed" data-testid="lesson-why-panel">
						{item.trigger && (
							<p className="text-foreground">
								<span className="rounded bg-background/50 px-1 font-bold" lang="sk">
									{item.trigger}
								</span>{" "}
								decides the form here.
							</p>
						)}
						<p className="text-foreground">{info.rule}</p>
						{info.bridge && (
							<p className="text-muted-foreground">
								<span className="font-semibold text-foreground">Estonian:</span> {info.bridge}
							</p>
						)}
						{examples.length > 0 && (
							<ul className="mt-2 flex flex-col gap-0.5">
								{examples.map((ex) => (
									<li key={ex.id} className="text-muted-foreground">
										<span className="text-foreground" lang="sk">
											{ex.before}
											<b>{ex.answer}</b>
											{ex.after}
										</span>{" "}
										· {ex.translation}
									</li>
								))}
							</ul>
						)}
						<button type="button" onClick={onAskTutor} className="mt-2 font-ui text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">
							Still unsure? Ask the tutor (opens a chat)
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── End screen ─────────────────────────────────────────────────────────────

function Confetti() {
	const bits = useMemo(
		() =>
			Array.from({ length: 36 }, (_, i) => ({
				i,
				dx: `${(Math.random() - 0.5) * 520}px`,
				dy: `${-120 - Math.random() * 260}px`,
				rot: `${(Math.random() - 0.5) * 720}deg`,
				color: ["var(--lh-go)", "var(--lh-gold)", "var(--lh-xp)", "var(--lh-sky)", "var(--lh-flame)"][i % 5],
				delay: `${Math.random() * 120}ms`,
			})),
		[],
	);
	return (
		<div className="pointer-events-none absolute left-1/2 top-1/3" aria-hidden="true">
			{bits.map((b) => (
				<span
					key={b.i}
					className="lh-confetti-bit absolute block h-2.5 w-1.5 rounded-sm"
					style={
						{
							background: b.color,
							animationDelay: b.delay,
							["--dx" as string]: b.dx,
							["--dy" as string]: b.dy,
							["--rot" as string]: b.rot,
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	);
}

function EndScreen({
	mode,
	unit,
	reps,
	outcome,
	saving,
	onAgain,
	onNext,
}: {
	mode: Mode;
	unit: UnitId;
	reps: Rep[];
	outcome: Outcome | null;
	saving: boolean;
	onAgain: () => void;
	onNext: (unit: UnitId) => void;
}) {
	const correct = reps.filter((r) => r.verdict !== "wrong").length;
	const accuracy = reps.length ? Math.round((correct / reps.length) * 100) : 0;
	// One line per sentence: a miss and its "once more" rep are the same item.
	const missed = reps.filter((r, i) => (r.verdict !== "exact" || r.assisted) && reps.findIndex((o) => o.item.sentence === r.item.sentence) === i);
	const goalMet = outcome ? outcome.summary.todayXp >= outcome.summary.dailyGoal : false;
	// Where this lesson leaves the unit (the summary is post-save, so it
	// already counts this lesson) and what the button opens next.
	const here = outcome?.summary.units.find((u) => u.id === unit) ?? null;
	const wasDone = here ? unitDone(here.lessons - 1, here.accuracy) : false;
	const nextUnit = outcome ? (outcome.summary.units.find((u) => u.id === outcome.summary.next) ?? null) : null;
	const stayHere = !!outcome && outcome.summary.next === unit;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && outcome) {
				e.preventDefault();
				if (mode === "blitz") onAgain();
				else onNext(outcome.summary.next);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [outcome, mode, onAgain, onNext]);

	return (
		<div className="relative m-auto w-full max-w-xl px-5 text-center" data-testid="lesson-end">
			<Confetti />
			<div className="lh-pop mx-auto flex size-24 items-center justify-center rounded-full bg-gold/15 text-gold">
				{mode === "blitz" ? <ZapIcon className="size-12" /> : <TrophyIcon className="size-12" />}
			</div>
			<h1 className="mt-5 font-ui text-4xl font-black text-foreground">
				{mode === "blitz" ? (outcome?.newBest ? "New best!" : "Time!") : here?.done && !wasDone ? "Unit complete!" : outcome?.perfect ? "Perfect lesson!" : "Lesson complete!"}
			</h1>
			<p className="mt-2 font-prose text-lg text-muted-foreground" data-testid="lesson-end-where">
				{mode === "blitz" ? `${correct} right in 60 seconds` : here ? whereLine(here, nextUnit) : unitInfo(unit).title}
			</p>
			{mode === "lesson" && here && !here.done && (
				<ol className="mx-auto mt-3 flex items-center justify-center gap-2" aria-label={`${Math.min(here.lessons, LESSONS_TO_COMPLETE)} of ${LESSONS_TO_COMPLETE} lessons done`}>
					{Array.from({ length: LESSONS_TO_COMPLETE }, (_, i) => (
						<li key={i} className={cn("h-2.5 w-8 rounded-full", i < here.lessons ? "bg-go" : "bg-accent")} />
					))}
				</ol>
			)}

			<div className="mt-8 grid grid-cols-3 gap-3">
				<Stat label="XP" value={saving || !outcome ? "…" : `+${outcome.xp}`} ink="text-xp" />
				<Stat label={mode === "blitz" ? "Best" : "Accuracy"} value={mode === "blitz" ? String(Math.max(outcome?.summary.bestBlitz ?? 0, correct)) : `${accuracy}%`} ink="text-go" />
				<Stat label="Streak" value={outcome ? `${outcome.summary.streak.days}` : "…"} ink="text-flame" icon={<FlameIcon className="size-5" />} />
			</div>

			{outcome && (
				<p className="mt-4 font-prose text-sm text-muted-foreground">
					{goalMet ? "Daily goal reached. " : `${Math.max(0, outcome.summary.dailyGoal - outcome.summary.todayXp)} XP to today's goal. `}
					{outcome.queued.length > 0 && `${outcome.queued.length} missed word${outcome.queued.length === 1 ? "" : "s"} added to your review deck.`}
				</p>
			)}

			{missed.length > 0 && (
				<div className="mt-6 rounded-2xl border bg-card p-4 text-left">
					<p className="font-ui text-sm font-bold text-muted-foreground">Worth another look</p>
					<ul className="mt-2 flex flex-col gap-2">
						{missed.slice(0, 5).map((r, i) => (
							<li key={i} className="font-prose text-base leading-snug">
								<span className="text-foreground" lang="sk">
									{r.item.before}
									<b>{r.item.answer}</b>
									{r.item.after}
								</span>
								<span className="block text-sm text-muted-foreground">{r.item.translation}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
				<Link href="/" className={SECONDARY}>
					Today
				</Link>
				{mode === "blitz" ? (
					<button type="button" onClick={onAgain} className={cn(BUTTON, "bg-sky text-background hover:brightness-110")}>
						Go again
					</button>
				) : (
					<button type="button" disabled={!outcome} onClick={() => outcome && onNext(outcome.summary.next)} className={PRIMARY} data-testid="lesson-next">
						{stayHere || !nextUnit ? "Next lesson" : `Next: ${nextUnit.title}`}
					</button>
				)}
			</div>
		</div>
	);
}

/** The line under the end-screen heading: lesson N of 3 in this unit, or
 *  the unit is done and here is what follows. */
function whereLine(here: { title: string; lessons: number; done: boolean; accuracy: number | null }, next: { id: UnitId; title: string } | null): string {
	if (!here.done) return `Lesson ${Math.min(here.lessons, LESSONS_TO_COMPLETE)} of ${LESSONS_TO_COMPLETE} in ${here.title}`;
	if (here.lessons === LESSONS_TO_COMPLETE || !next || next.title === here.title) return `${here.title} · ${here.lessons} lessons · ${Math.round((here.accuracy ?? 0) * 100)}% right`;
	return `${here.title} is done. Up next: ${next.title}`;
}

function Stat({ label, value, ink, icon }: { label: string; value: string; ink: string; icon?: React.ReactNode }) {
	return (
		<div className="rounded-2xl border-2 bg-card px-3 py-4">
			<p className="font-ui text-sm font-bold text-muted-foreground">{label}</p>
			<p className={cn("mt-1 flex items-center justify-center gap-1 font-ui text-3xl font-black tabular-nums", ink)}>
				{icon}
				{value}
			</p>
		</div>
	);
}
