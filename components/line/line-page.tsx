"use client";

/**
 * Today's line (LangHarness, 2026-11-06; docs/research/creator-hooks.md,
 * proposal 1), in the task frame the lessons and Listen use: a focus mode
 * (Escape leaves), one card, one bar at the bottom. The sentence plays as the
 * card opens and nothing is shown until the learner has typed what they
 * caught. The result is a count, the learner's own, never a grade: the words
 * caught stand in full, the missed ones fade, a missing mark is underlined.
 * In the evening the same sentence comes back and the two counts sit side by
 * side. Keys: Space plays, Enter checks, then Enter leaves.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SnailIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import { EmptyState } from "@/components/quiet/empty-state";
import { DiacriticBar } from "@/components/diacritic-bar";
import { speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { useActiveTime } from "@/components/use-active-time";
import { COLUMN, Dock, PRIMARY, SECONDARY, TaskTop } from "@/components/task-frame";
import type { QIconName } from "@/components/quiet/icon-paths";
import { QUIET } from "@/components/ui/learn-buttons";
import { LineHistory } from "@/components/line/line-history";
import { SourcesNote } from "@/components/sources/sources-note";
import { scoreLine, type LineRecord, type LineState } from "@/src/core";

type Phase = "ask-morning" | "ask-evening" | "waiting" | "done" | "no-line";

function phaseOf(view: LineState): Phase {
	if (!view.item) return "no-line";
	if (!view.morning) return "ask-morning";
	if (!view.evening) return view.eveningOpen ? "ask-evening" : "waiting";
	return "done";
}

const INPUT =
	"w-full rounded-lg bg-well px-4 py-3.5 font-prose text-[26px] font-[550] tracking-[-0.02em] text-foreground shadow-[inset_0_0_0_1.5px_var(--q-line-2)] outline-none transition-shadow placeholder:font-normal placeholder:text-ink-4 focus-visible:shadow-[inset_0_0_0_1.5px_var(--q-teal)]";

export function LinePage({ initial }: { initial: LineState }) {
	const lang = useActiveLanguage();
	const router = useRouter();
	const [view, setView] = useState<LineState>(initial);
	const [typed, setTyped] = useState("");
	const [plays, setPlays] = useState(0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// The hearing just answered stays on the card until the learner goes on.
	const [justHeard, setJustHeard] = useState<"morning" | "evening" | null>(null);
	const [showTable, setShowTable] = useState(false);
	const time = useActiveTime("listen", "interactive");
	const inputRef = useRef<HTMLInputElement>(null);

	const phase = phaseOf(view);
	const item = view.item;
	const asking = (phase === "ask-morning" || phase === "ask-evening") && !justHeard;
	const askPhase: "morning" | "evening" = phase === "ask-morning" ? "morning" : "evening";
	const heard = (view.morning ? 1 : 0) + (view.evening ? 1 : 0);

	const play = useCallback(
		(slow = false) => {
			if (!item) return;
			setPlays((n) => n + 1);
			void speak(item.sentence, undefined, { slow }).catch(() => {});
		},
		[item],
	);

	// The line plays as the card opens: the ear meets it before anything is
	// shown. Once per hearing: the ref outlives React's second effect pass in
	// development, so the first play is not counted twice.
	const autoPlayed = useRef<string | null>(null);
	useEffect(() => {
		if (!asking || !item) return;
		const key = `${askPhase}:${item.id}`;
		if (autoPlayed.current !== key) {
			autoPlayed.current = key;
			play();
		}
		inputRef.current?.focus();
		return () => stopSpeaking();
	}, [asking, askPhase, item, play]);

	const submit = useCallback(
		async (given: string) => {
			if (!item || busy || !asking) return;
			setBusy(true);
			setError(null);
			const activeMs = time.finish();
			try {
				const res = await fetch("/api/line", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ phase: askPhase, itemId: item.id, typed: given, plays, activeMs }),
				});
				const body = (await res.json().catch(() => null)) as { state?: LineState; message?: string } | null;
				if (!res.ok || !body?.state) {
					setError(body?.message ?? "The line could not be saved. Reload the page and try again.");
					const fresh = await fetch("/api/line")
						.then((r) => r.json() as Promise<LineState>)
						.catch(() => null);
					if (fresh) setView(fresh);
					return;
				}
				stopSpeaking();
				setView(body.state);
				setJustHeard(askPhase);
				setTyped("");
				setPlays(0);
			} finally {
				setBusy(false);
			}
		},
		[item, busy, asking, time, askPhase, plays],
	);

	const hearAgainNow = () => {
		setJustHeard(null);
		time.restart();
	};

	// Keys: Escape leaves, Space plays, Enter checks (the field) or leaves (the result).
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.repeat) return;
			if (e.key === "Escape") {
				router.push("/");
				return;
			}
			const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
			if (asking) {
				if (!inField && e.key === " ") {
					e.preventDefault();
					play();
				}
				return;
			}
			if (e.key === "Enter" && !inField && phase !== "no-line") router.push("/");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [asking, phase, play, router]);

	if (phase === "no-line") {
		return (
			<Frame>
				<TaskTop progress={0} label="Today's line" count="0/2" />
				<div className="mx-auto w-full max-w-3xl px-6 pt-[8vh]">
					<EmptyState
						testid="line-none"
						title="No line today"
						action={
							<Link href="/" className="q-btn primary">
								Back to Today
							</Link>
						}
					>
						<p>The line is a dictionary sentence of five to twelve words with one or two you have not met. None fits yet.</p>
						<p>It fills in as the words you know grow.</p>
					</EmptyState>
				</div>
			</Frame>
		);
	}

	const shown: LineRecord | null = justHeard ? (justHeard === "morning" ? view.morning : view.evening) : phase === "waiting" ? view.morning : phase === "done" ? view.evening : null;
	const compare: LineRecord | null = shown && shown.phase === "evening" ? view.morning : null;
	const sub = asking ? (askPhase === "morning" ? "First hearing" : "Second hearing") : shown?.phase === "evening" ? "Heard twice" : "First hearing";
	const eveningLater = shown?.phase === "morning" && !view.eveningOpen;
	const eveningNow = shown?.phase === "morning" && view.eveningOpen && !view.evening;

	return (
		<Frame>
			<TaskTop progress={heard / 2} label="First and second hearing" count={`${heard}/2`} />

			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
				<div key={asking ? `ask-${askPhase}` : `shown-${shown?.phase ?? "none"}`} className={cn(COLUMN, "lh-rise")}>
					<LineCard icon="ear" title="Today's line" sub={sub} right={item ? `${item.words} words · ${item.newWords.length} new` : undefined}>
						{asking && item ? (
							<>
								<p className="mb-4 font-ui text-[13px] text-ink-3">
									{askPhase === "morning" ? "Heard cold. Nothing is shown until you have answered." : `First hearing: ${view.morning!.caught} of ${view.morning!.words} words. The same sentence, once more.`}
								</p>
								<h2 className="mb-5 font-prose text-[22px] font-semibold tracking-[-0.02em] text-foreground">Type what you hear</h2>
								<div className="flex flex-wrap items-center gap-3">
									<button
										type="button"
										onClick={() => play()}
										aria-label="Play the sentence"
										className="lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-sun-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2"
										data-testid="line-play"
									>
										<Volume2Icon className="size-6" strokeWidth={1.6} />
									</button>
									<button type="button" onClick={() => play(true)} aria-label="Play slowly" className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-wash px-3.5 text-[13px] font-[550] text-teal-2 transition-colors hover:bg-well-2">
										<SnailIcon className="size-5" strokeWidth={1.6} />
										Slowly
									</button>
									<span className="font-ui text-[13px] text-ink-3" aria-live="polite">
										{plays <= 1 ? "Played once" : `Played ${plays} times`}
										<kbd className="q-kbd ml-2 pointer-coarse:hidden">Space</kbd>
									</span>
								</div>
								<form
									className="mt-6"
									onSubmit={(e) => {
										e.preventDefault();
										void submit(typed.trim());
									}}
								>
									<input
										ref={inputRef}
										type="text"
										lang={lang?.code}
										autoComplete="off"
										autoCapitalize="off"
										spellCheck={false}
										value={typed}
										onChange={(e) => setTyped(e.target.value)}
										disabled={busy}
										aria-label="Type the sentence you heard"
										placeholder="Type what you hear"
										className={INPUT}
										data-testid="line-input"
									/>
									<DiacriticBar variant="keys" className="mt-4" />
								</form>
								{error && (
									<p className="mt-4 rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground" role="alert">
										{error}
									</p>
								)}
							</>
						) : shown ? (
							<Result record={shown} compare={compare} />
						) : null}
					</LineCard>
				</div>

				<div className={cn(COLUMN, "mt-8")}>
					<LineHistory days={view.history} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} />
					<SourcesNote feature="line" className="mt-6" />
				</div>
			</div>

			<Dock tone="plain" live>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					{asking ? (
						<>
							<button type="button" className={QUIET} disabled={busy} onClick={() => void submit("")} data-testid="line-miss">
								I didn&apos;t catch it
							</button>
							<button type="button" className={PRIMARY} disabled={busy} onClick={() => void submit(typed.trim())} data-testid="line-check">
								Check
								<span className="q-kbd">
									<QIcon name="enter" />
								</span>
							</button>
						</>
					) : (
						<>
							<p className="min-w-0 font-ui text-[15px] font-[600] tracking-[-0.01em] text-foreground" data-testid="line-verdict">
								{shown ? `${shown.phase === "morning" ? "Heard cold" : "Heard again"} · ${shown.caught} of ${shown.words} words` : ""}
								{eveningLater && <span className="block text-[13px] font-[450] text-ink-3">It comes back later today, once you have practiced.</span>}
								{eveningNow && <span className="block text-[13px] font-[450] text-ink-3">You have practiced today, so it can come back now, or later today.</span>}
								{shown?.phase === "evening" && <span className="block text-[13px] font-[450] text-ink-3">Both hearings are in. The next line comes tomorrow.</span>}
							</p>
							<div className="flex shrink-0 items-center gap-2">
								{eveningNow && (
									<button type="button" className={SECONDARY} onClick={hearAgainNow} data-testid="line-again">
										Hear it again now
									</button>
								)}
								<Link href="/" className={PRIMARY} data-testid="line-leave">
									Back to Today
									<span className="q-kbd pointer-coarse:hidden">
										<QIcon name="enter" />
									</span>
								</Link>
							</div>
						</>
					)}
				</div>
			</Dock>
		</Frame>
	);
}

/** One hearing: the count as the figure, the sentence with every word marked,
 *  what was typed when it fell short, the meaning and the new words. With a
 *  morning record to compare to, the change since then sits by the figure. */
