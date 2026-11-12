"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import { EmptyState } from "@/components/quiet/empty-state";
import { speak, useActiveLanguage } from "@/components/speech";
import { useActiveTime } from "@/components/use-active-time";
import { COLUMN, Dock, endEnterBlocked, EnterHint, onFocusedControl, OptionTile, PLAY_ROW, PracticeCard, PRIMARY, SECONDARY, Stat, Stats, TaskEnd, TaskFrame, TaskTop, VerdictDisc } from "@/components/task-frame";
import { SMALL } from "@/components/ui/learn-buttons";
import { SourcesNote } from "@/components/sources/sources-note";
import type { WordCheckMiss, WordCheckFeedback, WordCheckItem, WordCheckResult, WordCheckStart } from "@/src/core";

const WORDS_HREF = "/words";
const DONT_KNOW_KEY = "5";

type Pick = number | "dont-know";

async function post<T>(body: Record<string, unknown>, keepalive = false): Promise<T> {
	const res = await fetch("/api/words/check", { method: "POST", keepalive, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
	const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
	if (!res.ok || !data) throw new Error(data?.message ?? "The word check could not be reached.");
	return data;
}

const count = (n: number) => n.toLocaleString("en-US");

export function WordCheck() {
	const lang = useActiveLanguage();
	const router = useRouter();
	const time = useActiveTime("wordcheck", "interactive");
	const [id, setId] = useState<string | null>(null);
	const [item, setItem] = useState<WordCheckItem | null>(null);
	const [total, setTotal] = useState(0);
	const [answered, setAnswered] = useState(0);
	const [pick, setPick] = useState<Pick | null>(null);
	const [feedback, setFeedback] = useState<WordCheckFeedback | null>(null);
	const [result, setResult] = useState<WordCheckResult | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const shownAt = useRef(0);
	const started = useRef(false);

	const begin = useCallback(async () => {
		setError(null);
		setResult(null);
		setFeedback(null);
		setPick(null);
		setAnswered(0);
		try {
			const start = await post<WordCheckStart>({ action: "start" });
			setId(start.id);
			setItem(start.item);
			setTotal(start.progress.total);
			shownAt.current = performance.now();
			time.restart();
		} catch (err) {
			setItem(null);
			setError(err instanceof Error ? err.message : "The word check could not start.");
		}
	}, [time]);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void begin();
	}, [begin]);

	const answer = useCallback(
		async (choice: Pick) => {
			if (!id || !item || feedback || busy) return;
			setBusy(true);
			setPick(choice);
			try {
				const reply = await post<WordCheckFeedback>({ action: "answer", id, slug: item.slug, pick: choice === "dont-know" ? null : choice, ms: Math.round(performance.now() - shownAt.current) });
				setFeedback(reply);
				setAnswered((n) => n + 1);
			} catch (err) {
				setPick(null);
				setError(err instanceof Error ? err.message : "The answer was not saved.");
			} finally {
				setBusy(false);
			}
		},
		[id, item, feedback, busy],
	);

	const finish = useCallback(async () => {
		if (!id) return;
		setBusy(true);
		try {
			setResult(await post<WordCheckResult>({ action: "finish", id, activeMs: time.finish(), tz: new Date().getTimezoneOffset() }));
		} catch (err) {
			setError(err instanceof Error ? err.message : "The result was not saved.");
		} finally {
			setBusy(false);
		}
	}, [id, time]);

	const next = useCallback(() => {
		if (!feedback || busy) return;
		if (!feedback.item) {
			void finish();
			return;
		}
		setItem(feedback.item);
		setFeedback(null);
		setPick(null);
		shownAt.current = performance.now();
	}, [feedback, busy, finish]);

	const leave = useCallback(() => {
		if (id && !result && answered > 0) void post({ action: "finish", id, activeMs: time.finish(), tz: new Date().getTimezoneOffset() }, true).catch(() => {});
		router.push(WORDS_HREF);
	}, [id, result, answered, time, router]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key === "Escape") {
				leave();
				return;
			}
			if (result) {
				if (e.key === "Enter" && !endEnterBlocked(e)) router.push(WORDS_HREF);
				return;
			}
			if (feedback) {
				if (e.key === "Enter" && !onFocusedControl(e)) {
					e.preventDefault();
					next();
				}
				return;
			}
			if (!item) return;
			if (e.key === DONT_KNOW_KEY) void answer("dont-know");
			else if (/^[1-9]$/.test(e.key) && Number(e.key) <= item.options.length) void answer(Number(e.key) - 1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [answer, feedback, item, leave, next, result, router]);

	if (result) return <CheckResult result={result} lang={lang?.code} onAgain={() => void begin()} />;

	const tileState = (i: number) => {
		if (!feedback) return pick === i ? "dim" : "idle";
		if (i === feedback.correctOption) return "right";
		return pick === i ? "wrong" : "dim";
	};

	return (
		<TaskFrame>
			<TaskTop progress={total ? answered / total : 0} label="Words checked" count={`${Math.min(answered + (feedback ? 0 : 1), Math.max(total, 1))}/${total || "…"}`} onLeave={leave} />

			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
				<div className={cn(COLUMN, "max-w-2xl")}>
					{error && !item ? (
						<EmptyState
							testid="word-check-error"
							title="The word check cannot start"
							action={
								<Link href={WORDS_HREF} className="q-btn primary">
									Back to Words
								</Link>
							}
						>
							<p>{error}</p>
						</EmptyState>
					) : item ? (
						<PracticeCard icon="check" title="Word check" sub="What does this word mean?">
							<div className="flex min-h-14 items-center gap-3">
								<h2 className="font-prose text-[34px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[40px]" lang={lang?.code} data-testid="word-check-word" data-no-word-lookup="true">
									{item.word}
								</h2>
								{feedback && (
									<button type="button" onClick={() => void speak(item.word).catch(() => {})} className={PLAY_ROW} aria-label={`Play: ${item.word}`} title="Play">
										<Volume2Icon className="size-4" strokeWidth={1.6} />
									</button>
								)}
							</div>

							<div className="mt-6 grid gap-2" data-testid="word-check-options" data-no-word-lookup="true">
								{item.options.map((option, i) => (
									<OptionTile key={`${item.slug}-${i}`} n={i + 1} state={tileState(i)} disabled={!!feedback || busy} onClick={() => void answer(i)} lang="en" testId="word-check-option">
										{option}
									</OptionTile>
								))}
							</div>

							<div className="mt-4 flex min-h-24 flex-col gap-2">
								{feedback ? (
									<div className="lh-fade" data-testid="word-check-feedback" data-no-word-lookup="true">
										<p className="font-prose text-[17px] text-foreground">
											<span lang={lang?.code} className="font-semibold">
												{feedback.lemma}
											</span>{" "}
											<span className="text-ink-2">means {feedback.gloss}</span>
										</p>
										{feedback.example && (
											<p className="mt-1.5 font-prose text-[15px] leading-snug text-ink-3">
												<span lang={lang?.code} className="text-ink-2">
													{feedback.example.text}
												</span>{" "}
												{feedback.example.translation}
											</p>
										)}
									</div>
								) : (
									<>
										<button type="button" className={cn(SECONDARY, "self-start pointer-coarse:min-h-11", pick === "dont-know" && "opacity-50")} disabled={busy} onClick={() => void answer("dont-know")} data-testid="word-check-dont-know">
											<span className="q-kbd pointer-coarse:hidden">{DONT_KNOW_KEY}</span>
											I don&apos;t know this word
										</button>
										<p className="font-ui text-[13px] leading-normal text-ink-3">A lucky guess counts as a word you know, so say when you don&apos;t. That keeps the number honest.</p>
									</>
								)}
								{error && item && (
									<p className="rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground" role="alert">
										{error}
									</p>
								)}
							</div>
						</PracticeCard>
					) : (
						<p className="font-prose text-[17px] text-ink-3" role="status">
							Picking words…
						</p>
					)}
				</div>
			</div>

			<Dock tone={feedback ? (feedback.known ? "right" : "miss") : "plain"} live testId="word-check-dock">
				<div className={cn(COLUMN, "flex min-h-20 max-w-2xl items-center justify-between gap-4 py-4")}>
					{feedback ? (
						<>
							<p className="flex min-w-0 items-center gap-2.5 font-ui text-[15px] font-[550] text-foreground" data-testid="word-check-verdict">
								<VerdictDisc ok={feedback.known} />
								{feedback.known ? "You know it" : pick === "dont-know" ? "Not yet. Now you have met it." : "Not this one"}
							</p>
							<button type="button" className={PRIMARY} onClick={next} disabled={busy} data-testid="word-check-next">
								{feedback.item ? "Next word" : "See the result"}
								<span className="q-kbd pointer-coarse:hidden">
									<QIcon name="enter" />
								</span>
							</button>
						</>
					) : (
						<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 sm:pointer-fine:flex">
							<kbd className="q-kbd">1</kbd>
							<span>to</span>
							<kbd className="q-kbd">4</kbd>
							<span>picks a meaning</span>
						</p>
					)}
				</div>
			</Dock>
		</TaskFrame>
	);
}

