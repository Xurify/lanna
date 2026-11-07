"use client";

/**
 * /milestones — "When can I…?" (LangHarness, 2026-10-28). Xurify asked for
 * a calculator with a memory: one that knows what they know and says when
 * they will understand most of a Slovak YouTube video. The page shows,
 * for each situation, the two gaps the research separates — words
 * (coverage) and speed (parsing at the speaker's pace) — against what the
 * app has measured, and the date where both close, at the planned pace
 * and at the real one. Evidence first, like the placement screen: every
 * number says where it comes from.
 *
 * Marks follow the hours sheet: thin bars in the app's accent, the target
 * as a tick, text in text tokens. No native widgets; the add box is the
 * app's own input. The model (src/core/milestones.ts) and its sources are
 * the page's footnotes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	ArrowLeftIcon,
	BabyIcon,
	BookOpenIcon,
	BriefcaseIcon,
	CaptionsIcon,
	ChevronDownIcon,
	ClapperboardIcon,
	CoffeeIcon,
	Gamepad2Icon,
	HeadphonesIcon,
	LandmarkIcon,
	MailIcon,
	MapIcon,
	MessageCircleIcon,
	MicIcon,
	MonitorPlayIcon,
	MusicIcon,
	NewspaperIcon,
	PhoneIcon,
	PlusIcon,
	RadioIcon,
	SparklesIcon,
	TvIcon,
	UsersIcon,
	VideoIcon,
	XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { dateInWords, daysLeftWords, GENRES, INFLECTION_FACTOR, LEVEL_VOCAB, MAX_CUSTOM_LENGTH, MIN_PACE_DAYS, MILESTONE_SOURCES, SPEED_LADDER, SUPPORT_LINE, genreLemmas, type DatedSceneView, type Eta, type LearnerFacts, type MilestoneEstimate, type MilestonesReport, type NextWord } from "@/src/core";
import { fillStyle } from "@/components/ui/fill";
import { DatePicker } from "@/components/milestones/date-picker";
import { SourcesNote } from "@/components/sources/sources-note";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	"monitor-play": MonitorPlayIcon,
	video: VideoIcon,
	headphones: HeadphonesIcon,
	newspaper: NewspaperIcon,
	coffee: CoffeeIcon,
	users: UsersIcon,
	captions: CaptionsIcon,
	clapperboard: ClapperboardIcon,
	radio: RadioIcon,
	"book-open": BookOpenIcon,
	"message-circle": MessageCircleIcon,
	briefcase: BriefcaseIcon,
	music: MusicIcon,
	phone: PhoneIcon,
	mail: MailIcon,
	landmark: LandmarkIcon,
	tv: TvIcon,
	mic: MicIcon,
	sparkles: SparklesIcon,
	baby: BabyIcon,
	"gamepad-2": Gamepad2Icon,
	map: MapIcon,
};

function Icon({ name, className }: { name: string; className?: string }) {
	const C = ICONS[name] ?? SparklesIcon;
	return <C className={className} />;
}

const n = (x: number) => x.toLocaleString("en-GB");
const pct = (x: number) => `${Math.round(x * 100)}%`;

function monthOf(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** "now", "in 3 weeks", "Mar 2027" or "—". */
function when(days: number | null, iso: string | null): string {
	if (days === null) return "—";
	if (days <= 0) return "now";
	if (days > 3653) return "more than 10 years away";
	if (days < 14) return `in ${Math.max(1, Math.round(days))} days`;
	if (days < 60) return `in ${Math.round(days / 7)} weeks`;
	if (days < 365) return `in ${Math.round(days / 30.4)} months · ${monthOf(iso)}`;
	const years = days / 365.25;
	return `in ${years < 1.5 ? "about a year" : `${Math.round(years * 2) / 2} years`} · ${monthOf(iso)}`;
}

const STATUS: Record<MilestoneEstimate["status"], { label: string; cls: string }> = {
	reached: { label: "Reached", cls: "bg-teal-wash text-teal-2" },
	close: { label: "Close", cls: "bg-well text-foreground" },
	"on-the-way": { label: "On the way", cls: "bg-teal-wash text-teal-2" },
	far: { label: "A long road", cls: "bg-well-2 text-ink-2" },
};

