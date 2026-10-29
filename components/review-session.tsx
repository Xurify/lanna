"use client";

/**
 * The spaced-review page (LangHarness, Phase 7): Clozemaster-style cloze
 * cards from the dictionary's sentences, one word blanked, scheduled with
 * FSRS. Type the missing word (or pick it), hear the sentence, rate.
 *
 * Grading is local and instant (core/language.ts compareAnswer — exact,
 * accents-only, wrong); the rating the learner confirms goes to
 * POST /api/review, which schedules the card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrainIcon, ChartColumnIcon, CheckIcon, EyeOffIcon, LightbulbIcon, LoaderCircleIcon, MinusIcon, PlusIcon, Volume2Icon, VolumeXIcon, WholeWordIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUTTON, KBD, PRIMARY, QUIET, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { TopBar } from "@/components/top-bar";
import { DiacriticBar } from "@/components/diacritic-bar";
import { PlayButton, speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { setSoundOn, sfx, soundOn } from "@/components/lesson/sound";
import { compareAnswer, diacriticSlips, formatInterval, rankLabel, ratingCap, ratingFor, RATING_LABELS, type AnswerVerdict, type Rating, type ReviewCard } from "@/src/core";

interface Prompt {
	card: ReviewCard;
	before: string;
	after: string;
	intervals: Record<Rating, number>;
	options: string[];
	rank?: number;
	cat?: string;
	form?: string;
}

interface Status {
	profile: string;
	available: boolean;
	counts: { due: number; learning: number; newToday: number; newLeft: number; total: number; reviewedToday: number };
	settings: { newPerDay: number; retention: number };
	next: Prompt | null;
	leeches: Array<{ id: string; lemma: string; gloss: string; lapses: number }>;
}

type Mode = "type" | "choice";
const MODE_KEY = "lh-review-mode";

function readPref(key: string, fallback: string): string {
	try {
		return localStorage.getItem(key) ?? fallback;
	} catch {
		return fallback;
	}
}
function writePref(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// not remembered
	}
}

const VERDICT_STYLE: Record<AnswerVerdict, { label: string; className: string; badge: string; btn: string }> = {
	exact: { label: "Correct", className: "text-go", badge: "bg-go text-go-ink", btn: "bg-go text-go-ink" },
	accents: { label: "Almost! Check the accents", className: "text-warn", badge: "bg-warn text-background", btn: "bg-warn text-background" },
	wrong: { label: "Not quite", className: "text-miss", badge: "bg-miss text-background", btn: "bg-miss text-background" },
};

/** What the deck will do with the card at the suggested rating, in words. */
function memoryLine(state: ReviewCard["state"], days: number): string {
	const when = `next in ${formatInterval(days)}`;
	return state === "new" ? `new · ${when}` : state === "learning" ? `learning · ${when}` : `known · ${when}`;
}

/** One labelled fact chip (the lesson footer's shape). */
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<div className="flex items-center gap-2.5 rounded-xl bg-accent/60 py-1.5 pl-2.5 pr-3.5">
			<span className="text-muted-foreground" aria-hidden="true">
				{icon}
			</span>
			<div className="min-w-0">
				<dt className="font-ui text-xs font-bold text-muted-foreground">{label}</dt>
				<dd className="font-prose text-sm leading-tight text-foreground">{value}</dd>
			</div>
		</div>
	);
}

