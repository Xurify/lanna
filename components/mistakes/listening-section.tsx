"use client";

import Link from "next/link";
import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { AiCallout } from "@/components/ai-callout";
import { cn } from "@/lib/utils";
import { CAUSE_MIN_SENTENCES, LISTEN_CAUSES, LISTEN_KIND_LABEL, LISTEN_MIN_MISSED, LISTEN_MIN_SESSIONS, LISTEN_MIN_TYPED, type CauseTrend, type ListenAnalysis, type ListenGuideData, type MistakesReport, type Trend } from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

const pct = (x: number) => `${Math.round(x * 100)}%`;

// For a cause, "better" means it happens less often than before.
const TREND: Record<Trend, { label: string; ink: string }> = {
	better: { label: "less often", ink: "text-teal-2" },
	worse: { label: "more often", ink: "text-miss" },
	steady: { label: "no clear change", ink: "text-ink-3" },
	new: { label: "too few to compare", ink: "text-ink-3" },
};

function Heading({ children, line }: { children: React.ReactNode; line?: string }) {
	return (
		<>
			<h3 className="mt-6 text-[13px] font-semibold text-ink-2">{children}</h3>
			{line && <p className="mt-0.5 text-[12.5px] text-ink-3">{line}</p>}
		</>
	);
}

function CauseRow({ c }: { c: CauseTrend }) {
	const info = LISTEN_CAUSES[c.cause];
	const t = TREND[c.trend];
	return (
		<li className="flex flex-col gap-0.5 px-4 py-3" data-testid={`listening-cause-${c.cause}`}>
			<div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
				<span className="text-[15px] font-[550] text-foreground">{info.label}</span>
				<span className="q-pill grey">{LISTEN_KIND_LABEL[info.kind]}</span>
				<span className="q-num ml-auto text-[13px] text-ink-2">
					{c.recent !== null && c.earlier !== null ? (
						<>
							{c.recent} in 100 sentences lately, {c.earlier} before · <span className={cn("font-semibold", t.ink)}>{t.label}</span>
						</>
					) : (
						<>
							{c.count} {c.count === 1 ? "time" : "times"}
						</>
					)}
				</span>
			</div>
			<p className="text-[12.5px] leading-snug text-ink-3">{info.line}</p>
		</li>
	);
}

const DEEP_ADDS = [
	"Connects the figures: for example short words dropped with a worse second half, or fast clips typed correctly less often",
	"Keeps hearing apart from grammar, spelling and typing, and sends each to the right practice",
	"Points out what you would not see from the figures one at a time, and says when that is a guess",
	"Reads the weekly counts for what changed, but calls a trend only where the test above did",
	"Gives tips for this week, each tied to what it answers",
	"Writes what to practice this week, in the app's own tasks",
];

