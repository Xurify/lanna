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
import { PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { SidebarToggle } from "@/components/sidebar";
import { FORM_SLIPS, FORM_SLIP_LABEL, type GuideData, type MistakeAnalysis, type Trend, type UnitTrend } from "@/src/core";
import { AiCallout } from "@/components/ai-callout";
import { SettingsLink } from "@/components/settings/settings-link";
import type { MistakesReport } from "@/src/server";

const TREND: Record<Trend, { label: string; ink: string }> = {
	better: { label: "Getting better", ink: "text-go" },
	worse: { label: "Getting worse", ink: "text-miss" },
	steady: { label: "Steady", ink: "text-muted-foreground" },
	new: { label: "Too few answers to say", ink: "text-muted-foreground" },
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function MistakesPage({ initial }: { initial: MistakesReport | null }) {
	const [report, setReport] = useState<MistakesReport | null>(initial);
	const [busy, setBusy] = useState<"analyse" | "guide" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const run = async (action: "analyse" | "guide", force = false) => {
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
				<Link href="/" className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
					<ArrowLeftIcon className="size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 font-ui text-3xl font-black tracking-tight text-foreground">My mistakes</h1>
				<p className="mt-2 max-w-2xl font-prose text-base text-muted-foreground">
					Read from your first tries: the answer you gave before any hint. A miss you then got right still counts here, because that is the one to work on.
				</p>

				<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="mistakes-when">
					<p className="font-prose text-sm text-muted-foreground">
						{a ? (
							<>
								Last analysed{" "}
								<time dateTime={a.at} suppressHydrationWarning className="font-bold text-foreground">
									{new Date(a.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
								</time>
								{a.from ? ` · ${a.reps} first tries, ${a.from} to ${a.to}` : ""}
							</>
						) : (
							"Not analysed yet."
						)}
					</p>
					<button type="button" onClick={() => void run("analyse")} disabled={busy !== null} className={cn(SECONDARY, SMALL, "pointer-coarse:min-h-11")} data-testid="mistakes-analyse">
						{busy === "analyse" ? <LoaderCircleIcon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
						Analyse now
					</button>
				</div>
				{error && (
					<p role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-prose text-sm text-miss" data-testid="mistakes-error">
						{error}
						{/Settings/.test(error) && (
							<SettingsLink keys={/key/i.test(error)} className="font-ui text-xs font-bold text-foreground underline underline-offset-2">
								Open Settings
							</SettingsLink>
						)}
					</p>
				)}

				{a && a.reps === 0 ? (
					<section className="mt-8 rounded-2xl border-2 bg-card p-5" data-testid="mistakes-empty">
						<p className="font-prose text-base text-foreground">There are no answers to read yet.</p>
						<p className="mt-1 font-prose text-sm text-muted-foreground">Finish a lesson and come back: your first tries show up here.</p>
						<Link href="/" className={cn(SECONDARY, SMALL, "mt-3")}>
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
		<section className="mt-8" aria-labelledby={`${id}-title`} data-testid={id}>
			<h2 id={`${id}-title`} className="font-ui text-lg font-black text-foreground">
				{title}
			</h2>
			{line && <p className="mt-0.5 font-prose text-sm text-muted-foreground">{line}</p>}
			<div className="mt-3">{children}</div>
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
				<h3 className="font-ui text-sm font-bold text-foreground">What keeps going wrong</h3>
				{data.patterns.map((p) => (
					<article key={p.title} className="rounded-xl border bg-background p-4">
						<h4 className="font-ui text-sm font-bold text-foreground">{p.title}</h4>
						{p.evidence && (
							<p className="mt-1 font-prose text-sm text-muted-foreground" lang="sk">
								{p.evidence}
							</p>
						)}
						<dl className="mt-2 grid gap-x-3 gap-y-1 font-prose text-sm text-foreground sm:grid-cols-[4rem_1fr]">
							<dt className="font-ui text-xs font-bold text-muted-foreground">Why</dt>
							<dd>{p.why}</dd>
							{p.fix && (
								<>
									<dt className="font-ui text-xs font-bold text-muted-foreground">Fix</dt>
									<dd>{p.fix}</dd>
								</>
							)}
						</dl>
					</article>
				))}
			</div>
			{data.next.length > 0 && (
				<div>
					<h3 className="font-ui text-sm font-bold text-foreground">What may trip you next</h3>
					<p className="font-prose text-xs text-muted-foreground">Guesses from your pairs and trends, not tested yet.</p>
					<ul className="mt-2 flex list-disc flex-col gap-1 pl-5 font-prose text-sm text-foreground marker:text-muted-foreground">
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
					<h3 className="font-ui text-sm font-bold text-foreground">Do this week</h3>
					<ul className="mt-2 flex flex-col divide-y rounded-xl border bg-background">
						{data.plan.map((p) => {
							const href = STEP_HREF(p);
							return (
								<li key={p.step} className="flex items-center justify-between gap-3 px-3 py-2">
									<span className="font-prose text-sm text-foreground">{p.step}</span>
									{href && (
										<Link href={href} className={cn(SECONDARY, SMALL, "shrink-0 pointer-coarse:min-h-11")}>
											Open
											<ArrowRightIcon className="size-4" />
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
	return <p className="whitespace-pre-line font-prose text-sm text-foreground">{text}</p>;
}

const GUIDE_ADDS = [
	"Finds the pattern behind several mistakes, not just how many there were",
	"Explains why it happens and how to fix it, from your own wrong sentences",
	"Guesses what may trip you next, beyond the word pairs the app already knows",
	"Writes a plan for the week, with a button for each step",
	"Builds a personal lesson on the words, pairs and units it picked, from the app's checked sentences",
];

function GuideCard({ report, busy, onWrite }: { report: MistakesReport; busy: boolean; onWrite: (force: boolean) => void }) {
	const { guide, guideCurrent, ai } = report;
	return (
		<section className="mt-8 rounded-2xl border-2 bg-card p-5" aria-labelledby="guide-title" data-testid="mistakes-guide">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h2 id="guide-title" className="flex items-center gap-1.5 font-ui text-lg font-black text-foreground">
					<CompassIcon className="size-5 text-sky" aria-hidden="true" />
					Your guide
				</h2>
				{guide && (
					<p className="font-prose text-xs text-muted-foreground" suppressHydrationWarning>
						Written {new Date(guide.at).toLocaleDateString(undefined, { dateStyle: "medium" })}
						{guideCurrent ? "" : " · your answers have changed since"}
					</p>
				)}
			</div>
			{guide?.practice && (
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-go/40 bg-go/10 p-4" data-testid="guide-practice">
					<div className="min-w-0">
						<p className="font-ui text-sm font-bold text-foreground">Your plan practice</p>
						<p className="font-prose text-xs text-muted-foreground">
							Built from checked sentences on: <span lang="sk">{guide.practice.shown.join(", ")}</span>
						</p>
					</div>
					<Link href="/lesson?mode=personal" className={cn(PRIMARY, SMALL, "shrink-0 pointer-coarse:min-h-11")} data-testid="guide-practise">
						Practise your plan
						<ArrowRightIcon className="size-4" />
					</Link>
				</div>
			)}
			{guide ? (
				<div className="mt-3">{guide.data ? <GuideBody data={guide.data} /> : <GuideText text={guide.text} />}</div>
			) : ai.ready ? (
				<p className="mt-2 font-prose text-sm text-muted-foreground">An AI teacher reads your wrong answers and writes what keeps going wrong, why, and what to do about it. It uses your Strong model (Cheap when Strong is empty) and runs once per set of answers.</p>
			) : (
				<AiCallout status={ai} title="Turn on AI for a deeper read" adds={GUIDE_ADDS} className="mt-3" />
			)}
			{ai.ready && (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<button type="button" disabled={busy || (!!guide && guideCurrent)} onClick={() => onWrite(false)} className={cn(SECONDARY, SMALL, "pointer-coarse:min-h-11")} data-testid="mistakes-write-guide">
						{busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
						{guide ? (guideCurrent ? "Guide is up to date" : "Write it again") : "Write my guide"}
					</button>
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
	const weak = a.units.find((u) => u.trend === "worse") ?? a.units.filter((u) => u.accuracy < 0.85).sort((x, y) => x.accuracy - y.accuracy)[0];
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
			<ul className="flex flex-col divide-y rounded-2xl border-2 bg-card">
				{pairs > 0 && (
					<Step title="Practise the words you mix up" line={`${pairs} ${pairs === 1 ? "pair" : "pairs"}, typed, both sides in turn`}>
						<Link href="/lesson?mode=mixups" className={cn(SECONDARY, SMALL, "pointer-coarse:min-h-11")} data-testid="step-mixups">
							Start
							<ArrowRightIcon className="size-4" />
						</Link>
					</Step>
				)}
				{weak && (
					<Step title={`A lesson on ${weak.title}`} line={weak.trend === "worse" ? `Slipping lately: ${pct(weak.earlier ?? weak.accuracy)} before, ${pct(weak.recent ?? weak.accuracy)} now` : `${pct(weak.accuracy)} right on first tries`}>
						<Link href={`/lesson?unit=${weak.unit}`} className={cn(SECONDARY, SMALL, "pointer-coarse:min-h-11")} data-testid="step-unit">
							Start
							<ArrowRightIcon className="size-4" />
						</Link>
					</Step>
				)}
				{slugs.length > 0 && (
					<Step title="Put the words you miss into review" line={`${slugs.length} ${slugs.length === 1 ? "word" : "words"}, so they come back on a schedule`}>
						<button type="button" disabled={added === "adding" || added === "added"} onClick={() => void addWords()} className={cn(SECONDARY, SMALL, "pointer-coarse:min-h-11")} data-testid="step-review">
							{added === "added" ? <CheckIcon className="size-4" /> : added === "adding" ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
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
				<p className="font-ui text-sm font-bold text-foreground">{title}</p>
				<p className="font-prose text-xs text-muted-foreground">{line}</p>
			</div>
			<div className="shrink-0">{children}</div>
		</li>
	);
}

function MixupsSection({ a }: { a: MistakeAnalysis }) {
	if (!a.mixups.length) return null;
	return (
		<Section id="mistakes-mixups" title="Words you mix up" line="One word given where another was wanted. Not tested yet means the same pattern, guessed from a pair you missed.">
			<ul className="flex flex-col divide-y rounded-2xl border-2 bg-card">
				{a.mixups.map((m) => (
					<li key={m.key} className="px-4 py-3" data-testid={`mistakes-mixup-${m.key}`}>
						<p className="font-ui text-sm font-bold text-foreground" lang="sk">
							{m.words.join(" / ")}
						</p>
						<p className="font-prose text-xs text-muted-foreground">{m.line}</p>
					</li>
				))}
			</ul>
			<Link href="/lesson?mode=mixups" className={cn(SECONDARY, SMALL, "mt-3 pointer-coarse:min-h-11")} data-testid="mistakes-practise">
				Practise them
				<ArrowRightIcon className="size-4" />
			</Link>
		</Section>
	);
}

function UnitsSection({ units }: { units: UnitTrend[] }) {
	if (!units.length) return null;
	return (
		<Section id="mistakes-units" title="By unit" line="Most misses first. The trend compares the last 14 days with the days before.">
			<ul className="flex flex-col divide-y rounded-2xl border-2 bg-card">
				{units.slice(0, 8).map((u) => {
					const slips = FORM_SLIPS.filter((s) => u.slips[s]).map((s) => `${FORM_SLIP_LABEL[s]} ${u.slips[s]}`);
					return (
						<li key={u.unit} className="px-4 py-3">
							<Link href={`/lesson?unit=${u.unit}`} className="group block">
								<div className="flex items-baseline justify-between gap-3">
									<span className="font-ui text-sm font-bold text-foreground group-hover:text-go">{u.title}</span>
									<span className="font-ui text-sm font-black tabular-nums text-foreground">{pct(u.accuracy)}</span>
								</div>
								<p className="font-prose text-xs text-muted-foreground">
									{u.wrong} wrong of {u.reps} first tries{slips.length ? ` · ${slips.join(", ")}` : ""}
								</p>
								<p className={cn("font-prose text-xs", TREND[u.trend].ink)}>
									{TREND[u.trend].label}
									{u.recent !== null && u.earlier !== null ? ` · ${pct(u.earlier)} before, ${pct(u.recent)} lately` : ""}
								</p>
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
			<ul className="flex flex-col divide-y rounded-2xl border-2 bg-card">
				{a.words.map((w) => (
					<li key={w.slug} className="flex items-baseline justify-between gap-3 px-4 py-3">
						<span className="min-w-0 font-prose text-base text-foreground" lang="sk">
							<b>{w.answer}</b>
							<span className="text-muted-foreground"> · {w.lastGiven ? `you wrote “${w.lastGiven}”` : "no answer"}</span>
						</span>
						<span className="flex shrink-0 items-center gap-3">
							<span className="font-ui text-xs tabular-nums text-muted-foreground">
								{w.misses} of {w.reps}
							</span>
							<button
								type="button"
								disabled={done[w.slug] === "adding" || done[w.slug] === "added"}
								onClick={() => void add(w.slug)}
								className="inline-flex h-8 items-center gap-1 rounded-lg px-2 font-ui text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60 pointer-coarse:min-h-11"
								aria-label={`Add ${w.lemma} to review`}
								data-testid={`word-review-${w.slug}`}
							>
								{done[w.slug] === "added" ? <CheckIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
								{done[w.slug] === "added" ? "In review" : done[w.slug] === "failed" ? "Try again" : "Review"}
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
			<ol className="flex items-end gap-2 rounded-2xl border-2 bg-card p-4" aria-label="First-try accuracy by week">
				{a.weeks.map((w) => (
					<li key={w.week} className="flex min-w-0 flex-1 flex-col items-center gap-1">
						<span className="font-ui text-xs font-bold tabular-nums text-foreground">{pct(w.accuracy)}</span>
						<span className="flex h-20 w-full items-end rounded-md bg-accent">
							<span className="w-full rounded-md bg-go" style={{ height: `${Math.max(4, Math.round(w.accuracy * 100))}%` }} />
						</span>
						<span className="font-ui text-xs text-muted-foreground" title={`${w.reps} first tries`}>
							{w.week.slice(5)}
						</span>
					</li>
				))}
			</ol>
		</Section>
	);
}
