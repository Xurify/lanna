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
import {
	FlameIcon,
	HelpCircleIcon,
	LoaderCircleIcon,
	SnailIcon,
	SparklesIcon,
	TimerIcon,
	Volume2Icon,
	VolumeXIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DiacriticBar } from "@/components/diacritic-bar";
import { setSpeed, speak, SPEEDS, useActiveLanguage } from "@/components/speech";
import { setSoundOn, sfx, soundOn } from "@/components/lesson/sound";
import { startTutorChat, whyPrompt } from "@/components/lesson/tutor";
import {
	compareAnswer,
	diacriticSlips,
	repXp,
	sameSentence,
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
}

interface Outcome {
	xp: number;
	correct: number;
	total: number;
	perfect: boolean;
	queued: string[];
	newBest?: number;
	summary: { streak: { days: number; activeToday: boolean }; todayXp: number; dailyGoal: number; next: UnitId; bestBlitz: number };
}

const BLITZ_SECONDS = 60;

const KIND_LABEL: Record<ItemKind, string> = {
	choose: "Choose the right form",
	type: "Type the missing word",
	build: "Build the sentence",
	listen: "Listen and type the missing word",
};

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
	const startedAt = useRef(Date.now());
	const finishing = useRef(false);

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
						reps: all.map((r) => ({ itemId: r.item.id, slug: r.item.slug, kind: r.item.kind, verdict: r.verdict })),
						ms: Date.now() - startedAt.current,
						tz: new Date().getTimezoneOffset(),
					}),
				});
				setOutcome((await res.json()) as Outcome);
			} catch {
				setOutcome({
					xp,
					correct: all.filter((r) => r.verdict !== "wrong").length,
					total: all.length,
					perfect: false,
					queued: [],
					summary: { streak: { days: 0, activeToday: false }, todayXp: xp, dailyGoal: 50, next: plan.unit, bestBlitz: 0 },
				});
			} finally {
				setSaving(false);
			}
		},
		[plan, mode, xp],
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
		const rep: Rep = { item, given, verdict };
		const nextCombo = verdict === "wrong" ? 0 : combo + 1;
		const gained = repXp(item.kind, verdict, nextCombo);
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
			window.setTimeout(() => {
				setCurrent(null);
				if (index + 1 >= total) void finish(all);
				else setIndex((i) => i + 1);
			}, verdict === "wrong" ? 650 : 280);
			return;
		}
		setCurrent(rep);
		if (item.kind !== "listen") void speak(item.sentence).catch(() => {});
	};

	const advance = () => {
		if (!current) return;
		const all = [...reps, current];
		setReps(all);
		setCurrent(null);
		if (index + 1 >= total) void finish(all);
		else setIndex((i) => i + 1);
	};

	const why = async () => {
		if (!current) return;
		try {
			await startTutorChat(router, {
				title: `Why ${current.item.answer}?`,
				prompt: whyPrompt({ sentence: current.item.sentence, answer: current.item.answer, given: current.given, lemma: current.item.lemma }),
			});
		} catch {
			setError("Couldn't open the tutor. Check Settings → Models.");
		}
	};

	// Enter continues from the feedback sheet; Escape leaves.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
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
					onNext={(u) => router.push(`/lesson?unit=${u}`)}
				/>
			</Frame>
		);
	}

	const unitTitle = mode === "blitz" ? "Blitz" : unitInfo(plan.unit).title;
	const progress = mode === "blitz" ? left / BLITZ_SECONDS : (index + (current ? 1 : 0)) / total;

	return (
		<Frame>
			{/* Top bar: exit · progress · combo · sound */}
			<div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 pt-5">
				<Link href="/" aria-label="Leave the lesson" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<XIcon className="size-5" />
				</Link>
				<div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-accent" aria-label={mode === "blitz" ? `${left} seconds left` : `${index} of ${total} done`}>
					<div
						className={cn("h-full rounded-full transition-[width] duration-500 ease-out", mode === "blitz" ? (left <= 10 ? "bg-miss" : "bg-sky") : "bg-go")}
						style={{ width: `${Math.max(3, progress * 100)}%` }}
					/>
					<div className="absolute inset-x-3 top-[3px] h-1 rounded-full bg-white/20" style={{ width: `calc(${Math.max(3, progress * 100)}% - 1.5rem)` }} />
				</div>
				{mode === "blitz" && (
					<span className={cn("flex items-center gap-1 font-ui text-sm tabular-nums", left <= 10 ? "text-miss" : "text-sky")}>
						<TimerIcon className="size-4" />
						{left}s
					</span>
				)}
				<div className={cn("relative flex min-w-14 items-center gap-1 font-ui text-sm font-semibold tabular-nums", combo >= 3 ? "text-flame" : "text-muted-foreground")} data-testid="combo">
					<FlameIcon className={cn("size-5", combo >= 3 && "lh-flicker")} />
					{combo}
					{floater && (
						<span key={floater.key} className="lh-float-up pointer-events-none absolute left-7 top-5 font-ui text-xs font-bold text-xp">
							{floater.text}
						</span>
					)}
				</div>
				<button type="button" onClick={toggleSound} aria-label={sound ? "Mute sounds" : "Turn sounds on"} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
					{sound ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
				</button>
			</div>

			<div className="mx-auto mt-1 w-full max-w-3xl px-5 font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">
				{unitTitle}
				{mode === "blitz" && <span className="ml-2 text-foreground">{reps.filter((r) => r.verdict !== "wrong").length} right</span>}
			</div>

			{/* The rep */}
			<div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-[10vh]">
				<div key={`${item.id}-${index}`} className={cn("lh-rise mx-auto w-full max-w-2xl", shake && current?.verdict === "wrong" && "lh-shake")}>
					<RepView key={`${item.id}-${index}-${shake}`} item={item} tag={tag} locked={!!current} result={current} onGrade={grade} />
				</div>
			</div>

			{/* Feedback sheet (lessons only — blitz flashes and moves on) */}
			{mode === "lesson" && current && <FeedbackSheet rep={current} tag={tag} onContinue={advance} onWhy={() => void why()} last={index + 1 >= total} />}
		</Frame>
	);
}