function DeepBody({ data }: { data: ListenGuideData }) {
	const lang = useActiveLanguage();
	// A read saved before these two existed has neither.
	const noticed = data.noticed ?? [];
	const tips = data.tips ?? [];
	return (
		<div className="flex flex-col gap-5" data-testid="listen-guide-body">
			{data.summary && <p className="text-[15px] leading-relaxed text-foreground">{data.summary}</p>}
			{data.patterns.length > 0 && (
				<div className="flex flex-col gap-3">
					<h4 className="q-lbl">What the misses share</h4>
					{data.patterns.map((p) => (
						<article key={p.title} className="rounded-xl bg-well p-4">
							<h5 className="text-sm font-semibold text-foreground">{p.title}</h5>
							{p.evidence && (
								<p className="mt-1 text-sm text-ink-3" lang={lang?.code}>
									{p.evidence}
								</p>
							)}
							<dl className="mt-2 grid gap-x-3 gap-y-1 text-sm text-foreground sm:grid-cols-[4rem_1fr]">
								<dt className="text-xs font-semibold text-ink-3">Why</dt>
								<dd>{p.why}</dd>
								{p.fix && (
									<>
										<dt className="text-xs font-semibold text-ink-3">Fix</dt>
										<dd>{p.fix}</dd>
									</>
								)}
							</dl>
						</article>
					))}
				</div>
			)}
			{noticed.length > 0 && (
				<div>
					<h4 className="q-lbl">What you may not have noticed</h4>
					<ul className="mt-2 flex flex-col gap-2.5 text-sm text-foreground">
						{noticed.map((n) => (
							<li key={n.what}>
								<b className="font-semibold">{n.what}.</b> <span className="text-ink-2">{n.why}</span>
							</li>
						))}
					</ul>
				</div>
			)}
			{tips.length > 0 && (
				<div>
					<h4 className="q-lbl">Tips</h4>
					<ul className="mt-2 flex flex-col gap-2.5 text-sm text-foreground">
						{tips.map((t) => (
							<li key={t.tip} className="rounded-xl bg-teal-wash px-3.5 py-2.5">
								{t.tip}
								{t.why && <span className="mt-0.5 block text-xs text-ink-3">{t.why}</span>}
							</li>
						))}
					</ul>
				</div>
			)}
			{data.trends.length > 0 && (
				<div>
					<h4 className="q-lbl">Over time</h4>
					<ul className="mt-2 flex flex-col gap-2 text-sm text-foreground">
						{data.trends.map((t) => (
							<li key={t.what}>
								<b className="font-semibold">{t.what}.</b> <span className="text-ink-2">{t.read}</span>
							</li>
						))}
					</ul>
				</div>
			)}
			{data.next.length > 0 && (
				<div>
					<h4 className="q-lbl">This week</h4>
					<ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground marker:text-ink-4">
						{data.next.map((n) => (
							<li key={n}>{n}</li>
						))}
					</ul>
				</div>
			)}
			{data.limits && <p className="text-xs leading-relaxed text-ink-3">{data.limits}</p>}
		</div>
	);
}

/** The deep read: one model call over the figures above, written once per set of figures. The page shows the saved one without a call. */
function DeepRead({ report, busy, error, onWrite }: { report: MistakesReport; busy: boolean; error: string | null; onWrite: (force: boolean) => void }) {
	const { listenGuide: guide, listenGuideCurrent: current, ai } = report;
	return (
		<section className="q-card mt-6 p-5" aria-labelledby="listen-guide-title" data-testid="listen-guide">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h3 id="listen-guide-title" className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em] text-foreground">
					<SparklesIcon className="size-4 text-teal" strokeWidth={1.6} aria-hidden="true" />
					Deep read
				</h3>
				{guide && (
					<p className="text-xs text-ink-3" suppressHydrationWarning>
						Written {new Date(guide.at).toLocaleDateString(undefined, { dateStyle: "medium" })}
						{current ? "" : " · your listening has changed since"}
					</p>
				)}
			</div>
			{guide ? (
				<div className="mt-3">{guide.data ? <DeepBody data={guide.data} /> : <p className="whitespace-pre-wrap text-sm text-foreground">{guide.text}</p>}</div>
			) : ai.ready ? (
				<p className="mt-2 text-sm text-ink-3">An AI teacher reads the figures above and the sentences you missed, finds what they share and says what to practice. It uses your main AI model and runs once per set of figures.</p>
			) : (
				<AiCallout status={ai} title="Turn on AI for a deeper read" adds={DEEP_ADDS} className="mt-3" />
			)}
			{error && (
				<p role="alert" className="mt-3 text-sm text-miss" data-testid="listen-guide-error">
					{error}
				</p>
			)}
			{ai.ready && (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<button type="button" disabled={busy || (!!guide && !!current)} onClick={() => onWrite(false)} className="q-btn sec pointer-coarse:min-h-11" data-testid="listen-guide-write">
						{busy ? <LoaderCircleIcon className="q-ico animate-spin" /> : <SparklesIcon className="q-ico" />}
						{guide ? (current ? "Deep read is up to date" : "Read it again") : "Analyze my listening"}
					</button>
					<p className="text-xs text-ink-3" data-testid="listen-guide-privacy">
						Sends the figures on this page and the sentences you missed, with what you typed, to your model provider. Nothing else leaves this computer.
					</p>
				</div>
			)}
			{!ai.ready && guide && <AiCallout status={ai} title="AI is off, so this read cannot be refreshed" adds={[]} className="mt-4" />}
		</section>
	);
}