export function ReviewSession() {
	const lang = useActiveLanguage();
	const [status, setStatus] = useState<Status | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [given, setGiven] = useState("");
	const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
	const [suggested, setSuggested] = useState<Rating>(3);
	// Hints taken on this card: 1 = the meaning, 2 = the dictionary form too.
	// Each one is allowed and priced (caps the rating; core/review.ts).
	const [hint, setHint] = useState(0);
	const [mode, setMode] = useState<Mode>("type");
	const [sound, setSound] = useState(true);
	const [saving, setSaving] = useState(false);
	const shownAt = useRef(Date.now());
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setMode(readPref(MODE_KEY, "type") === "choice" ? "choice" : "type");
		setSound(soundOn());
	}, []);

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/review?tz=${new Date().getTimezoneOffset()}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const next = (await res.json()) as Status;
			setStatus(next);
			setGiven("");
			setVerdict(null);
			setHint(0);
			shownAt.current = Date.now();
			setLoadError(null);
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const prompt = status?.next ?? null;
	const tag = lang?.tag ?? "sk-SK";
	// A card already retrieved once (state "review") is always typed:
	// choosing from four is for meeting a word, producing it is what keeps
	// it (recall beats recognition; docs/research/desirable-difficulties.md).
	const picks = mode === "choice" && !!prompt && prompt.card.state !== "review";
	const help = { hints: hint, picked: picks };

	useEffect(() => {
		if (status?.next && !verdict && !picks) inputRef.current?.focus();
	}, [status?.next, verdict, picks]);

	const check = (answer: string) => {
		if (!prompt || verdict) return;
		const v = compareAnswer(prompt.card.answer, answer, tag);
		setGiven(answer);
		setVerdict(v);
		setSuggested(ratingFor(v, Date.now() - shownAt.current, help));
		if (v === "exact") sfx.right();
		else if (v === "accents") sfx.almost();
		else sfx.wrong();
		void speak(prompt.card.sentence);
	};

	const rate = async (rating: Rating) => {
		if (!prompt || !verdict || saving) return;
		setSaving(true);
		try {
			await fetch("/api/review", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ cardId: prompt.card.id, given, ms: Date.now() - shownAt.current, rating: Math.min(rating, ratingCap(help)), hints: hint, picked: picks }),
			});
			await load();
			// The sidebar's due badge counts the same deck.
			window.dispatchEvent(new Event("lh:review-changed"));
		} finally {
			setSaving(false);
		}
	};

	const suspend = async () => {
		if (!prompt) return;
		await fetch("/api/review/suspend", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ cardId: prompt.card.id }),
		});
		await load();
	};

	// Keyboard: Enter checks / accepts the suggested rating; 1–4 rate, or
	// pick an option before the answer when choosing.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!verdict) {
				const opt = picks ? prompt?.options[Number(e.key) - 1] : undefined;
				if (opt && !e.metaKey && !e.ctrlKey && !e.altKey) {
					e.preventDefault();
					check(opt);
				}
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				void rate(suggested);
			} else if (["1", "2", "3", "4"].includes(e.key) && !(e.target instanceof HTMLInputElement)) {
				void rate(Number(e.key) as Rating);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const slips = useMemo(() => (prompt && verdict === "accents" ? new Set(diacriticSlips(prompt.card.answer, given, tag)) : new Set<number>()), [prompt, verdict, given, tag]);

	const saveNewPerDay = async (n: number) => {
		const res = await fetch("/api/review/settings", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ newPerDay: n }),
		});
		if (res.ok) await load();
	};
	// The stepper shows the new value at once; the save lands behind it.
	const [newPerDay, setNewPerDay] = useState<number | null>(null);
	const stepNewPerDay = (delta: number) => {
		const from = newPerDay ?? status?.settings.newPerDay ?? 0;
		const next = Math.max(0, Math.min(100, from + delta));
		if (next === from) return;
		setNewPerDay(next);
		void saveNewPerDay(next);
	};

	const toggleSound = () => {
		const next = !sound;
		setSoundOn(next);
		setSound(next);
		if (!next) stopSpeaking();
	};

	const counts = status?.counts;
	const kbd = (k: string) => <kbd className={KBD}>{k}</kbd>;

	return (
		<div className="flex h-dvh flex-col">
			<TopBar>
				<h1 className="font-ui text-base font-extrabold text-foreground">Review</h1>
				{counts && (
					<span className="ml-auto flex items-center gap-1.5 font-ui text-xs font-bold text-muted-foreground tabular-nums" data-testid="review-counts">
						<span title="Cards due for review" className="rounded-full bg-sky/15 px-2.5 py-1 text-sky">
							{counts.due + counts.learning} due
						</span>
						<span title="New cards left today" className="rounded-full bg-accent px-2.5 py-1">
							{counts.newLeft} new
						</span>
						<span title="Reviews done today" className="rounded-full bg-go-soft px-2.5 py-1 text-go">
							{counts.reviewedToday} done today
						</span>
						<span title="Words in the deck" className="hidden px-1.5 sm:inline">
							{counts.total} words
						</span>
					</span>
				)}
			</TopBar>

			<main className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-10 font-prose">
				<div className="w-full max-w-2xl">
					{loadError && (
						<div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-miss/40 bg-miss-soft px-4 py-3 text-sm text-foreground">
							<p>Couldn&apos;t load your review deck. {loadError}</p>
							<button type="button" onClick={() => void load()} className={cn(SECONDARY, SMALL, "ml-auto")}>
								Try again
							</button>
						</div>
					)}

					{!status && !loadError && (
						<div className="rounded-3xl border bg-card p-6 sm:p-8" aria-busy="true" aria-label="Loading your review deck" data-testid="review-loading">
							<div className="h-3 w-20 animate-pulse rounded bg-accent" />
							<div className="mt-7 h-9 w-full animate-pulse rounded-lg bg-accent" />
							<div className="mt-3 h-9 w-2/3 animate-pulse rounded-lg bg-accent" />
							<div className="mt-5 h-4 w-1/2 animate-pulse rounded bg-accent/70" />
							<div className="mt-8 flex justify-end gap-2">
								<div className="h-12 w-28 animate-pulse rounded-xl bg-accent/70" />
								<div className="h-12 w-28 animate-pulse rounded-xl bg-accent" />
							</div>
						</div>
					)}

					{status && !status.available && (
						<div className="rounded-xl border bg-card p-6 text-base text-muted-foreground" data-testid="review-unavailable">
							This language has no dictionary yet, so there are no review sentences. Slovak has one: switch languages at the top of the sidebar.
						</div>
					)}

					{status?.available && !prompt && (
						<div className="rounded-3xl border bg-card p-8 text-center" data-testid="review-done">
							<div className="mx-auto flex size-14 items-center justify-center rounded-full bg-go-soft text-go">
								<CheckIcon className="size-7" strokeWidth={3} aria-hidden="true" />
							</div>
							<p className="mt-4 font-ui text-2xl font-black text-foreground">All caught up</p>
							<p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">
								{(counts?.reviewedToday ?? 0) === 1 ? "1 review" : `${counts?.reviewedToday ?? 0} reviews`} done today. Words come back on the day they are due, and new ones arrive tomorrow.
							</p>
							<div className="mt-6 flex items-center justify-center gap-3" data-testid="review-new-per-day">
								<span className="font-ui text-sm font-semibold text-muted-foreground" id="review-new-per-day-label">
									New words per day
								</span>
								<div className="flex items-center rounded-xl border-2 border-border" role="group" aria-labelledby="review-new-per-day-label">
									<button
										type="button"
										onClick={() => stepNewPerDay(-5)}
										disabled={(newPerDay ?? status.settings.newPerDay) <= 0}
										aria-label="Five fewer new words per day"
										className="grid size-10 place-items-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
									>
										<MinusIcon className="size-4" />
									</button>
									<span className="w-10 text-center font-ui text-base font-bold tabular-nums text-foreground" aria-live="polite">
										{newPerDay ?? status.settings.newPerDay}
									</span>
									<button
										type="button"
										onClick={() => stepNewPerDay(5)}
										disabled={(newPerDay ?? status.settings.newPerDay) >= 100}
										aria-label="Five more new words per day"
										className="grid size-10 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
									>
										<PlusIcon className="size-4" />
									</button>
								</div>
							</div>
							<div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
								<Link href="/" className={SECONDARY}>
									Back to Today
								</Link>
								<Link href="/lesson" className={PRIMARY}>
									Do a lesson
								</Link>
							</div>
						</div>
					)}

					{prompt && (
						<div className="rounded-3xl border bg-card p-6 sm:p-8" data-testid="review-card">
							{/* Card header: where this word is in the deck, then how to answer. */}
							<div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-ui text-xs font-bold text-muted-foreground">
								<span>{prompt.card.state === "new" ? "New word" : prompt.card.state === "learning" ? "Relearning" : "Review"}</span>
								<div className="ml-auto flex items-center gap-2">
									<span id="review-mode-label">Answer by</span>
									<div className="flex rounded-lg bg-accent/60 p-0.5" role="radiogroup" aria-labelledby="review-mode-label">
										{(["type", "choice"] as const).map((m) => (
											<button
												key={m}
												type="button"
												role="radio"
												aria-checked={mode === m}
												onClick={() => {
													setMode(m);
													writePref(MODE_KEY, m);
												}}
												className={cn("rounded-md px-2.5 py-1 transition-colors", mode === m ? "bg-background text-foreground shadow-sm" : "hover:text-foreground")}
												data-testid={`review-mode-${m}`}
											>
												{m === "type" ? "Typing" : "Choosing"}
											</button>
										))}
									</div>
									<button
										type="button"
										onClick={toggleSound}
										aria-pressed={sound}
										className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-accent hover:text-foreground"
										title="Speech and sounds, on every page"
										data-testid="review-sound"
									>
										{sound ? <Volume2Icon className="size-4" aria-hidden="true" /> : <VolumeXIcon className="size-4" aria-hidden="true" />}
										{sound ? "Sound on" : "Sound off"}
									</button>
								</div>
							</div>

							<form
								onSubmit={(e) => {
									e.preventDefault();
									if (given.trim()) check(given);
								}}
								className="text-3xl leading-relaxed text-foreground"
								lang={lang?.code}
							>
								<span>{prompt.before}</span>
								{verdict ? (
									<span className={cn("-mx-0.5 rounded-md px-0.5 font-semibold", verdict === "accents" ? VERDICT_STYLE.accents.className : VERDICT_STYLE.exact.className)} data-testid="review-answer">
										{[...prompt.card.answer].map((ch, i) => (
											<span key={i} className={slips.has(i) ? "underline decoration-2 underline-offset-4" : undefined}>
												{ch}
											</span>
										))}
									</span>
								) : !picks ? (
									<input
										ref={inputRef}
										value={given}
										onChange={(e) => setGiven(e.target.value)}
										aria-label="Missing word"
										autoComplete="off"
										autoCorrect="off"
										spellCheck={false}
										data-testid="review-input"
										style={{ width: `${Math.max(4, prompt.card.answer.length + 1)}ch` }}
										className="mx-1 inline-block rounded-xl border-2 border-border bg-background px-2 text-center font-bold caret-go outline-none transition-colors selection:bg-go/30 focus:border-go"
									/>
								) : (
									<span className="mx-1 inline-block h-[1.1em] w-[5ch] translate-y-[0.2em] rounded-lg border-2 border-dashed border-muted-foreground/50" aria-label="blank" />
								)}
								<span>{prompt.after}</span>
							</form>

							<p className="mt-3 text-lg text-muted-foreground">{prompt.card.translation}</p>

							{/* Hints taken, labelled the same way as the lesson's cue chip. */}
							{!verdict && hint > 0 && (
								<p className="mt-3 flex flex-wrap gap-2 text-base" data-testid="review-hints">
									<span className="inline-flex items-baseline gap-1.5 rounded-md bg-accent px-2 py-0.5 text-foreground">
										<span className="font-ui text-xs font-bold text-muted-foreground">means</span>
										<span className="font-medium">{prompt.card.gloss}</span>
									</span>
									{hint > 1 && (
										<span className="inline-flex items-baseline gap-1.5 rounded-md bg-accent px-2 py-0.5 text-foreground">
											<span className="font-ui text-xs font-bold text-muted-foreground">base form</span>
											<span className="font-medium" lang={lang?.code}>
												{prompt.card.lemma}
											</span>
										</span>
									)}
								</p>
							)}

							{!verdict && mode === "choice" && !picks && <p className="mt-2 font-ui text-sm text-muted-foreground">You have met this word before, so this time you type it.</p>}

							{!verdict && picks && (
								<div className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="review-options">
									{prompt.options.map((o, i) => (
										<button
											key={o}
											type="button"
											onClick={() => check(o)}
											className="flex items-center gap-3 rounded-xl border-2 border-border bg-background px-4 py-3 text-left text-xl text-foreground transition-colors hover:border-foreground/40 hover:bg-accent"
											lang={lang?.code}
										>
											<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-ui text-sm text-muted-foreground">{i + 1}</span>
											{o}
										</button>
									))}
								</div>
							)}

							{!verdict && !picks && <DiacriticBar variant="keys" className="mt-6" />}

							{!verdict && (
								<div className="mt-7 flex flex-wrap items-center gap-2 font-ui">
									{/* Graded help: the meaning first, then the base form. Each
									    one caps the rating, so the card comes back sooner. */}
									{hint < 2 && (
										<button
											type="button"
											onClick={() => {
												setHint((h) => Math.min(2, h + 1));
												inputRef.current?.focus();
											}}
											className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
											title={hint === 0 ? "Show what the word means. The card then comes back sooner (rated Good at most)." : "Show the dictionary form. The card then comes back sooner (rated Hard at most)."}
											data-testid="review-hint"
										>
											<LightbulbIcon className="size-4" aria-hidden="true" />
											{hint === 0 ? "Show meaning" : "Show base form"}
											<span className="font-normal">· comes back sooner</span>
										</button>
									)}
									<div className="ml-auto flex items-center gap-2">
										<button type="button" onClick={() => check("")} className={QUIET} data-testid="review-dont-know">
											I don&apos;t know
										</button>
										{!picks && (
											<button type="button" onClick={() => check(given)} disabled={!given.trim()} className={PRIMARY} data-testid="review-check">
												Check
											</button>
										)}
									</div>
								</div>
							)}

							{verdict && (
								<div className="mt-6 border-t pt-5" data-testid="review-verdict">
									{/* Header row: the verdict left, Continue right (the lesson footer's shape). */}
									<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
										<div className="flex items-center gap-3">
											<span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", VERDICT_STYLE[verdict].badge)} aria-hidden="true">
												{verdict === "wrong" ? <XIcon className="size-5" strokeWidth={3} /> : <CheckIcon className="size-5" strokeWidth={3} />}
											</span>
											<p className={cn("font-ui text-2xl font-bold leading-tight", VERDICT_STYLE[verdict].className)}>{VERDICT_STYLE[verdict].label}</p>
										</div>
										{/* The checker already knows how it went: Continue schedules with
										    the derived rating (one decision per card, not two). */}
										<button
											type="button"
											autoFocus
											disabled={saving}
											onClick={() => void rate(suggested)}
											data-testid="review-continue"
											className={cn(BUTTON, "hover:brightness-110 disabled:opacity-50", VERDICT_STYLE[verdict].btn)}
										>
											{saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
											Continue
										</button>
									</div>
									<div className="mt-3 flex flex-col gap-3 sm:pl-12">
										{verdict !== "exact" && (
											<div>
												<p className="font-prose text-lg text-foreground">
													Correct answer: <b lang={lang?.code}>{prompt.card.answer}</b>
												</p>
												{given && (
													<p className="font-prose text-base text-muted-foreground">
														You wrote “<span lang={lang?.code}>{given}</span>”
													</p>
												)}
											</div>
										)}
										<div className="flex items-start gap-3">
											<PlayButton text={prompt.card.sentence} className="mt-0.5 size-8 rounded-full bg-sky/20 text-sky hover:bg-sky/30 hover:text-sky" label="Play the sentence" />
											<div className="min-w-0">
												<p className="font-prose text-lg leading-snug text-foreground" lang={lang?.code}>
													{prompt.before}
													<b className={VERDICT_STYLE[verdict].className}>{prompt.card.answer}</b>
													{prompt.after}
												</p>
												<p className="font-prose text-base text-muted-foreground">{prompt.card.translation}</p>
											</div>
										</div>
										<dl className="flex flex-wrap gap-2" data-testid="review-facts">
											<Fact
												icon={<WholeWordIcon className="size-4" />}
												label={prompt.form ? "Form" : "Word"}
												value={prompt.form ?? `${prompt.card.lemma} · ${prompt.card.gloss.split(/[;,(]/)[0]!.trim()}`}
											/>
											{rankLabel(prompt.rank, prompt.cat) && <Fact icon={<ChartColumnIcon className="size-4" />} label="How common" value={rankLabel(prompt.rank, prompt.cat)!} />}
											<Fact icon={<BrainIcon className="size-4" />} label="Memory" value={memoryLine(prompt.card.state, prompt.intervals[suggested])} />
										</dl>
										{/* The four ratings stay as a quiet override of the suggested one. */}
										<div className="flex flex-wrap items-center gap-1.5 font-ui text-xs text-muted-foreground" data-testid="review-ratings">
											<span className="mr-1">Rate it yourself:</span>
											{([1, 2, 3, 4] as Rating[]).map((r) => (
												<button
													key={r}
													type="button"
													disabled={saving || r > ratingCap(help)}
													onClick={() => void rate(r)}
													title={r > ratingCap(help) ? `${RATING_LABELS[r]} is off: you had help on this card` : `${RATING_LABELS[r]}: next in ${formatInterval(prompt.intervals[r])} (key ${r})`}
													className={cn("rounded-full border px-2.5 py-1 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:line-through disabled:hover:bg-transparent", r === suggested && "border-foreground/40 text-foreground")}
												>
													{RATING_LABELS[r]} · {formatInterval(prompt.intervals[r])}
												</button>
											))}
											<span className="ml-auto hidden items-center gap-1 sm:flex">
												{hint > 0 || picks ? (
													`With help: at most ${RATING_LABELS[ratingCap(help)]}`
												) : (
													<>
														{kbd("Enter")} continues · {kbd("1")}–{kbd("4")} rate
													</>
												)}
											</span>
										</div>
									</div>
								</div>
							)}

							<div className="mt-6 flex justify-end">
								<button
									type="button"
									onClick={() => void suspend()}
									className="flex items-center gap-1.5 rounded-md px-2 py-1 font-ui text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
									title="Never show this sentence again"
									data-testid="review-suspend"
								>
									<EyeOffIcon className="size-3.5" aria-hidden="true" />
									Hide this sentence
								</button>
							</div>
						</div>
					)}

					{prompt && !verdict && !picks && (
						<p className="mt-3 hidden items-center justify-center gap-1.5 font-ui text-sm text-muted-foreground sm:flex">
							{kbd("Enter")} to check
						</p>
					)}

					{status && status.leeches.length > 0 && (
						<div className="mt-10" data-testid="review-leeches">
							<h2 className="font-ui text-sm font-extrabold text-foreground">Words that keep slipping</h2>
							<p className="mt-0.5 text-sm text-muted-foreground">Missed again and again. A lesson on them, or a sentence of your own, often helps more than another review.</p>
							<ul className="mt-3 flex flex-wrap gap-2 text-sm">
								{status.leeches.map((l) => (
									<li key={l.id} className="rounded-lg border px-2.5 py-1">
										<span className="text-foreground" lang={lang?.code}>
											{l.lemma}
										</span>{" "}
										<span className="text-muted-foreground">{l.gloss}</span>{" "}
										<span className="font-ui text-xs text-muted-foreground" title={`Missed ${l.lapses} times`}>
											×{l.lapses}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{status?.available && <p className="mt-10 text-center text-xs text-muted-foreground">Sentences from slovak.wiki: curated examples and Tatoeba (CC BY 2.0 FR).</p>}
				</div>
			</main>
		</div>
	);
}
