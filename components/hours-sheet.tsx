"use client";

/**
 * "How long does it take?" (LangHarness, 2026-10-28) — the research behind
 * the goal line's hours, in one sheet: the guided-hour bands per CEFR
 * level (Cambridge's figures for English next to this app's estimate for
 * Slovak), the FSI yardstick for a category-III language, and what the
 * learner's own pace makes of them. Opened from the goal line on Today
 * and from the setup's time screen.
 *
 * The chart is one emphasis form: the app's estimate in the accent, the
 * English reference in gray, the FSI figure as a reference line; a
 * table view carries the same numbers for anyone who prefers them.
 * Every figure is a planning estimate and says so.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CEFR_ORDER, GUIDED_HOURS, languageName, weeklyHours, type Cefr, type Lang } from "@/src/core";

/** Cambridge English's guided-learning-hour bands (cumulative, midpoints):
 *  A1 ≈ 90–100, A2 ≈ 180–200, B1 ≈ 350–400, B2 ≈ 500–600, C1 ≈ 700–800. */
const CAMBRIDGE_ENGLISH: Record<Cefr, number> = { A1: 95, A2: 190, B1: 375, B2: 550, C1: 750 };
/** FSI: a category-III language (Slovak among them) takes about 1,100
 *  class hours to professional working proficiency (ILR 3 ≈ B2/C1). */
const FSI_CAT3 = 1100;
const FSI_CAT1 = 700;

const LEVEL_LINE: Record<Cefr, string> = {
	A1: "Introduce yourself, order, ask the way",
	A2: "Shop, make appointments, tell what happened",
	B1: "Tell stories, give opinions, deal with offices",
	B2: "Argue a point, follow film and news, write formally",
	C1: "Nuance, register, long texts with ease",
};

export const STUDIES: Array<{ who: string; what: string; line: string }> = [
	{
		who: "Cambridge English (Cambridge Assessment)",
		what: "Guided learning hours per CEFR level",
		line: "The gray bars: about 90–100 hours of guided learning for A1, 180–200 for A2, 350–400 for B1, 500–600 for B2, 700–800 for C1 — for English, with as much again in independent study.",
	},
	{
		who: "U.S. Foreign Service Institute",
		what: "Language difficulty categories",
		line: "Slovak sits in category III with Czech, Polish and Russian: about 44 weeks, 1,100 class hours, to professional working proficiency (ILR 3, roughly B2–C1). French or Spanish take 600–750.",
	},
	{
		who: "Ringbom (2007), Cross-linguistic Similarity in Foreign Language Learning",
		what: "Why the first language matters",
		line: "Learners whose languages already have the target's structures learn them faster. A language with cases (Estonian, Finnish, German, Latvian…) is a real head start on Slovak cases; a Slavic language is a bigger one. The green bars sit between the two yardsticks for that reason.",
	},
	{
		who: "Cepeda, Pashler, Vul, Wixted & Rohrer (2006), Psychological Bulletin",
		what: "Distributed practice",
		line: "A review of 254 studies: the same hours spread over many short sessions are remembered far better than the same hours in a few long ones. That is why the plan asks for minutes a day, not hours a week.",
	},
];

/** What each known language is worth as a head start on Slovak, for the
 *  note under the chart. Slavic languages share the case system and the
 *  vocabulary; the others listed have cases of their own (Ringbom 2007). */
const HEAD_START: Partial<Record<Lang, string>> = {
	ru: "Slavic, the same six cases",
	uk: "Slavic, the same case logic",
	pl: "Slavic, cases and aspect",
	cs: "Slavic, nearly the same grammar",
	sl: "Slavic, cases and aspect",
	hr: "Slavic, seven cases",
	bg: "Slavic vocabulary and aspect",
	et: "14 cases",
	fi: "15 cases",
	hu: "cases",
	lv: "seven cases",
	lt: "seven cases",
	de: "four cases and gender",
	tr: "cases",
};

/** The one line that says what the green bars assume and whether this
 *  learner has it. Xurify (2026-10-28): the old legend said "from
 *  Estonian", which read as the app's language; the hours table does not
 *  change by language, the assumption behind it does. */
export function headStartLine(languages: readonly Lang[]): string {
	const have = languages.filter((l) => HEAD_START[l]).map((l) => `${languageName(l)} (${HEAD_START[l]})`);
	const worth = `the gap to the FSI line, ${FSI_CAT3 - GUIDED_HOURS.C1}–${FSI_CAT3 - GUIDED_HOURS.B2} hours at B2–C1`;
	const assume = "The green bars assume a head start: a language you know that already has cases, or is Slavic.";
	if (have.length === 0) return `${assume} None of yours is, so read nearer the FSI line; the head start is ${worth} (Ringbom 2007).`;
	return `${assume} Yours: ${have.join(", ")}. The head start is ${worth} (Ringbom 2007).`;
}

