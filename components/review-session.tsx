"use client";

/**
 * Spaced-review page: Clozemaster-style cloze cards from the dictionary's
 * sentences, scheduled with FSRS. Grading is local and instant
 * (core/language.ts compareAnswer); the confirmed rating goes to POST /api/review.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EyeOffIcon, LightbulbIcon, LoaderCircleIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QCheck, QIcon, QPie } from "@/components/quiet/icon";
import { JumpBar } from "@/components/quiet/jump";
import { SidebarToggle } from "@/components/sidebar";
import { DayRail, greeting, todayDate, useDaySummary } from "@/components/quiet/day-rail";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { useRouter } from "next/navigation";
import { DiacriticBar } from "@/components/diacritic-bar";
import { useActiveTime } from "@/components/use-active-time";
import { PlayButton, speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { SoundControl } from "@/components/sound-control";
import { compareAnswer, diacriticSlips, formatInterval, ratingCap, ratingFor, RATING_LABELS, type AnswerVerdict, type Rating, type ReviewCard } from "@/src/core";

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
/** How long the loading skeleton waits before it shows, so a deck that
 *  lands inside this window never flashes one. */
const SKELETON_DELAY_MS = 300;
/** The deck as it last loaded, so a return visit starts with a card on screen. */
let knownStatus: Status | null = null;

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

/**
 * Splits the sentence around the blank. Punctuation that touches the blank
 * ("." after it, "„" before it) comes out as lead and tail, so it renders in
 * the same nowrap run as the highlight box. The box is an atomic inline, and
 * a browser may break the line right after it, stranding the period below it.
 */
function clozeAround(before: string, after: string) {
	const lead = /[^\s\p{L}\p{N}]*$/u.exec(before)?.[0] ?? "";
	const tail = /^[^\s\p{L}\p{N}]*/u.exec(after)?.[0] ?? "";
	return { before: before.slice(0, before.length - lead.length), lead, tail, after: after.slice(tail.length) };
}

