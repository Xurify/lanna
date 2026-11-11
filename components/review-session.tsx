"use client";

/**
 * Spaced-review page: Clozemaster-style cloze cards from the dictionary's
 * sentences, scheduled with FSRS. Grading is local and instant
 * (core/language.ts compareAnswer); the confirmed rating goes to POST /api/review.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookmarkIcon, EyeOffIcon, LightbulbIcon, LoaderCircleIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QCheck, QIcon, QPie } from "@/components/quiet/icon";
import { SidebarToggle } from "@/components/sidebar";
import { DayRail, useDaySummary } from "@/components/quiet/day-rail";
import { DiacriticBar } from "@/components/diacritic-bar";
import { useActiveTime } from "@/components/use-active-time";
import { PlayButton, prefetchSpeech, speak, useActiveLanguage } from "@/components/speech";
import { sfx, warmSound } from "@/components/lesson/sound";
import { SoundControl } from "@/components/sound-control";
import { compareAnswer, diacriticSlips, formatInterval, ratingCeiling, ratingFor, RATING_LABELS, shortGloss, targetWordOf, type AnswerVerdict, type MissReason, type Rating, type ReviewCard } from "@/src/core";
import { fillStyle } from "@/components/ui/fill";
import { settle, shake } from "@/components/motion";
import { SourcesNote } from "@/components/sources/sources-note";

interface Prompt {
	card: ReviewCard;
	before: string;
	after: string;
	answer: string;
	words: number;
	target: number;
	intervals: Record<Rating, number>;
	options: string[];
	rank?: number;
	cat?: string;
	form?: string;
	sentenceSource?: string;
}

/** How the lexicon's `src` reads on the card. */
const SENTENCE_SOURCES: Record<string, string> = { curated: "slovak.wiki", tatoeba: "Tatoeba" };