function Frame({ children }: { children: React.ReactNode }) {
	// Full screen, over the sidebar: a lesson is a focus mode (Esc leaves).
	return <div className="fixed inset-0 z-40 flex flex-col bg-background">{children}</div>;
}

// ─── One rep ────────────────────────────────────────────────────────────────

function hintFor(item: LessonItem): string {
	// "First words": the blank IS the dictionary form, so the hint is the meaning.
	return item.unit === "words" ? item.gloss : item.lemma;
}

function RepView({
	item,
	tag,
	locked,
	result,
	onGrade,
}: {
	item: LessonItem;
	tag: string;
	locked: boolean;
	result: Rep | null;
	onGrade: (given: string, verdict: RepVerdict) => void;
}) {
	return (
		<div>
			<p className="mb-5 font-prose text-xl font-semibold text-foreground">{KIND_LABEL[item.kind]}</p>
			{item.kind === "build" ? (
				<BuildRep item={item} locked={locked} onGrade={onGrade} />
			) : (
				<ClozeRep item={item} tag={tag} locked={locked} result={result} onGrade={onGrade} />
			)}
		</div>
	);
}

function ClozeRep({
	item,
	tag,
	locked,
	result,
	onGrade,
}: {
	item: LessonItem;
	tag: string;
	locked: boolean;
	result: Rep | null;
	onGrade: (given: string, verdict: RepVerdict) => void;
}) {
	const [given, setGiven] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const typed = item.kind === "type" || item.kind === "listen";

	useEffect(() => {
		if (typed) inputRef.current?.focus();
		if (item.kind === "listen") void speak(item.sentence).catch(() => {});
	}, [item, typed]);

	const submit = () => {
		if (locked || !given.trim()) return;
		onGrade(given, compareAnswer(item.answer, given, tag));
	};

	// 1–4 pick an option.
	useEffect(() => {
		if (item.kind !== "choose" || locked) return;
		const onKey = (e: KeyboardEvent) => {
			const n = Number(e.key);
			const opt = item.options?.[n - 1];
			if (opt) {
				e.preventDefault();
				onGrade(opt, compareAnswer(item.answer, opt, tag));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [item, locked, onGrade, tag]);

	const hidden = item.kind === "listen" && !locked;
	const verdictInk = result ? (result.verdict === "exact" ? "text-go" : result.verdict === "accents" ? "text-warn" : "text-miss") : "";

	return (
		<div>
			<div className="flex items-start gap-3">
				{(item.kind === "listen" || locked) && (
					<div className="flex shrink-0 flex-col gap-1.5 pt-1">
						<button
							type="button"
							onClick={() => void speak(item.sentence)}
							aria-label="Play the sentence"
							className={cn("flex items-center justify-center rounded-2xl bg-sky text-background transition-transform hover:scale-105 active:scale-95", item.kind === "listen" ? "size-14" : "size-10")}
						>
							<Volume2Icon className={item.kind === "listen" ? "size-7" : "size-5"} />
						</button>
						{item.kind === "listen" && (
							<button
								type="button"
								onClick={() => void slowSpeak(item.sentence)}
								aria-label="Play slowly"
								className="flex size-14 items-center justify-center rounded-2xl border border-sky/50 text-sky transition-transform hover:scale-105"
							>
								<SnailIcon className="size-6" />
							</button>
						)}
					</div>
				)}
				<form
					className="flex-1"
					onSubmit={(e) => {
						e.preventDefault();
						submit();
					}}
				>
					<p className="font-prose text-[28px] leading-[1.5] text-foreground" lang="sk">
						{hidden ? <span className="text-muted-foreground/60">{item.before.replace(/\S/g, "·")}</span> : <span>{item.before}</span>}
						{locked ? (
							<span className={cn("lh-pop inline-block rounded-lg px-1.5 font-bold", verdictInk, result?.verdict === "exact" ? "bg-go-soft" : result?.verdict === "accents" ? "bg-warn-soft" : "bg-miss-soft")}>
								{item.answer}
							</span>
						) : typed ? (
							<input
								ref={inputRef}
								value={given}
								onChange={(e) => setGiven(e.target.value)}
								aria-label="Missing word"
								data-testid="lesson-input"
								autoComplete="off"
								autoCorrect="off"
								autoCapitalize="off"
								spellCheck={false}
								style={{ width: `${Math.max(5, item.answer.length + 2)}ch` }}
								className="mx-1 inline-block rounded-lg border-2 border-b-[4px] border-border bg-card px-2 text-center font-bold text-foreground caret-go outline-none transition-colors focus:border-go"
							/>
						) : (
							<span className="mx-1 inline-block min-w-20 rounded-lg border-b-[3px] border-dashed border-muted-foreground/50 text-center">&nbsp;</span>
						)}
						{hidden ? <span className="text-muted-foreground/60">{item.after.replace(/[^\s.,!?]/g, "·")}</span> : <span>{item.after}</span>}
					</p>
					{!hidden && (
						<p className="mt-2 font-prose text-lg text-muted-foreground">
							{item.unit !== "words" && <span className="mr-2 rounded-md bg-accent px-2 py-0.5 font-medium text-foreground">{hintFor(item)}</span>}
							{item.translation}
						</p>
					)}
					{hidden && <p className="mt-2 font-prose text-base text-muted-foreground">Listen, then type the word that goes in the blank.</p>}
					{typed && !locked && (
						<div className="mt-8 flex items-center justify-between gap-4">
							<DiacriticBar className="min-w-0 flex-1 flex-wrap justify-start" />
							<button
								type="submit"
								disabled={!given.trim()}
								className="rounded-2xl bg-go px-8 py-3 font-ui text-sm font-extrabold uppercase tracking-wider text-go-ink shadow-[0_4px_0_0_rgb(0_0_0/0.35)] transition-all enabled:hover:brightness-110 enabled:active:translate-y-0.5 enabled:active:shadow-none disabled:opacity-40"
							>
								Check
							</button>
						</div>
					)}
				</form>
			</div>

			{item.kind === "choose" && (
				<div className={"mt-8 grid grid-cols-2 gap-3"} data-testid="lesson-options">
					{item.options!.map((o, i) => {
						const picked = result?.given === o;
						const right = locked && compareAnswer(item.answer, o, tag) === "exact";
						return (
							<button
								key={o}
								type="button"
								disabled={locked}
								onClick={() => onGrade(o, compareAnswer(item.answer, o, tag))}
								className={cn(
									"group flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-prose text-xl text-foreground shadow-[0_3px_0_0_var(--border)] transition-all",
									!locked && "hover:-translate-y-0.5 hover:border-foreground/40 active:translate-y-0.5 active:shadow-none",
									right && "border-go bg-go-soft shadow-[0_3px_0_0_var(--lh-go)]",
									picked && !right && "border-miss bg-miss-soft shadow-[0_3px_0_0_var(--lh-miss)]",
									locked && !right && !picked && "opacity-50",
								)}
							>
								<span className="flex size-7 shrink-0 items-center justify-center rounded-lg border font-ui text-xs text-muted-foreground">{i + 1}</span>
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

function BuildRep({ item, locked, onGrade }: { item: LessonItem; locked: boolean; onGrade: (given: string, verdict: RepVerdict) => void }) {
	// Bank entries by position (words can repeat in a sentence).
	const [picked, setPicked] = useState<number[]>([]);
	const bank = item.bank ?? [];
	const tokens = item.tokens ?? [];

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

	return (
		<div>
			<p className="font-prose text-2xl text-foreground">“{item.translation}”</p>
			<div className="mt-6 flex min-h-16 flex-wrap items-center gap-2 border-y-2 border-border/70 py-3" data-testid="build-answer">
				{picked.length === 0 && <span className="font-prose text-base text-muted-foreground/60">Tap the words in order</span>}
				{picked.map((bi, k) => (
					<button
						key={`${bi}-${k}`}
						type="button"
						disabled={locked}
						onClick={() => setPicked((p) => p.filter((_, j) => j !== k))}
						className="lh-pop rounded-xl border-2 bg-card px-3 py-1.5 font-prose text-xl text-foreground shadow-[0_3px_0_0_var(--border)]"
						lang="sk"
					>
						{bank[bi]}
					</button>
				))}
			</div>
			<div className="mt-6 flex flex-wrap justify-center gap-2">
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
							className={cn(
								"rounded-xl border-2 px-3 py-1.5 font-prose text-xl shadow-[0_3px_0_0_var(--border)] transition-all",
								used ? "border-transparent bg-accent text-transparent shadow-none" : "bg-card text-foreground hover:-translate-y-0.5",
							)}
							lang="sk"
						>
							{w}
						</button>
					);
				})}
			</div>
			{!locked && (
				<div className="mt-8 flex justify-end">
					<button
						type="button"
						onClick={check}
						disabled={picked.length === 0}
						className="rounded-2xl bg-go px-8 py-3 font-ui text-sm font-extrabold uppercase tracking-wider text-go-ink shadow-[0_4px_0_0_rgb(0_0_0/0.35)] transition-all enabled:hover:brightness-110 enabled:active:translate-y-0.5 enabled:active:shadow-none disabled:opacity-40"
					>
						Check
					</button>
				</div>
			)}
		</div>
	);
}

// ─── Feedback ───────────────────────────────────────────────────────────────

function FeedbackSheet({ rep, tag, onContinue, onWhy, last }: { rep: Rep; tag: string; onContinue: () => void; onWhy: () => void; last: boolean }) {
	const praise = useMemo(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]!, []);
	const { item, verdict, given } = rep;
	const slips = verdict === "accents" ? new Set(diacriticSlips(item.answer, given, tag)) : new Set<number>();
	const tone =
		verdict === "exact"
			? { bg: "bg-go-soft", ink: "text-go", btn: "bg-go text-go-ink", title: praise }
			: verdict === "accents"
				? { bg: "bg-warn-soft", ink: "text-warn", btn: "bg-warn text-background", title: "Almost! Check the accents" }
				: { bg: "bg-miss-soft", ink: "text-miss", btn: "bg-miss text-background", title: "Not quite" };
	return (
		<div className={cn("lh-rise border-t-2 border-border/40", tone.bg)} data-testid="lesson-feedback" data-verdict={verdict}>
			<div className="mx-auto flex w-full max-w-3xl flex-wrap items-end gap-4 px-5 py-5">
				<div className="min-w-0 flex-1">
					<p className={cn("flex items-center gap-2 font-ui text-2xl font-bold", tone.ink)}>
						{verdict === "exact" && <SparklesIcon className="size-6" />}
						{tone.title}
					</p>
					{verdict !== "exact" && (
						<p className="mt-1 font-prose text-lg text-foreground">
							{item.kind === "build" ? "Correct sentence: " : "Correct answer: "}
							<span className="font-bold" lang="sk">
								{item.kind === "build"
									? item.sentence
									: [...item.answer].map((ch, i) => (
											<span key={i} className={slips.has(i) ? `underline decoration-2 underline-offset-4 ${tone.ink}` : undefined}>
												{ch}
											</span>
										))}
							</span>
							{verdict === "wrong" && given && item.kind !== "build" && <span className="ml-2 text-muted-foreground line-through">{given}</span>}
						</p>
					)}
					{verdict !== "exact" && item.kind !== "build" && <p className="mt-1 font-prose text-base text-muted-foreground">{unitInfo(item.unit).rule}</p>}
					{verdict === "exact" && item.kind !== "build" && (
						<p className="mt-1 font-prose text-base text-muted-foreground" lang="sk">
							{item.sentence} <span className="text-muted-foreground/70">· {item.translation}</span>
						</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					{verdict !== "exact" && (
						<button type="button" onClick={onWhy} className="flex items-center gap-1.5 rounded-2xl border-2 border-foreground/20 px-4 py-3 font-ui text-xs font-extrabold uppercase tracking-wider text-foreground hover:bg-background/40">
							<HelpCircleIcon className="size-4" />
							Why?
						</button>
					)}
					<button
						type="button"
						autoFocus
						onClick={onContinue}
						data-testid="lesson-continue"
						className={cn("rounded-2xl px-8 py-3 font-ui text-sm font-extrabold uppercase tracking-wider shadow-[0_4px_0_0_rgb(0_0_0/0.35)] transition-all hover:brightness-110 active:translate-y-0.5 active:shadow-none", tone.btn)}
					>
						{last ? "Finish" : "Continue"}
					</button>
				</div>
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
					style={{ background: b.color, animationDelay: b.delay, ["--dx" as string]: b.dx, ["--dy" as string]: b.dy, ["--rot" as string]: b.rot } as React.CSSProperties}
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
	const missed = reps.filter((r) => r.verdict !== "exact");
	const goalMet = outcome ? outcome.summary.todayXp >= outcome.summary.dailyGoal : false;

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
				{mode === "blitz" ? <ZapIcon className="size-12" /> : <SparklesIcon className="size-12" />}
			</div>
			<h1 className="mt-5 font-ui text-4xl font-black text-foreground">
				{mode === "blitz" ? (outcome?.newBest ? "New best!" : "Time!") : outcome?.perfect ? "Perfect lesson!" : "Lesson complete!"}
			</h1>
			<p className="mt-2 font-prose text-lg text-muted-foreground">{mode === "blitz" ? `${correct} right in 60 seconds` : unitInfo(unit).title}</p>

			<div className="mt-8 grid grid-cols-3 gap-3">
				<Stat label="XP" value={saving || !outcome ? "…" : `+${outcome.xp}`} ink="text-xp" />
				<Stat label={mode === "blitz" ? "Best" : "Accuracy"} value={mode === "blitz" ? String(Math.max(outcome?.summary.bestBlitz ?? 0, correct)) : `${accuracy}%`} ink="text-go" />
				<Stat label="Streak" value={outcome ? `${outcome.summary.streak.days}` : "…"} ink="text-flame" icon={<FlameIcon className="size-5" />} />
			</div>

			{outcome && (
				<p className="mt-4 font-ui text-xs text-muted-foreground">
					{goalMet ? "Daily goal reached. " : `${Math.max(0, outcome.summary.dailyGoal - outcome.summary.todayXp)} XP to today's goal. `}
					{outcome.queued.length > 0 && `${outcome.queued.length} missed word${outcome.queued.length === 1 ? "" : "s"} added to your review deck.`}
				</p>
			)}

			{missed.length > 0 && (
				<div className="mt-6 rounded-2xl border bg-card p-4 text-left">
					<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">Worth another look</p>
					<ul className="mt-2 flex flex-col gap-1.5">
						{missed.slice(0, 5).map((r, i) => (
							<li key={i} className="flex items-baseline gap-2 font-prose text-base text-foreground" lang="sk">
								<span className="font-bold">{r.item.answer}</span>
								<span className="text-muted-foreground">
									{r.item.before.trim().split(/\s+/).slice(-2).join(" ")} ___ · {r.item.gloss}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
				<Link href="/" className="rounded-2xl border-2 px-6 py-3 font-ui text-sm font-extrabold uppercase tracking-wider text-foreground hover:bg-accent">
					Today
				</Link>
				{mode === "blitz" ? (
					<button type="button" onClick={onAgain} className="rounded-2xl bg-sky px-8 py-3 font-ui text-sm font-extrabold uppercase tracking-wider text-background shadow-[0_4px_0_0_rgb(0_0_0/0.35)] hover:brightness-110">
						Go again
					</button>
				) : (
					<button
						type="button"
						disabled={!outcome}
						onClick={() => outcome && onNext(outcome.summary.next)}
						className="rounded-2xl bg-go px-8 py-3 font-ui text-sm font-extrabold uppercase tracking-wider text-go-ink shadow-[0_4px_0_0_rgb(0_0_0/0.35)] hover:brightness-110 disabled:opacity-40"
					>
						Next lesson
					</button>
				)}
			</div>
		</div>
	);
}

function Stat({ label, value, ink, icon }: { label: string; value: string; ink: string; icon?: React.ReactNode }) {
	return (
		<div className="rounded-2xl border-2 bg-card px-3 py-4">
			<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">{label}</p>
			<p className={cn("mt-1 flex items-center justify-center gap-1 font-ui text-3xl font-black tabular-nums", ink)}>
				{icon}
				{value}
			</p>
		</div>
	);
}