function CheckResult({ result, lang, onAgain }: { result: WordCheckResult; lang?: string; onAgain: () => void }) {
	const [inReview, setInReview] = useState<Set<string>>(() => new Set(result.missed.filter((w) => w.inReview).map((w) => w.slug)));
	const [adding, setAdding] = useState(false);
	const toAdd = result.missed.filter((w) => !inReview.has(w.slug));

	const addToReview = async (words: readonly WordCheckMiss[]) => {
		if (adding || words.length === 0) return;
		setAdding(true);
		try {
			const res = await fetch("/api/review/enqueue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: words.map((w) => w.slug) }) });
			if (res.ok) {
				const { added } = (await res.json()) as { added: string[] };
				setInReview((s) => new Set([...s, ...added]));
			}
		} finally {
			setAdding(false);
		}
	};

	const moved = result.after.total - result.before.total;
	return (
		<TaskFrame>
			<TaskEnd
				testId="word-check-result"
				label="Your word check result"
				hint={<EnterHint>back to Words</EnterHint>}
				actions={
					<>
						<button type="button" className={SECONDARY} onClick={onAgain} disabled={result.report.wordsLeftToCheck === 0} data-testid="word-check-again">
							Check {result.report.checkLength} more
						</button>
						<Link href={WORDS_HREF} className={PRIMARY} data-testid="word-check-done">
							Back to Words
						</Link>
					</>
				}
			>
				<p className="font-ui text-[13px] font-[550] text-ink-3">{result.measured ? "Measured from your answers" : "Too few answers to measure yet"}</p>
				<h1 className="mt-1 font-title text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[48px]" data-testid="word-check-total">
					About <span className="tabular-nums">{count(result.after.total)}</span> words
				</h1>
				<p className="q-line dim mt-2 !text-[16px]">
					Likely between <span className="tabular-nums">{count(result.after.low)}</span> and <span className="tabular-nums">{count(result.after.high)}</span>.{" "}
					{moved === 0 ? "The same as before this check." : `Before this check the app said about ${count(result.before.total)}.`}
				</p>

				<Stats className="mt-8">
					<Stat label="Words you knew" value={`${result.known} of ${result.answered}`} />
					<Stat label="Range before this check" value={`${count(result.before.low)} to ${count(result.before.high)}`} />
					<Stat label="Range now" value={`${count(result.after.low)} to ${count(result.after.high)}`} />
				</Stats>

				{result.missed.length > 0 && (
					<section className="mt-10" aria-labelledby="word-check-missed">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h2 id="word-check-missed" className="font-ui text-[15px] font-semibold text-foreground">
								Words you have now met
							</h2>
							{toAdd.length > 0 && (
								<button type="button" className={cn(SECONDARY, SMALL)} onClick={() => void addToReview(toAdd)} disabled={adding} data-testid="word-check-add-all">
									Add {toAdd.length === result.missed.length ? "all" : "the other"} {toAdd.length} to Review
								</button>
							)}
						</div>
						<ul className="mt-3 divide-y divide-[var(--q-line)] border-y border-[var(--q-line)]" data-no-word-lookup="true">
							{result.missed.map((w) => (
								<li key={w.slug} className="flex min-h-12 items-center justify-between gap-4 py-2">
									<p className="min-w-0 font-prose text-[16px]">
										<span lang={lang} className="font-semibold text-foreground">
											{w.lemma}
										</span>{" "}
										<span className="text-ink-3">{w.gloss}</span>
									</p>
									<span className="shrink-0 font-ui text-[13px] text-ink-3">{inReview.has(w.slug) ? "In Review" : ""}</span>
								</li>
							))}
						</ul>
					</section>
				)}

				<SourcesNote feature="word-check" className="mt-10" />
			</TaskEnd>
		</TaskFrame>
	);
}