export function MilestonesPage({ initialReport, modelReady }: { initialReport: MilestonesReport | null; modelReady: boolean }) {
	const [report, setReport] = useState<MilestonesReport | null>(initialReport);
	const [error, setError] = useState<string | null>(null);
	const [text, setText] = useState("");
	const [adding, setAdding] = useState(false);
	const [open, setOpen] = useState<string | null>(null);
	const [sourcesOpen, setSourcesOpen] = useState(true);
	const [queued, setQueued] = useState<Set<string>>(new Set());
	const [datedText, setDatedText] = useState("");
	const [datedDate, setDatedDate] = useState<string | null>(null);
	const [datedAdding, setDatedAdding] = useState(false);
	const [datedError, setDatedError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		try {
			const res = await fetch(`/api/milestones?tz=${new Date().getTimezoneOffset()}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			setReport((await res.json()) as MilestonesReport);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);
	useEffect(() => {
		if (!initialReport) void reload();
	}, [initialReport, reload]);

	const add = async () => {
		const t = text.trim();
		if (!t || adding) return;
		setAdding(true);
		setError(null);
		try {
			const res = await fetch(`/api/milestones?tz=${new Date().getTimezoneOffset()}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
			const body = (await res.json()) as { message?: string; id?: string; report?: MilestonesReport };
			if (!res.ok || !body.report) throw new Error(body.message ?? `HTTP ${res.status}`);
			setReport(body.report);
			setText("");
			if (body.id) setOpen(body.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setAdding(false);
		}
	};
	const remove = async (id: string) => {
		const res = await fetch(`/api/milestones?id=${encodeURIComponent(id)}&tz=${new Date().getTimezoneOffset()}`, { method: "DELETE" });
		const body = (await res.json().catch(() => null)) as { report?: MilestonesReport } | null;
		if (body?.report) setReport(body.report);
	};
	const addDated = async () => {
		const t = datedText.trim();
		if (!t || !datedDate || datedAdding) return;
		setDatedAdding(true);
		setDatedError(null);
		try {
			const res = await fetch(`/api/milestones/dated?tz=${new Date().getTimezoneOffset()}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t, date: datedDate }) });
			const body = (await res.json()) as { message?: string; id?: string; report?: MilestonesReport };
			if (!res.ok || !body.report) throw new Error(body.message ?? `HTTP ${res.status}`);
			setReport(body.report);
			setDatedText("");
			setDatedDate(null);
			if (body.id) setOpen(body.id);
		} catch (err) {
			setDatedError(err instanceof Error ? err.message : String(err));
		} finally {
			setDatedAdding(false);
		}
	};
	const saveOutcome = async (id: string, line: string): Promise<string | null> => {
		const res = await fetch(`/api/milestones/dated?tz=${new Date().getTimezoneOffset()}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, outcome: line }) });
		const body = (await res.json().catch(() => null)) as { message?: string; report?: MilestonesReport } | null;
		if (!res.ok || !body?.report) return body?.message ?? `HTTP ${res.status}`;
		setReport(body.report);
		return null;
	};
	const queue = async (slugs: string[]) => {
		const res = await fetch("/api/review/enqueue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs }) });
		const body = (await res.json().catch(() => null)) as { added?: string[] } | null;
		setQueued((q) => new Set([...q, ...(body?.added ?? slugs)]));
	};

	const facts = report?.facts ?? null;
	const sorted = useMemo(() => (report ? [...report.milestones].sort((a, b) => (a.eta.daysPlanned ?? 1e9) - (b.eta.daysPlanned ?? 1e9)) : []), [report]);

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="milestones">
				<Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Milestones</h1>
				<p className="q-line dim mt-2 max-w-2xl">
					<b className="text-foreground">When can I…?</b> Each situation asks two things of you: enough <b className="text-foreground">words</b> to cover what is said, and the <b className="text-foreground">speed</b> to turn them into meaning before the next ones arrive. The app measures both and says when they meet, at the pace you planned and at the pace you keep.
				</p>

				{error && (
					<p className="mt-4 rounded-xl bg-[var(--q-miss-wash)] px-4 py-3 text-sm text-foreground" role="alert" data-testid="milestones-error">
						{error}
					</p>
				)}

				{facts && <Evidence facts={facts} />}

				{report && sorted.length > 0 && <Timeline items={sorted} paceKnown={(facts?.paceDays ?? 0) >= MIN_PACE_DAYS} />}

				<ol className="mt-6 flex flex-col gap-3" data-testid="milestone-list">
					{sorted.map((m) => (
						<MilestoneCard key={m.def.id} m={m} facts={facts} goals={report?.goals ?? {}} open={open === m.def.id} onToggle={() => setOpen(open === m.def.id ? null : m.def.id)} onRemove={m.def.custom ? () => void remove(m.def.id) : undefined} scene={report?.scenes[m.def.id]} onSaveOutcome={(line) => saveOutcome(m.def.id, line)} />
					))}
				</ol>

				{/* Your own milestone, in your words. */}
				<section className="mt-6 rounded-xl border border-dashed border-line-2 p-4" data-testid="milestone-add">
					<h2 className="font-ui text-sm font-semibold text-foreground">Add your own</h2>
					<p className="mt-1 font-prose text-sm text-muted-foreground">Say it the way you would to a friend: “follow my mother-in-law on the phone”, “read a lease”, “watch let's plays”. The tutor's cheap model maps it to the kind of language it needs, once, and keeps the answer.</p>
					<form
						className="mt-3 flex flex-wrap items-stretch gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							void add();
						}}
					>
						<SceneInput value={text} onChange={setText} placeholder={modelReady ? "I want to be able to…" : "Turn on AI in Settings → AI models to add your own"} disabled={!modelReady || adding} label="Your milestone" testId="milestone-input" />
						<button type="submit" disabled={!modelReady || adding || text.trim().length < 3} className="q-btn primary h-11" data-testid="milestone-submit">
							<PlusIcon className="q-ico" />
							{adding ? "Estimating…" : "Estimate"}
						</button>
					</form>
				</section>

				{/* A scene with a date: the same text box, and the day it should work. */}
				<section className="mt-6 rounded-xl border border-dashed border-line-2 p-4" data-testid="dated-add">
					<h2 className="font-ui text-sm font-semibold text-foreground">Add a scene with a date</h2>
					<p className="mt-1 font-prose text-sm text-muted-foreground">One scene you want to handle, in your own words, and the day you want to be ready for it. The app says whether your real pace gets you there, and asks how it went once the day has passed.</p>
					<form
						className="mt-3 flex flex-col gap-4"
						onSubmit={(e) => {
							e.preventDefault();
							void addDated();
						}}
					>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
							<SceneInput value={datedText} onChange={setDatedText} placeholder={modelReady ? "lunch with friends in the city, in the language" : "Turn on AI in Settings → AI models to add a scene"} disabled={!modelReady || datedAdding} label="Your scene" testId="dated-input" className="w-full sm:flex-1" />
							<button type="submit" disabled={!modelReady || datedAdding || datedText.trim().length < 3 || !datedDate} className="q-btn primary h-11 w-full sm:w-auto" data-testid="dated-submit">
								<PlusIcon className="q-ico" />
								{datedAdding ? "Adding…" : "Add the scene"}
							</button>
						</div>
						{report && <DatePicker value={datedDate} today={report.today} onChange={setDatedDate} />}
					</form>
					{datedError && (
						<p role="alert" className="mt-3 font-ui text-sm text-miss">
							{datedError}
						</p>
					)}
				</section>

				{report && report.nextWords.length > 0 && <NextWords words={report.nextWords} queued={queued} onQueue={queue} />}

				{/* The assumptions and the studies. */}
				<section className="mt-8 border-t pt-5" data-testid="milestone-sources">
					<button type="button" onClick={() => setSourcesOpen((o) => !o)} aria-expanded={sourcesOpen} className="flex w-full items-center justify-between gap-3 text-left">
						<span className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">How the numbers are made, and the studies behind them</span>
						<ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", sourcesOpen && "rotate-180")} />
					</button>
					{sourcesOpen && (
						<div className="mt-3 flex flex-col gap-4 font-prose text-sm leading-relaxed text-muted-foreground">
							<p>
								<b className="text-foreground">Words.</b> Your working vocabulary is every word the deck or a word lesson has shown you, plus the commonest words up to the size a learner at your level typically has (Milton 2009: A1 {n(LEVEL_VOCAB.A1)}, A2 {n(LEVEL_VOCAB.A2)}, B1 {n(LEVEL_VOCAB.B1)}, B2 {n(LEVEL_VOCAB.B2)}, C1 {n(LEVEL_VOCAB.C1)} lemmas here). “Commonest” is by how often a word's forms occur in the dictionary's 30,000 example sentences. The published thresholds count English word families; a lemma in an inflected language is finer (a noun, its adjective and its adverb are three), so every count is raised by a quarter (×{INFLECTION_FACTOR}). Between the published 95% and 98% points the curve is a Zipf tail.
							</p>
							<p>
								<b className="text-foreground">Speed.</b> Words a minute of understanding: in Listen, the words of a sentence divided by the time from its first sound to your right answer (never less than the audio itself; replays and a peek at the text count against it). In Watch, the segments you got on the first unaided pass. Each situation demands the speaker's rate, discounted for its support: {Object.entries(SUPPORT_LINE).map(([k, v]) => `${k} (${v})`).join("; ")}. Hours to a speed follow the guided-hours ladder — {SPEED_LADDER.map((r) => `${r.level} ≈ ${r.wpm}`).join(", ")} words a minute — until eight of your own Listen sessions across a week replace it with your trend.
							</p>
							<p>
								<b className="text-foreground">Dates.</b> Words grow at the deck's new words a day plus about five from Listen and Read (planned), or at the deck's real growth over the last two weeks. Speed grows with study hours at your planned minutes × days, or at your real minutes a day over the last two weeks. The milestone's date is the later of the two. Everything is an estimate, and it changes as the evidence does. A scene with a date is on track when the estimate at your real pace falls on or before its date; otherwise the page gives the days it falls later. With no measured speed or pace, it gives no date.
							</p>
							<ol className="flex flex-col gap-3">
								{MILESTONE_SOURCES.map((s) => (
									<li key={s.who}>
										<span className="block font-ui text-sm font-semibold text-foreground">
											{s.what} <span className="font-normal text-muted-foreground">· {s.who}</span>
										</span>
										<span>{s.line}</span>
									</li>
								))}
							</ol>
						</div>
					)}
				</section>
				<SourcesNote feature="milestones" className="mt-6" />
				<SourcesNote feature="where-you-are" className="mt-3" />
			</main>
		</div>
	);
}

