"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Volume2Icon } from "lucide-react";
import { EmptyState } from "@/components/quiet/empty-state";
import { QIcon } from "@/components/quiet/icon";
import { COLUMN, Dock, endEnterBlocked, EnterHint, NotSaved, PracticeCard, PRIMARY, SECONDARY, SentenceRow, SentenceRows, Stat, Stats, TaskEnd, TaskFrame as Frame, TaskTop, VerdictDisc } from "@/components/task-frame";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { cn } from "@/lib/utils";
import { STUDY_ROUTE, studyLanguage, type StudyLanguage } from "@/components/experiment/study-language";
import { EXPERIMENT_CONSTANTS, judgeTyped, wordMatch, type CheckItemRecord, type ProbeItem } from "@/src/core";

type Step = "intro" | "probes" | "production" | "end";
type SaveState = "saving" | "saved" | "failed";

interface CheckItems {
	probes: ProbeItem[];
	production: ProbeItem[];
}

interface Answer {
	record: CheckItemRecord;
	missing: string[];
	extra: string[];
}

const CLEAR_SCORE = 0.8;
const PARTIAL_SCORE = 0.5;
const FIELD = "w-full rounded-lg bg-well px-4 py-3.5 font-prose text-[26px] font-[550] tracking-[-0.02em] text-foreground shadow-[inset_0_0_0_1.5px_var(--q-line-2)] outline-none transition-shadow placeholder:font-normal placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--q-teal)] disabled:opacity-70 dark:bg-background";

function clipUrl(text: string, language: StudyLanguage): string {
	const q = new URLSearchParams({ text });
	if (language.code) q.set("lang", language.code);
	return `/api/tts?${q.toString()}`;
}

