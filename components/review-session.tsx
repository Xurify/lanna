"use client";

/**
 * Spaced-review page: Clozemaster-style cloze cards from the dictionary's
 * sentences, scheduled with FSRS. Grading is local and instant
 * (core/language.ts compareAnswer); the confirmed rating goes to POST /api/review.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
	BookmarkIcon,
	ChevronDownIcon,
	EyeOffIcon,
	LightbulbIcon,
	LoaderCircleIcon,
	MinusIcon,
	PlusIcon,
	SlidersHorizontalIcon,
	XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QIcon, QPie } from "@/components/quiet/icon";
import { SidebarToggle } from "@/components/sidebar";
import { DayRail, useDaySummary } from "@/components/quiet/day-rail";
import { DiacriticBar } from "@/components/diacritic-bar";
import { OptionTile } from "@/components/task-frame";
import { useActiveTime } from "@/components/use-active-time";
import { PlayButton, prefetchSpeech, speak, useActiveLanguage } from "@/components/speech";
import { sfx, warmSound } from "@/components/lesson/sound";
import { SoundControl } from "@/components/sound-control";
import { MissWhy } from "@/components/miss-why";
import {
	compareAnswer,
	diacriticSlips,
	ratingCeiling,
	ratingFor,
	RATING_LABELS,
	shortGloss,
	splitOnWords,
	targetWordOf,
	wordsOf,
	type AnswerVerdict,
	type MissReason,
	type Rating,
	type ReviewCard,
} from "@/src/core";
import { fillStyle } from "@/components/ui/fill";
import { settle, shake } from "@/components/motion";
import { SourcesNote } from "@/components/sources/sources-note";
import { usePopoverDismiss } from "@/components/popover-dismiss";
import { useFieldCycle } from "@/components/field-cycle";

interface Prompt {
	card: ReviewCard;
	pieces: string[];
	gaps: string[];
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

interface AnsweredLine {
	cardId: string;
	reviewedAt: string;
	pieces: string[];
	gaps: string[];
	translation: string;
	rating: Rating;
	verdict: AnswerVerdict;
	helped: boolean;
}

/** How the lexicon's `src` reads on the card. */
const HELP_BUTTON =
	"q-btn sec !h-auto min-h-14 flex-col !items-start !gap-0 py-1.5 text-left !whitespace-normal disabled:!opacity-60 @2xl:min-h-12 @2xl:!h-12 @2xl:flex-row @2xl:!items-center @2xl:!gap-2 @2xl:!whitespace-nowrap";

const SENTENCE_SOURCES: Record<string, string> = { curated: "slovak.wiki", tatoeba: "Tatoeba" };

interface Status {
	profile: string;
	available: boolean;
	counts: {
		due: number;
		learning: number;
		newToday: number;
		newLeft: number;
		total: number;
		reviewedToday: number;
		cardsToday: number;
		dueUntouched: number;
		pendingNew: number;
		dueLater: number;
	};
	settings: { newPerDay: number; retention: number; blankWords: number };
	next: Prompt | null;
	answered?: AnsweredLine[];
	leeches: Array<{ id: string; lemma: string; gloss: string; lapses: number }>;
}

type Mode = "type" | "choice";
const MODE_KEY = "lh-review-mode";
/** How long the loading skeleton waits before it shows, so a deck that
 *  lands inside this window never flashes one. */
const SKELETON_DELAY_MS = 300;
/** The deck as it last loaded, so a return visit starts with a card on screen. */
let knownStatus: Status | null = null;

const COLUMN = "mx-auto w-full max-w-[760px] px-4 @xl:px-8";

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
 * Splits each piece of the sentence around the gaps. Punctuation that touches
 * a gap ("." after it, "„" before it) comes out as head and foot, so it renders
 * in the same nowrap run as the gap's box. The box is an atomic inline, and
 * a browser may break the line right after it, stranding the period below it.
 */
function clozeRuns(pieces: string[]) {
	return pieces.map((piece, i) => {
		const head = i > 0 ? (/^[^\s\p{L}\p{N}]*/u.exec(piece)?.[0] ?? "") : "";
		const rest = piece.slice(head.length);
		const foot = i < pieces.length - 1 ? (/[^\s\p{L}\p{N}]*$/u.exec(rest)?.[0] ?? "") : "";
		return { head, body: rest.slice(0, rest.length - foot.length), foot };
	});
}

const NO_WORDS: ReadonlySet<string> = new Set();

function Masked({ text, hide }: { text: string; hide: ReadonlySet<string> }) {
	if (hide.size === 0) return <>{text}</>;
	return (
		<>
			{splitOnWords(text, hide).map((part, i) =>
				part.hidden ? (
					<span key={i} className="rounded-[3px] bg-well-2 text-transparent select-none">
						<span aria-hidden="true">{part.text}</span>
						<span className="sr-only">hidden</span>
					</span>
				) : (
					part.text
				),
			)}
		</>
	);
}

function stillToDo(counts: Status["counts"]): string {
	const newLeft = counts.newLeft + counts.pendingNew;
	const left = counts.dueUntouched + newLeft;
	const later = counts.dueLater;
	const toRepeat = counts.due + counts.learning;
	if (left === 0)
		return toRepeat > 0
			? `Every card seen once today. ${toRepeat} to repeat.`
			: later > 0
				? `Done for now. ${later} more ${later === 1 ? "card comes" : "cards come"} due later today.`
				: "All done for today.";
	return `Still to do: ${counts.dueUntouched} due, ${newLeft} new${toRepeat > counts.dueUntouched ? `, ${toRepeat - counts.dueUntouched} to repeat` : ""}${later > 0 ? `, ${later} more due later today` : ""}.`;
}