// ─── What the app knows ──────────────────────────────────────────────────────

function Evidence({ facts }: { facts: LearnerFacts }) {
	const speedLine =
		facts.speed.basis === "level"
			? `assumed from your hours on the map; do a Listen session to measure it`
			: facts.speed.basis === "listen"
				? `from ${facts.listen.reading?.samples ?? 0} Listen sentences over ${facts.listen.sessions} session${facts.listen.sessions === 1 ? "" : "s"}${facts.listen.reading?.audioWpm ? ` · the voice speaks at ${facts.listen.reading.audioWpm}` : ""}`
				: facts.speed.basis === "watch"
					? `from ${facts.watch?.segments ?? 0} video segments`
					: `from Listen and Watch together`;
	return (
		<section className="mt-6 q-card p-4" data-testid="milestone-evidence" aria-label="What the app knows about you">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h2 className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">What the app knows about you</h2>
				<p className="font-ui text-xs text-muted-foreground">
					level from the map ·{" "}
					<Link href="/start?edit=1&check=1" className="underline hover:text-foreground">
						re-check
					</Link>
				</p>
			</div>
			<dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Fact label="Level" value={facts.level} line={`where the map has you${facts.placed ? " (placement set the start; lessons move it)" : ""} · ${Math.round(facts.levelProgress * 100)}% through it`} />
				<Fact label="Words" value={n(facts.vocabulary)} line={`${n(facts.met)} met in the deck and lessons (${n(facts.solid)} solid) · ${n(facts.assumed)} more ${facts.words.basis === "measured" ? `from your word check${facts.words.measuredAt ? ` on ${facts.words.measuredAt.slice(0, 10)}` : ""}${facts.words.reliable === false ? " (generous: pseudowords were ticked)" : ""}` : `credited for the ${facts.level === "A1" ? "part of A1" : `levels before ${facts.level} and the part of it`} behind you; a word check (re-check) measures it`}`} />
				<Fact label="Speed" value={`${facts.speed.wpm} w/min`} line={speedLine} dim={facts.speed.basis === "level"} />
				<Fact label="Pace" value={`${facts.paceMinutes} min/day`} line={`last 14 days · plan ${facts.minutesPerDay} min × ${facts.daysPerWeek} days · ${facts.hoursLogged} h logged`} />
			</dl>
			{facts.listen.knownSentences.total >= 10 && (
				<p className="mt-3 font-prose text-sm text-muted-foreground">
					Of the {facts.listen.knownSentences.total} Listen sentences built only from words the app counts as known, you understood {facts.listen.knownSentences.right} ({pct(facts.listen.knownSentences.right / facts.listen.knownSentences.total)}). {facts.listen.knownSentences.right / facts.listen.knownSentences.total < 0.75 ? "The word count above is generous, then; the speed figure is the one to trust." : "The word count above is earning its trust."}
				</p>
			)}
		</section>
	);
}

