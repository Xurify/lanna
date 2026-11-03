"use client";

/**
 * My mistakes (/mistakes, LangHarness 2026-11-01): what the lesson log says
 * about where you go wrong and whether it is getting better, when it was
 * last read, and an optional personal guide written from it. The analysis
 * is local and free; only the guide uses a model, and only when asked.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CompassIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { FORM_SLIPS, FORM_SLIP_LABEL, guideReadiness, RANGE_SHOWN_UNDER, WEAK_BAR, type GuideData, type MistakeAnalysis, type MistakesReport, type Trend, type UnitTrend } from "@/src/core";
import { AiCallout } from "@/components/ai-callout";
import { SettingsLink } from "@/components/settings/settings-link";

const TREND: Record<Trend, { label: string; ink: string }> = {
	better: { label: "Getting better", ink: "text-teal-2" },
	worse: { label: "Getting worse", ink: "text-miss" },
	steady: { label: "Steady", ink: "text-ink-3" },
	new: { label: "Too few answers to say", ink: "text-ink-3" },
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function MistakesPage({ initial }: { initial: MistakesReport | null }) {
	const [report, setReport] = useState<MistakesReport | null>(initial);
	const [busy, setBusy] = useState<"analyze" | "guide" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const run = async (action: "analyze" | "guide", force = false) => {
		setBusy(action);
		setError(null);
		try {
			const res = await fetch("/api/mistakes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, force }) });
			const body = await res.json();
			if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
			setReport(body as MistakesReport);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(null);
		}
	};

	const a = report?.analysis ?? null;
	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="mistakes">
				<Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="q-ico size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">My mistakes</h1>
				<p className="q-line dim mt-2 max-w-2xl">Read from your first tries: the answer you gave before any hint. A miss you then got right still counts here, because that is the one to work on.</p>

				<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="mistakes-when">
					<p className="q-date">
						{a ? (
							<>
								Last analyzed{" "}
								<time dateTime={a.at} suppressHydrationWarning className="font-semibold text-ink-2">
									{new Date(a.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
								</time>
								{a.from ? ` · ${a.reps} first tries, ${a.from} to ${a.to}` : ""}
							</>
						) : (
							"Not analyzed yet."
						)}
					</p>
					<button type="button" onClick={() => void run("analyze")} disabled={busy !== null} className="q-btn sec pointer-coarse:min-h-11" data-testid="mistakes-analyze">
						{busy === "analyze" ? <LoaderCircleIcon className="q-ico animate-spin" /> : <RefreshCwIcon className="q-ico" />}
						Analyze now
					</button>
				</div>
				{error && (
					<p role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-miss" data-testid="mistakes-error">
						{error}
						{/Settings/.test(error) && (
							<SettingsLink keys={/key/i.test(error)} className="text-xs font-semibold text-ink-2 underline underline-offset-2">
								Open Settings
							</SettingsLink>
						)}
					</p>
				)}

				{a && a.reps === 0 ? (
					<section className="q-card mt-8 p-5" data-testid="mistakes-empty">
						<p className="text-base text-foreground">There are no answers to read yet.</p>
						<p className="mt-1 text-sm text-ink-3">Finish a lesson and come back: your first tries show up here.</p>
						<Link href="/" className="q-btn sec mt-3 pointer-coarse:min-h-11">
							Go to Today
						</Link>
					</section>
				) : (
					a && (
						<>
							<NextSteps a={a} />
							<GuideCard report={report!} busy={busy === "guide"} onWrite={(force) => void run("guide", force)} />
							<MixupsSection a={a} />
							<UnitsSection units={a.units} />
							<WordsSection a={a} />
							<WeeksSection a={a} />
						</>
					)
				)}
			</main>
		</div>
	);
}

function Section({ id, title, line, children }: { id: string; title: string; line?: string; children: React.ReactNode }) {
	return (
		<section className="mt-9" aria-labelledby={`${id}-title`} data-testid={id}>
			<h2 id={`${id}-title`} className="q-sh">
				{title}
			</h2>
			{line && <p className="-mt-1 mb-3 text-[13px] text-ink-3">{line}</p>}
			<div>{children}</div>
		</section>
	);
}

const STEP_HREF = (p: GuideData["plan"][number]): string | null => (p.kind === "mixups" ? "/lesson?mode=mixups" : p.kind === "unit" && p.unit ? `/lesson?unit=${p.unit}` : p.kind === "review" ? "/review" : null);

/** The guide as the model wrote it: the patterns behind the misses, what may
 *  trip you next (said as guesses), and a plan whose steps open the app. */