function monthOf(d: Date): string {
	return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function HoursSheet({
	open,
	languages = [],
	onClose,
	minutesPerDay,
	daysPerWeek,
	target,
	hoursDone = 0,
}: {
	open: boolean;
	onClose: () => void;
	minutesPerDay: number;
	daysPerWeek: number;
	target: Cefr;
	hoursDone?: number;
	/** The learner's languages, for the head-start note under the chart. */
	languages?: readonly Lang[];
}) {
	const [view, setView] = useState<"chart" | "table">("chart");
	const [hover, setHover] = useState<{ level: Cefr; series: "app" | "en" } | null>(null);
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);
	if (!open) return null;

	const weekly = weeklyHours(minutesPerDay, daysPerWeek);
	const yearly = weekly * 52;
	const now = new Date();
	const dateFor = (hours: number) => (weekly > 0 ? monthOf(new Date(now.getTime() + Math.max(0, hours - hoursDone) / weekly * 7 * 86_400_000)) : "—");

	// Chart geometry: horizontal grouped bars, one row per level.
	const W = 560;
	const left = 44;
	const right = 24;
	const rowH = 46;
	const bar = 14;
	const gap = 2;
	const top = 18;
	const max = 1200;
	const x = (h: number) => left + ((W - left - right) * h) / max;
	const H = top + rowH * CEFR_ORDER.length + 28;
	const ticks = [0, 300, 600, 900, 1200];

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="How long does it take?" data-testid="hours-sheet">
			<div className="lh-rise max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 bg-card p-6">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="font-ui text-2xl font-black text-foreground">How long does it take?</h2>
						<p className="mt-1 font-prose text-base text-muted-foreground">Guided hours to each level: this app&apos;s estimate for Slovak next to the usual figures for English, and the FSI yardstick for a language in Slovak&apos;s category.</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</button>
				</div>

				<div className="mt-4 flex items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-xs text-muted-foreground" aria-label="Legend">
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-2.5 rounded-sm bg-go" aria-hidden="true" />
							This app · Slovak
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-2.5 rounded-sm bg-muted-foreground/50" aria-hidden="true" />
							Cambridge · English
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block h-3 w-0.5 bg-flame" aria-hidden="true" />
							FSI · category III (1,100 h)
						</span>
					</div>
					<div className="flex rounded-lg border p-0.5" role="group" aria-label="View">
						{(["chart", "table"] as const).map((v) => (
							<button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 font-ui text-xs font-bold capitalize", view === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
								{v}
							</button>
						))}
					</div>
				</div>

				{view === "chart" ? (
					<div className="relative mt-3">
						<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Guided hours to each CEFR level, this app's estimate against Cambridge's figures for English, with the FSI figure as a reference line">
							{ticks.map((t) => (
								<g key={t}>
									<line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 24} stroke="var(--border)" strokeWidth={1} />
									<text x={x(t)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-ui" fontSize={11}>
										{t === 0 ? "0" : `${t} h`}
									</text>
								</g>
							))}
							{/* FSI reference */}
							<line x1={x(FSI_CAT3)} x2={x(FSI_CAT3)} y1={top - 6} y2={H - 24} stroke="var(--lh-flame)" strokeWidth={2} />
							<line x1={x(FSI_CAT1)} x2={x(FSI_CAT1)} y1={top - 6} y2={H - 24} stroke="var(--lh-flame)" strokeWidth={1} strokeOpacity={0.45} />
							<text x={x(FSI_CAT1) - 4} y={top - 8} textAnchor="end" className="fill-muted-foreground font-ui" fontSize={10}>
								FSI cat. I
							</text>
							<text x={x(FSI_CAT3) - 4} y={top - 8} textAnchor="end" className="fill-muted-foreground font-ui" fontSize={10}>
								FSI cat. III
							</text>
							{CEFR_ORDER.map((lv, i) => {
								const y0 = top + i * rowH;
								const app = GUIDED_HOURS[lv];
								const en = CAMBRIDGE_ENGLISH[lv];
								const dim = hover && hover.level !== lv;
								return (
									<g key={lv} opacity={dim ? 0.45 : 1} className="transition-opacity">
										<text x={left - 10} y={y0 + bar + gap + 4} textAnchor="end" className="fill-foreground font-ui" fontSize={13} fontWeight={800}>
											{lv}
										</text>
										<rect x={left} y={y0} width={Math.max(0, x(app) - left)} height={bar} rx={0} className="fill-go" style={{ clipPath: `inset(0 0 0 0 round 0 4px 4px 0)` }} onMouseEnter={() => setHover({ level: lv, series: "app" })} onMouseLeave={() => setHover(null)}>
											<title>{`${lv}: about ${app} guided hours (this app, Slovak)`}</title>
										</rect>
										<text x={x(app) + 6} y={y0 + bar - 3} className="fill-foreground font-ui" fontSize={11} fontWeight={700}>
											{app}
										</text>
										<rect x={left} y={y0 + bar + gap} width={Math.max(0, x(en) - left)} height={bar} className="fill-muted-foreground/50" style={{ clipPath: `inset(0 0 0 0 round 0 4px 4px 0)` }} onMouseEnter={() => setHover({ level: lv, series: "en" })} onMouseLeave={() => setHover(null)}>
											<title>{`${lv}: about ${en} guided hours (Cambridge, English)`}</title>
										</rect>
										{lv === target && (
											<text x={x(Math.max(app, en)) + 6} y={y0 + bar * 2 + gap - 3} className="fill-muted-foreground font-ui" fontSize={10}>
												your target · {dateFor(app)} at your pace
											</text>
										)}
									</g>
								);
							})}
						</svg>
						{/* The hover readout sits under the plot, where it covers nothing. */}
						<p className="mt-1 min-h-5 font-ui text-xs text-muted-foreground" role="status" aria-live="polite">
							{hover ? (
								<>
									<b className="text-foreground">{hover.level}</b> · {hover.series === "app" ? `about ${GUIDED_HOURS[hover.level]} h in this app` : `about ${CAMBRIDGE_ENGLISH[hover.level]} h for English (Cambridge)`} · {LEVEL_LINE[hover.level]}
								</>
							) : (
								"Hover a bar for what the level means."
							)}
						</p>
					</div>
				) : (
					<table className="mt-3 w-full font-ui text-sm">
						<thead>
							<tr className="text-left text-xs text-muted-foreground">
								<th className="py-1 font-bold">Level</th>
								<th className="py-1 font-bold">This app (Slovak)</th>
								<th className="py-1 font-bold">Cambridge (English)</th>
								<th className="py-1 font-bold">At your pace</th>
							</tr>
						</thead>
						<tbody>
							{CEFR_ORDER.map((lv) => (
								<tr key={lv} className={cn("border-t", lv === target && "text-foreground font-bold")}>
									<td className="py-1.5">{lv}</td>
									<td className="py-1.5 tabular-nums">{GUIDED_HOURS[lv]} h</td>
									<td className="py-1.5 tabular-nums">{CAMBRIDGE_ENGLISH[lv]} h</td>
									<td className="py-1.5 tabular-nums">{dateFor(GUIDED_HOURS[lv])}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				<p className="mt-3 font-prose text-sm text-muted-foreground" data-testid="hours-head-start">
					{headStartLine(languages)}
				</p>

				<p className="mt-3 rounded-xl bg-accent/60 px-4 py-3 font-prose text-sm text-foreground" data-testid="hours-pace">
					At <b>{minutesPerDay} min</b> × <b>{daysPerWeek} days</b> you put in about <b>{Math.round(yearly)} hours a year</b>, so {target} ({GUIDED_HOURS[target]} h{hoursDone > 0 ? `, ${Math.round(hoursDone)} done` : ""}) lands around <b>{dateFor(GUIDED_HOURS[target])}</b>. The map credits hours as units are done, so your real date moves with the evidence, not with this table.
				</p>

				<h3 className="mt-5 font-ui text-xs font-bold tracking-wide text-muted-foreground">The studies behind the numbers</h3>
				<ol className="mt-2 flex flex-col gap-3">
					{STUDIES.map((s) => (
						<li key={s.who} className="font-prose text-sm leading-relaxed">
							<span className="block font-ui text-sm font-bold text-foreground">
								{s.what} <span className="font-normal text-muted-foreground">· {s.who}</span>
							</span>
							<span className="text-muted-foreground">{s.line}</span>
						</li>
					))}
				</ol>
				<p className="mt-4 font-prose text-xs text-muted-foreground">Guided hours mean lessons and tutoring with feedback; the bands assume about as much again in reading, listening and review on your own. All of it is a planning estimate.</p>
				<p className="mt-2 font-prose text-xs text-muted-foreground">
					Hours say when a level lands.{" "}
					<Link href="/milestones" className="underline hover:text-foreground" data-testid="hours-milestones">
						When can I…?
					</Link>{" "}
					says when real situations do: a vlog, the news, a film, the in-laws.
				</p>
			</div>
		</div>
	);
}