function Fact({ label, value, line, dim }: { label: string; value: string; line: string; dim?: boolean }) {
	return (
		<div className="min-w-0">
			<dt className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">{label}</dt>
			<dd className={cn("mt-0.5 font-ui text-2xl font-semibold tabular-nums", dim ? "text-muted-foreground" : "text-foreground")}>{value}</dd>
			<dd className="mt-0.5 font-prose text-xs leading-snug text-muted-foreground">{line}</dd>
		</div>
	);
}

// ─── The timeline ───────────────────────────────────────────────────────────

/** Every milestone as one row on a shared time axis from today: a thin
 *  line to its planned date (filled dot), a dashed tail to the real-pace
 *  date (hollow dot). One series, labels in the left column, so no two
 *  labels can collide. */
export function Timeline({ items, paceKnown = true }: { items: MilestoneEstimate[]; /** False until a real pace can be quoted (MIN_PACE_DAYS of study). */ paceKnown?: boolean }) {
	const [tip, setTip] = useState<string | null>(null);
	const dated = items.filter((m) => m.eta.daysPlanned !== null);
	if (dated.length === 0) return null;
	const paceOf = (m: MilestoneEstimate) => (m.eta.daysPace !== null ? Math.min(m.eta.daysPace, Math.max(365, (m.eta.daysPlanned ?? 0) * 2.5)) : 0);
	const maxDays = Math.max(365, ...dated.map((m) => Math.max(m.eta.daysPlanned ?? 0, paceOf(m)))) * 1.04;
	const W = 640;
	const left = 190;
	const right = 40;
	const rowH = 26;
	const top = 8;
	const axisY = top + dated.length * rowH + 6;
	const H = axisY + 20;
	const x = (d: number) => left + ((W - left - right) * Math.min(d, maxDays)) / maxDays;
	const now = new Date();
	const ticks: Array<{ d: number; label: string }> = [];
	for (let y = 1; y * 365.25 <= maxDays; y++) ticks.push({ d: y * 365.25, label: String(now.getFullYear() + y) });
	// Half-years when the span is short enough to show them.
	if (maxDays <= 800) for (let h = 1; h * 182.6 <= maxDays; h += 2) ticks.push({ d: h * 182.6, label: `${Math.floor(h / 2) === 0 ? "" : ""}${h * 6} mo` });
	return (
		<figure className="relative mt-6" data-testid="milestone-timeline" onMouseLeave={() => setTip(null)}>
			<svg viewBox={`0 0 ${W} ${H}`} className="hidden w-full sm:block" role="img" aria-label="When each milestone lands at your planned pace and at your real pace">
				{ticks.map((t) => (
					<g key={t.label}>
						<line x1={x(t.d)} x2={x(t.d)} y1={top} y2={axisY} stroke="var(--border)" strokeWidth={1} />
						<text x={x(t.d)} y={axisY + 14} textAnchor="middle" className="fill-muted-foreground font-ui" fontSize={10}>
							{t.label}
						</text>
					</g>
				))}
				<line x1={x(0)} x2={x(0)} y1={top} y2={axisY} stroke="var(--border)" strokeWidth={1.5} />
				<text x={x(0)} y={axisY + 14} textAnchor="middle" className="fill-muted-foreground font-ui" fontSize={10}>
					today
				</text>
				{dated.map((m, i) => {
					const cy = top + i * rowH + rowH / 2;
					const d = m.eta.daysPlanned ?? 0;
					const reached = m.status === "reached";
					const pace = m.eta.daysPace;
					const showPace = pace !== null && pace > d;
					const title = m.def.title.length > 30 ? `${m.def.title.slice(0, 28).trimEnd()}…` : m.def.title;
					return (
						<g key={m.def.id} tabIndex={0} role="img" aria-label={`${m.def.title}: ${reached ? "within reach now" : `${when(d, m.eta.planned)} at your plan`}`} className="outline-none" onMouseEnter={() => setTip(m.def.id)} onFocus={() => setTip(m.def.id)} onBlur={() => setTip(null)} data-testid={`timeline-row-${m.def.id}`}>
							<rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill="transparent" />
							<text x={left - 10} y={cy + 3.5} textAnchor="end" className="fill-foreground font-ui" fontSize={11} fontWeight={700}>
								{title}
							</text>
							<line x1={x(0)} x2={x(d)} y1={cy} y2={cy} className="stroke-teal" strokeWidth={2} />
							{showPace && <line x1={x(d)} x2={x(paceOf(m))} y1={cy} y2={cy} className="stroke-teal" strokeWidth={2} strokeOpacity={0.4} strokeDasharray="3 3" />}
							{showPace && <circle cx={x(paceOf(m))} cy={cy} r={4} fill="var(--background)" className="stroke-teal" strokeWidth={2} />}
							<circle cx={x(d)} cy={cy} r={5} className="fill-teal" />
							<text x={x(d) + (reached ? 9 : 0)} y={reached ? cy + 3.5 : cy - 7} textAnchor={reached ? "start" : "middle"} className="fill-muted-foreground font-ui" fontSize={10}>
								{reached ? "now" : (monthOf(m.eta.planned) ?? "")}
							</text>
						</g>
					);
				})}
			</svg>
			{/* Phones: the same rows as a list, since the SVG labels are too small below sm. */}
			<ol className="space-y-2 sm:hidden" aria-label="When each milestone lands at your planned pace and at your real pace">
				{dated.map((m) => {
					const reached = m.status === "reached";
					const d = m.eta.daysPlanned ?? 0;
					const level = m.def.cefr?.split(":")[0];
					return (
						<li key={m.def.id} className="q-card px-3 py-2" data-testid={`timeline-list-${m.def.id}`}>
							<p className="font-ui text-sm font-semibold text-foreground">{m.def.title}</p>
							{level && <p className="font-ui text-xs text-muted-foreground">Target: {level}</p>}
							<p className="mt-1 font-ui text-xs text-foreground">{reached ? "Within reach now." : `At your plan: ${when(d, m.eta.planned)}`}</p>
							{!reached && <p className="font-ui text-xs text-muted-foreground">{!paceKnown ? "Real pace: not enough data yet." : m.eta.daysPace === null ? "Real pace: no date yet." : `At your real pace: ${when(m.eta.daysPace, m.eta.pace)}`}</p>}
							{!reached && m.binding !== "none" && <p className="font-ui text-xs text-muted-foreground">{m.binding === "speed" ? "Speed is the longer road." : m.binding === "words" ? "Words are the longer road." : ""}</p>}
						</li>
					);
				})}
			</ol>
			{(() => {
				const i = dated.findIndex((m) => m.def.id === tip);
				const m = dated[i];
				if (!m) return null;
				const reached = m.status === "reached";
				const cy = top + i * rowH + rowH / 2;
				const anchor = x(m.eta.daysPlanned ?? 0) / W;
				return (
					<div
						role="tooltip"
						data-testid="timeline-tip"
						className="pointer-events-none absolute z-10 w-72 max-w-[85%] rounded-xl bg-popover px-3 py-2 text-xs text-popover-foreground shadow-raise-hi"
						style={{ top: `calc(${(cy / H) * 100}% + 14px)`, left: `${Math.min(Math.max(anchor * 100, 22), 78)}%`, transform: "translateX(-50%)" }}
					>
						<p className="text-sm font-semibold text-foreground">{m.def.title}</p>
						{m.def.line && <p className="mt-0.5 text-muted-foreground">{m.def.line}</p>}
						<p className="mt-1.5 text-foreground">{reached ? "Within reach now." : `${when(m.eta.daysPlanned, m.eta.planned)} at your plan.`}</p>
						{!reached && <p className="text-muted-foreground">{!paceKnown ? "Real pace: not enough data yet." : m.eta.daysPace === null ? "Real pace: no date yet." : `${when(m.eta.daysPace, m.eta.pace)} at your real pace.`}</p>}
						{!reached && <p className="mt-1 text-muted-foreground">{m.binding === "speed" ? "Speed is the longer road." : m.binding === "words" ? "Words are the longer road." : ""}</p>}
					</div>
				);
			})()}
			{/* The legend describes the chart only; phones read the list, which states its own pace lines. */}
			<figcaption className="mt-1 hidden font-ui text-xs text-muted-foreground sm:block">
				Filled dot: at your planned minutes.{" "}
				{paceKnown ? "Hollow dot on the dashed tail: at your real pace of the last two weeks." : "Your real pace appears here once seven of the last fourteen days have study in them."} Hover or tab to a row for the full name and details.
			</figcaption>
		</figure>
	);
}

