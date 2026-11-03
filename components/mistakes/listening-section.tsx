"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { LISTEN_CAUSES, LISTEN_KIND_LABEL, LISTEN_MIN_TYPED, type CauseTrend, type ListenAnalysis, type Trend } from "@/src/core";

const pct = (x: number) => `${Math.round(x * 100)}%`;

// For a cause, "better" means it happens less often than before.
const TREND: Record<Trend, { label: string; ink: string }> = {
	better: { label: "less often", ink: "text-teal-2" },
	worse: { label: "more often", ink: "text-miss" },
	steady: { label: "about the same", ink: "text-ink-3" },
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

/** What the Listen task says about hearing: how it is going, why sentences were missed, and whether that is changing. Local, no model. */
export function ListeningSection({ l }: { l: ListenAnalysis }) {
	if (l.sentences === 0) return null;
	const from = l.from === l.to ? l.from : `${l.from} to ${l.to}`;
	return (
		<section className="mt-9" aria-labelledby="mistakes-listening-title" data-testid="mistakes-listening">
			<h2 id="mistakes-listening-title" className="q-sh">
				Listening
			</h2>
			<p className="-mt-1 mb-3 text-[13px] text-ink-3">
				From the Listen task, {l.sentences} {l.sentences === 1 ? "sentence" : "sentences"} in {l.sessions} {l.sessions === 1 ? "session" : "sessions"} ({from}). A typed sentence is compared with what was said, word by word; a picked meaning shows only whether you understood it, not why.
			</p>
			<div className="q-card p-4">
				<p className="text-[15px] text-foreground">
					<b className="q-num font-semibold">{pct(l.right)}</b> understood
					{l.range && l.sentences < 40 ? <span className="text-ink-3">, likely between {pct(l.range.low)} and {pct(l.range.high)}</span> : null}
					<span className="text-ink-3"> · {l.typed} typed</span>
				</p>
				{l.weeks.length >= 2 && (
					<ol className="mt-3 flex items-end gap-2" aria-label="Sentences understood by week">
						{l.weeks.map((w) => (
							<li key={w.week} className="flex min-w-0 flex-1 flex-col items-center gap-1">
								<span className="q-num text-xs font-semibold text-ink-2">{pct(w.right / w.reps)}</span>
								<span className="flex h-16 w-full items-end rounded-md bg-well-2">
									<span className="w-full rounded-md bg-teal" style={{ height: `${Math.max(4, Math.round((w.right / w.reps) * 100))}%` }} />
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
					The causes appear after {LISTEN_MIN_TYPED} typed sentences with their words recorded; there {l.read === 1 ? "is" : "are"} {l.read} with a miss so far. Choose <b className="font-semibold text-ink-2">Type it</b> on{" "}
					<Link href="/listen" className="underline underline-offset-2 hover:text-foreground">
						Listen
					</Link>{" "}
					to give it something to read.
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
								Slow clips (under {l.pace.slowBelow} syllables a second): <b className="q-num font-semibold">{pct(l.pace.slow!.right / l.pace.slow!.reps)}</b> understood. Fast clips (over {l.pace.fastAbove}): <b className="q-num font-semibold">{pct(l.pace.fast!.right / l.pace.fast!.reps)}</b>.
								{l.pace.fast!.right / l.pace.fast!.reps < l.pace.slow!.right / l.pace.slow!.reps - 0.15 ? " Speed, more than any single word, is where it goes."  : ""}
							</li>
						) : null}
					</ul>

					{l.misses.length > 0 && (
						<>
							<Heading>Latest misses</Heading>
							<ul className="q-card mt-2 divide-y divide-[var(--q-line)]" data-testid="listening-misses">
								{l.misses.slice(0, 5).map((m) => (
									<li key={`${m.at}-${m.sentence}`} className="px-4 py-3">
										<p className="font-prose text-[16px] text-foreground" lang="sk">
											{m.sentence}
										</p>
										<p className="mt-0.5 text-[13px] text-ink-3">
											You typed <span lang="sk">{m.given || "nothing"}</span>
										</p>
										<ul className="mt-1 flex flex-wrap gap-1.5">
											{m.errors.map((e, i) => (
												<li key={i} className="q-pill grey" title={LISTEN_CAUSES[e.cause].line}>
													<span lang="sk">{e.target || "+"}</span>
													{e.given && e.target ? <> → <span lang="sk">{e.given}</span></> : e.target ? " missed" : <> “{e.given}” added</>} · {LISTEN_CAUSES[e.cause].label.toLowerCase()}
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