function Note({ label, children, lang }: { label: string; children: React.ReactNode; lang?: string }) {
	return (
		<span className="inline-flex items-baseline gap-1.5 text-[15px] font-[500] text-foreground">
			<span className="text-[12px] font-semibold text-ink-3">{label}</span>
			<span lang={lang}>{children}</span>
		</span>
	);
}

function VerdictMark({ verdict }: { verdict: AnswerVerdict }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"grid size-4 place-items-center rounded-full",
				verdict === "exact" && "bg-teal text-[var(--q-on-teal)]",
				verdict === "accents" && "bg-teal-line text-teal-2",
				verdict === "wrong" && "text-miss shadow-[inset_0_0_0_1.5px_var(--q-miss)]",
			)}
		>
			<svg
				viewBox="0 0 24 24"
				className="size-2.5 fill-none stroke-current"
				strokeWidth={3}
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{verdict === "wrong" ? <path d="M7 7l10 10M17 7L7 17" /> : <path d="M5.5 12.5l4 4L18.5 7.5" />}
			</svg>
		</span>
	);
}

const VERDICT_WORD: Record<AnswerVerdict, string> = { exact: "right", accents: "an accent off", wrong: "missed" };

function comesBack(days: number): string {
	const minutes = Math.round(days * 1440);
	if (minutes < 60) return `${Math.max(1, minutes)} min`;
	if (days < 1) return `${Math.round(minutes / 60)} h`;
	if (days < 30) return Math.round(days) === 1 ? "1 day" : `${Math.round(days)} days`;
	if (days < 365) return `${Math.round(days / 30)} mo`;
	return `${(days / 365).toFixed(1).replace(/\.0$/, "")} yr`;
}

function DeckSettings({
	mode,
	onMode,
	blankWords,
	onBlankWords,
	className,
}: {
	mode: Mode;
	onMode: (m: Mode) => void;
	blankWords: number;
	onBlankWords: (n: number) => void;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-[auto_auto] items-center justify-start gap-x-4 gap-y-3 text-[13px] text-ink-3",
				className,
			)}
		>
			<div className="contents">
				<span id="review-mode-label">Answer by</span>
				<span className="q-segc" role="radiogroup" aria-labelledby="review-mode-label">
					{(["type", "choice"] as const).map((m) => (
						<button
							key={m}
							type="button"
							role="radio"
							aria-checked={mode === m}
							className={cn("!h-8 !px-3 !text-[13px] pointer-coarse:!h-10", mode === m && "on")}
							onClick={() => onMode(m)}
							data-testid={`review-mode-${m}`}
						>
							{m === "type" ? "Typing" : "Choosing"}
						</button>
					))}
				</span>
			</div>
			<div
				className="contents"
				data-testid="review-blank"
				title="How many words a card can hide. A new word always hides one. Applies from the next card."
			>
				<span id="review-blank-label">Blank</span>
				<span className="q-segc" role="radiogroup" aria-labelledby="review-blank-label">
					{[1, 2, 3].map((n) => (
						<button
							key={n}
							type="button"
							role="radio"
							aria-checked={blankWords === n}
							className={cn("!h-8 !px-3 !text-[13px] whitespace-nowrap pointer-coarse:!h-10", blankWords === n && "on")}
							onClick={() => onBlankWords(n)}
							data-testid={`review-blank-${n}`}
						>
							{n === 1 ? "1 word" : `1–${n}`}
						</button>
					))}
				</span>
			</div>
		</div>
	);
}

function AnsweredRow({
	line,
	code,
	fresh,
	hide,
}: {
	line: AnsweredLine;
	code?: string;
	fresh: boolean;
	hide: ReadonlySet<string>;
}) {
	return (
		<li
			className={cn(
				"relative grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-x-3 py-3 @xl:grid-cols-[minmax(0,1fr)_auto]",
				fresh && "lh-fade",
			)}
		>
			<span className="mt-[3px] @xl:absolute @xl:-left-7 @xl:top-3">
				<VerdictMark verdict={line.verdict} />
			</span>
			<span className="min-w-0">
				<span className="sr-only">{VERDICT_WORD[line.verdict]}: </span>
				<span className="block text-[16px] leading-snug text-ink-2" lang={code}>
					{line.pieces.map((piece, i) => (
						<Fragment key={i}>
							<Masked text={piece} hide={hide} />
							{i < line.gaps.length && (
								<b
									className={cn(
										"font-semibold text-foreground underline decoration-2 underline-offset-[5px]",
										line.verdict === "exact" && "decoration-teal",
										line.verdict === "accents" && "decoration-teal-line",
										line.verdict === "wrong" && "decoration-miss",
									)}
								>
									<Masked text={line.gaps[i]!} hide={hide} />
								</b>
							)}
						</Fragment>
					))}
				</span>
				<span className="mt-0.5 block truncate text-[13px] text-ink-3" data-no-word-lookup="true">
					{line.translation}
				</span>
			</span>
			<span className="text-[12.5px] leading-[22px] whitespace-nowrap text-ink-3">
				{RATING_LABELS[line.rating]}
				{line.helped && " · help"}
			</span>
		</li>
	);
}