// ─── One milestone ──────────────────────────────────────────────────────────

function MilestoneCard({ m, facts, goals, open, onToggle, onRemove, scene, onSaveOutcome }: { m: MilestoneEstimate; facts: LearnerFacts | null; goals: MilestonesReport["goals"]; open: boolean; onToggle: () => void; onRemove?: () => void; scene?: DatedSceneView; onSaveOutcome?: (line: string) => Promise<string | null> }) {
	const st = STATUS[m.status];
	const genre = GENRES[m.def.genre];
	const lemmas = genreLemmas(genre);
	return (
		<li className="q-card" data-testid={`milestone-${m.def.id}`}>
			<button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-4 p-4 text-left">
				<span className={cn("mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl", m.status === "reached" ? "bg-teal-wash text-teal-2" : "bg-well text-ink-2")}>
					<Icon name={m.def.icon} className="size-6" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span className="font-ui text-lg font-semibold text-foreground">{m.def.title}</span>
						<span className={cn("rounded-md px-1.5 py-0.5 font-ui text-[11px] font-semibold", st.cls)}>{st.label}</span>
						{m.def.custom && <span className="rounded-md bg-well-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">yours</span>}
					</span>
					<span className="mt-0.5 block font-prose text-sm text-muted-foreground">{m.def.line}</span>
					<span className="mt-2 block font-ui text-sm text-foreground" data-testid={`milestone-${m.def.id}-eta`}>
						{m.status === "reached" ? (
							<b>Within reach now</b>
						) : (
							<>
								<b>{when(m.eta.daysPlanned, m.eta.planned)}</b> at your plan
								{m.eta.daysPace !== null ? (
									<span className="text-muted-foreground"> · {when(m.eta.daysPace, m.eta.pace)} at your real pace</span>
								) : (
									<span className="text-muted-foreground"> · real pace: not enough data yet</span>
								)}
							</>
						)}
					</span>
					<span className="mt-3 grid gap-2 sm:grid-cols-2">
						<Meter label="Words" have={m.words.have} need={m.words.need} line={`${n(m.words.have)} of ≈${n(m.words.need)} lemmas · ${pct(m.words.coverageNow)} of the words, needs ${pct(m.words.coverageTarget)}`} binding={m.binding === "words"} />
						{m.speed.need > 0 ? (
							<Meter label="Speed" have={m.speed.have} need={m.speed.need} line={`${m.speed.have} of ${m.speed.need} words a minute${m.speed.basis === "level" ? " (assumed)" : ""}`} binding={m.binding === "speed"} dim={m.speed.basis === "level"} />
						) : (
							<Meter label="Speed" have={1} need={1} line="you set the pace" binding={false} />
						)}
					</span>
				</span>
				<ChevronDownIcon className={cn("mt-1 size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
			</button>
			{scene && onSaveOutcome && <SceneDates scene={scene} onSave={onSaveOutcome} />}
				{open && (
				<div className="border-t px-4 pb-4 pt-3 font-prose text-sm leading-relaxed text-muted-foreground lh-rise" data-testid={`milestone-${m.def.id}-details`}>
					<p className="text-foreground">{m.verdict}</p>
					{m.missing.length > 0 && (
						<ul className="mt-2 flex flex-col gap-1.5">
							{m.missing.map((line) => (
								<li key={line} className="flex gap-2">
									<span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" aria-hidden="true" />
									<span>{line}</span>
								</li>
							))}
						</ul>
					)}
					<dl className="mt-3 grid gap-x-6 gap-y-2 font-ui text-xs sm:grid-cols-2">
						<Row k="Words at your plan" v={`${when(m.words.eta.daysPlanned, m.words.eta.planned)}${facts ? ` · ${Math.round((facts.wordsPerDayPlanned * facts.daysPerWeek) / 7 * 10) / 10} new words a day` : ""}`} />
						<Row k="Words at your real pace" v={m.words.eta.daysPace === null ? (facts?.wordsPerDayReal === null ? "after two weeks in the deck" : "no new words lately") : `${when(m.words.eta.daysPace, m.words.eta.pace)}${facts?.wordsPerDayReal ? ` · ${Math.round(facts.wordsPerDayReal * 10) / 10} a day` : ""}`} />
						{m.speed.need > 0 && <Row k="Speed at your plan" v={`${when(m.speed.eta.daysPlanned, m.speed.eta.planned)} · about ${n(m.speed.hoursToGo)} guided hours${m.speed.hoursBasis === "trend" ? ", from your own Listen trend" : ", by the hours ladder"}`} />}
						{m.speed.need > 0 && <Row k="Speed at your real pace" v={m.speed.eta.daysPace === null ? "not enough data yet (needs 7 study days of the last 14)" : when(m.speed.eta.daysPace, m.speed.eta.pace)} />}
						<Row k="Kind of language" v={`${genre.title}: about ${n(lemmas.n95)} lemmas for 95% of the words, ${n(lemmas.n98)} for 98%`} />
						<Row k="Support" v={SUPPORT_LINE[m.def.support]} />
						{m.def.cefr && <Row k="CEFR" v={m.def.cefr} />}
						{m.def.custom && <Row k="Your words" v={`“${m.def.custom}”`} />}
					</dl>
					{m.def.goals && m.def.goals.some((g) => goals[g]) && (
						<p className="mt-3">
							<span className="font-ui text-xs font-semibold text-foreground">On the map: </span>
							{m.def.goals
								.filter((g) => goals[g])
								.map((g) => `${goals[g]!.title} (${goals[g]!.done ? "done" : goals[g]!.open ? "open" : "ahead"})`)
								.join(" · ")}
						</p>
					)}
					<p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-xs">
						<span className="font-semibold text-foreground">What moves it:</span>
						<Link href="/listen" className="underline hover:text-foreground">
							Listen
						</Link>
						<Link href="/read" className="underline hover:text-foreground">
							Read
						</Link>
						<Link href="/review" className="underline hover:text-foreground">
							Review
						</Link>
						{m.binding === "speed" && <span>— speed grows from hearing what you already know, at pace, every day.</span>}
						{m.binding === "words" && <span>— the next words are below; the deck spaces them for you.</span>}
					</p>
					<p className="mt-2 font-ui text-xs text-muted-foreground/80">Source for this kind of language: {genre.source}.</p>
					{onRemove && (
						<button type="button" onClick={onRemove} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-ui text-xs font-semibold text-muted-foreground hover:bg-[var(--q-miss-wash)] hover:text-miss" data-testid={`milestone-${m.def.id}-remove`}>
							<XIcon className="size-3.5" />
							Remove this milestone
						</button>
					)}
				</div>
			)}
		</li>
	);
}

/** A scene's date, its days and where the estimate stands. Once the date has
 *  passed, the one line "How did it go?" saves through /api/milestones/dated. */
function SceneDates({ scene, onSave }: { scene: DatedSceneView; onSave: (line: string) => Promise<string | null> }) {
	const [line, setLine] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const save = async () => {
		const t = line.trim();
		if (!t || busy) return;
		setBusy(true);
		setError(null);
		const failed = await onSave(t);
		setBusy(false);
		if (failed) setError(failed);
	};
	return (
		<div className="border-t px-4 pb-4 pt-3 font-ui text-sm" data-testid={`scene-${scene.id}`}>
			<p className="text-foreground">
				<b>{dateInWords(scene.date)}</b> · {daysLeftWords(scene.daysLeft)}
			</p>
			<p className="mt-1 font-prose text-sm text-muted-foreground" data-testid={`scene-${scene.id}-status`}>
				{scene.line}
			</p>
			{scene.outcome && (
				<p className="mt-2 font-prose text-sm text-foreground" data-testid={`scene-${scene.id}-outcome`}>
					<span className="text-muted-foreground">How it went: </span>
					{scene.outcome.text}
				</p>
			)}
			{scene.outcomeDue && (
				<form
					className="mt-3 flex flex-wrap items-stretch gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						void save();
					}}
				>
					<span className="w-full font-semibold text-foreground sm:w-auto sm:self-center">How did it go?</span>
					<SceneInput value={line} onChange={setLine} placeholder="One line" disabled={busy} label="How did it go?" testId={`scene-${scene.id}-line`} className="w-full sm:flex-1" />
					<button type="submit" disabled={busy || line.trim().length === 0} className="q-btn sec h-11 w-full sm:w-auto" data-testid={`scene-${scene.id}-save`}>
						{busy ? "Saving…" : "Save"}
					</button>
				</form>
			)}
			{error && (
				<p role="alert" className="mt-2 text-miss">
					{error}
				</p>
			)}
		</div>
	);
}

