"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SpeakingReport, SpeakingTrends, Trend } from "@/src/core";
import { cn } from "@/lib/utils";

const TREND: Record<Trend, { label: string; ink: string }> = {
	better: { label: "Getting better", ink: "text-teal-2" },
	worse: { label: "Getting worse", ink: "text-miss" },
	steady: { label: "Steady", ink: "text-ink-3" },
	new: { label: "Too few talks to say", ink: "text-ink-3" },
};

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

export function SpeakingSection() {
	const [data, setData] = useState<{ reports: SpeakingReport[]; trends: SpeakingTrends } | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let alive = true;
		fetch("/api/speak/live/report")
			.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((body: { reports: SpeakingReport[]; trends: SpeakingTrends }) => {
				if (alive) setData(body);
			})
			.catch(() => {
				if (alive) setFailed(true);
			});
		return () => {
			alive = false;
		};
	}, []);

	if (failed) return null;
	if (!data) {
		return (
			<section className="mt-9" aria-labelledby="speaking-title">
				<h2 id="speaking-title" className="q-sh">
					Speaking
				</h2>
				<p className="font-prose text-[13px] text-ink-3">Reading your talks…</p>
			</section>
		);
	}
	const { reports, trends } = data;
	if (reports.length === 0) {
		return (
			<section className="mt-9" aria-labelledby="speaking-title" data-testid="speaking-section">
				<h2 id="speaking-title" className="q-sh">
					Speaking
				</h2>
				<p className="max-w-prose font-prose text-[14px] text-ink-2">
					No live talks yet. A live talk is a real conversation with the tutor; when it ends, this page keeps what it
					measured: how much you spoke, how fast you replied, and the fillers to reach for.
				</p>
				<Link href="/speak/live" className="q-btn sec mt-3 inline-flex">
					Open live talk
				</Link>
			</section>
		);
	}
	return (
		<section className="mt-9" aria-labelledby="speaking-title" data-testid="speaking-section">
			<h2 id="speaking-title" className="q-sh">
				Speaking
			</h2>
			<p className="-mt-1 mb-3 max-w-prose font-prose text-[13px] text-ink-3">
				From your live talks, counted from the microphone and the transcript. The trend compares the last two weeks with
				what came before; a change is only called when it is bigger than chance.
			</p>

			<ul className="divide-y divide-[var(--q-line)]">
				{trends.metrics.map((m) => (
					<li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
						<span className="min-w-0">
							<span className="block font-ui text-[14px] font-[600] text-foreground">{m.label}</span>
							<span className="mt-0.5 block font-prose text-[13px] text-ink-3">{m.line}</span>
						</span>
						<span className="shrink-0 text-right">
							<span className="block font-prose text-[14px] tabular-nums text-foreground">{m.now}</span>
							<span className={cn("block font-ui text-[12px]", TREND[m.trend].ink)}>
								{m.recent != null && m.earlier != null && m.trend !== "new"
									? `${pct(m.earlier)} → ${pct(m.recent)} · ${TREND[m.trend].label}`
									: TREND[m.trend].label}
							</span>
						</span>
					</li>
				))}
			</ul>

			{trends.weakCells.length > 0 && (
				<div className="mt-5">
					<h3 className="q-lbl">Keeps slipping out loud</h3>
					<ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
						{trends.weakCells.map((c) => (
							<li key={c.cell} className="font-prose text-[14px] text-ink-2">
								{c.label} <span className="text-ink-3">· {c.sessions} talks</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{trends.fixedCells.length > 0 && (
				<div className="mt-5">
					<h3 className="q-lbl">Right again lately</h3>
					<ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
						{trends.fixedCells.map((c) => (
							<li key={c.cell} className="font-prose text-[14px] text-ink-2">
								{c.label}
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="mt-5">
				<h3 className="q-lbl">Fillers</h3>
				<p className="mt-1 max-w-prose font-prose text-[14px] text-ink-2">
					{trends.fillers.target + trends.fillers.english === 0
						? "No fillers either way in the last two weeks."
						: `${trends.fillers.target} in the language you are learning, ${trends.fillers.english} in English, in the last two weeks.`}
				</p>
			</div>

			<ul className="mt-5 flex flex-col divide-y divide-[var(--q-line)]">
				{reports.slice(0, 4).map((report) => (
					<li key={report.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
						<span className="min-w-0">
							<span className="block font-ui text-[14px] text-foreground">{report.title}</span>
							<span className="mt-0.5 block font-prose text-[12px] text-ink-3">
								{new Date(report.at).toLocaleDateString(undefined, { dateStyle: "medium" })} ·{" "}
								{Math.round(report.metrics.talkSec / 60)} min · you spoke{" "}
								{Math.round(report.metrics.learnerShare * 100)}%
							</span>
						</span>
						<span className="shrink-0 font-prose text-[13px] text-ink-3">
							{report.slips.length} {report.slips.length === 1 ? "repair" : "repairs"}
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