function AnsweredHistory({
	lines,
	sessionSince,
	answeredToday,
	code,
	hide,
}: {
	lines: AnsweredLine[];
	sessionSince: string | undefined;
	answeredToday: number;
	code: string;
	hide: ReadonlySet<string>;
}) {
	const [earlierOpen, setEarlierOpen] = useState(false);
	const inSession = (line: AnsweredLine) => sessionSince !== undefined && line.reviewedAt > sessionSince;
	const session = lines.filter(inSession);
	const earlier = lines.filter((line) => !inSession(line));
	const earlierAnswers = answeredToday - session.length;
	const missed = session.filter((line) => line.verdict === "wrong").length;
	const sessionCut = earlier.length === 0 && answeredToday > lines.length;
	const row = (line: AnsweredLine) => (
		<AnsweredRow
			key={`${line.cardId}@${line.reviewedAt}`}
			line={line}
			code={code}
			hide={hide}
			fresh={inSession(line)}
		/>
	);
	return (
		<section className="mt-8" aria-label="Answered today" data-testid="review-answered">
			{session.length > 0 && (
				<>
					<h2 className="q-sh !mb-0" data-testid="review-session-heading">
						This session
						<small>
							{sessionCut && `latest ${session.length} · `}
							{session.length - missed} right · {missed} missed
						</small>
					</h2>
					<ol className="divide-y divide-[var(--q-line)]">{session.map(row)}</ol>
				</>
			)}
			{earlier.length > 0 && (
				<>
					<button
						type="button"
						aria-expanded={earlierOpen}
						aria-controls="review-answered-earlier"
						onClick={() => setEarlierOpen((open) => !open)}
						className="-ml-1 mt-1 flex h-10 items-center gap-1.5 rounded-md px-1 text-[13px] font-[500] text-ink-2 hover:text-foreground"
						data-testid="review-answered-earlier-toggle"
					>
						<ChevronDownIcon
							className={cn("size-3.5 transition-transform", earlierOpen && "rotate-180")}
							aria-hidden="true"
						/>
						Earlier today · {earlierAnswers}
					</button>
					<div id="review-answered-earlier" hidden={!earlierOpen}>
						<ol className="divide-y divide-[var(--q-line)]">{earlier.map(row)}</ol>
						{earlier.length < earlierAnswers && (
							<p className="pt-2 text-[12.5px] text-ink-3">
								The latest {earlier.length} of {earlierAnswers} show here.
							</p>
						)}
					</div>
				</>
			)}
		</section>
	);
}