/** The custom-milestone text box, shared by "Add your own" and "Add a scene with a date". */
function SceneInput({ value, onChange, placeholder, disabled, label, testId, className = "flex-1" }: { value: string; onChange: (text: string) => void; placeholder: string; disabled: boolean; label: string; testId: string; className?: string }) {
	return (
		<input
			value={value}
			onChange={(e) => onChange(e.target.value.slice(0, MAX_CUSTOM_LENGTH))}
			placeholder={placeholder}
			disabled={disabled}
			aria-label={label}
			className={cn("q-field min-h-11 min-w-0 rounded-lg px-4 py-2.5 text-base", className)}
			data-testid={testId}
		/>
	);
}

function Row({ k, v }: { k: string; v: string }) {
	return (
		<div className="min-w-0">
			<dt className="font-semibold text-muted-foreground">{k}</dt>
			<dd className="text-foreground">{v}</dd>
		</div>
	);
}

/** A thin meter: what you have against what it needs, the target at the
 *  right edge, the binding gap in the accent. */
function Meter({ label, have, need, line, binding, dim }: { label: string; have: number; need: number; line: string; binding: boolean; dim?: boolean }) {
	const share = need > 0 ? Math.min(1, have / need) : 1;
	const full = share >= 1;
	return (
		<span className="block min-w-0">
			<span className="flex items-baseline justify-between gap-2">
				<span className={cn("font-ui text-xs font-semibold", binding ? "text-foreground" : "text-muted-foreground")}>
					{label}
					{binding && <span className="ml-1.5 rounded bg-foreground/10 px-1 py-px text-xs font-semibold text-foreground">the gap</span>}
				</span>
				<span className="font-ui text-xs tabular-nums text-muted-foreground">{pct(share)}</span>
			</span>
			<span className="relative mt-1 block h-2 overflow-hidden rounded-full bg-well-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label={`${label}: ${line}`}>
				<span className={cn("lh-fill absolute inset-0 rounded-full", full ? "bg-teal" : dim ? "bg-teal/50" : "bg-teal")} style={fillStyle(share)} />
			</span>
			<span className="mt-1 block font-prose text-xs leading-snug text-muted-foreground">{line}</span>
		</span>
	);
}

