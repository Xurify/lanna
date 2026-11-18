"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cellLabel, type SpeakingReport } from "@/src/core";
import { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";

function minutes(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-b border-[var(--q-line)] py-2 last:border-0">
			<dt className="font-ui text-[13px] text-ink-3">{label}</dt>
			<dd className="font-prose text-[15px] tabular-nums text-foreground">{value}</dd>
		</div>
	);
}

export function SessionReport({
	report,
	next,
	onAgain,
	againHref,
}: {
	report: SpeakingReport;
	next: { step: string; needs: string[] } | null;
	onAgain: () => void;
	againHref: string;
}) {
	const m = report.metrics;
	const pct = (x: number) => `${Math.round(x * 100)}%`;
	return (
		<div className="mx-auto max-w-3xl px-5 pt-8 pb-24" data-testid="live-report">
			<p className="font-ui text-[12px] font-[550] text-ink-3">
				{report.kind === "island" ? "Island talk" : "Scene talk"} · {report.level}
			</p>
			<h1 className="mt-1 font-ui text-[28px] font-[600] leading-tight tracking-[-0.02em] text-foreground">
				{report.title}
			</h1>
			<p className="mt-2 max-w-prose font-prose text-[15px] text-ink-2">
				{report.approximate
					? "The counts came from your voice. Your words are the voice engine's transcript, so the wording may be a little off."
					: "Your lines were transcribed from your own voice, so the quotes below are what you said."}
			</p>

			<dl className="mt-6" data-testid="live-metrics">
				<Row label="Talk" value={minutes(m.talkSec)} />
				<Row label="You spoke" value={`${pct(m.learnerShare)} · ${minutes(m.learnerSec)}`} />
				<Row
					label="Replies"
					value={m.medianReplyMs == null ? "Not timed" : `median ${(m.medianReplyMs / 1000).toFixed(1)} s`}
				/>
				<Row label="Pace" value={`${m.syllablesPerMinute} syllables/min`} />
				<Row
					label="English words"
					value={m.words ? `${m.englishWords} of ${m.words} (${pct(m.englishShare)})` : "None said"}
				/>
				<Row label="Pauses over a second" value={m.pausesOver1s ? `${m.pausesOver1s}` : "None"} />
			</dl>

			{report.fillers.english.length > 0 && (
				<p className="mt-4 max-w-prose font-prose text-[14px] text-ink-2">
					You filled pauses with English: {report.fillers.english.map((e) => `“${e.word}” ×${e.count}`).join(", ")}. The
					target language has its own for that.
				</p>
			)}

			{report.judged ? (
				<>
					{report.strengths.length > 0 && (
						<section className="mt-8" aria-labelledby="report-good">
							<h2 id="report-good" className="q-sh">
								What went well
							</h2>
							<ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 font-prose text-[15px] text-foreground marker:text-ink-4">
								{report.strengths.map((s) => (
									<li key={s}>{s}</li>
								))}
							</ul>
						</section>
					)}

					{report.improve.length > 0 && (
						<section className="mt-8" aria-labelledby="report-better">
							<h2 id="report-better" className="q-sh">
								Said better
							</h2>
							<ul className="mt-2 flex flex-col divide-y divide-[var(--q-line)]">
								{report.improve.map((line) => (
									<li key={`${line.turn}-${line.yours}`} className="py-2.5">
										<p className="font-prose text-[14px] text-ink-3" lang={report.lang}>
											{line.yours}
										</p>
										<p className="mt-0.5 font-prose text-[15px] text-foreground" lang={report.lang}>
											{line.right}
										</p>
										<p className="mt-1 font-prose text-[13px] text-ink-3">{line.why}</p>
									</li>
								))}
							</ul>
						</section>
					)}

					{report.slips.length > 0 && (
						<section className="mt-8" aria-labelledby="report-slips">
							<h2 id="report-slips" className="q-sh">
								Worth repairing
							</h2>
							<ul className="mt-2 flex flex-col divide-y divide-[var(--q-line)]">
								{report.slips.map((slip) => (
									<li key={`${slip.turn}-${slip.yours}`} className="py-2.5">
										<p className="font-prose text-[14px] text-ink-3" lang={report.lang}>
											{slip.yours}
										</p>
										<p className="mt-0.5 font-prose text-[15px] text-foreground" lang={report.lang}>
											{slip.right}
										</p>
										<p className="mt-1 font-prose text-[13px] text-ink-3">
											{slip.rule ? `${slip.rule} · ` : ""}
											{slip.cell ? cellLabel(`${slip.cell.row}:${slip.cell.col}`) : slip.kind}
										</p>
									</li>
								))}
							</ul>
						</section>
					)}

					{report.complexity && (
						<section className="mt-8" aria-labelledby="report-range">
							<h2 id="report-range" className="q-sh">
								How far you reached
							</h2>
							<p className="mt-1 max-w-prose font-prose text-[15px] text-ink-2">
								{[
									report.complexity.past ? "past reference" : "",
									report.complexity.future ? "future reference" : "",
									report.complexity.clauses.length ? `connectors: ${report.complexity.clauses.join(", ")}` : "",
									report.complexity.aspectPairs ? `${report.complexity.aspectPairs} aspect pairs` : "",
								]
									.filter(Boolean)
									.join(" · ") || "Short, present-tense lines this time."}
							</p>
							{report.complexity.note && (
								<p className="mt-1 font-prose text-[14px] text-ink-3">{report.complexity.note}</p>
							)}
						</section>
					)}
				</>
			) : (
				<p className="mt-6 max-w-prose font-prose text-[14px] text-ink-2">
					No AI model was set, so this report has the counts only. Everything above was measured from your voice; what
					was said well, what to repair and the phrases to keep need a model.
				</p>
			)}

			{report.fillers.used.length > 0 && (
				<section className="mt-8" aria-labelledby="report-fillers">
					<h2 id="report-fillers" className="q-sh">
						Fillers you used
					</h2>
					<p className="mt-1 font-prose text-[15px] text-ink-2" lang={report.lang}>
						{report.fillers.used.map((f) => `${f.sk} ×${f.count}`).join(" · ")}
					</p>
				</section>
			)}

			{report.recommended.length > 0 && (
				<section className="mt-8" aria-labelledby="report-next-fillers">
					<h2 id="report-next-fillers" className="q-sh">
						Three to try next time
					</h2>
					<ul className="mt-2 flex flex-col gap-1.5">
						{report.recommended.map((f) => (
							<li key={f.sk} className="font-prose text-[15px] text-foreground">
								<span lang={report.lang}>{f.sk}</span>{" "}
								<span className="text-ink-3">
									— {f.en}, {f.why}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}

			{report.newChunks.length > 0 && (
				<section className="mt-8" aria-labelledby="report-chunks">
					<h2 id="report-chunks" className="q-sh">
						Worth keeping
					</h2>
					<ul className="mt-2 flex flex-col gap-1.5">
						{report.newChunks.map((c) => (
							<li key={c.sk} className="font-prose text-[15px] text-foreground">
								<span lang={report.lang}>{c.sk}</span> <span className="text-ink-3">— {c.en}</span>
							</li>
						))}
					</ul>
				</section>
			)}

			{next && (
				<section className="mt-8 rounded-xl bg-well p-4" aria-labelledby="report-island-next">
					<h2 id="report-island-next" className="font-ui text-[13px] font-[600] text-ink-2">
						The island is at {next.step}
					</h2>
					<ul className="mt-1 flex list-disc flex-col gap-1 pl-5 font-prose text-[14px] text-ink-2 marker:text-ink-4">
						{next.needs.map((need) => (
							<li key={need}>{need}</li>
						))}
					</ul>
				</section>
			)}

			<div className="mt-9 flex flex-wrap items-center gap-3">
				<button type="button" onClick={onAgain} className={PRIMARY} data-testid="live-again">
					Talk again
				</button>
				<Link href={againHref} className={SECONDARY}>
					{report.kind === "island" ? "Back to the island" : "Back to Speak"}
					<ArrowRightIcon className="size-4" />
				</Link>
				<p className="font-ui text-[12px] text-ink-3">+{report.xp} XP</p>
			</div>
		</div>
	);
}