export function ReviewSession() {
	const lang = useActiveLanguage();
	const [status, setStatus] = useState<Status | null>(() => knownStatus);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [fields, setFields] = useState<string[]>([]);
	const [givenParts, setGivenParts] = useState<string[]>([]);
	const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
	const [reason, setReason] = useState<MissReason | null>(null);
	const [suggested, setSuggested] = useState<Rating>(3);
	// Hints taken on this card: 1 = the meaning, 2 = the dictionary form too.
	// Each one is allowed and priced (caps the rating; core/review.ts).
	const [hint, setHint] = useState(0);
	// Read on first render, so the card never paints the default and then flips.
	const [mode, setMode] = useState<Mode>(() => (readPref(MODE_KEY, "type") === "choice" ? "choice" : "type"));
	const [saving, setSaving] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const bandRef = useRef<HTMLDivElement>(null);
	const closeSettings = useCallback(() => setSettingsOpen(false), []);
	usePopoverDismiss(bandRef, settingsOpen, closeSettings);
	const [hidden, setHidden] = useState<{ id: string; lemma: string } | null>(null);
	// Cards whose sentence went to the saved phrases from this page.
	const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());
	const [newestLineAtOpen, setNewestLineAtOpen] = useState<string | undefined>(() =>
		knownStatus ? (knownStatus.answered?.[0]?.reviewedAt ?? "") : undefined,
	);
	const shownAt = useRef(Date.now());
	// One card at a time: its active time (the gaps between actions, each
	// capped) is what the day's minutes count; `ms` stays the card's wall-clock.
	const activeTime = useActiveTime("review", "interactive");
	const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
	const sentenceRef = useRef<HTMLFormElement>(null);
	const bodyRef = useRef<HTMLElement>(null);

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
			setNewestLineAtOpen((seen) => seen ?? next.answered?.[0]?.reviewedAt ?? "");
			setStatus(next);
			if (!sameCard) {
				setFields([]);
				setGivenParts([]);
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
	const runs = clozeRuns(prompt?.pieces ?? [""]);
	const gaps = prompt?.gaps ?? [];
	const typed = gaps.map((_, i) => (fields[i] ?? "").trim());
	const given = givenParts.join(" ");
	const focusGap = (i: number) => inputRefs.current[i]?.focus();
	const focusOpenGap = () =>
		focusGap(
			Math.max(
				0,
				typed.findIndex((t) => !t),
			),
		);
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
		if (status?.next && !verdict && !picks) inputRefs.current[0]?.focus();
	}, [status?.next, verdict, picks]);
	// Tab moves through the blanks in sentence order and wraps. Refs are null for
	// blanks that are not on screen, so the filter keeps only the live ones.
	const cycleBlanks = useCallback(() => inputRefs.current.filter((el): el is HTMLInputElement => el !== null), []);
	useFieldCycle(cycleBlanks);

	const check = (parts: string[]) => {
		if (!prompt || verdict) return;
		const answer = parts.join(" ");
		const v = compareAnswer(prompt.answer, answer, tag);
		setGivenParts(parts);
		setVerdict(v);
		setSuggested(ratingFor(v, Date.now() - shownAt.current, help));
		if (v === "exact") sfx.right();
		else if (v === "accents") sfx.almost();
		else {
			sfx.wrong();
			shake(sentenceRef.current);
			const id = prompt.card.id;
			const missUrl = `/api/review/miss?cardId=${encodeURIComponent(id)}&given=${encodeURIComponent(answer)}&words=${prompt.words}`;
			const showMiss = (url: string) =>
				fetch(url)
					.then((res) => (res.ok ? (res.json() as Promise<{ reason: MissReason | null }>) : null))
					.then((body) => {
						if (!body?.reason || knownStatus?.next?.card.id !== id) return;
						setReason(body.reason);
						if (body.reason.other?.notePending && !url.endsWith("&note=write")) void showMiss(`${url}&note=write`);
					})
					.catch(() => {});
			void showMiss(missUrl);
		}
		void speak(prompt.card.sentence);
	};

	const rate = async (rating: Rating) => {
		if (!prompt || !verdict || saving) return;
		setSaving(true);
		setHidden(null);
		try {
			const res = await fetch("/api/review", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					cardId: prompt.card.id,
					given,
					ms: Date.now() - shownAt.current,
					activeMs: activeTime.finish(),
					rating: Math.min(rating, cap),
					hints: hint,
					picked: picks,
					words: prompt.words,
					tz: new Date().getTimezoneOffset(),
				}),
			});
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
			body: JSON.stringify({
				text: prompt.card.sentence,
				translation: prompt.card.translation,
				source: "review",
				context: prompt.card.lemma,
			}),
		}).catch(() => null);
		if (res?.ok) setSavedIds((s) => new Set(s).add(id));
	};

	const suspend = async () => {
		if (!prompt) return;
		const card = { id: prompt.card.id, lemma: prompt.card.lemma };
		await fetch("/api/review/suspend", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ cardId: card.id }),
		});
		await load();
		setHidden(card);
	};
	const unhide = async () => {
		if (!hidden) return;
		await fetch("/api/review/suspend", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ cardId: hidden.id, suspended: false }),
		});
		setHidden(null);
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
					check([opt]);
				}
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				void rate(suggested);
			} else if (
				["1", "2", "3", "4"].includes(e.key) &&
				!(e.target instanceof HTMLInputElement) &&
				Number(e.key) <= cap
			) {
				setSuggested(Number(e.key) as Rating);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const gapVerdicts = useMemo(
		() => (verdict ? gaps.map((gap, i) => compareAnswer(gap, givenParts[i] ?? "", tag)) : []),
		[verdict, gaps, givenParts, tag],
	);
	const gapSlips = useMemo(
		() =>
			gapVerdicts.map((v, i) =>
				v === "accents" ? new Set(diacriticSlips(gaps[i]!, givenParts[i] ?? "", tag)) : new Set<number>(),
			),
		[gapVerdicts, gaps, givenParts, tag],
	);
	const hideInHistory = useMemo(
		() => (prompt && !verdict ? new Set(wordsOf(prompt.answer)) : NO_WORDS),
		[prompt, verdict],
	);
	const typeInGap = (i: number, value: string) => {
		const [head, ...rest] = value.split(/\s+/);
		const spill = i < gaps.length - 1 && rest.length > 0;
		setFields((now) => {
			const next = gaps.map((_, k) => now[k] ?? "");
			next[i] = spill ? head! : value;
			if (spill && rest.join(" ")) next[i + 1] = rest.join(" ");
			return next;
		});
		if (spill) focusGap(i + 1);
	};

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
	const chooseMode = (m: Mode) => {
		setMode(m);
		writePref(MODE_KEY, m);
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
	const answered = status?.answered ?? [];
	const caughtUp = !!status?.available && !prompt;

	return (
		<div className="@container h-dvh" data-testid="review-session">
			<div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,1fr)_376px] @6xl:grid-rows-1">
				<header className="lh-drag lh-wco-gutter relative z-[2] flex h-[60px] items-center gap-2.5 bg-background px-4 shadow-[inset_0_-1px_0_var(--q-line)] @6xl:hidden">
					<SidebarToggle />
					<QPie frac={day.s && day.s.dailyGoal > 0 ? day.s.todayXp / day.s.dailyGoal : 0} size={28} />
					<div className="flex min-w-0 flex-col leading-[1.2]">
						<b className="q-num text-[15px] font-semibold tracking-[-0.01em]">
							{day.s?.todayXp ?? 0}{" "}
							<span className="text-[13px] font-[450] text-ink-3">/ {day.s?.dailyGoal ?? 50} XP</span>
						</b>
						<small className="text-xs text-ink-3">
							{day.s
								? day.s.todayXp < day.s.dailyGoal
									? `${day.s.dailyGoal - day.s.todayXp} to today's goal`
									: "Today's goal is met"
								: " "}
						</small>
					</div>
					<Link href="/" className="q-btn ghost ml-auto">
						Today
					</Link>
				</header>

				<main className="flex min-h-0 flex-col">
					<div className={cn(COLUMN, "relative z-10 shrink-0 pt-4 @6xl:pt-9")} ref={bandRef}>
						<div className="flex h-9 items-center gap-3">
							<span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
								<QIcon name="review" className="text-teal" />
								Review
							</span>
							<div
								role="progressbar"
								aria-label="Cards done today"
								aria-valuemin={0}
								aria-valuemax={total}
								aria-valuenow={done}
								aria-valuetext={counts ? `${done} of ${total} cards today. ${stillToDo(counts)}` : undefined}
								title={counts ? stillToDo(counts) : undefined}
								className="relative h-[3px] min-w-8 flex-1 overflow-hidden rounded-full bg-well-2"
								data-testid="review-progress"
							>
								<div className="lh-fill rounded-full bg-teal" style={fillStyle(total > 0 ? done / total : 0)} />
							</div>
							<span
								className="min-w-[52px] whitespace-nowrap text-right @sm:min-w-[88px] text-[12.5px] text-ink-3"
								data-testid="review-counts"
							>
								{counts && lang ? (
									<>
										<b className="q-num font-semibold text-ink-2">{done}</b> of{" "}
										<b className="q-num font-semibold text-ink-2">{total}</b>
										<span className="hidden @sm:inline"> today</span>
									</>
								) : null}
							</span>
							<button
								type="button"
								onClick={() => setSettingsOpen((o) => !o)}
								aria-expanded={settingsOpen}
								aria-controls="review-settings"
								title="Review settings: answer by typing or choosing, and how many words a blank hides"
								className={cn(
									"grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-well hover:text-ink-2 pointer-coarse:size-10",
									settingsOpen && "bg-well text-ink-2",
								)}
								data-testid="review-settings-toggle"
							>
								<SlidersHorizontalIcon className="size-4" aria-hidden="true" />
								<span className="sr-only">Review settings</span>
							</button>
							<SoundControl
								className="-mr-1.5 flex shrink-0 items-center justify-center transition-colors pointer-coarse:size-10"
								iconClass="size-4"
								testid="review-sound"
							/>
						</div>
						{settingsOpen && (
							<div
								id="review-settings"
								role="group"
								aria-label="Review settings"
								className="lh-menu-in absolute right-4 top-full mt-1 origin-top-right rounded-xl bg-card p-4 shadow-[var(--q-raise-hi)] @xl:right-8"
							>
								<DeckSettings
									mode={mode}
									onMode={chooseMode}
									blankWords={blankWordsNow}
									onBlankWords={chooseBlankWords}
								/>
							</div>
						)}
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable_both-edges]">
						<div className={cn(COLUMN, "pb-12")}>
							{loadError && (
								<div
									role="alert"
									className="mt-8 flex flex-wrap items-center gap-3 rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground"
								>
									<p>Couldn&apos;t load your review deck. {loadError}</p>
									<button type="button" onClick={() => void load()} className="q-btn sec ml-auto">
										Try again
									</button>
								</div>
							)}

							{/* A card that arrives late must not push the page: its space is held from the first frame, drawn only after the skeleton delay. */}
							{!loadError && (!status || (prompt && !lang)) && (
								<div
									className={cn("min-h-[300px] pt-8 @xl:pt-12", !slow && "invisible")}
									aria-busy="true"
									aria-label="Loading your review deck"
									data-testid="review-loading"
								>
									<div className="h-3 w-24 animate-pulse rounded bg-well-2" />
									<div className="mt-5 h-10 w-full animate-pulse rounded-lg bg-well-2 @xl:h-12" />
									<div className="mt-4 h-10 w-2/3 animate-pulse rounded-lg bg-well-2 @xl:h-12" />
									<div className="mt-5 h-4 w-1/2 animate-pulse rounded bg-well-2" />
								</div>
							)}

							{status && !status.available && (
								<p className="pt-8 text-[17px] leading-relaxed text-ink-2 @xl:pt-12" data-testid="review-unavailable">
									This language has no words yet, so there is nothing to review. Add its words from the language menu at
									the top of the sidebar (Add a language…).
								</p>
							)}

							{caughtUp && (
								<section className="lh-fade pt-8 @xl:pt-12" data-testid="review-done">
									<h1 className="text-[34px] leading-[44px] font-semibold tracking-[-0.032em] text-foreground @xl:text-[44px] @xl:leading-[60px]">
										{done > 0 ? "All caught up." : "Nothing is due right now."}
									</h1>
									<p className="q-line dim mt-3 max-w-lg" data-testid="review-left">
										{counts && stillToDo(counts) !== "All done for today." ? `${stillToDo(counts)} ` : ""}Words come
										back on the day they are due, and new ones arrive tomorrow.
									</p>
									<div className="mt-6 flex items-center gap-3" data-testid="review-new-per-day">
										<span className="text-[13px] text-ink-3" id="review-new-per-day-label">
											New words per day
										</span>
										<div className="q-segc" role="group" aria-labelledby="review-new-per-day-label">
											<button
												type="button"
												onClick={() => stepNewPerDay(-5)}
												disabled={(newPerDay ?? status.settings.newPerDay) <= 0}
												aria-label="Five fewer new words per day"
												className="disabled:opacity-40"
											>
												<MinusIcon className="size-3.5" />
											</button>
											<span className="q-num grid w-10 place-items-center text-[13px] font-semibold" aria-live="polite">
												{newPerDay ?? status.settings.newPerDay}
											</span>
											<button
												type="button"
												onClick={() => stepNewPerDay(5)}
												disabled={(newPerDay ?? status.settings.newPerDay) >= 100}
												aria-label="Five more new words per day"
												className="disabled:opacity-40"
											>
												<PlusIcon className="size-3.5" />
											</button>
										</div>
									</div>
									<SourcesNote feature="review" className="mt-6" />
								</section>
							)}

							{prompt && lang && (
								<article
									ref={bodyRef}
									className="pt-5 @xl:pt-12"
									data-testid="review-card"
									aria-label={`Review, ${isNew ? "new word" : "card"}`}
								>
									<div className="flex h-8 items-center gap-3 text-[13px] text-ink-3">
										<span className="whitespace-nowrap font-[450]" data-testid="review-kind">
											{isNew
												? newTotal > 0
													? `New word ${position} of ${newTotal}`
													: "New word"
												: prompt.card.state === "learning"
													? "Relearning"
													: "Review"}
										</span>
										{prompt.sentenceSource && (
											<span className="-ml-1.5 hidden min-w-0 truncate @lg:inline" data-testid="review-source">
												· sentence from {SENTENCE_SOURCES[prompt.sentenceSource] ?? prompt.sentenceSource}
											</span>
										)}
										{hidden ? (
											<span
												className="ml-auto flex items-center gap-1 whitespace-nowrap"
												role="status"
												data-testid="review-hidden"
											>
												Hidden: <span lang={lang?.code}>{hidden.lemma}</span>
												<button
													type="button"
													onClick={() => void unhide()}
													className="q-btn ghost -mr-2.5 !h-8 !px-2 !text-[13px] !text-teal-2"
													data-testid="review-unhide"
												>
													Undo
												</button>
											</span>
										) : (
											<button
												type="button"
												onClick={() => void suspend()}
												className="q-btn ghost -mr-2.5 ml-auto !h-8 !text-[13px] !font-[450]"
												title="Never show this word again"
												data-testid="review-suspend"
											>
												<EyeOffIcon className="size-3.5" aria-hidden="true" />
												Hide this word
											</button>
										)}
									</div>

									<form
										ref={sentenceRef}
										onSubmit={(e) => {
											e.preventDefault();
											if (typed.some(Boolean)) check(typed);
											else focusOpenGap();
										}}
										className="q-sent mt-2 !text-[30px] !leading-[44px] [text-wrap:pretty] @xl:!text-[46px] @xl:!leading-[64px]"
										lang={lang?.code}
										data-word-lookup-enabled={verdict !== null ? "true" : "false"}
									>
										{runs.map((run, i) => {
											const gap = gaps[i];
											const v = gapVerdicts[i];
											return (
												<Fragment key={i}>
													<span>{run.body}</span>
													{gap !== undefined && (
														<span className="whitespace-nowrap">
															{run.foot}
															<span
																className={cn(
																	"q-slot !mx-0 !h-[44px] !px-0.5 @xl:!h-[58px] @xl:!px-1 max-w-full",
																	!verdict && "q-write !text-foreground",
																	v === "wrong" && "!text-miss",
																	v === "accents" && "!text-foreground",
																)}
																style={{ display: "inline-grid", gridTemplateColumns: "auto" }}
															>
																<span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
																	{!verdict && !picks && (fields[i]?.length ?? 0) > gap.length ? fields[i] : gap}
																</span>
																{verdict ? (
																	<span
																		className="lh-pop col-start-1 row-start-1 whitespace-pre text-center"
																		data-testid="review-answer"
																	>
																		<span
																			className={cn(
																				v === "exact" &&
																					"underline decoration-teal decoration-2 underline-offset-[8px]",
																				v === "wrong" &&
																					"underline decoration-miss decoration-2 underline-offset-[8px]",
																			)}
																		>
																			{[...gap].map((ch, k) => (
																				<span
																					key={k}
																					className={
																						gapSlips[i]?.has(k)
																							? "underline decoration-2 underline-offset-4"
																							: undefined
																					}
																				>
																					{ch}
																				</span>
																			))}
																		</span>
																	</span>
																) : picks ? (
																	<span className="col-start-1 row-start-1" aria-label="blank" />
																) : (
																	<input
																		ref={(el) => {
																			inputRefs.current[i] = el;
																		}}
																		value={fields[i] ?? ""}
																		onChange={(e) => typeInGap(i, e.target.value)}
																		onKeyDown={(e) => {
																			const el = e.currentTarget;
																			const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
																			const atEnd = el.selectionStart === el.value.length;
																			// HTML's implicit submission skips a form with more than one text field and no submit button, so Enter is handled here.
																			if (e.key === "Enter" && gaps.length > 1) {
																				e.preventDefault();
																				e.stopPropagation();
																				if (typed.some(Boolean)) check(typed);
																				else focusOpenGap();
																			} else if (
																				i > 0 &&
																				((e.key === "Backspace" && !el.value) || (e.key === "ArrowLeft" && atStart))
																			) {
																				e.preventDefault();
																				focusGap(i - 1);
																			} else if (i < gaps.length - 1 && e.key === "ArrowRight" && atEnd) {
																				e.preventDefault();
																				focusGap(i + 1);
																			}
																		}}
																		aria-label={
																			gaps.length > 1 ? `Missing word ${i + 1} of ${gaps.length}` : "Missing word"
																		}
																		autoComplete="off"
																		autoCorrect="off"
																		spellCheck={false}
																		size={1}
																		data-testid="review-input"
																		className="col-start-1 row-start-1 w-px min-w-full bg-transparent text-center outline-none caret-teal selection:bg-teal-line"
																	/>
																)}
															</span>
															{runs[i + 1]?.head}
														</span>
													)}
												</Fragment>
											);
										})}
									</form>

									<div className="mt-3 flex min-h-8 items-center gap-2">
										<p className="text-[17px] leading-snug text-ink-2" data-no-word-lookup="true">
											{prompt.card.translation}
										</p>
										<span className={cn("flex shrink-0 gap-2", !verdict && "invisible")} aria-hidden={!verdict}>
											<PlayButton
												text={prompt.card.sentence}
												className="size-8 shrink-0 rounded-full bg-well text-ink-2 hover:bg-well-2"
												label="Play the sentence"
											/>
											<button
												type="button"
												onClick={() => void saveSentence()}
												aria-pressed={savedIds.has(prompt.card.id)}
												aria-label={
													savedIds.has(prompt.card.id)
														? "Sentence saved to your phrases"
														: "Save the sentence to your phrases"
												}
												title={
													savedIds.has(prompt.card.id) ? "Saved to your phrases" : "Save the sentence to your phrases"
												}
												data-testid="review-save-phrase"
												className={cn(
													"grid size-8 shrink-0 place-items-center rounded-full bg-well text-ink-2 hover:bg-well-2",
													savedIds.has(prompt.card.id) && "text-teal-2",
												)}
											>
												<BookmarkIcon
													className="size-4"
													fill={savedIds.has(prompt.card.id) ? "currentColor" : "none"}
													aria-hidden="true"
												/>
											</button>
										</span>
									</div>

									<div className="mt-6 grid grid-cols-[minmax(0,1fr)] @2xl:min-h-[112px]">
										<div className={cn("col-start-1 row-start-1", verdict && "invisible")}>
											<p className="mb-3 flex min-h-6 flex-wrap gap-x-6 gap-y-1" data-testid="review-hints">
												{hint > 0 && (
													<span className="lh-fade">
														<Note label="means">{prompt.card.gloss}</Note>
													</span>
												)}
												{hint > 1 && (
													<span className="lh-fade">
														<Note label="base form" lang={lang?.code}>
															{prompt.card.lemma}
														</Note>
													</span>
												)}
											</p>

											{!verdict && mode === "choice" && !picks && (
												<p className="q-sub !mt-0 mb-3">You have met this word before, so this time you type it.</p>
											)}

											{picks && (
												<div className="grid gap-2 @xl:grid-cols-2" data-testid="review-options">
													{prompt.options.map((o, i) => (
														<OptionTile
															key={o}
															n={i + 1}
															onClick={() => check([o])}
															disabled={!!verdict}
															lang={lang?.code}
														>
															{o}
														</OptionTile>
													))}
												</div>
											)}

											{!picks && <DiacriticBar variant="keys" />}
										</div>

										{verdict && (
											<div className="lh-fade col-start-1 row-start-1" data-testid="review-feedback">
												<p
													className={cn("q-result !text-[15px]", verdict === "wrong" && "miss")}
													data-testid="review-verdict"
												>
													{verdict === "wrong" ? (
														<XIcon className="size-4" strokeWidth={2} aria-hidden="true" />
													) : (
														<QIcon name="check" />
													)}
													{exact
														? helped
															? "Right"
															: "Right on the first try"
														: verdict === "accents"
															? "Almost, check the accents"
															: "Not quite"}
													{exact && <span>· {helped ? "help used" : "no help used"}</span>}
													{!exact && given.trim() && !(verdict === "wrong" && reason) && (
														<span className="min-w-0 truncate">
															· you wrote “<span lang={lang?.code}>{givenParts.filter(Boolean).join(" … ")}</span>”
														</span>
													)}
												</p>
												{verdict === "wrong" && reason && (
													<MissWhy
														reason={reason}
														given={reason.given ?? targetWordOf(prompt, given)}
														answer={reason.answer ?? prompt.card.answer}
														code={lang?.code}
														className="mt-3"
													/>
												)}
												{verdict !== "wrong" && (
													<p className="mt-3 flex flex-wrap gap-x-6 gap-y-1" data-testid="review-facts">
														<Note label="word">
															<Link
																href={`/words?search=${encodeURIComponent(prompt.card.lemma)}`}
																lang={lang?.code}
																className="underline decoration-line-2 underline-offset-2 hover:text-ink"
															>
																{prompt.card.lemma}
															</Link>
															<span className="ml-1.5 font-[450] text-ink-2">{shortGloss(prompt.card.gloss)}</span>
														</Note>
														{prompt.form && <Note label="form">{prompt.form}</Note>}
													</p>
												)}
											</div>
										)}
									</div>
								</article>
							)}

							{lang && status?.available && answered.length > 0 && (prompt || caughtUp) && (
								<AnsweredHistory
									lines={answered}
									sessionSince={newestLineAtOpen}
									answeredToday={counts?.reviewedToday ?? answered.length}
									code={lang.code}
									hide={hideInHistory}
								/>
							)}

							{caughtUp && status && lang && status.leeches.length > 0 && (
								<section className="mt-12" data-testid="review-leeches">
									<h2 className="q-sh">Words that keep slipping</h2>
									<p className="q-sub" style={{ marginTop: 0 }}>
										Missed again and again. A lesson on them, or a sentence of your own, often helps more than another
										review.
									</p>
									<ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
										{status.leeches.map((l) => (
											<li key={l.id} className="q-ex" title={`Missed ${l.lapses} times`}>
												<span lang={lang?.code}>{l.lemma}</span>
												<span className="ml-1.5 font-[450] text-ink-3">{l.gloss}</span>
												<span className="ml-1.5 text-[12px] text-ink-3">×{l.lapses}</span>
											</li>
										))}
									</ul>
								</section>
							)}
						</div>
					</div>

					{prompt && lang && (
						<div
							className={cn(
								"shrink-0 pb-[env(safe-area-inset-bottom)] transition-colors",
								verdict === "wrong"
									? "bg-miss-soft shadow-[0_-1px_0_color-mix(in_srgb,var(--q-miss)_45%,transparent)]"
									: verdict
										? "bg-teal-wash shadow-[0_-1px_0_var(--q-teal-line)]"
										: "bg-background shadow-[0_-1px_0_var(--q-line)]",
							)}
							data-testid="review-dock"
						>
							<div className={cn(COLUMN, "py-4")}>
								<div className={cn("@2xl:min-h-14", picks ? "min-h-14" : "min-h-[120px]")}>
									{!verdict ? (
										<div key="ask" className="grid grid-cols-2 gap-2 @2xl:flex @2xl:h-14 @2xl:items-center">
											<button
												type="button"
												onClick={() => {
													setHint((h) => Math.min(2, h + 1));
													focusOpenGap();
												}}
												disabled={hint >= 2}
												className={HELP_BUTTON}
												data-testid="review-hint"
											>
												<span className="flex items-center gap-2">
													<LightbulbIcon
														className="hidden size-3.5 shrink-0 text-ink-3 @2xl:block"
														aria-hidden="true"
													/>
													{hint === 0 ? "Show meaning" : hint === 1 ? "Show base form" : "Both hints shown"}
												</span>
												<span className="text-[12px] font-[450] text-ink-3 @2xl:text-[13px]">
													<span className="hidden @2xl:inline">· </span>
													{hint === 0 ? "at most Good" : "at most Hard"}
												</span>
											</button>
											<button
												type="button"
												onClick={() => check(gaps.map(() => ""))}
												className={HELP_BUTTON}
												data-testid="review-dont-know"
											>
												I don&apos;t know
												<span className="text-[12px] font-[450] text-ink-3 @2xl:text-[13px]">
													<span className="hidden @2xl:inline">· </span>counts as Again
												</span>
											</button>
											{!picks && (
												<button
													type="button"
													onClick={() => check(typed)}
													disabled={!typed.some(Boolean)}
													className="q-btn primary col-span-2 !h-12 @2xl:ml-auto @2xl:min-w-44"
													data-testid="review-check"
												>
													Check
													<span className="q-kbd pointer-coarse:hidden">
														<QIcon name="enter" />
													</span>
												</button>
											)}
										</div>
									) : (
										<div key="rate" className="grid gap-2 @2xl:flex @2xl:h-14 @2xl:items-center">
											{cap === 1 ? (
												<p
													className="flex h-14 items-center text-[15px] text-ink-2 @2xl:w-[440px]"
													data-testid="review-ratings"
												>
													Comes back in&nbsp;
													<b className="font-semibold text-foreground">{comesBack(prompt.intervals[1])}</b>
												</p>
											) : (
												<div
													className="grid h-14 grid-cols-4 rounded-[10px] bg-well shadow-[inset_0_0_0_1px_var(--q-line-2)] @2xl:w-[440px]"
													role="radiogroup"
													aria-label="Rate it yourself: when the word comes back"
													data-testid="review-ratings"
												>
													{([1, 2, 3, 4] as Rating[]).map((r) => (
														<button
															key={r}
															type="button"
															role="radio"
															aria-checked={r === shownSuggested}
															disabled={saving || r > cap}
															onClick={() => setSuggested(r)}
															title={
																r > cap
																	? `${RATING_LABELS[r]} is off: ${verdict === "wrong" ? "a miss counts as Again" : "you had help on this card"}`
																	: undefined
															}
															className={cn(
																"relative flex min-w-0 flex-col items-center justify-center text-[14px] font-semibold text-foreground transition-colors first:rounded-l-[10px] last:rounded-r-[10px]",
																r > 1 && "shadow-[inset_1px_0_0_var(--q-line)]",
																r !== shownSuggested &&
																	"hover:bg-well-2 disabled:text-ink-4 disabled:hover:bg-transparent",
																r === shownSuggested &&
																	"rounded-[10px] bg-card text-teal-2 shadow-[inset_0_0_0_1.5px_var(--q-teal)]",
															)}
														>
															<kbd className="absolute left-1.5 top-1.5 hidden font-ui text-[12px] font-[550] text-ink-4 pointer-fine:block">
																{r}
															</kbd>
															{RATING_LABELS[r]}
															<span className="q-num text-[12px] font-[450] text-ink-3">
																{comesBack(prompt.intervals[r])}
															</span>
														</button>
													))}
												</div>
											)}
											<button
												type="button"
												autoFocus
												disabled={saving}
												onClick={() => void rate(shownSuggested)}
												data-testid="review-continue"
												className="q-btn primary !h-12 @2xl:ml-auto @2xl:min-w-44"
											>
												{saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
												{cap === 1 ? "Continue" : `Continue · ${RATING_LABELS[shownSuggested]}`}
												<span className="q-kbd pointer-coarse:hidden">
													<QIcon name="enter" />
												</span>
											</button>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{caughtUp && (
						<div className="shrink-0 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--q-line)]">
							<div className={cn(COLUMN, "flex min-h-20 flex-wrap items-center justify-end gap-2 py-4")}>
								<Link href="/lesson" className="q-btn ghost">
									Do a lesson
								</Link>
								<Link href="/" className="q-btn primary !h-12">
									Back to Today
								</Link>
							</div>
						</div>
					)}
				</main>

				<DayRail s={day.s} />
			</div>
		</div>
	);
}