export function WeeklyCheckPlayer({ initialWeek, initialLanguage, languages }: { initialWeek: number; initialLanguage: string; languages: string[] }) {
	const router = useRouter();
	const [week, setWeek] = useState(initialWeek);
	const [languageId, setLanguageId] = useState(initialLanguage);
	const [items, setItems] = useState<CheckItems | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [step, setStep] = useState<Step>("intro");
	const [index, setIndex] = useState(0);
	const [draft, setDraft] = useState("");
	const [played, setPlayed] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [playFailed, setPlayFailed] = useState(false);
	const [answer, setAnswer] = useState<Answer | null>(null);
	const [records, setRecords] = useState<CheckItemRecord[]>([]);
	const [save, setSave] = useState<SaveState>("saving");
	const clip = useRef<HTMLAudioElement | null>(null);
	const field = useRef<HTMLInputElement | null>(null);
	const loadSeq = useRef(0);

	const language = studyLanguage(languageId);

	const load = useCallback(async () => {
		const seq = ++loadSeq.current;
		setItems(null);
		setLoadError(null);
		try {
			const res = await fetch(`/api/experiments/input-first/check?week=${week}&lang=${languageId}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = (await res.json()) as Partial<CheckItems>;
			if (seq !== loadSeq.current) return;
			if (!body.probes?.length || !body.production?.length) throw new Error("This check has no sentences.");
			setItems({ probes: body.probes, production: body.production });
		} catch (err) {
			if (seq === loadSeq.current) setLoadError(err instanceof Error ? err.message : String(err));
		}
	}, [week, languageId]);

	useEffect(() => {
		void load();
	}, [load]);

	const stopClip = () => {
		clip.current?.pause();
		clip.current = null;
	};
	useEffect(() => () => clip.current?.pause(), []);

	const total = items ? items.probes.length + items.production.length : EXPERIMENT_CONSTANTS.PROBE_ITEMS_PER_WEEK + EXPERIMENT_CONSTANTS.PRODUCTION_ITEMS_PER_WEEK;
	const item = step === "probes" ? items?.probes[index] : step === "production" ? items?.production[index] : undefined;

	const begin = (nextLanguage = languageId) => {
		stopClip();
		setLanguageId(nextLanguage);
		setRecords([]);
		setIndex(0);
		setDraft("");
		setPlayed(false);
		setPlaying(false);
		setPlayFailed(false);
		setAnswer(null);
		setSave("saving");
		setStep(nextLanguage === languageId ? "probes" : "intro");
	};

	const playOnce = () => {
		if (!item || played) return;
		setPlayed(true);
		setPlaying(true);
		setPlayFailed(false);
		field.current?.focus();
		const audio = new Audio(clipUrl(item.targetSentence, language));
		clip.current = audio;
		audio.onended = () => setPlaying(false);
		const notHeard = () => {
			setPlaying(false);
			setPlayed(false);
			setPlayFailed(true);
		};
		audio.onerror = notHeard;
		audio.play().catch(notHeard);
	};

	const answerWith = (response: string) => {
		if (!item || answer) return;
		const base = { date: new Date().toISOString().slice(0, 10), week, dayNumber: week * 7, language: languageId, itemId: item.id, expected: item.targetSentence, response };
		if (step === "probes") {
			const verdict = response ? judgeTyped(response, item.targetSentence, language.tag) : "wrong";
			setAnswer({ record: { ...base, type: "probe", prompt: "Listening Dictation (single play)", score: verdict === "wrong" ? 0 : 1, verdict }, missing: [], extra: [] });
			return;
		}
		const match = wordMatch(item.targetSentence, response);
		const score = response ? Math.round(match.score * 100) / 100 : 0;
		const verdict = score >= CLEAR_SCORE ? "clear" : score >= PARTIAL_SCORE ? "partial" : "not-yet";
		setAnswer({ record: { ...base, type: "production", prompt: item.englishTranslation, score, verdict, engine: "typed" }, missing: response ? match.missing : [], extra: response ? match.extra : [] });
	};

	const send = async (all: CheckItemRecord[]) => {
		setSave("saving");
		try {
			const res = await fetch("/api/experiments/input-first/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: all }) });
			setSave(res.ok ? "saved" : "failed");
		} catch {
			setSave("failed");
		}
	};

	const advance = () => {
		if (!answer || !items) return;
		const all = [...records, answer.record];
		setRecords(all);
		setAnswer(null);
		setDraft("");
		setPlayed(false);
		setPlaying(false);
		setPlayFailed(false);
		stopClip();
		const last = index + 1 >= (step === "probes" ? items.probes.length : items.production.length);
		if (!last) setIndex((i) => i + 1);
		else if (step === "probes") {
			setIndex(0);
			setStep("production");
		} else {
			setStep("end");
			void send(all);
		}
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented) return;
			if (e.key === "Escape") router.push(STUDY_ROUTE);
			else if (step === "end" && e.key === "Enter" && !endEnterBlocked(e)) {
				e.preventDefault();
				router.push(STUDY_ROUTE);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [router, step]);

	if (loadError) {
		return (
			<Frame>
				<div className="mx-auto w-full max-w-3xl px-6 pt-[8vh]">
					<EmptyState
						testid="check-error"
						title="The check could not start"
						action={
							<button type="button" onClick={() => void load()} className="q-btn primary">
								Try again
							</button>
						}
						secondary={
							<Link href={STUDY_ROUTE} className="q-btn ghost">
								Back to Study
							</Link>
						}
					>
						<p>{loadError}</p>
						<p>Nothing was recorded, so the check can be taken from the start.</p>
					</EmptyState>
				</div>
			</Frame>
		);
	}

	if (step === "end") {
		return (
			<Frame>
				<EndScreen week={week} language={language} other={languages.find((l) => l !== languageId)} records={records} save={save} onRetrySave={() => void send(records)} onOther={(id) => begin(id)} />
			</Frame>
		);
	}

	if (step === "intro" || !items || !item) {
		const probeCount = items?.probes.length ?? EXPERIMENT_CONSTANTS.PROBE_ITEMS_PER_WEEK;
		const productionCount = items?.production.length ?? EXPERIMENT_CONSTANTS.PRODUCTION_ITEMS_PER_WEEK;
		return (
			<Frame strip={false}>
				<TaskTop progress={0} label="Nothing answered yet" count={`0/${total}`} href={STUDY_ROUTE} />
				<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
					<div className={cn(COLUMN, "q-rise")} data-testid="check-intro">
						<p className="q-date flex items-center gap-1.5">
							<QIcon name="listen" className="text-teal" />
							Study · weekly check
						</p>
						<h1 className="q-hello">
							Week {week} in {language.name}
						</h1>
						<p className="q-line dim mt-3 max-w-2xl">
							{probeCount} sentences to hear and type, then {productionCount} to write yourself. It measures where you are this week, so it gives no XP.
						</p>
						<div className="mt-6 grid max-w-md grid-cols-2 gap-3">
							<div>
								<p className="mb-1.5 font-ui text-xs font-semibold text-muted-foreground">Language</p>
								<ChoiceMenu ariaLabel="Language" value={languageId} options={languages.map((id) => ({ value: id, label: studyLanguage(id).name }))} onChange={setLanguageId} />
							</div>
							<div>
								<p className="mb-1.5 font-ui text-xs font-semibold text-muted-foreground">Week</p>
								<ChoiceMenu ariaLabel="Week" value={String(week)} options={Array.from({ length: EXPERIMENT_CONSTANTS.TOTAL_WEEKS }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }))} onChange={(w) => setWeek(Number(w))} />
							</div>
						</div>
						<ul className="mt-6 flex max-w-2xl flex-col gap-1.5 font-prose text-sm leading-relaxed text-muted-foreground">
							<li>Each sentence plays once. There is no replay and no slow play.</li>
							<li>Your answers are saved after the last sentence, so finish in one sitting.</li>
						</ul>
					</div>
				</div>
				<Dock>
					<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
						<Link href={STUDY_ROUTE} className={SECONDARY}>
							Back to Study
						</Link>
						<button type="button" onClick={() => begin()} disabled={!items} className={PRIMARY} data-testid="check-start" autoFocus>
							{items ? "Start" : "Loading…"}
							<span className="q-kbd">
								<QIcon name="enter" />
							</span>
						</button>
					</div>
				</Dock>
			</Frame>
		);
	}

	const listening = step === "probes";
	const stepCount = listening ? items.probes.length : items.production.length;
	const answered = records.length + (answer ? 1 : 0);
	const score = answer?.record.score ?? 0;
	const good = listening ? score === 1 : score >= CLEAR_SCORE;
	const partly = !listening && !good && score >= PARTIAL_SCORE;
	const canCheck = draft.trim().length > 0 && (!listening || played);

	return (
		<Frame strip={false}>
			<TaskTop progress={answered / total} label={`${answered} of ${total} answered`} count={`${records.length + 1}/${total}`} href={STUDY_ROUTE} />

			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
				<div key={item.id} className={cn(COLUMN, "lh-rise")}>
					<PracticeCard icon={listening ? "listen" : "check"} title="Weekly check" sub={`${index + 1} of ${stepCount}`} right={`Week ${week} · ${language.name}`}>
						<h2 className="mb-5 font-prose text-[22px] font-semibold tracking-[-0.02em] text-foreground">{listening ? (!answer ? "Type what you hear" : good ? "Understood" : "It said…") : !answer ? `Write this in ${language.name}` : score === 1 ? "That is it" : "It is…"}</h2>

						{listening ? (
							<div className="flex flex-wrap items-center gap-3">
								<button
									type="button"
									onClick={playOnce}
									disabled={played}
									autoFocus
									aria-label="Play the sentence once"
									className="lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-sun-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2 disabled:cursor-not-allowed disabled:bg-well-2 disabled:text-ink-4 disabled:shadow-none"
									data-testid="check-play"
								>
									<Volume2Icon className={cn("size-6", playing && "animate-pulse motion-reduce:animate-none")} strokeWidth={1.6} />
								</button>
								<p className="font-ui text-[13px] text-ink-3" aria-live="polite">
									{answer ? "Played once." : playing ? "Playing…" : played ? "Played. It does not play again." : playFailed ? "The sentence could not be played, so it does not count as heard. Press play again." : "It plays once. Press play when you are ready."}
								</p>
							</div>
						) : (
							<p className="font-prose text-[26px] font-[550] leading-[1.35] tracking-[-0.02em] text-foreground" data-testid="check-prompt">
								{item.englishTranslation}
							</p>
						)}

						<div className="mt-6">
							<input
								ref={field}
								type="text"
								lang={language.code}
								autoComplete="off"
								autoCapitalize="off"
								spellCheck={false}
								autoFocus={!listening}
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key !== "Enter") return;
									e.preventDefault();
									if (canCheck) answerWith(draft.trim());
								}}
								disabled={!!answer}
								aria-label={listening ? "Type the sentence you heard" : `Write the sentence in ${language.name}`}
								placeholder={listening ? "Type what you hear" : `In ${language.name}`}
								className={FIELD}
								data-testid="check-input"
							/>
						</div>

						<div className="mt-6 min-h-[4.5rem]" data-testid="check-feedback">
							{answer ? (
								<div className="lh-rise">
									<p className="font-prose text-[30px] font-[550] leading-[1.4] tracking-[-0.025em] text-foreground" lang={language.code}>
										{item.targetSentence}
									</p>
									{!good && (
										<p className="mt-2 font-prose text-base text-ink-3">
											{answer.record.response ? (
												<>
													You typed · <span lang={language.code}>{answer.record.response}</span>
												</>
											) : listening ? (
												"Not caught"
											) : (
												"Not written"
											)}
										</p>
									)}
									{answer.missing.length > 0 && (
										<p className="mt-2 font-prose text-base text-ink-3">
											Missing ·{" "}
											<span className="text-miss" lang={language.code}>
												{answer.missing.join(", ")}
											</span>
										</p>
									)}
									{answer.extra.length > 0 && (
										<p className="mt-1 font-prose text-base text-ink-3">
											Not in the sentence · <span lang={language.code}>{answer.extra.join(", ")}</span>
										</p>
									)}
									{listening && <p className="mt-3 font-prose text-base text-ink-2">{item.englishTranslation}</p>}
								</div>
							) : (
								<p className="font-ui text-[13px] leading-relaxed text-ink-3">{listening ? "The text appears once you have typed what you heard." : "The sentence appears once you have written yours."}</p>
							)}
						</div>
					</PracticeCard>
				</div>
			</div>

			<Dock tone={!answer ? "plain" : good ? "right" : partly ? "wait" : "miss"} live>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					{answer ? (
						<>
							<p className={cn("flex items-center gap-2.5 font-ui text-[15px] font-[600] tracking-[-0.01em]", good ? "text-teal-2" : partly ? "text-ink-2" : "text-miss")} data-testid="check-verdict">
								<VerdictDisc ok={good || partly} />
								{listening ? (good ? (answer.record.verdict === "accents" ? "Understood on the first play · only an accent is missing" : "Understood on the first play") : answer.record.response ? "Not quite" : "Not caught this time") : `${Math.round(score * 100)}% of the words`}
							</p>
							<button type="button" onClick={advance} onKeyDown={(e) => {
									if (e.repeat) e.preventDefault();
								}} className={PRIMARY} data-testid="check-continue" autoFocus>
								{answered >= total ? "Finish" : "Continue"}
								<span className="q-kbd">
									<QIcon name="enter" />
								</span>
							</button>
						</>
					) : (
						<>
							<button type="button" onClick={() => answerWith("")} disabled={listening && !played} className={SECONDARY} data-testid="check-give-up">
								{listening ? "I didn't catch it" : "I don't know"}
							</button>
							<button type="button" onClick={() => answerWith(draft.trim())} disabled={!canCheck} className={PRIMARY} data-testid="check-check">
								Check
								<span className="q-kbd">
									<QIcon name="enter" />
								</span>
							</button>
						</>
					)}
				</div>
			</Dock>
		</Frame>
	);
}

function EndScreen({ week, language, other, records, save, onRetrySave, onOther }: { week: number; language: StudyLanguage; other: string | undefined; records: CheckItemRecord[]; save: SaveState; onRetrySave: () => void; onOther: (id: string) => void }) {
	const probes = records.filter((r) => r.type === "probe");
	const production = records.filter((r) => r.type === "production");
	const understood = probes.filter((r) => r.score === 1).length;
	const wordsRight = production.length > 0 ? Math.round((production.reduce((sum, r) => sum + r.score, 0) / production.length) * 100) : 0;
	const missed = records.filter((r) => (r.type === "probe" ? r.score < 1 : r.score < CLEAR_SCORE));
	return (
		<TaskEnd
			testId="check-end"
			hint={save === "failed" ? <NotSaved onRetry={onRetrySave} /> : <EnterHint>for Study</EnterHint>}
			actions={
				<>
					{other && (
						<button type="button" onClick={() => onOther(other)} className={SECONDARY} data-testid="check-other">
							Now {studyLanguage(other).name}
						</button>
					)}
					<Link href={STUDY_ROUTE} className={PRIMARY} data-testid="check-study">
						Study
					</Link>
				</>
			}
		>
			<p className="q-date flex items-center gap-1.5">
				<QIcon name="listen" className="text-teal" />
				Week {week} check · {language.name} · done
			</p>
			<h1 className="q-hello">
				{understood} of {probes.length} understood on the first play
			</h1>
			<Stats className="mt-7 max-w-none">
				<Stat label={`Words right in the ${production.length} sentences you wrote`} value={`${wordsRight}%`} />
				<Stat label="Saved to the study" value={save === "saving" ? null : save === "saved" ? "Yes" : "Not yet"} ink={save === "failed" ? "text-ink-3" : undefined} />
			</Stats>
			{missed.length > 0 && (
				<div className="mt-8">
					<h2 className="q-sh">Worth another look</h2>
					<SentenceRows className="mt-2">
						{missed.map((r) => (
							<SentenceRow
								key={`${r.type}:${r.itemId}`}
								sentence={r.expected}
								lang={language.code}
								translation={r.type === "production" ? r.prompt : undefined}
								onPlay={() => void new Audio(clipUrl(r.expected, language)).play().catch(() => {})}
								note={
									r.response ? (
										<span>
											You typed{" "}
											<span className="font-medium text-miss" lang={language.code}>
												“{r.response}”
											</span>
										</span>
									) : (
										<span>{r.type === "probe" ? "Not caught" : "Not written"}</span>
									)
								}
							/>
						))}
					</SentenceRows>
				</div>
			)}
		</TaskEnd>
	);
}
