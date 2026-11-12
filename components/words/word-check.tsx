"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import { EmptyState } from "@/components/quiet/empty-state";
import { speak, useActiveLanguage } from "@/components/speech";
import { useActiveTime } from "@/components/use-active-time";
import { COLUMN, Dock, endEnterBlocked, EnterHint, onFocusedControl, PLAY_ROW, PracticeCard, PRIMARY, SECONDARY, TaskEnd, TaskFrame, TaskTop, VerdictDisc } from "@/components/task-frame";
import { SMALL } from "@/components/ui/learn-buttons";
import { SourcesNote } from "@/components/sources/sources-note";
import { belongsToLayoutAccent, type WordCheckAnswered, type WordCheckMiss, type WordCheckFeedback, type WordCheckItem, type WordCheckResult, type WordCheckStart } from "@/src/core";

const WORDS_HREF = "/words";
const DONT_KNOW_KEY = "?";
const TYPED_LIMIT = 120;
async function post<T>(body: Record<string, unknown>, keepalive = false): Promise<T> {
	const res = await fetch("/api/words/check", { method: "POST", keepalive, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
	const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
	if (!res.ok || !data) throw new Error(data?.message ?? "The word check could not be reached.");
	return data;
}

const count = (n: number) => n.toLocaleString("en-US");

function verdictLine(feedback: WordCheckFeedback): string {
	if (feedback.verdict === "known") return "You know it";
	if (feedback.verdict === "dont-know") return "Now you have met it";
	if (feedback.verdict === "unchecked") return "Not counted";
	return "Not this meaning";
}

export function WordCheck() {
	const lang = useActiveLanguage();
	const router = useRouter();
	const time = useActiveTime("wordcheck", "interactive");
	const [id, setId] = useState<string | null>(null);
	const [item, setItem] = useState<WordCheckItem | null>(null);
	const [judges, setJudges] = useState(false);
	const [total, setTotal] = useState(0);
	const [answered, setAnswered] = useState(0);
	const [typed, setTyped] = useState("");
	const [feedback, setFeedback] = useState<WordCheckFeedback | null>(null);
	const [result, setResult] = useState<WordCheckResult | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const shownAt = useRef(0);
	const started = useRef(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const begin = useCallback(async () => {
		setError(null);
		setResult(null);
		setFeedback(null);
		setTyped("");
		setAnswered(0);
		try {
			const start = await post<WordCheckStart>({ action: "start" });
			setId(start.id);
			setItem(start.item);
			setJudges(start.judges);
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

	useEffect(() => {
		if (item && !feedback && !busy) inputRef.current?.focus();
	}, [item, feedback, busy]);

	const answer = useCallback(
		async (meaning: string | null) => {
			if (!id || !item || feedback || busy) return;
			setBusy(true);
			setError(null);
			try {
				const reply = await post<WordCheckFeedback>({ action: "answer", id, slug: item.slug, typed: meaning, ms: Math.round(performance.now() - shownAt.current) });
				setFeedback(reply);
				setAnswered((n) => n + 1);
			} catch (err) {
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
		setTyped("");
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
			if (feedback && e.key === "Enter" && !onFocusedControl(e)) {
				e.preventDefault();
				next();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [feedback, leave, next, result, router]);

	if (result) return <CheckResult result={result} lang={lang?.code} onAgain={() => void begin()} />;

	const known = feedback?.verdict === "known";
	const judged = feedback?.verdict === "known" || feedback?.verdict === "not-known";

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

							<form
								className="mt-6"
								onSubmit={(e) => {
									e.preventDefault();
									if (typed.trim()) void answer(typed);
								}}
								data-no-word-lookup="true"
							>
								{feedback ? (
									<p
										className={cn("flex min-h-12 items-center rounded-lg px-4 py-2.5 font-prose text-[18px] font-semibold", known ? "bg-go-soft text-foreground" : judged ? "bg-miss-soft text-foreground" : "bg-[var(--q-well)] text-ink-2")}
										data-testid="word-check-typed"
									>
										{feedback.typed ?? "I don't know this word"}
									</p>
								) : (
									<input
										ref={inputRef}
										value={typed}
										onChange={(e) => setTyped(e.target.value.slice(0, TYPED_LIMIT))}
										onKeyDown={(e) => {
											if (belongsToLayoutAccent(e.nativeEvent) || e.key !== DONT_KNOW_KEY || typed) return;
											e.preventDefault();
											void answer(null);
										}}
										aria-label="The meaning in English"
										placeholder="Type the meaning in English"
										lang="en"
										enterKeyHint="done"
										autoComplete="off"
										autoCorrect="off"
										autoCapitalize="off"
										spellCheck={false}
										disabled={busy}
										className="q-field min-h-12 w-full rounded-lg px-4 py-2.5 font-prose text-[18px] placeholder:text-[var(--q-ink-3)]"
										data-testid="word-check-input"
									/>
								)}
							</form>

							<div className="mt-4 flex min-h-28 flex-col gap-2">
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
										{feedback.markedBy === "model" && (
											<p className="mt-2.5 font-ui text-[13px] leading-normal text-ink-3" data-testid="word-check-model-note">
												Marked by the model, because your answer is not the dictionary&apos;s wording{feedback.note ? `: ${feedback.note}` : "."}
											</p>
										)}
										{feedback.verdict === "unchecked" && (
											<p className="mt-2.5 font-ui text-[13px] leading-normal text-ink-3" data-testid="word-check-unchecked-note">
												Your answer is not the dictionary&apos;s wording and no model is set to judge it, so this word counts neither as known nor as not known.
											</p>
										)}
									</div>
								) : (
									<>
										<button type="button" className={cn(SECONDARY, "self-start pointer-coarse:min-h-11")} disabled={busy} onClick={() => void answer(null)} data-testid="word-check-dont-know">
											<span className="q-kbd pointer-coarse:hidden">{DONT_KNOW_KEY}</span>
											I don&apos;t know this word
										</button>
										<p className="font-ui text-[13px] leading-normal text-ink-3">
											There are no meanings to pick from, on purpose: picking from a list reads higher than what you can recall while reading.
											{judges ? " A model marks an answer the dictionary words differently." : " No model is set, so only the dictionary's own wording counts."}
										</p>
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

			<Dock tone={judged ? (known ? "right" : "miss") : "plain"} live testId="word-check-dock">
				<div className={cn(COLUMN, "flex min-h-20 max-w-2xl items-center justify-between gap-4 py-4")}>
					{feedback ? (
						<>
							<p className="flex min-w-0 items-center gap-2.5 font-ui text-[15px] font-[550] text-foreground" data-testid="word-check-verdict">
								{judged && <VerdictDisc ok={known} />}
								{verdictLine(feedback)}
							</p>
							<button type="button" className={cn(PRIMARY, "shrink-0 whitespace-nowrap")} onClick={next} disabled={busy} data-testid="word-check-next">
								{feedback.item ? "Next word" : "See the result"}
								<span className="q-kbd pointer-coarse:hidden">
									<QIcon name="enter" />
								</span>
							</button>
						</>
					) : (
						<>
							<span aria-hidden="true" />
							<button type="button" className={PRIMARY} onClick={() => void answer(typed)} disabled={!item || !typed.trim() || busy} data-testid="word-check-submit">
								{busy && <LoaderCircleIcon className="size-5 animate-spin" />}
								{busy ? (judges ? "Marking…" : "Checking…") : "Check"}
								{!busy && (
									<span className="q-kbd pointer-coarse:hidden">
										<QIcon name="enter" />
									</span>
								)}
							</button>
						</>
					)}
				</div>
			</Dock>
		</TaskFrame>
	);
}
const AXIS_FROM_RANK = 10;
const DOT_PX = 12;
const DOT_ROWS = 4;
const TOO_CLOSE = 0.04;

function placeOnAxis(rank: number, dictionary: number): number {
	const from = Math.log(AXIS_FROM_RANK);
	return Math.min(1, Math.max(0, (Math.log(Math.max(AXIS_FROM_RANK, rank)) - from) / (Math.log(Math.max(dictionary, AXIS_FROM_RANK * 10)) - from)));
}

function laneRows(answers: readonly WordCheckAnswered[], dictionary: number): Array<{ answer: WordCheckAnswered; x: number; row: number }> {
	const lastInRow: number[] = [];
	return answers.map((answer) => {
		const x = placeOnAxis(answer.rank, dictionary);
		let row = 0;
		while (row < DOT_ROWS && lastInRow[row] !== undefined && x - lastInRow[row]! < TOO_CLOSE) row++;
		if (row === DOT_ROWS) row = lastInRow.indexOf(Math.min(...lastInRow));
		lastInRow[row] = x;
		return { answer, x, row };
	});
}

function AnswerLane({ title, answers, dictionary, filled, active, onActive }: { title: string; answers: readonly WordCheckAnswered[]; dictionary: number; filled: boolean; active: string | null; onActive: (slug: string | null) => void }) {
	return (
		<div>
			<p className="font-ui text-[13px] text-ink-2">
				{title} <b className="font-[600] tabular-nums text-foreground">{answers.length}</b>
			</p>
			<div className="relative mt-1.5" style={{ height: DOT_ROWS * (DOT_PX + 2) }}>
				{laneRows(answers, dictionary).map(({ answer, x, row }) => (
					<button
						key={answer.slug}
						type="button"
						tabIndex={-1}
						aria-hidden="true"
						onPointerEnter={() => onActive(answer.slug)}
						onPointerLeave={() => onActive(null)}
						onClick={() => onActive(active === answer.slug ? null : answer.slug)}
						className="absolute -m-1.5 box-content rounded-full p-1.5"
						style={{ left: `calc(${(x * 100).toFixed(2)}% - ${DOT_PX / 2}px)`, top: row * (DOT_PX + 2), width: DOT_PX, height: DOT_PX }}
					>
						<span
							className={cn(
								"block size-full rounded-full border-2",
								filled ? "border-[var(--q-card)] bg-[var(--q-teal)]" : "border-[var(--q-ink-3)] bg-[var(--q-card)]",
								active === answer.slug && "outline outline-2 outline-offset-1 outline-[var(--q-ink)]",
							)}
						/>
					</button>
				))}
			</div>
		</div>
	);
}

function AnswerStrip({ answers, dictionary, edgeRank, lang }: { answers: readonly WordCheckAnswered[]; dictionary: number; edgeRank: number; lang?: string }) {
	const [active, setActive] = useState<string | null>(null);
	const knew = answers.filter((a) => a.verdict === "known");
	const notYet = answers.filter((a) => a.verdict !== "known");
	const shown = answers.find((a) => a.slug === active);
	const edge = placeOnAxis(edgeRank, dictionary);
	const ticks = [100, 1000].filter((rank) => rank < dictionary * 0.7);
	return (
		<figure className="mt-4" data-testid="word-check-strip" data-no-word-lookup="true">
			<div
				role="img"
				aria-label={`Your answers by how common each word is. You knew ${knew.length} and did not know ${notYet.length}. About half of the words around number ${count(edgeRank)} in the frequency order are known. The words are listed below.`}
				className="relative"
			>
				<div aria-hidden="true" className="absolute inset-y-0 w-px bg-[var(--q-ink-3)]" style={{ left: `${(edge * 100).toFixed(2)}%` }} />
				<AnswerLane title="You knew" answers={knew} dictionary={dictionary} filled active={active} onActive={setActive} />
				<div className="mt-3">
					<AnswerLane title="You did not know" answers={notYet} dictionary={dictionary} filled={false} active={active} onActive={setActive} />
				</div>
				<div aria-hidden="true" className="relative mt-2 h-5 border-t border-[var(--q-line-2)] font-ui text-[12px] tabular-nums text-ink-3">
					<span className="absolute left-0 top-1">commonest</span>
					{ticks.map((rank) => (
						<span key={rank} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(placeOnAxis(rank, dictionary) * 100).toFixed(2)}%` }}>
							<i className="h-1 w-px bg-[var(--q-line-2)]" />
							{count(rank)}th
						</span>
					))}
					<span className="absolute right-0 top-1">rarest</span>
				</div>
			</div>
			<figcaption className="mt-3 min-h-[2.75rem] font-ui text-[13px] leading-normal text-ink-3" aria-live="polite">
				{shown ? (
					<>
						<span lang={lang} className="font-prose text-[15px] font-semibold text-foreground">
							{shown.lemma}
						</span>{" "}
						<span className="text-ink-2">{shown.gloss}</span> · number {count(shown.rank)} by how common it is · {shown.verdict === "known" ? "you knew it" : shown.typed ? `you wrote “${shown.typed}”` : "you did not know it"}
					</>
				) : (
					<>
						Each dot is a word you were asked, placed by how common it is. The line is your edge: around the <b className="font-[550] tabular-nums text-ink-2">{count(edgeRank)}</b> commonest words, you know about one word in two. Tap or point at a dot to see the word.
					</>
				)}
			</figcaption>
		</figure>
	);
}

function RangeRow({ label, range, scale, now }: { label: string; range: { total: number; low: number; high: number }; scale: number; now: boolean }) {
	const at = (n: number) => `${Math.min(100, (n / scale) * 100).toFixed(2)}%`;
	return (
		<>
			<span className="font-ui text-[13px] text-ink-2">{label}</span>
			<span className="q-bar" aria-hidden="true">
				<i className={now ? "!bg-[var(--q-teal)]" : "over !rounded"} style={{ left: at(range.low), width: `calc(${at(range.high)} - ${at(range.low)})` }} />
				{now && <span className="target" style={{ left: at(range.total) }} />}
			</span>
			<span className="text-right font-ui text-[13px] tabular-nums text-ink-2">
				{count(range.low)} to {count(range.high)}
			</span>
		</>
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

	const estimate = result.report.estimate;
	const steady = result.report.answersForASteadyEstimate;
	const checked = estimate?.answers ?? 0;
	const scale = Math.max(100, Math.ceil((Math.max(result.before.high, result.after.high) * 1.08) / 100) * 100);
	const knew = result.answers.filter((a) => a.verdict === "known");
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
				<p className="font-ui text-[13px] font-[550] text-ink-3">Words you know</p>
				<h1 className="mt-1 font-title text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[48px]" data-testid="word-check-total">
					About <span className="tabular-nums">{count(result.after.total)}</span>
				</h1>
				<p className="q-line dim mt-2 !text-[16px]">
					{result.measured ? (
						<>
							Measured from the <span className="tabular-nums">{count(checked)}</span> meanings you have typed. You knew <b className="font-[600] text-foreground">{result.known}</b> of the <span className="tabular-nums">{result.answered}</span> in this check.
						</>
					) : (
						<>
							Too few answers to call this measured yet. You knew <b className="font-[600] text-foreground">{result.known}</b> of <span className="tabular-nums">{result.answered}</span>.
						</>
					)}
				</p>

				{estimate && estimate.shareOfUses !== null && (
					<p className="q-line dim mt-1 !text-[16px]" data-testid="word-check-coverage">
						Counted by use, they are about <b className="font-[600] tabular-nums text-foreground">{Math.round(estimate.shareOfUses * 100)}%</b> of the words in this dictionary&apos;s example sentences.
					</p>
				)}

				<div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5" data-testid="word-check-ranges">
					<RangeRow label="Before" range={result.before} scale={scale} now={false} />
					<RangeRow label="Now" range={result.after} scale={scale} now />
				</div>
				<p className="mt-3 font-ui text-[13px] leading-normal text-ink-3" data-testid="word-check-steadiness">
					The bar is the range the real number is likely in; the mark is the best guess.
					{steady > 0 && checked < steady && (
						<>
							{" "}
							It is still wide: studies of size tests ask for about <span className="tabular-nums">{count(steady)}</span> checked words here, and you have <span className="tabular-nums">{count(checked)}</span>. Each check narrows it.
						</>
					)}
				</p>

				{estimate && result.answers.length > 0 && (
					<section className="mt-10" aria-labelledby="word-check-answers">
						<h2 id="word-check-answers" className="font-ui text-[15px] font-semibold text-foreground">
							Where your answers fall
						</h2>
						<AnswerStrip answers={result.answers} dictionary={estimate.dictionary} edgeRank={estimate.midpointRank} lang={lang} />
					</section>
				)}

				{result.missed.length > 0 && (
					<section className="mt-8" aria-labelledby="word-check-missed">
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
										{w.typed && <span className="font-ui text-[13px] text-ink-3"> · you wrote &ldquo;{w.typed}&rdquo;</span>}
									</p>
									<span className="shrink-0 font-ui text-[13px] text-ink-3">{inReview.has(w.slug) ? "In Review" : ""}</span>
								</li>
							))}
						</ul>
					</section>
				)}

				{knew.length > 0 && (
					<section className="mt-8" aria-labelledby="word-check-knew">
						<h2 id="word-check-knew" className="font-ui text-[15px] font-semibold text-foreground">
							Words you knew
						</h2>
						<p className="mt-2 font-prose text-[16px] leading-relaxed text-ink-2" lang={lang} data-no-word-lookup="true" data-testid="word-check-knew-list">
							{knew.map((a) => a.lemma).join(", ")}
						</p>
					</section>
				)}

				{result.unchecked > 0 && (
					<p className="q-line dim mt-6 !text-[14px]" data-testid="word-check-unchecked">
						{result.unchecked} {result.unchecked === 1 ? "answer was" : "answers were"} not counted: the dictionary words the meaning differently and no model was set to judge it.
					</p>
				)}

				<SourcesNote feature="word-check" className="mt-10" />
			</TaskEnd>
		</TaskFrame>
	);
}