function Result({ record, compare }: { record: LineRecord; compare: LineRecord | null }) {
	const lang = useActiveLanguage();
	const score = scoreLine(record.sentence, record.typed);
	const before = compare ? scoreLine(compare.sentence, compare.typed) : null;
	const shown = record.sentence.normalize("NFC").match(/[\p{L}\p{N}]+/gu) ?? [];
	const delta = before ? score.caught - before.caught : null;
	return (
		<>
			<p className="mb-3 font-ui text-[13px] text-ink-3">{record.phase === "morning" ? "Heard cold, with no text" : "Heard again, after practice"}</p>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<p className="font-ui text-[44px] font-semibold leading-none tracking-[-0.03em] text-foreground" data-testid="line-figure">
					{score.caught}
					<span className="ml-2 text-[20px] font-[450] tracking-normal text-ink-3">of {score.words} words</span>
				</p>
				{before && delta !== null && (
					<span className={cn("q-pill", delta <= 0 && "grey")} data-testid="line-delta">
						{delta === 0 ? "Same as" : `${delta > 0 ? "+" : ""}${delta} on`} the first hearing ({before.caught} of {before.words})
					</span>
				)}
			</div>
			<p className="mt-5 font-prose text-[28px] font-[550] leading-[1.4] tracking-[-0.025em]" lang={lang?.code} data-testid="line-marks">
				{score.marks.map((m, i) => (
					<span key={i}>
						{i > 0 && " "}
						<span
							className={m.caught ? "text-foreground" : m.almost ? "text-teal-2 underline decoration-teal decoration-2 underline-offset-[6px]" : "text-ink-4"}
							title={m.caught ? "Caught" : m.almost ? "The right word, a mark missing" : "Not caught"}
						>
							{shown[i] ?? m.word}
						</span>
					</span>
				))}
			</p>
			<p className="mt-2 font-ui text-[12.5px] text-ink-3">Caught words in full, missed words faded, a missing mark underlined.</p>
			{before && <p className="mt-1 font-ui text-[12.5px] text-ink-3" data-testid="line-confound">You had seen the sentence by now, so a higher count shows what you remember, not how much better you hear.</p>}
			{score.caught < score.words && (
				<p className="mt-3 font-prose text-base text-ink-3" data-testid="line-typed">
					{record.typed ? (
						<>
							You typed · <span lang={lang?.code}>{record.typed}</span>
						</>
					) : (
						"Nothing caught this time"
					)}
				</p>
			)}
			<p className="mt-3 font-prose text-base text-ink-2">{record.translation}</p>
			{record.newWords.length > 0 && (
				<ul className="mt-3 flex flex-wrap gap-2" aria-label="New words">
					{record.newWords.map((w) => (
						<li key={w.text} className="q-ex">
							<u lang={lang?.code}>{w.text}</u>
							{w.gloss && <span className="ml-1.5 font-normal text-ink-3">· {w.gloss}</span>}
						</li>
					))}
				</ul>
			)}
		</>
	);
}

/** The whole window, not a column beside the sidebar. The sidebar stays
 *  underneath, so the page is centred in the window and the rail never shows. */
function Frame({ children }: { children: React.ReactNode }) {
	return (
		<div data-testid="line-frame" className="fixed inset-0 z-40 flex flex-col bg-background">
			{children}
		</div>
	);
}

/** The practice card. Its content uses the same 18 px inset as the heading,
 *  so the icon, the text and the controls share one left edge. */
function LineCard({ icon, title, sub, right, children }: { icon: QIconName; title: string; sub?: string; right?: string; children: React.ReactNode }) {
	return (
		<div className="q-cloze">
			<div className="q-card-head">
				<QIcon name={icon} />
				<span className="text-ink">{title}</span>
				{sub && <span className="font-[450] text-ink-3">{sub}</span>}
				{right && <span className="mins">{right}</span>}
			</div>
			<div className="px-[18px] py-5">{children}</div>
		</div>
	);
}