interface Status {
	profile: string;
	available: boolean;
	counts: { due: number; learning: number; newToday: number; newLeft: number; total: number; reviewedToday: number; cardsToday: number; dueUntouched: number; pendingNew: number; dueLater: number };
	settings: { newPerDay: number; retention: number; blankWords: number };
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

function MissWhy({ reason, given, code, className }: { reason: MissReason; given: string; code?: string; className?: string }) {
	const w = (text: string) => (
		<b className="font-semibold" lang={code}>
			{text}
		</b>
	);
	const yours = <span lang={code}>“{given.trim()}”</span>;
	const here = (
		<>
			This one is {w(reason.lemma)}, {reason.gloss}.
		</>
	);
	const what =
		reason.slip === "other" && reason.other ? (
			<>
				{yours} {reason.other.isLemma ? <>means {reason.other.gloss}</> : <>is a form of {w(reason.other.lemma)}, {reason.other.gloss}</>}: a different word. {here}
			</>
		) : reason.slip === "other" ? (
			<>
				{yours} is not a form of {w(reason.lemma)} ({reason.gloss}).
			</>
		) : reason.slip === "base" ? (
			<>{yours} is the dictionary form. The sentence needs an ending on it.</>
		) : reason.slip === "same-word" ? (
			<>
				{yours} is {w(reason.lemma)} with another ending.
			</>
		) : (
			<>
				The word is {w(reason.lemma)}, {reason.gloss}.
			</>
		);
	const need = reason.trigger ? (
		<>
			<span className="rounded-[5px] bg-well px-1.5 font-semibold text-teal-2" lang={code}>
				{reason.trigger}
			</span>{" "}
			decides the case{reason.form ? <>: {w(`${reason.form}`)}</> : null}.
		</>
	) : reason.form ? (
		<>The sentence needs the {w(reason.form)}.</>
	) : null;
	return (
		<div className={cn("lh-fade flex flex-col gap-1.5 text-[15px] leading-snug text-foreground", className)} data-testid="review-why">
			{what && <p>{what}</p>}
			{need && <p>{need}</p>}
		</div>
	);
}

export function ReviewSession() {
	const lang = useActiveLanguage();
	const [status, setStatus] = useState<Status | null>(() => knownStatus);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [given, setGiven] = useState("");
	const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
	const [reason, setReason] = useState<MissReason | null>(null);
	const [suggested, setSuggested] = useState<Rating>(3);
	// Hints taken on this card: 1 = the meaning, 2 = the dictionary form too.
	// Each one is allowed and priced (caps the rating; core/review.ts).
	const [hint, setHint] = useState(0);
	// Read on first render, so the card never paints the default and then flips.
	const [mode, setMode] = useState<Mode>(() => (readPref(MODE_KEY, "type") === "choice" ? "choice" : "type"));
	const [saving, setSaving] = useState(false);
	// Cards whose sentence went to the saved phrases from this page.
	const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());
	// The rep just before this one, kept on screen as a collapsed line.
	const [last, setLast] = useState<{ before: string; answer: string; after: string; translation: string; label: string } | null>(null);
	const shownAt = useRef(Date.now());
	// One card at a time: its active time (the gaps between actions, each
	// capped) is what the day's minutes count; `ms` stays the card's wall-clock.
	const activeTime = useActiveTime("review", "interactive");
	const inputRef = useRef<HTMLInputElement>(null);
	const sentenceRef = useRef<HTMLFormElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);

	// The skeleton waits a beat, so a deck that lands at once never flashes one.
	const [slow, setSlow] = useState(false);
	useEffect(() => {
		const t = window.setTimeout(() => setSlow(true), SKELETON_DELAY_MS);
		return () => window.clearTimeout(t);
	}, []);

	// `keepCard` is the mount's background refresh: when the same card is
	// still due, what the learner has typed and the card's timer carry on.
	const show = useCallback(
		(next: Status, keepCard = false) => {
			const sameCard = keepCard && !!next.next && next.next.card.id === knownStatus?.next?.card.id;
			knownStatus = next;
			setStatus(next);
			if (!sameCard) {
				setGiven("");
				setVerdict(null);
				setReason(null);
				setHint(0);
				shownAt.current = Date.now();
				// A card is on screen: time it. The caught-up screen is not practice.
				if (next.next) activeTime.restart();
				else activeTime.finish();
			}
			setLoadError(null);
		},
		[activeTime],
	);
	const load = useCallback(
		async (keepCard = false) => {
			try {
				const res = await fetch(`/api/review?tz=${new Date().getTimezoneOffset()}`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				show((await res.json()) as Status, keepCard);
			} catch (err) {
				setLoadError(err instanceof Error ? err.message : String(err));
			}
		},
		[show],
	);

	useEffect(() => {
		void load(true);
	}, [load]);

	const prompt = status?.next ?? null;
	const cardId = prompt?.card.id;
	useEffect(() => {
		if (cardId) settle(bodyRef.current);
	}, [cardId]);
	const around = clozeAround(prompt?.before ?? "", prompt?.after ?? "");
	const tag = lang?.tag ?? "sk-SK";
	// A card already retrieved once is always typed: recall beats recognition (docs/research/desirable-difficulties.md).
	// The sentence is spoken when the answer is checked: have its audio ready by then.
	const sentence = prompt?.card.sentence;
	useEffect(() => {
		if (sentence && lang) prefetchSpeech(sentence, lang.code);
		warmSound();
	}, [sentence, lang]);
	const picks = mode === "choice" && !!prompt && prompt.card.state !== "review";
	const help = { hints: hint, picked: picks };
	const cap = ratingCeiling(verdict ?? "exact", help);

	useEffect(() => {
		if (status?.next && !verdict && !picks) inputRef.current?.focus();
	}, [status?.next, verdict, picks]);

	const check = (answer: string) => {
		if (!prompt || verdict) return;
		const v = compareAnswer(prompt.answer, answer, tag);
		setGiven(answer);
		setVerdict(v);
		setSuggested(ratingFor(v, Date.now() - shownAt.current, help));
		if (v === "exact") sfx.right();
		else if (v === "accents") sfx.almost();
		else {
			sfx.wrong();
			shake(sentenceRef.current);
			const id = prompt.card.id;
			void fetch(`/api/review/miss?cardId=${encodeURIComponent(id)}&given=${encodeURIComponent(answer)}&words=${prompt.words}`)
				.then((res) => (res.ok ? (res.json() as Promise<{ reason: MissReason | null }>) : null))
				.then((body) => {
					if (body?.reason && knownStatus?.next?.card.id === id) setReason(body.reason);
				})
				.catch(() => {});
		}
		void speak(prompt.card.sentence);
	};

	const rate = async (rating: Rating) => {
		if (!prompt || !verdict || saving) return;
		setSaving(true);
		try {
			const res = await fetch("/api/review", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ cardId: prompt.card.id, given, ms: Date.now() - shownAt.current, activeMs: activeTime.finish(), rating: Math.min(rating, cap), hints: hint, picked: picks, words: prompt.words, tz: new Date().getTimezoneOffset() }),
			});
			setLast({ before: around.before + around.lead, answer: prompt.answer, after: around.tail + around.after, translation: prompt.card.translation, label: `${RATING_LABELS[Math.min(rating, cap) as Rating]}${help.hints > 0 || help.picked ? ", with help" : ", no help"}` });
			// The answer's response carries the deck as it stands now: one round trip, not two.
			const after = res.ok ? ((await res.json().catch(() => null)) as { status?: Status } | null)?.status : undefined;
			if (after) show(after);
			else await load();
			// The sidebar's due badge counts the same deck.
			window.dispatchEvent(new Event("lh:review-changed"));
		} finally {
			setSaving(false);
		}
	};

	const saveSentence = async () => {
		if (!prompt || savedIds.has(prompt.card.id)) return;
		const id = prompt.card.id;
		const res = await fetch("/api/phrases", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text: prompt.card.sentence, translation: prompt.card.translation, source: "review", context: prompt.card.lemma }),
		}).catch(() => null);
		if (res?.ok) setSavedIds((s) => new Set(s).add(id));
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
			} else if (["1", "2", "3", "4"].includes(e.key) && !(e.target instanceof HTMLInputElement) && Number(e.key) <= cap) {
				setSuggested(Number(e.key) as Rating);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const slips = useMemo(() => (prompt && verdict === "accents" ? new Set(diacriticSlips(prompt.answer, given, tag)) : new Set<number>()), [prompt, verdict, given, tag]);

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
	const [blankWords, setBlankWords] = useState<number | null>(null);
	const blankWordsNow = blankWords ?? status?.settings.blankWords ?? 1;
	const chooseBlankWords = (n: number) => {
		setBlankWords(n);
		void fetch("/api/review/settings", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ blankWords: n }),
		});
	};
	const stepNewPerDay = (delta: number) => {
		const from = newPerDay ?? status?.settings.newPerDay ?? 0;
		const next = Math.max(0, Math.min(100, from + delta));
		if (next === from) return;
		setNewPerDay(next);
		void saveNewPerDay(next);
	};

	const counts = status?.counts;
	const day = useDaySummary();
	// The bar counts cards, not answers. A card that comes back (a miss goes into relearning) is the same card, so answering it again neither moves the bar nor grows its total; it moves when a card is seen for the first time today. Counting answers made "24 of 25" become "49 of 50" after one card was repeated. The total holds the whole day, so it does not grow while the day goes on: new cards that already exist (the one on screen included, and the ones lessons put in the deck), and cards that fall due later today, are in it from the start. Without them "26 of 26" turned into "45 of 45" by evening.
	const done = counts?.cardsToday ?? 0;
	const newLeft = counts ? counts.newLeft + counts.pendingNew : 0;
	const left = counts ? counts.dueUntouched + newLeft : 0;
	const later = counts?.dueLater ?? 0;
	const total = done + left + later;
	const isNew = prompt?.card.state === "new";
	const position = counts ? counts.newToday + 1 : 1;
	const newTotal = counts ? counts.newToday + counts.newLeft : 0;
	const exact = verdict === "exact";
	const helped = hint > 0 || picks;
	const shownSuggested = Math.min(suggested, cap) as Rating;

	return (
		<div className="@container h-dvh" data-testid="review-session">
			<div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,1fr)_376px] @6xl:grid-rows-1">
				<header className="lh-drag lh-wco-gutter relative z-[2] flex h-[60px] items-center gap-2.5 bg-background px-4 shadow-[inset_0_-1px_0_var(--q-line)] @6xl:hidden">
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
					<div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] px-4 @6xl:px-0">
						<div className="mx-auto w-full max-w-[720px] pb-10 pt-6 @6xl:pt-12">
							<section>
								<h2 className="q-sh">
									<QIcon name="review" />
									Review
									{counts && lang && (
										<small data-testid="review-counts">
											<b className="font-semibold text-ink-2 q-num">{done}</b> of <b className="font-semibold text-ink-2 q-num">{total}</b> cards today
										</small>
									)}
								</h2>
								<div role="progressbar" aria-label="Reviews done today" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-1.5 overflow-hidden rounded-full bg-well-2" data-testid="review-progress">
									<div className="lh-fill rounded-full bg-teal" style={fillStyle(total > 0 ? done / total : 0)} />
								</div>
								{counts && lang && (
									<p className="mt-2 text-[12.5px] text-ink-3" data-testid="review-left">
										{left === 0 ? (counts.due + counts.learning > 0 ? `Every card seen once today. ${counts.due + counts.learning} to repeat.` : later > 0 ? `Done for now. ${later} more ${later === 1 ? "card comes" : "cards come"} due later today.` : "All done for today.") : `Still to do: ${counts.dueUntouched} due, ${newLeft} new${counts.due + counts.learning > counts.dueUntouched ? `, ${counts.due + counts.learning - counts.dueUntouched} to repeat` : ""}${later > 0 ? `, ${later} more due later today` : ""}.`}
									</p>
								)}
							</section>

							<section className="mt-6">
								{loadError && (
									<div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground">
										<p>Couldn&apos;t load your review deck. {loadError}</p>
										<button type="button" onClick={() => void load()} className="q-btn sec ml-auto">
											Try again
										</button>
									</div>
								)}

								{/* A card that arrives late must not push the page: its space is held from the first frame, drawn only after the skeleton delay. */}
								{!loadError && (!status || (prompt && !lang)) && (
									<div className={cn("q-cloze min-h-[300px] p-7", !slow && "invisible")} aria-busy="true" aria-label="Loading your review deck" data-testid="review-loading">
										<div className="h-3 w-20 animate-pulse rounded bg-well-2" />
										<div className="mt-7 h-12 w-full animate-pulse rounded-lg bg-well-2" />
										<div className="mt-3 h-12 w-2/3 animate-pulse rounded-lg bg-well-2" />
									</div>
								)}

								{status && !status.available && (
									<div className="q-card p-6 text-[15px] text-ink-3" data-testid="review-unavailable">
										This language has no words yet, so there is nothing to review. Add its words from the language menu at the top of the sidebar (Add a language…).
									</div>
								)}

								{status?.available && !prompt && (
									<div className="q-card p-8" data-testid="review-done">
										<div className="flex items-center gap-3">
											<span className="grid size-8 place-items-center rounded-full bg-teal text-sun-ink">
												<QIcon name="check" className="size-4" />
											</span>
											<p className="text-[24px] font-semibold tracking-[-0.02em]">{done > 0 ? "All caught up" : "Nothing is due right now"}</p>
										</div>
										<p className="q-line dim mt-2 max-w-md">
											{done > 0 ? `${done === 1 ? "1 review" : `${done} reviews`} done today. ` : ""}Words come back on the day they are due, and new ones arrive tomorrow.
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
											<Link href="/" className="q-btn primary">
												Back to Today
											</Link>
											<Link href="/lesson" className="q-btn ghost">
												Do a lesson
											</Link>
										</div>
										<SourcesNote feature="review" className="mt-6" />
									</div>
								)}

								{prompt && lang && (
									<article className="q-cloze" data-testid="review-card" aria-label={`Review, ${isNew ? "new word" : "card"}`}>
										<header className="q-card-head">
											<QIcon name="review" />
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
										<div ref={bodyRef} className="q-c-body !px-4 @xl:!px-7">
											<form
												ref={sentenceRef}
												onSubmit={(e) => {
													e.preventDefault();
													if (given.trim()) check(given);
												}}
												className="q-sent !text-[28px] !leading-[44px] @xl:!text-[44px] @xl:!leading-[64px]"
												lang={lang?.code}
												data-word-lookup-enabled={verdict !== null ? "true" : "false"}
											>
												<span>{around.before}</span>
												<span className={cn(prompt.words === 1 && "whitespace-nowrap")}>
													{around.lead}
													<span
														className={cn(
															"q-slot !mx-0 !h-[44px] !px-0.5 @xl:!h-[58px] @xl:!px-1 max-w-full",
															!verdict && "q-write !text-foreground",
															verdict === "wrong" && "!text-miss",
															verdict === "accents" && "!text-foreground",
														)}
														style={{ display: "inline-grid", gridTemplateColumns: "auto" }}
													>
														<span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre-wrap">
															{!verdict && !picks && given.length > prompt.answer.length ? given : prompt.answer}
														</span>
														{verdict ? (
															<span className="lh-pop col-start-1 row-start-1 whitespace-pre text-center" data-testid="review-answer">
																<span className={cn(verdict === "exact" && "underline decoration-teal decoration-2 underline-offset-[8px]", verdict === "wrong" && "underline decoration-miss decoration-2 underline-offset-[8px]")}>
																	{[...prompt.answer].map((ch, i) => (
																		<span key={i} className={slips.has(i) ? "underline decoration-2 underline-offset-4" : undefined}>
																			{ch}
																		</span>
																	))}
																</span>
															</span>
														) : picks ? (
															<span className="col-start-1 row-start-1" aria-label="blank" />
														) : (
															<input
																ref={inputRef}
																value={given}
																onChange={(e) => setGiven(e.target.value)}
																aria-label={prompt.words > 1 ? "Missing words" : "Missing word"}
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

											<div className="q-en">
												<div className="flex min-h-8 items-center gap-2">
													<p data-no-word-lookup="true">{prompt.card.translation}</p>
													{verdict && <PlayButton text={prompt.card.sentence} className="size-8 shrink-0 rounded-full bg-well text-ink-2 hover:bg-well-2" label="Play the sentence" />}
													{verdict && (
														<button
															type="button"
															onClick={() => void saveSentence()}
															aria-pressed={savedIds.has(prompt.card.id)}
															aria-label={savedIds.has(prompt.card.id) ? "Sentence saved to your phrases" : "Save the sentence to your phrases"}
															title={savedIds.has(prompt.card.id) ? "Saved to your phrases" : "Save the sentence to your phrases"}
															data-testid="review-save-phrase"
															className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-well text-ink-2 hover:bg-well-2", savedIds.has(prompt.card.id) && "text-teal-2")}
														>
															<BookmarkIcon className="size-4" fill={savedIds.has(prompt.card.id) ? "currentColor" : "none"} aria-hidden="true" />
														</button>
													)}
												</div>
											</div>

											<div className="mt-4 grid grid-cols-[minmax(0,1fr)]">
												<div className={cn("col-start-1 row-start-1", verdict && "invisible")}>
													{!verdict && mode === "choice" && !picks && <p className="q-sub !mt-0 mb-3">You have met this word before, so this time you type it.</p>}

													{picks && (
														<div className="grid gap-2 @xl:grid-cols-2" data-testid="review-options">
															{prompt.options.map((o, i) => (
																<button key={o} type="button" onClick={() => check(o)} disabled={!!verdict} lang={lang?.code} className="flex h-12 items-center gap-3 rounded-lg bg-well px-3.5 text-left text-[20px] font-[500] hover:bg-well-2">
																	<kbd className="q-kbd pointer-coarse:hidden">{i + 1}</kbd>
																	{o}
																</button>
															))}
														</div>
													)}

													{!picks && <DiacriticBar variant="keys" />}
												</div>

												{verdict && (
													<div className="lh-fade col-start-1 row-start-1" data-testid="review-feedback">
														<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-3">
															<span className={cn("q-result", verdict === "wrong" && "miss")} data-testid="review-verdict">
																{verdict === "wrong" ? <XIcon className="size-[15px]" strokeWidth={2} aria-hidden="true" /> : <QIcon name="check" />}
																{exact ? (helped ? "Right" : "Right on the first try") : verdict === "accents" ? "Almost, check the accents" : "Not quite"}
																{exact && <span>· {helped ? "help used" : "no help used"}</span>}
															</span>
															{!exact && (
																<span>
																	Correct answer: <b className="font-[550] text-ink-2" lang={lang?.code}>{prompt.answer}</b>
																	{given && (
																		<>
																			{" "}
																			· You wrote “<span lang={lang?.code}>{given}</span>”
																		</>
																	)}
																</span>
															)}
														</p>
														{verdict === "wrong" && reason && <MissWhy reason={reason} given={targetWordOf(prompt, given)} code={lang?.code} className="mt-2.5" />}
														{verdict !== "wrong" && (
															<p className="mt-3 flex flex-wrap gap-2" data-testid="review-facts">
																<span className="q-ex">
																	<span className="mr-1.5 text-[12px] font-semibold text-ink-3">word</span>
																	<Link href={`/words?search=${encodeURIComponent(prompt.card.lemma)}`} lang={lang?.code} className="underline decoration-line-2 underline-offset-2 hover:text-ink">
																		{prompt.card.lemma}
																	</Link>
																	<span className="ml-1.5 font-[450] text-ink-2">{shortGloss(prompt.card.gloss)}</span>
																</span>
																{prompt.form && (
																	<span className="q-ex">
																		<span className="mr-1.5 text-[12px] font-semibold text-ink-3">form</span>
																		{prompt.form}
																	</span>
																)}
															</p>
														)}
														{prompt.sentenceSource && (
															<p className="mt-3 text-[14px] text-ink-3" data-testid="review-source">
																Sentence from {SENTENCE_SOURCES[prompt.sentenceSource] ?? prompt.sentenceSource}
															</p>
														)}
													</div>
												)}
											</div>
										</div>
									</article>
								)}

								{prompt && lang && (
									<div className="mt-4 min-h-[184px] @xl:min-h-[152px]" data-testid="review-dock">
										{!verdict ? (
											<div className="flex flex-wrap items-center gap-2">
												{hint > 0 && (
													<span className="q-ex h-12 !items-center rounded-lg bg-well px-3.5" data-testid="review-hints">
														<span className="mr-1.5 text-[12px] font-semibold text-ink-3">means</span>
														{prompt.card.gloss}
													</span>
												)}
												{hint > 1 && (
													<span className="q-ex h-12 !items-center rounded-lg bg-well px-3.5">
														<span className="mr-1.5 text-[12px] font-semibold text-ink-3">base form</span>
														<span lang={lang?.code}>{prompt.card.lemma}</span>
													</span>
												)}
												{hint < 2 && (
													<button
														type="button"
														onClick={() => {
															setHint((h) => Math.min(2, h + 1));
															inputRef.current?.focus();
														}}
														className="q-btn sec"
														data-testid="review-hint"
													>
														<LightbulbIcon className="size-3.5" aria-hidden="true" />
														{hint === 0 ? "Show meaning" : "Show base form"}
														<span className="font-[450] text-ink-3">· rating up to {hint === 0 ? "Good" : "Hard"}</span>
													</button>
												)}
												<button type="button" onClick={() => check("")} className="q-btn sec" data-testid="review-dont-know">
													I don&apos;t know
													<span className="font-[450] text-ink-3">· counts as Again</span>
												</button>
												{!picks && (
													<button type="button" onClick={() => check(given)} disabled={!given.trim()} className="q-btn primary ml-auto" data-testid="review-check">
														Check
													</button>
												)}
											</div>
										) : (
											<div className="flex flex-col gap-3">
												<div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Rate it yourself" data-testid="review-ratings">
													{([1, 2, 3, 4] as Rating[]).map((r) => (
														<button
															key={r}
															type="button"
															role="radio"
															aria-checked={r === shownSuggested}
															disabled={saving || r > cap}
															onClick={() => setSuggested(r)}
															title={r > cap ? `${RATING_LABELS[r]} is off: ${verdict === "wrong" ? "a miss counts as Again" : "you had help on this card"}` : undefined}
															className={cn("flex h-14 min-w-0 flex-col items-center justify-center rounded-lg text-[14px] font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--q-line-2)] hover:bg-well disabled:opacity-35 disabled:line-through", r === shownSuggested && "bg-teal-wash text-teal-2 shadow-[inset_0_0_0_1.5px_var(--q-teal)] hover:bg-teal-wash")}
																>
															{RATING_LABELS[r]}
															<span className="q-num text-[12px] font-[450] text-ink-3">{formatInterval(prompt.intervals[r])}</span>
														</button>
													))}
												</div>
												<button type="button" autoFocus disabled={saving} onClick={() => void rate(shownSuggested)} data-testid="review-continue" className="q-btn primary w-full justify-center">
													{saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
													Continue · {RATING_LABELS[shownSuggested]}
												</button>
											</div>
										)}
										<div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
										<p className="whitespace-nowrap text-[12px] text-ink-3 pointer-coarse:hidden">{!verdict ? "Press Enter to check." : "Press 1 to 4 to rate, Enter to continue."}</p>
										<div className="flex items-center gap-2 text-[12px] text-ink-3" data-testid="review-blank" title="How many words a card can hide. A new word always hides one. Applies from the next card.">
											<span id="review-blank-label">Blank</span>
											<span className="q-segc" role="radiogroup" aria-labelledby="review-blank-label">
												{[1, 2, 3].map((n) => (
													<button key={n} type="button" role="radio" aria-checked={blankWordsNow === n} className={cn("!h-6 !px-2 !text-[12px] whitespace-nowrap", blankWordsNow === n && "on")} onClick={() => chooseBlankWords(n)} data-testid={`review-blank-${n}`}>
														{n === 1 ? "1 word" : `1–${n}`}
													</button>
												))}
											</span>
										</div>
										<button type="button" onClick={() => void suspend()} className="q-btn ghost ml-auto" title="Never show this word again" data-testid="review-suspend">
											<EyeOffIcon className="size-3.5" aria-hidden="true" />
											Hide this word
										</button>
									</div>
									</div>
								)}

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
										<span className="e" title={last.translation}>{last.translation}</span>
										<span className="r">{last.label}</span>
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

				</main>

				<DayRail s={day.s} />
			</div>
		</div>
	);
}