/** What the Listen task says about hearing: how it is going, why sentences were missed, and whether that is changing. The figures are local, no model; the deep read is the optional model call. */
export function ListeningSection({ l, report, busy, error, onWrite }: { l: ListenAnalysis; report: MistakesReport; busy: boolean; error: string | null; onWrite: (force: boolean) => void }) {
	const lang = useActiveLanguage();
	if (l.sentences === 0) return null;
	const from = l.from === l.to ? l.from : `${l.from} to ${l.to}`;
	return (
		<section className="mt-9" aria-labelledby="mistakes-listening-title" data-testid="mistakes-listening">
			<h2 id="mistakes-listening-title" className="q-sh">
				Listening
			</h2>
			<p className="-mt-1 mb-3 text-[13px] text-ink-3">
				From the Listen task, {l.sentences} {l.sentences === 1 ? "sentence" : "sentences"} in {l.sessions} {l.sessions === 1 ? "session" : "sessions"} ({from}). Each typed sentence is compared with what was said, word by word. Meanings picked before Listen became typing-only count as right when the right one was picked, but give no cause.
			</p>
			<div className="q-card p-4">
				<p className="text-[15px] text-foreground">
					<b className="q-num font-semibold">{pct(l.right)}</b> typed correctly
					{l.range && l.sentences < 100 ?<span className="text-ink-3">, likely between {pct(l.range.low)} and {pct(l.range.high)}</span> : null}
					<span className="text-ink-3"> · {l.typed} typed</span>
				</p>
				{l.weeks.length >= 2 && (
					<ol className="mt-3 flex items-end gap-2" aria-label="Sentences typed correctly by week">
						{l.weeks.map((w) => (
							<li key={w.week} className="flex min-w-0 flex-1 flex-col items-center gap-1">
								<span className="q-num text-xs font-semibold text-ink-2">{w.few ? "few" : pct(w.right / w.reps)}</span>
								<span className="flex h-16 w-full items-end rounded-md bg-well-2">
									{!w.few && <span className="w-full rounded-md bg-teal" style={{ height: `${Math.max(4, Math.round((w.right / w.reps) * 100))}%` }} />}
								</span>
								<span className="text-xs text-ink-3" title={`${w.reps} sentences`}>
									{w.week.slice(5)}
								</span>
							</li>
						))}
					</ol>
				)}
			</div>

			{!l.ready ? (
				<p className="mt-3 text-[13px] text-ink-3" data-testid="listening-notready">
					Why sentences are missed shows once there is enough to tell a pattern from chance: {LISTEN_MIN_TYPED} typed sentences (<span className="q-num">{l.readable}</span> so far), {LISTEN_MIN_MISSED} of them with a miss (<span className="q-num">{l.read}</span>), over {LISTEN_MIN_SESSIONS} sessions (<span className="q-num">{l.readSessions}</span>). Every{" "}
					<Link href="/listen" className="underline underline-offset-2 hover:text-foreground">
						Listen
					</Link>{" "}
					session adds ten.
				</p>
			) : (
				<>
					<Heading line="Every difference between what was said and what you typed, grouped by what it most likely was.">What goes wrong</Heading>
					{l.kinds.length > 0 && (
						<p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" data-testid="listening-kinds">
							{l.kinds.map((k) => (
								<span key={k.kind}>
									<b className="q-num font-semibold">{pct(k.share)}</b> {k.label.toLowerCase()}
								</span>
							))}
						</p>
					)}
					<ul className="q-card mt-2 divide-y divide-[var(--q-line)]" data-testid="listening-causes">
						{l.causes.slice(0, 7).map((c) => (
							<CauseRow key={c.cause} c={c} />
						))}
					</ul>
					{l.rare > 0 && (
						<p className="mt-1.5 text-[12.5px] text-ink-3">
							{l.rare} more {l.rare === 1 ? "difference" : "differences"} with a cause seen in fewer than {CAUSE_MIN_SENTENCES} sentences, not listed.
						</p>
					)}

					<Heading line="Effort says how hard a sentence was to catch, whatever the words.">Signals</Heading>
					<ul className="q-card mt-2 divide-y divide-[var(--q-line)] text-[14px] text-ink-2" data-testid="listening-signals">
						{l.replays.recent !== null && (
							<li className="px-4 py-2.5">
								Plays after the first: <b className="q-num font-semibold">{l.replays.recent.toFixed(1)}</b> a sentence lately{l.replays.earlier !== null ? `, ${l.replays.earlier.toFixed(1)} before` : ""}
							</li>
						)}
						{l.peeked.recent !== null && (
							<li className="px-4 py-2.5">
								Text shown before answering: <b className="q-num font-semibold">{pct(l.peeked.recent)}</b> of sentences lately{l.peeked.earlier !== null ? `, ${pct(l.peeked.earlier)} before` : ""}
							</li>
						)}
						{l.pace ? (
							<li className="px-4 py-2.5">
								Slow clips (under {l.pace.slowBelow} syllables a second): <b className="q-num font-semibold">{pct(l.pace.slow.right / l.pace.slow.reps)}</b> typed correctly. Fast clips (over {l.pace.fastAbove}): <b className="q-num font-semibold">{pct(l.pace.fast.right / l.pace.fast.reps)}</b>.
								{l.pace.fastHarder ? " Speed, more than any single word, is where it goes." : ""}
							</li>
						) : null}
					</ul>

					{(l.insights ?? []).length > 0 && (
						<>
							<Heading line="Found by a stricter test than the trends, so it needs many sentences before it shows anything.">Things you may not have noticed</Heading>
							<ul className="q-card mt-2 divide-y divide-[var(--q-line)]" data-testid="listening-insights">
								{l.insights.map((i) => (
									<li key={i.id} className="px-4 py-3" data-testid={`listening-insight-${i.id}`}>
										<p className="text-[15px] font-[550] text-foreground">{i.title}</p>
										<p className="mt-0.5 text-[13px] leading-snug text-ink-2">{i.line}</p>
										{i.id === "repeat" && (
											<ul className="mt-2 flex flex-wrap gap-1.5">
												{l.repeats.map((w) => (
													<li key={w.word} className="q-pill grey">
														<span lang={lang?.code}>{w.word}</span>
														{w.typedAs.length > 0 && (
															<>
																{" "}→ <span lang={lang?.code}>{w.typedAs.join(", ")}</span>
															</>
														)}
													</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ul>
						</>
					)}

					<DeepRead report={report} busy={busy} error={error} onWrite={onWrite} />

					{l.misses.length > 0 && (
						<>
							<Heading>Latest misses</Heading>
							<ul className="q-card mt-2 divide-y divide-[var(--q-line)]" data-testid="listening-misses">
								{l.misses.slice(0, 5).map((m) => (
									<li key={`${m.at}-${m.sentence}`} className="px-4 py-3">
										<p className="font-prose text-[16px] text-foreground" lang={lang?.code}>
											{m.sentence}
										</p>
										<p className="mt-0.5 text-[13px] text-ink-3">
											You typed <span lang={lang?.code}>{m.given || "nothing"}</span>
										</p>
										<ul className="mt-1 flex flex-wrap gap-1.5">
											{m.errors.map((e, i) => (
												<li key={i} className="q-pill grey" title={LISTEN_CAUSES[e.cause].line}>
													<span lang={lang?.code}>{e.target || "+"}</span>
													{e.given && e.target ? <> → <span lang={lang?.code}>{e.given}</span></> : e.target ? " missed" : <> “{e.given}” added</>} · {LISTEN_CAUSES[e.cause].label.toLowerCase()}
												</li>
											))}
										</ul>
									</li>
								))}
							</ul>
						</>
					)}
				</>
			)}
		</section>
	);
}
