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
import { EyeOffIcon, LightbulbIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/top-bar";
import { DiacriticBar } from "@/components/diacritic-bar";
import { PlayButton, speak, useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import {
	compareAnswer,
	diacriticSlips,
	formatInterval,
	ratingFor,
	RATING_LABELS,
	type AnswerVerdict,
	type Rating,
	type ReviewCard,
} from "@/src/core";

interface Prompt {
	card: ReviewCard;
	before: string;
	after: string;
	intervals: Record<Rating, number>;
	options: string[];
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
const AUTOPLAY_KEY = "lh-review-autoplay";

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

const VERDICT_STYLE: Record<AnswerVerdict, { label: string; className: string }> = {
	exact: { label: "Correct", className: "text-green-600 dark:text-green-500" },
	accents: { label: "Right word, check the accents", className: "text-amber-600 dark:text-amber-400" },
	wrong: { label: "Not quite", className: "text-red-600 dark:text-red-400" },
};

export function ReviewSession() {
	const lang = useActiveLanguage();
	const [status, setStatus] = useState<Status | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [given, setGiven] = useState("");
	const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
	const [suggested, setSuggested] = useState<Rating>(3);
	const [hint, setHint] = useState(false);
	const [mode, setMode] = useState<Mode>("type");
	const [autoplay, setAutoplay] = useState(true);
	const [saving, setSaving] = useState(false);
	const shownAt = useRef(Date.now());
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setMode(readPref(MODE_KEY, "type") === "choice" ? "choice" : "type");
		setAutoplay(readPref(AUTOPLAY_KEY, "1") === "1");
	}, []);

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/review?tz=${new Date().getTimezoneOffset()}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const next = (await res.json()) as Status;
			setStatus(next);
			setGiven("");
			setVerdict(null);
			setHint(false);
			shownAt.current = Date.now();
			setLoadError(null);
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (status?.next && !verdict && mode === "type") inputRef.current?.focus();
	}, [status?.next, verdict, mode]);

	const prompt = status?.next ?? null;
	const tag = lang?.tag ?? "sk-SK";

	const check = (answer: string) => {
		if (!prompt || verdict) return;
		const v = compareAnswer(prompt.card.answer, answer, tag);
		setGiven(answer);
		setVerdict(v);
		setSuggested(ratingFor(v, Date.now() - shownAt.current));
		if (v === "exact") sfx.right();
		else if (v === "accents") sfx.almost();
		else sfx.wrong();
		if (autoplay) void speak(prompt.card.sentence);
	};

	const rate = async (rating: Rating) => {
		if (!prompt || !verdict || saving) return;
		setSaving(true);
		try {
			await fetch("/api/review", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ cardId: prompt.card.id, given, ms: Date.now() - shownAt.current, rating }),
			});
			await load();
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

	// Keyboard: Enter checks / accepts the suggested rating; 1–4 rate.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!verdict) return;
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

	const slips = useMemo(
		() => (prompt && verdict === "accents" ? new Set(diacriticSlips(prompt.card.answer, given, tag)) : new Set<number>()),
		[prompt, verdict, given, tag],
	);

	const saveNewPerDay = async (n: number) => {
		const res = await fetch("/api/review/settings", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ newPerDay: n }),
		});
		if (res.ok) await load();
	};

	const counts = status?.counts;

	return (
		<div className="flex h-dvh flex-col">
			<TopBar>
				<h1 className="font-ui text-base font-extrabold text-foreground">Review</h1>
				{counts && (
					<span className="ml-auto flex items-center gap-1.5 font-ui text-xs font-bold text-muted-foreground tabular-nums" data-testid="review-counts">
						<span title="Cards due for review" className="rounded-full bg-sky/15 px-2.5 py-1 text-sky">{counts.due + counts.learning} due</span>
						<span title="New cards left today" className="rounded-full bg-accent px-2.5 py-1">{counts.newLeft} new</span>
						<span title="Reviews done today" className="rounded-full bg-go-soft px-2.5 py-1 text-go">{counts.reviewedToday} done today</span>
						<span title="Words in the deck" className="hidden px-1.5 sm:inline">{counts.total} words</span>
					</span>
				)}
			</TopBar>

			<main className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-10 font-prose">
				<div className="w-full max-w-2xl">
					{loadError && <p className="text-sm text-red-600">Could not load the deck: {loadError}</p>}

					{status && !status.available && (
						<div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground" data-testid="review-unavailable">
							There is no dictionary for this language yet, so there are no review sentences. Slovak has one; switch languages in the sidebar.
						</div>
					)}

					{status?.available && !prompt && (
						<div className="rounded-3xl border-2 bg-card p-8 text-center" data-testid="review-done">
							<p className="font-ui text-2xl font-black text-foreground">All caught up 🎉</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{counts?.reviewedToday ?? 0} reviews today. New words tomorrow: {status.settings.newPerDay}. Words that come back
								sooner wait in the deck until they are due.
							</p>
							<label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
								New words per day
								<input
									type="number"
									min={0}
									max={100}
									defaultValue={status.settings.newPerDay}
									onBlur={(e) => void saveNewPerDay(Number(e.target.value))}
									className="w-16 rounded-md border bg-background px-2 py-1 text-foreground"
								/>
							</label>
						</div>
					)}

					{prompt && (
						<div className="rounded-3xl border-2 bg-card p-8 shadow-[0_4px_0_0_var(--border)]" data-testid="review-card">
							<div className="mb-5 flex items-center gap-2 font-ui text-xs font-bold text-muted-foreground">
								<span>{prompt.card.state === "new" ? "New word" : prompt.card.state === "learning" ? "Relearning" : "Review"}</span>
								<div className="ml-auto flex items-center gap-1">
									{(["type", "choice"] as const).map((m) => (
										<button
											key={m}
											type="button"
											onClick={() => {
												setMode(m);
												writePref(MODE_KEY, m);
											}}
											className={cn("rounded-sm px-2 py-0.5", mode === m ? "bg-accent text-foreground" : "hover:text-foreground")}
										>
											{m === "type" ? "Type" : "Choose"}
										</button>
									))}
									<button
										type="button"
										onClick={() => {
											setAutoplay(!autoplay);
											writePref(AUTOPLAY_KEY, autoplay ? "0" : "1");
										}}
										className="rounded-sm px-2 py-0.5 hover:text-foreground"
										title="Play the sentence after answering"
									>
										Audio {autoplay ? "on" : "off"}
									</button>
								</div>
							</div>

							<form
								onSubmit={(e) => {
									e.preventDefault();
									check(given);
								}}
								className="text-3xl leading-relaxed text-foreground"
								lang={lang?.code}
							>
								<span>{prompt.before}</span>
								{verdict ? (
									<span className={cn("rounded-md px-1 font-semibold", verdict === "accents" ? VERDICT_STYLE.accents.className : VERDICT_STYLE.exact.className)} data-testid="review-answer">
										{[...prompt.card.answer].map((ch, i) => (
											<span key={i} className={slips.has(i) ? "underline decoration-2 underline-offset-4" : undefined}>
												{ch}
											</span>
										))}
									</span>
								) : mode === "type" ? (
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
										className="mx-1 inline-block rounded-lg border-2 border-b-[4px] border-border bg-background px-2 text-center font-bold caret-go outline-none transition-colors focus:border-go"
									/>
								) : (
									<span className="mx-1 inline-block min-w-16 border-b-2 border-dashed border-muted-foreground/50 text-center">&nbsp;</span>
								)}
								<span>{prompt.after}</span>
							</form>

							<p className="mt-3 text-lg text-muted-foreground">{prompt.card.translation}</p>

							{!verdict && mode === "choice" && (
								<div className="mt-5 grid grid-cols-2 gap-2" data-testid="review-options">
									{prompt.options.map((o) => (
										<button
											key={o}
											type="button"
											onClick={() => check(o)}
											className="rounded-2xl border-2 bg-background px-4 py-3 text-left text-xl text-foreground shadow-[0_3px_0_0_var(--border)] transition-all hover:border-sky/60 hover:bg-accent active:translate-y-0.5 active:shadow-none"
										>
											{o}
										</button>
									))}
								</div>
							)}

							{!verdict && (
								<div className="mt-7 flex items-center gap-2 font-ui text-sm">
									{mode === "type" && (
										<button type="button" onClick={() => check(given)} className="rounded-2xl bg-go px-7 py-2.5 font-extrabold uppercase tracking-wider text-go-ink shadow-[0_4px_0_0_rgb(0_0_0/0.35)] transition-all hover:brightness-110 active:translate-y-0.5 active:shadow-none">
											Check
										</button>
									)}
									<button
										type="button"
										onClick={() => setHint(true)}
										className="flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
									>
										<LightbulbIcon className="size-3.5" />
										{hint ? (
											<span>
												{prompt.card.lemma} · {prompt.card.gloss}
											</span>
										) : (
											"Hint"
										)}
									</button>
									<button
										type="button"
										onClick={() => check("")}
										className="ml-auto rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
									>
										I don&apos;t know
									</button>
								</div>
							)}

							{verdict && (
								<div className="mt-5" data-testid="review-verdict">
									<div className="flex items-center gap-2">
										<span className={cn("font-medium", VERDICT_STYLE[verdict].className)}>{VERDICT_STYLE[verdict].label}</span>
										{verdict !== "exact" && given && (
											<span className="text-sm text-muted-foreground">
												You wrote <span className="font-medium text-foreground">{given}</span>
											</span>
										)}
										<PlayButton text={prompt.card.sentence} className="ml-auto" label="Play the sentence" />
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{prompt.card.lemma} · {prompt.card.gloss}
									</p>
									{/* The checker already knows how it went: Continue schedules with
									    the derived rating (redesign 2026-10-27 — one decision per card,
									    not two). The four ratings stay as a quiet override. */}
									<div className="mt-5 flex flex-wrap items-center gap-3" data-testid="review-ratings">
										<button
											type="button"
											autoFocus
											disabled={saving}
											onClick={() => void rate(suggested)}
											data-testid="review-continue"
											className={cn(
												"rounded-2xl px-8 py-3 font-ui text-sm font-bold uppercase tracking-wider shadow-[0_4px_0_0_rgb(0_0_0/0.35)] transition-all hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:opacity-50",
												verdict === "exact" ? "bg-go text-go-ink" : verdict === "accents" ? "bg-warn text-background" : "bg-miss text-background",
											)}
										>
											Continue
										</button>
										<span className="font-ui text-[11px] text-muted-foreground">
											{RATING_LABELS[suggested]} · next in {formatInterval(prompt.intervals[suggested])}
										</span>
										<span className="ml-auto flex items-center gap-1 font-ui text-xs text-muted-foreground">
											<span className="mr-1">Rate it yourself:</span>
											{([1, 2, 3, 4] as Rating[]).map((r) => (
												<button
													key={r}
													type="button"
													disabled={saving}
													onClick={() => void rate(r)}
													title={`${RATING_LABELS[r]}: next in ${formatInterval(prompt.intervals[r])} (key ${r})`}
													className={cn("rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-foreground", r === suggested && "text-foreground")}
												>
													{RATING_LABELS[r]}
												</button>
											))}
										</span>
									</div>
									<p className="mt-2 font-ui text-xs text-muted-foreground">Enter continues · 1–4 rates it yourself</p>
								</div>
							)}

							<div className="mt-6 flex justify-end">
								<button
									type="button"
									onClick={() => void suspend()}
									className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
									title="Never show this sentence again"
								>
									<EyeOffIcon className="size-3" />
									Hide this card
								</button>
							</div>
						</div>
					)}

					{prompt && mode === "type" && !verdict && <DiacriticBar className="mt-2 justify-center" />}

					{status && status.leeches.length > 0 && (
						<div className="mt-10" data-testid="review-leeches">
							<h2 className="font-ui text-sm font-extrabold text-muted-foreground">Words that keep slipping</h2>
							<ul className="mt-2 flex flex-wrap gap-2 text-sm">
								{status.leeches.map((l) => (
									<li key={l.id} className="rounded-md border px-2 py-1">
										<span className="text-foreground">{l.lemma}</span> <span className="text-muted-foreground">{l.gloss}</span>{" "}
										<span className="font-mono text-[11px] text-muted-foreground">×{l.lapses}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{status?.available && (
						<p className="mt-10 text-center text-xs text-muted-foreground">
							Sentences from slovak.wiki — curated examples and Tatoeba (CC BY 2.0 FR).
						</p>
					)}
				</div>
			</main>
		</div>
	);
}