// ─── The next words ─────────────────────────────────────────────────────────

function NextWords({ words, queued, onQueue }: { words: NextWord[]; queued: Set<string>; onQueue: (slugs: string[]) => void }) {
	const left = words.filter((w) => !queued.has(w.slug));
	return (
		<section className="mt-6 q-card p-4" data-testid="milestone-next-words">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h2 className="font-ui text-sm font-semibold text-foreground">The next words that pay most</h2>
				<p className="font-ui text-xs text-muted-foreground">commonest in the dictionary's sentences, not yet yours</p>
			</div>
			<ul className="mt-3 flex flex-wrap gap-2">
				{words.map((w) => (
					<li key={w.slug} className={cn("rounded-lg px-3 py-1.5 text-sm text-foreground", queued.has(w.slug) ? "bg-teal-wash shadow-[inset_0_0_0_1px_var(--q-teal-line)]" : "bg-well")} title={`${w.cat} · #${w.rank} by frequency`}>
						<b>{w.lemma}</b> <span className="text-muted-foreground">{w.gloss}</span>
					</li>
				))}
			</ul>
			<div className="mt-3 flex flex-wrap items-center gap-3">
				<button type="button" onClick={() => onQueue(left.slice(0, 10).map((w) => w.slug))} disabled={left.length === 0} className="q-btn sec t" data-testid="milestone-queue">
					<PlusIcon className="size-4" />
					{left.length === 0 ? "All in the deck" : `Put the next ${Math.min(10, left.length)} in Review`}
				</button>
				<span className="font-prose text-xs text-muted-foreground">They come up in the deck ahead of frequency order, a few a day.</span>
			</div>
		</section>
	);
}

export type { Eta };