export function ReviewSession() {
	const lang = useActiveLanguage();
	const [status, setStatus] = useState<Status | null>(() => knownStatus);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [given, setGiven] = useState("");
	const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
	const [suggested, setSuggested] = useState<Rating>(3);
	// Hints taken on this card: 1 = the meaning, 2 = the dictionary form too.
	// Each one is allowed and priced (caps the rating; core/review.ts).
	const [hint, setHint] = useState(0);
	// Read on first render, so the card never paints the default and then flips.
	const [mode, setMode] = useState<Mode>(() => (readPref(MODE_KEY, "type") === "choice" ? "choice" : "type"));
	const [saving, setSaving] = useState(false);
	// The rep just before this one, kept on screen as a collapsed line.
	const [last, setLast] = useState<{ before: string; answer: string; after: string; translation: string; label: string } | null>(null);
	const shownAt = useRef(Date.now());
	// One card at a time: its active time (the gaps between actions, each
	// capped) is what the day's minutes count; `ms` stays the card's wall-clock.
	const activeTime = useActiveTime("review", "interactive");
	const inputRef = useRef<HTMLInputElement>(null);

	// The skeleton waits a beat, so a deck that lands at once never flashes one.
	const [slow, setSlow] = useState(false);
	useEffect(() => {
		const t = window.setTimeout(() => setSlow(true), SKELETON_DELAY_MS);
		return () => window.clearTimeout(t);
	}, []);

	// `keepCard` is the mount's background refresh: when the same card is
	// still due, what the learner has typed and the card's timer carry on.
	const load = useCallback(
		async (keepCard = false) => {
			try {
				const res = await fetch(`/api/review?tz=${new Date().getTimezoneOffset()}`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const next = (await res.json()) as Status;
				const sameCard = keepCard && !!next.next && next.next.card.id === knownStatus?.next?.card.id;
				knownStatus = next;
				setStatus(next);
				if (!sameCard) {
					setGiven("");
					setVerdict(null);
					setHint(0);
					shownAt.current = Date.now();
					// A card is on screen: time it. The caught-up screen is not practice.
					if (next.next) activeTime.restart();
					else activeTime.finish();
				}
				setLoadError(null);
			} catch (err) {
				setLoadError(err instanceof Error ? err.message : String(err));
			}
		},
		[activeTime],
	);

	useEffect(() => {
		void load(true);
	}, [load]);

	const prompt = status?.next ?? null;
	const around = clozeAround(prompt?.before ?? "", prompt?.after ?? "");
	const tag = lang?.tag ?? "sk-SK";
	// A card already retrieved once is always typed: recall beats recognition (docs/research/desirable-difficulties.md).
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
				body: JSON.stringify({ cardId: prompt.card.id, given, ms: Date.now() - shownAt.current, activeMs: activeTime.finish(), rating: Math.min(rating, ratingCap(help)), hints: hint, picked: picks }),
			});
			setLast({ before: around.before + around.lead, answer: prompt.card.answer, after: around.tail + around.after, translation: prompt.card.translation, label: `${RATING_LABELS[Math.min(rating, ratingCap(help)) as Rating]}${help.hints > 0 || help.picked ? ", with help" : ", no help"}` });
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
			} else if (["1", "2", "3", "4"].includes(e.key) && !(e.target instanceof HTMLInputElement) && Number(e.key) <= ratingCap(help)) {
				setSuggested(Number(e.key) as Rating);
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

	const counts = status?.counts;
	const day = useDaySummary();
	const router = useRouter();
	const zeroKeys = useZeroKeys();
	const strongKeyless = useStrongKeyless();
	const keyless = zeroKeys || strongKeyless;
	const done = counts?.reviewedToday ?? 0;
	const left = counts ? counts.due + counts.learning + counts.newLeft : 0;
	const isNew = prompt?.card.state === "new";
	const position = counts ? counts.newToday + 1 : 1;
	const newTotal = counts ? counts.newToday + counts.newLeft : 0;
	const exact = verdict === "exact";
	const helped = hint > 0 || picks;
	const shownSuggested = Math.min(suggested, ratingCap(help)) as Rating;

	return (
		<div className="@container h-dvh" data-testid="review-session">
			<div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,1fr)_376px] @6xl:grid-rows-1">
				<header className="relative z-[2] flex h-[60px] items-center gap-2.5 bg-background px-4 shadow-[inset_0_-1px_0_var(--q-line)] @6xl:hidden">
					<SidebarToggle />
					<QPie frac={day.s && day.s.dailyGoal > 0 ? day.s.todayXp / day.s.dailyGoal : 0} size={28} />
					<div className="flex min-w-0 flex-col leading-[1.2]">
						<b className="q-num text-[15px] font-semibold tracking-[-0.01em]">
							{day.s?.todayXp ?? 0} <span className="text-[13px] font-[450] text-ink-3">/ {day.s?.dailyGoal ?? 50} XP</span>
						</b>
						<small className="text-xs text-ink-3">{day.s ? `${Math.max(0, day.s.dailyGoal - day.s.todayXp)} to today's goal` : " "}</small>
					</div>
					<Link href="/" className="q-btn ghost ml-auto">
						Today
					</Link>
				</header>

				<main className="flex min-h-0 flex-col">
					<div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto [scrollbar-gutter:stable] px-4 pb-1 [mask-image:linear-gradient(to_bottom,transparent_0,#000_120px)] @6xl:px-0">
						<div className="mx-auto w-full max-w-[720px] pt-8">
							{/* The date and greeting are known at once; the day's counts join the line when the summary arrives, in space already held for two lines on a phone. */}
							<section className="opacity-50">
								<p className="q-date first-letter:uppercase" suppressHydrationWarning>
									{todayDate()}
								</p>
								<p className="q-line mt-0.5 min-h-[30px] text-[20px] font-semibold tracking-[-0.02em] @max-xl:min-h-[60px]" suppressHydrationWarning>
									{greeting()}.{day.s ? `${day.s.streak.days > 0 ? ` Day ${day.s.streak.days} in a row.` : ""} ${day.s.plan.total} things today, ${day.s.plan.done} done.` : ""}
								</p>
							</section>

							<section className="mt-5">
								<h2 className="q-sh">
									<QIcon name="review" />
									Review
									{counts && lang && (
										<small data-testid="review-counts">
											{counts.due + counts.learning} due · {counts.newLeft} new · {counts.reviewedToday} done today
										</small>
									)}
								</h2>
								<p className={cn("q-line dim min-h-[26px] opacity-75", !prompt && "invisible")}>Type each one. Help is there, and it costs a little.</p>
							</section>

							{last && prompt && (
								<div className="q-rep mt-3 opacity-75" data-testid="review-last">
									<span className="cb">
										<QCheck />
									</span>
									<span className="s" lang={lang?.code}>
										{last.before}
										<em>{last.answer}</em>
										{last.after}
									</span>
									<span className="e hidden @xl:inline">{last.translation}</span>
									<span className="r">{last.label}</span>
								</div>
							)}

							<section className="mt-5">
								{loadError && (
									<div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground">
										<p>Couldn&apos;t load your review deck. {loadError}</p>
										<button type="button" onClick={() => void load()} className="q-btn sec ml-auto">
											Try again
										</button>
									</div>
								)}

								{/* The page is bottom-aligned, so a card that arrives late would push everything above it up: its space is held from the first frame, drawn only after the skeleton delay. */}
								{!loadError && (!status || (prompt && !lang)) && (
									<div className={cn("q-cloze min-h-[300px] p-7", !slow && "invisible")} aria-busy="true" aria-label="Loading your review deck" data-testid="review-loading">
										<div className="h-3 w-20 animate-pulse rounded bg-well-2" />
										<div className="mt-7 h-12 w-full animate-pulse rounded-lg bg-well-2" />
										<div className="mt-3 h-12 w-2/3 animate-pulse rounded-lg bg-well-2" />
									</div>
								)}

								{status && !status.available && (
									<div className="q-card p-6 text-[15px] text-ink-3" data-testid="review-unavailable">
										This language has no dictionary yet, so there are no review sentences. Slovak has one: switch languages at the top of the sidebar.
									</div>
								)}

								{status?.available && !prompt && (
									<div className="q-card p-8" data-testid="review-done">
										<div className="flex items-center gap-3">
											<span className="grid size-8 place-items-center rounded-full bg-teal text-sun-ink">
												<QIcon name="check" className="size-4" />
											</span>
											<p className="text-[24px] font-semibold tracking-[-0.02em]">All caught up</p>
										</div>
										<p className="q-line dim mt-2 max-w-md">
											{done === 1 ? "1 review" : `${done} reviews`} done today. Words come back on the day they are due, and new ones arrive tomorrow.
										</p>
										<div className="mt-5 flex items-center gap-3" data-testid="review-new-per-day">
											<span className="text-[13px] text-ink-3" id="review-new-per-day-label">
												New words per day
											</span>
											<div className="q-segc" role="group" aria-labelledby="review-new-per-day-label">
												<button type="button" onClick={() => stepNewPerDay(-5)} disabled={(newPerDay ?? status.settings.newPerDay) <= 0} aria-label="Five fewer new words per day" className="disabled:opacity-40">
													<MinusIcon className="size-3.5" />
												</button>
												<span className="q-num grid w-10 place-items-center text-[13px] font-semibold" aria-live="polite">
													{newPerDay ?? status.settings.newPerDay}
												</span>
												<button type="button" onClick={() => stepNewPerDay(5)} disabled={(newPerDay ?? status.settings.newPerDay) >= 100} aria-label="Five more new words per day" className="disabled:opacity-40">
													<PlusIcon className="size-3.5" />
												</button>
											</div>
										</div>
										<div className="q-acts">
											<Link href="/" className="q-btn sec">
												Back to Today
											</Link>
											<Link href="/lesson" className="q-btn primary">
												Do a lesson
											</Link>
										</div>
									</div>
								)}

								{prompt && lang && (
									<article className="q-cloze" data-testid="review-card" aria-label={`Review, ${isNew ? "new word" : "card"}`}>
										<header className="q-card-head">
											<QIcon name="review" />
											<span className="@max-xl:hidden">Review</span>
											<span className="whitespace-nowrap font-[450] text-ink-3">{isNew ? (newTotal > 0 ? `New word ${position} of ${newTotal}` : "New word") : prompt.card.state === "learning" ? "Relearning" : "Review"}</span>
											{isNew && newTotal > 0 && newTotal <= 24 && (
												<span className="q-dots hidden @xl:flex" aria-hidden="true">
													{Array.from({ length: newTotal }, (_, i) => (
														<i key={i} className={i < position - 1 ? "d" : i === position - 1 ? "c" : undefined} />
													))}
												</span>
											)}
											<span className="mins flex items-center gap-2">
												<span className="q-segc" role="radiogroup" aria-label="Answer by">
													{(["type", "choice"] as const).map((m) => (
														<button
															key={m}
															type="button"
															role="radio"
															aria-checked={mode === m}
															className={cn("!h-6 !px-2 !text-[12px]", mode === m && "on")}
															onClick={() => {
																setMode(m);
																writePref(MODE_KEY, m);
															}}
															data-testid={`review-mode-${m}`}
														>
															{m === "type" ? "Typing" : "Choosing"}
														</button>
													))}
												</span>
												<SoundControl className="flex items-center transition-colors" iconClass="size-4" testid="review-sound" />
											</span>
										</header>
										<div className="q-c-body !px-4 @xl:!px-7">
											<form
												onSubmit={(e) => {
													e.preventDefault();
													if (given.trim()) check(given);
												}}
												className="q-sent !text-[28px] !leading-[44px] @xl:!text-[44px] @xl:!leading-[64px]"
												lang={lang?.code}
												data-word-lookup-enabled={verdict !== null ? "true" : "false"}
											>
												<span>{around.before}</span>
												<span className="whitespace-nowrap">
													{around.lead}
													<span
														className={cn(
															"q-slot !h-[44px] !px-2.5 @xl:!h-[58px] @xl:!px-3.5",
															!verdict && "q-write !text-foreground",
															verdict === "wrong" && "!text-miss",
															verdict === "accents" && "!text-foreground",
														)}
														style={{ display: "inline-grid", gridTemplateColumns: "auto" }}
													>
														<span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
															{!verdict && !picks && given.length > prompt.card.answer.length ? given : prompt.card.answer}
														</span>
														{verdict ? (
															<span className="col-start-1 row-start-1 flex items-center gap-2.5" data-testid="review-answer">
																<span className={cn(verdict === "exact" && "underline decoration-teal decoration-2 underline-offset-[8px]", verdict === "wrong" && "underline decoration-miss decoration-2 underline-offset-[8px]")}>
																	{[...prompt.card.answer].map((ch, i) => (
																		<span key={i} className={slips.has(i) ? "underline decoration-2 underline-offset-4" : undefined}>
																			{ch}
																		</span>
																	))}
																</span>
																<span className={cn("ok", verdict === "wrong" && "!text-miss")}>
																	{verdict === "wrong" ? <XIcon className="size-5" strokeWidth={2.4} /> : <QCheck />}
																</span>
															</span>
														) : picks ? (
															<span className="col-start-1 row-start-1" aria-label="blank" />
														) : (
															<input
																ref={inputRef}
																value={given}
																onChange={(e) => setGiven(e.target.value)}
																aria-label="Missing word"
																autoComplete="off"
																autoCorrect="off"
																spellCheck={false}
																size={1}
																data-testid="review-input"
																className="col-start-1 row-start-1 w-px min-w-full bg-transparent text-center outline-none caret-teal selection:bg-teal-line"
															/>
														)}
													</span>
													{around.tail}
												</span>
												<span>{around.after}</span>
											</form>

											<div className="q-en @max-xl:flex-col @max-xl:items-start @max-xl:gap-2">
												<div className="flex items-center gap-2">
													<p data-no-word-lookup="true">{prompt.card.translation}</p>
													{verdict && <PlayButton text={prompt.card.sentence} className="size-8 shrink-0 rounded-full bg-well text-ink-2 hover:bg-well-2" label="Play the sentence" />}
												</div>
												{verdict && (
													<p className={cn("q-result", verdict === "wrong" && "miss")} data-testid="review-verdict">
														{verdict === "wrong" ? <XIcon className="size-[15px]" strokeWidth={2} aria-hidden="true" /> : <QIcon name="check" />}
														{exact ? (helped ? "Right" : "Right on the first try") : verdict === "accents" ? "Almost, check the accents" : "Not quite"}
														<span>{exact ? (helped ? "· help used" : "· no help used") : ""}</span>
													</p>
												)}
											</div>

											{verdict && verdict !== "exact" && (
												<div className="q-sub">
													Correct answer: <b lang={lang?.code}>{prompt.card.answer}</b>
													{given && (
														<>
															{" "}
															· You wrote “<span lang={lang?.code}>{given}</span>”
														</>
													)}
												</div>
											)}

											{!verdict && hint > 0 && (
												<p className="mt-3 flex flex-wrap gap-2 text-[15px]" data-testid="review-hints">
													<span className="q-ex">
														<span className="mr-1.5 text-[12px] font-semibold text-ink-3">means</span>
														{prompt.card.gloss}
													</span>
													{hint > 1 && (
														<span className="q-ex">
															<span className="mr-1.5 text-[12px] font-semibold text-ink-3">base form</span>
															<span lang={lang?.code}>{prompt.card.lemma}</span>
														</span>
													)}
												</p>
											)}

											{!verdict && mode === "choice" && !picks && <p className="q-sub">You have met this word before, so this time you type it.</p>}

											{!verdict && picks && (
												<div className="mt-5 grid gap-2 @xl:grid-cols-2" data-testid="review-options">
													{prompt.options.map((o, i) => (
														<button key={o} type="button" onClick={() => check(o)} lang={lang?.code} className="flex h-12 items-center gap-3 rounded-lg bg-well px-3.5 text-left text-[20px] font-[500] hover:bg-well-2">
															<kbd className="q-kbd pointer-coarse:hidden">{i + 1}</kbd>
															{o}
														</button>
													))}
												</div>
											)}

											{!verdict && !picks && <DiacriticBar variant="keys" className="mt-5" />}
										</div>
									</article>
								)}

								{prompt && lang && (
									<div className="mt-2 flex justify-end">
										<button type="button" onClick={() => void suspend()} className="q-btn ghost" title="Never show this word again" data-testid="review-suspend">
											<EyeOffIcon className="size-3.5" aria-hidden="true" />
											Hide this word
										</button>
									</div>
								)}

								{status && lang && status.leeches.length > 0 && (
									<div className="mt-6" data-testid="review-leeches">
										<h2 className="q-sh">Words that keep slipping</h2>
										<p className="q-sub" style={{ marginTop: 0 }}>
											Missed again and again. A lesson on them, or a sentence of your own, often helps more than another review.
										</p>
										<ul className="mt-3 flex flex-wrap gap-2">
											{status.leeches.map((l) => (
												<li key={l.id} className="q-ex" title={`Missed ${l.lapses} times`}>
													<span lang={lang?.code}>{l.lemma}</span>
													<span className="ml-1.5 font-[450] text-ink-3">{l.gloss}</span>
													<span className="ml-1.5 text-[12px] text-ink-3">×{l.lapses}</span>
												</li>
											))}
										</ul>
									</div>
								)}

							</section>
						</div>
					</div>

					<div className="px-4 pb-3 pt-3 @6xl:px-0 @6xl:pb-5">
						<div className="mx-auto w-full max-w-[720px]">
							{!(prompt && lang) && <div className="mb-3 h-[34px]" aria-hidden="true" />}
							{prompt && lang && (
								<div className="q-decide flex-wrap" data-testid="review-dock">
									{!verdict ? (
										<>
											{hint < 2 && (
												<button
													type="button"
													onClick={() => {
														setHint((h) => Math.min(2, h + 1));
														inputRef.current?.focus();
													}}
													className="q-btn ghost"
													title={hint === 0 ? "Show what the word means. The card then comes back sooner (rated Good at most)." : "Show the dictionary form. The card then comes back sooner (rated Hard at most)."}
													data-testid="review-hint"
												>
													<LightbulbIcon className="size-3.5" aria-hidden="true" />
													{hint === 0 ? "Show meaning" : "Show base form"}
													<span className="font-[450]">· comes back sooner</span>
												</button>
											)}
											<button type="button" onClick={() => check("")} className="q-btn ghost ml-auto" data-testid="review-dont-know">
												I don&apos;t know
											</button>
											{!picks && (
												<button type="button" onClick={() => check(given)} disabled={!given.trim()} className="q-btn primary !ml-0" data-testid="review-check">
													Check
													<kbd className="q-kbd pointer-coarse:hidden">
														<QIcon name="enter" />
													</kbd>
												</button>
											)}
										</>
									) : (
										<>
											<span className="l">Rate it</span>
											<div className="q-segc" role="radiogroup" aria-label="Rate it yourself" data-testid="review-ratings">
												{([1, 2, 3, 4] as Rating[]).map((r) => (
													<button
														key={r}
														type="button"
														role="radio"
														aria-checked={r === shownSuggested}
														disabled={saving || r > ratingCap(help)}
														onClick={() => setSuggested(r)}
														title={r > ratingCap(help) ? `${RATING_LABELS[r]} is off: you had help on this card` : `${RATING_LABELS[r]}: next in ${formatInterval(prompt.intervals[r])} (key ${r})`}
														className={cn(r === shownSuggested && "on", "disabled:opacity-35 disabled:line-through")}
													>
														{RATING_LABELS[r]}
														<kbd className="pointer-coarse:hidden">{r}</kbd>
													</button>
												))}
											</div>
											<button type="button" autoFocus disabled={saving} onClick={() => void rate(shownSuggested)} data-testid="review-continue" className="q-btn primary">
												{saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
												Continue · {RATING_LABELS[shownSuggested]}
												<kbd className="q-kbd pointer-coarse:hidden">
													<QIcon name="enter" />
												</kbd>
											</button>
										</>
									)}
								</div>
							)}
							<JumpBar />
						</div>
					</div>
				</main>

				<DayRail s={day.s} />
			</div>
		</div>
	);
}