function GuideBody({ data }: { data: GuideData }) {
	return (
		<div className="flex flex-col gap-5" data-testid="guide-body">
			<div className="flex flex-col gap-3">
				<h3 className="q-lbl">What keeps going wrong</h3>
				{data.patterns.map((p) => (
					<article key={p.title} className="rounded-xl bg-well p-4">
						<h4 className="text-sm font-semibold text-foreground">{p.title}</h4>
						{p.evidence && (
							<p className="mt-1 text-sm text-ink-3" lang="sk">
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
			{data.next.length > 0 && (
				<div>
					<h3 className="q-lbl">What may trip you next</h3>
					<p className="mt-1 text-xs text-ink-3">Guesses from your pairs and trends, not tested yet.</p>
					<ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground marker:text-ink-4">
						{data.next.map((n) => (
							<li key={n.what}>
								<b>{n.what}</b>
								{n.why ? ` — ${n.why}` : ""}
							</li>
						))}
					</ul>
				</div>
			)}
			{data.plan.length > 0 && (
				<div>
					<h3 className="q-lbl">Do this week</h3>
					<ul className="mt-2 flex flex-col divide-y divide-border rounded-xl bg-well">
						{data.plan.map((p) => {
							const href = STEP_HREF(p);
							return (
								<li key={p.step} className="flex items-center justify-between gap-3 px-3 py-2">
									<span className="text-sm text-foreground">{p.step}</span>
									{href && (
										<Link href={href} className="q-btn sec shrink-0 pointer-coarse:min-h-11">
											Open
											<ArrowRightIcon className="q-ico" />
										</Link>
									)}
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}

/** A reply that could not be read as the three parts is shown as it came. */
function GuideText({ text }: { text: string }) {
	return <p className="whitespace-pre-line text-sm text-foreground">{text}</p>;
}

const GUIDE_ADDS = [
	"Finds the pattern behind several mistakes, not just how many there were",
	"Explains why it happens and how to fix it, from your own wrong sentences",
	"Guesses what may trip you next, beyond the word pairs the app already knows",
	"Writes a plan for the week, with a button for each step",
	"Builds a personal lesson on the words, pairs and units it picked, from the app's checked sentences",
];

/** How far the evidence is from enough for a guide: a pattern read from a
 *  handful of answers would be a guess dressed as a finding. */
function Readiness({ enough }: { enough: ReturnType<typeof guideReadiness> }) {
	const bars = [
		{ label: "First tries", have: enough.reps, need: enough.needReps },
		{ label: "Mistakes among them", have: enough.wrong, need: enough.needWrong },
	];
	return (
		<div className="q-well mt-4" data-testid="guide-readiness">
			<p className="text-[13px] font-semibold text-ink-2">Needs a few more lessons first</p>
			<p className="mt-1 text-xs text-ink-3">
				With too few answers, the guide would be guessing. It unlocks at {enough.needReps} first tries with {enough.needWrong} mistakes among them.
			</p>
			<dl className="mt-3 grid gap-3 sm:grid-cols-2">
				{bars.map((b) => (
					<div key={b.label}>
						<div className="flex items-baseline justify-between gap-2 text-xs">
							<dt className="font-semibold text-ink-3">{b.label}</dt>
							<dd className="tabular-nums text-ink-2">
								{Math.min(b.have, b.need)} of {b.need}
							</dd>
						</div>
						<div className="q-bar mt-1.5" aria-hidden="true">
							<i style={{ width: `${Math.round(Math.min(1, b.have / b.need) * 100)}%`, background: "var(--q-teal)" }} />
						</div>
					</div>
				))}
			</dl>
		</div>
	);
}

function GuideCard({ report, busy, onWrite }: { report: MistakesReport; busy: boolean; onWrite: (force: boolean) => void }) {
	const { guide, guideCurrent, ai } = report;
	const enough = guideReadiness(report.analysis);
	return (
		<section className="q-card mt-9 p-5" aria-labelledby="guide-title" data-testid="mistakes-guide">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h2 id="guide-title" className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em] text-foreground">
					<CompassIcon className="size-4 text-teal" strokeWidth={1.6} aria-hidden="true" />
					Your guide
				</h2>
				{guide && (
					<p className="text-xs text-ink-3" suppressHydrationWarning>
						Written {new Date(guide.at).toLocaleDateString(undefined, { dateStyle: "medium" })}
						{guideCurrent ? "" : " · your answers have changed since"}
					</p>
				)}
			</div>
			{guide?.practice && (
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-wash p-4" data-testid="guide-practice">
					<div className="min-w-0">
						<p className="text-sm font-semibold text-teal-2">Your plan practice</p>
						<p className="text-xs text-ink-3">
							Built from checked sentences on: <span lang="sk">{guide.practice.shown.join(", ")}</span>
						</p>
					</div>
					<Link href="/lesson?mode=personal" className="q-btn primary shrink-0 pointer-coarse:min-h-11" data-testid="guide-practice">
						Practice your plan
						<ArrowRightIcon className="q-ico" />
					</Link>
				</div>
			)}
			{guide ? (
				<div className="mt-3">{guide.data ? <GuideBody data={guide.data} /> : <GuideText text={guide.text} />}</div>
			) : ai.ready ? (
				<p className="mt-2 text-sm text-ink-3">An AI teacher reads your wrong answers and writes what keeps going wrong, why, and what to do about it. It uses your Strong model (Cheap when Strong is empty) and runs once per set of answers.</p>
			) : (
				<AiCallout status={ai} title="Turn on AI for a deeper read" adds={GUIDE_ADDS} className="mt-3" />
			)}
			{!enough.ready && !(guide && guideCurrent) && <Readiness enough={enough} />}
			{ai.ready && (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<button type="button" disabled={busy || !enough.ready || (!!guide && guideCurrent)} onClick={() => onWrite(false)} className="q-btn sec pointer-coarse:min-h-11" data-testid="mistakes-write-guide">
						{busy ? <LoaderCircleIcon className="q-ico animate-spin" /> : <SparklesIcon className="q-ico" />}
						{guide ? (guideCurrent ? "Guide is up to date" : "Write it again") : "Write my guide"}
					</button>
					<p className="text-xs text-ink-3" data-testid="guide-privacy">
						Sends your unit scores, the words you miss or mix up, and your latest wrong sentences with what you wrote to your model provider. Nothing else leaves this computer.
					</p>
				</div>
			)}
			{!ai.ready && guide && <AiCallout status={ai} title="AI is off, so this guide cannot be refreshed" adds={[]} className="mt-4" />}
		</section>
	);
}

/** What to do about it, worked out from the figures (not from the guide's
 *  text, so it is there without a model): each step is a button. */
function NextSteps({ a }: { a: MistakeAnalysis }) {
	const [added, setAdded] = useState<"adding" | "added" | "failed" | null>(null);
	const pairs = a.mixups.length;
	// A unit is named only when the evidence says so: a real drop, or a range that lies under the bar.
	const weak = a.units.find((u) => u.trend === "worse") ?? a.units.filter((u) => u.weak).sort((x, y) => (x.high ?? 1) - (y.high ?? 1))[0];
	const slugs = a.words.map((w) => w.slug);
	if (!pairs && !weak && !slugs.length) return null;
	const addWords = async () => {
		setAdded("adding");
		try {
			const res = await fetch("/api/review/enqueue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs }) });
			setAdded(res.ok ? "added" : "failed");
		} catch {
			setAdded("failed");
		}
	};
	return (
		<Section id="mistakes-next" title="Do this next" line="Worked out from the figures below.">
			<ul className="q-card flex flex-col divide-y divide-border">
				{pairs > 0 && (
					<Step title="Practice the words you mix up" line={`${pairs} ${pairs === 1 ? "pair" : "pairs"}, typed, both sides in turn`}>
						<Link href="/lesson?mode=mixups" className="q-btn primary pointer-coarse:min-h-11" data-testid="step-mixups">
							Start
							<ArrowRightIcon className="q-ico" />
						</Link>
					</Step>
				)}
				{weak && (
					<Step title={`A lesson on ${weak.title}`} line={weak.trend === "worse" ? `Slipping lately: ${pct(weak.earlier ?? weak.accuracy)} before, ${pct(weak.recent ?? weak.accuracy)} now` : `${pct(weak.accuracy)} right on ${weak.reps} first tries, likely under ${pct(weak.high ?? weak.accuracy)}`}>
						<Link href={`/lesson?unit=${weak.unit}`} className="q-btn sec t pointer-coarse:min-h-11" data-testid="step-unit">
							Start
							<ArrowRightIcon className="q-ico" />
						</Link>
					</Step>
				)}
				{slugs.length > 0 && (
					<Step title="Put the words you miss into review" line={`${slugs.length} ${slugs.length === 1 ? "word" : "words"}, so they come back on a schedule`}>
						<button type="button" disabled={added === "adding" || added === "added"} onClick={() => void addWords()} className="q-btn sec pointer-coarse:min-h-11" data-testid="step-review">
							{added === "added" ? <CheckIcon className="q-ico" /> : added === "adding" ? <LoaderCircleIcon className="q-ico animate-spin" /> : <PlusIcon className="q-ico" />}
							{added === "added" ? "Added" : added === "failed" ? "Try again" : "Add to review"}
						</button>
					</Step>
				)}
			</ul>
		</Section>
	);
}

function Step({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
	return (
		<li className="flex items-center justify-between gap-4 px-4 py-3">
			<div className="min-w-0">
				<p className="text-sm font-semibold text-foreground">{title}</p>
				<p className="text-xs text-ink-3">{line}</p>
			</div>
			<div className="shrink-0">{children}</div>
		</li>
	);
}

function MixupsSection({ a }: { a: MistakeAnalysis }) {
	if (!a.mixups.length) return null;
	return (
		<Section id="mistakes-mixups" title="Words you mix up" line="One word given where another was wanted. Not tested yet means the same pattern, guessed from a pair you missed.">
			<ul className="q-card flex flex-col divide-y divide-border">
				{a.mixups.map((m) => (
					<li key={m.key} className="px-4 py-3" data-testid={`mistakes-mixup-${m.key}`}>
						<p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground" lang="sk">
							{m.words.join(" / ")}
						</p>
						<p className="mt-0.5 text-xs text-ink-3">{m.line}</p>
					</li>
				))}
			</ul>
			<Link href="/lesson?mode=mixups" className="q-btn sec t mt-3 pointer-coarse:min-h-11" data-testid="mistakes-practice">
				Practice them
				<ArrowRightIcon className="q-ico" />
			</Link>
		</Section>
	);
}

/** A unit's likely range on a 0 to 100 track, the dot at what you got, and a
 *  tick at the bar under which a unit counts as weak. */
function RangeBand({ u }: { u: UnitTrend }) {
	const lo = (u.low ?? u.accuracy) * 100;
	const hi = (u.high ?? u.accuracy) * 100;
	return (
		<span className="relative block h-5 w-full" aria-hidden="true">
			<span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-2" />
			<span className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-teal-wash" style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%`, boxShadow: "inset 0 0 0 1px var(--q-teal-line)" }} />
			<span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal" style={{ left: `${u.accuracy * 100}%`, boxShadow: "0 0 0 2px var(--q-bg)" }} />
			<span className="absolute inset-y-0 w-px bg-ink-3" style={{ left: `${WEAK_BAR * 100}%` }} />
		</span>
	);
}

function UnitsSection({ units }: { units: UnitTrend[] }) {
	if (!units.length) return null;
	return (
		<Section id="mistakes-units" title="By unit" line="Most misses first. The dot is your share right, the band is the likely range, the tick is the 85% bar. The trend compares the last 14 days with the days before.">
			<ul className="q-card flex flex-col divide-y divide-border">
				{units.slice(0, 8).map((u) => {
					const slips = FORM_SLIPS.filter((s) => u.slips[s]).map((s) => `${FORM_SLIP_LABEL[s]} ${u.slips[s]}`);
					return (
						<li key={u.unit}>
							<Link href={`/lesson?unit=${u.unit}`} className="group grid gap-x-5 gap-y-2 px-4 py-3 hover:bg-well sm:grid-cols-[1fr_minmax(0,9rem)_auto] sm:items-center">
								<div className="min-w-0">
									<span className="text-sm font-semibold text-foreground group-hover:text-teal-2">{u.title}</span>
									<p className="text-xs text-ink-3">
										{u.wrong} wrong of {u.reps} first tries
										{u.reps < RANGE_SHOWN_UNDER && u.low !== undefined && u.high !== undefined ? ` · few answers, likely ${pct(u.low)}–${pct(u.high)}` : ""}
										{slips.length ? ` · ${slips.join(", ")}` : ""}
									</p>
									<p className={cn("text-xs", TREND[u.trend].ink)}>
										{TREND[u.trend].label}
										{u.recent !== null && u.earlier !== null ? ` · ${pct(u.earlier)} before, ${pct(u.recent)} lately` : ""}
									</p>
								</div>
								<RangeBand u={u} />
								<span className="q-num text-[15px] font-semibold text-foreground sm:text-right">{pct(u.accuracy)}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</Section>
	);
}

function WordsSection({ a }: { a: MistakeAnalysis }) {
	const [done, setDone] = useState<Record<string, "adding" | "added" | "failed">>({});
	if (!a.words.length) return null;
	const add = async (slug: string) => {
		setDone((d) => ({ ...d, [slug]: "adding" }));
		try {
			const res = await fetch("/api/review/enqueue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: [slug] }) });
			setDone((d) => ({ ...d, [slug]: res.ok ? "added" : "failed" }));
		} catch {
			setDone((d) => ({ ...d, [slug]: "failed" }));
		}
	};
	return (
		<Section id="mistakes-words" title="Words you miss most" line="What the sentence wanted, and what you last wrote.">
			<ul className="q-card flex flex-col divide-y divide-border">
				{a.words.map((w) => (
					<li key={w.slug} className="flex items-baseline justify-between gap-3 px-4 py-3">
						<span className="min-w-0 text-base text-foreground" lang="sk">
							<b className="font-semibold">{w.answer}</b>
							<span className="text-ink-3"> · {w.lastGiven ? `you wrote “${w.lastGiven}”` : "no answer"}</span>
						</span>
						<span className="flex shrink-0 items-center gap-3">
							<span className="q-num text-xs text-ink-3">
								{w.misses} of {w.reps}
							</span>
							<button
								type="button"
								disabled={done[w.slug] === "adding" || done[w.slug] === "added"}
								onClick={() => void add(w.slug)}
								className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-ink-3 hover:bg-well hover:text-ink-2 disabled:opacity-60 pointer-coarse:min-h-11"
								aria-label={`Add ${w.lemma} to review`}
								data-testid={`word-review-${w.slug}`}
							>
								{done[w.slug] === "added" ? <CheckIcon className="size-3.5" strokeWidth={1.6} /> : <PlusIcon className="size-3.5" strokeWidth={1.6} />}
								{done[w.slug] === "added" ? "In Review" : done[w.slug] === "failed" ? "Try again" : "Add to Review"}
							</button>
						</span>
					</li>
				))}
			</ul>
		</Section>
	);
}

function WeeksSection({ a }: { a: MistakeAnalysis }) {
	if (a.weeks.length < 2) return null;
	return (
		<Section id="mistakes-weeks" title="Week by week" line="Share of first tries right.">
			<ol className="q-card flex items-end gap-2 p-4" aria-label="First-try accuracy by week">
				{a.weeks.map((w) => (
					<li key={w.week} className="flex min-w-0 flex-1 flex-col items-center gap-1">
						<span className="q-num text-xs font-semibold text-ink-2">{pct(w.accuracy)}</span>
						<span className="flex h-20 w-full items-end rounded-md bg-well-2">
							<span className="w-full rounded-md bg-teal" style={{ height: `${Math.max(4, Math.round(w.accuracy * 100))}%` }} />
						</span>
						<span className="text-xs text-ink-3" title={`${w.reps} first tries`}>
							{w.week.slice(5)}
						</span>
					</li>
				))}
			</ol>
		</Section>
	);
}
