"use client";
/**
 * Settings → Spending: the running total, this month, each kind of session,
 * every session's cost and the audio library. Reads GET /api/usage once per
 * open. Every figure is folded from the records on disk, the same numbers
 * `npm run corpus:export` writes to summary.json.
 */

import { useEffect, useState } from "react";
import { formatTokens, formatUsd } from "@/components/usage-format";
import type { SessionMode, UsageReport } from "@/src/core";
import { SettingsGroup } from "./controls.tsx";

const MODE_LABEL: Record<SessionMode, string> = {
	learn: "Learn a topic",
	chat: "Chat",
	talk: "Talk",
	story: "Story",
	why: "Why?",
	practice: "Practice",
};

function monthLabel(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString("en-GB", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

function dateLabel(iso: string): string {
	return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function usd(n: number | null): string {
	return n === null ? "—" : formatUsd(n);
}

export function UsageSection() {
	const [report, setReport] = useState<UsageReport | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showAll, setShowAll] = useState(false);

	useEffect(() => {
		fetch("/api/usage")
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
			.then((body: UsageReport) => setReport(body))
			.catch((e: Error) => setError(e.message));
	}, []);

	if (error) return <p className="text-sm text-destructive">Couldn't load spending: {error}</p>;
	if (!report) return <p className="text-sm text-muted-foreground">Adding it up…</p>;

	const thisMonth = report.byMonth[0];
	const sessions = showAll ? report.sessions : report.sessions.slice(0, 12);
	const sessionTotal = (s: UsageReport["sessions"][number]) => (s.costUsd ?? 0) + s.jobsUsd;

	return (
		<div data-testid="usage-section" className="flex flex-col gap-8">
			<SettingsGroup label="So far">
				<div className="flex flex-wrap gap-6">
					<Stat label="All time" value={formatUsd(report.totalUsd)} testid="usage-total" />
					<Stat
						label={thisMonth ? monthLabel(thisMonth.month) : "This month"}
						value={thisMonth ? formatUsd(thisMonth.usd) : "$0.00"}
					/>
					<Stat label="Tutor turns" value={String(report.sessions.reduce((n, s) => n + s.turns, 0))} />
					<Stat
						label="Tokens"
						value={`${formatTokens(report.tokens.input + report.tokens.cacheRead + report.tokens.cacheWrite)} in · ${formatTokens(report.tokens.output)} out`}
					/>
				</div>
				<p className="text-xs text-muted-foreground">
					Tutor replies {formatUsd(report.turnsUsd)}
					{report.jobsUsd > 0 && <> · background tasks {formatUsd(report.jobsUsd)}</>}
					{report.stories.count > 0 && (
						<>
							{" "}
							· {report.stories.count} story {report.stories.count === 1 ? "episode" : "episodes"}{" "}
							{formatUsd(report.storiesUsd)}
						</>
					)}
					{(report.speak?.count ?? 0) > 0 && (
						<>
							{" "}
							· {report.speak.count} spoken {report.speak.count === 1 ? "scene" : "scenes"} {formatUsd(report.speakUsd)}
						</>
					)}
					{(report.videos?.count ?? 0) > 0 && (
						<>
							{" "}
							· {report.videos.count} {report.videos.count === 1 ? "video" : "videos"} prepared{" "}
							{formatUsd(report.videosUsd)}
						</>
					)}
					{(report.placement?.count ?? 0) > 0 && (
						<>
							{" "}
							· {report.placement!.count} placement {report.placement!.count === 1 ? "check" : "checks"}{" "}
							{formatUsd(report.placementUsd ?? 0)}
						</>
					)}
					{(report.wordChecks?.count ?? 0) > 0 && (
						<>
							{" "}
							· {report.wordChecks!.count} word {report.wordChecks!.count === 1 ? "check" : "checks"}{" "}
							{formatUsd(report.wordChecksUsd ?? 0)}
						</>
					)}
					{(report.writing?.count ?? 0) > 0 && (
						<>
							{" "}
							· {report.writing!.count} writing {report.writing!.count === 1 ? "check" : "checks"}{" "}
							{formatUsd(report.writingUsd ?? 0)}
							{report.writing!.unpriced > 0 && ` (${report.writing!.unpriced} unpriced)`}
						</>
					)}
					{(report.languages?.count ?? 0) > 0 && (
						<>
							{" "}
							· {report.languages!.count} {report.languages!.count === 1 ? "language" : "languages"} added (course and
							stories) {formatUsd(report.languagesUsd ?? 0)}
						</>
					)}
					{report.unpricedTurns > 0 && <> · {report.unpricedTurns} turns had no known price and are not counted</>}.
					Lessons, Blitz, Review, Listen and Speed run on this computer and cost nothing.
				</p>
			</SettingsGroup>

			<SettingsGroup label="By kind">
				<table className="w-full text-sm">
					<tbody>
						{report.byMode.map((m) => (
							<tr key={m.mode} className="border-t border-border/40 first:border-t-0">
								<td className="py-1.5 pr-3 text-foreground">{MODE_LABEL[m.mode]}</td>
								<td className="py-1.5 pr-3 text-muted-foreground">
									{m.sessions} {m.sessions === 1 ? "session" : "sessions"} · {m.turns}{" "}
									{m.turns === 1 ? "turn" : "turns"}
								</td>
								<td className="py-1.5 text-right tabular-nums text-foreground">{formatUsd(m.usd)}</td>
							</tr>
						))}
						{report.byMode.length === 0 && (
							<tr>
								<td className="py-1.5 text-muted-foreground">No tutor sessions yet.</td>
							</tr>
						)}
					</tbody>
				</table>
			</SettingsGroup>

			{report.byMonth.length > 1 && (
				<SettingsGroup label="By month">
					<table className="w-full text-sm">
						<tbody>
							{report.byMonth.map((m) => (
								<tr key={m.month} className="border-t border-border/40 first:border-t-0">
									<td className="py-1.5 pr-3 text-foreground">{monthLabel(m.month)}</td>
									<td className="py-1.5 pr-3 text-muted-foreground">
										{m.turns} {m.turns === 1 ? "turn" : "turns"}
									</td>
									<td className="py-1.5 text-right tabular-nums text-foreground">{formatUsd(m.usd)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</SettingsGroup>
			)}

			<SettingsGroup label="Sessions">
				<table className="w-full text-sm" data-testid="usage-sessions">
					<tbody>
						{sessions.map((s) => (
							<tr key={s.id} className="border-t border-border/40 first:border-t-0">
								<td className="max-w-[16rem] truncate py-1.5 pr-3 text-foreground">
									{s.deleted ? (
										<span className="text-muted-foreground line-through">{s.title}</span>
									) : (
										<a href={`/chat/${s.id}`} className="hover:underline">
											{s.title}
										</a>
									)}
								</td>
								<td className="whitespace-nowrap py-1.5 pr-3 text-muted-foreground">
									{MODE_LABEL[s.mode]} · {dateLabel(s.createdAt)} · {s.turns} {s.turns === 1 ? "turn" : "turns"}
								</td>
								<td className="py-1.5 text-right tabular-nums text-foreground">
									{s.turns === 0 ? "—" : usd(s.costUsd === null && s.jobsUsd === 0 ? null : sessionTotal(s))}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{report.sessions.length > 12 && (
					<button
						type="button"
						onClick={() => setShowAll((v) => !v)}
						className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
					>
						{showAll ? "Show fewer" : `Show all ${report.sessions.length}`}
					</button>
				)}
			</SettingsGroup>

			<SettingsGroup label="Audio library">
				<p className="text-sm text-foreground">
					{report.audio.clips} {report.audio.clips === 1 ? "clip" : "clips"} kept (
					{(report.audio.bytes / 1_048_576).toFixed(1)} MB)
					{Object.entries(report.audio.byTier).length > 0 && (
						<span className="text-muted-foreground">
							{" "}
							·{" "}
							{Object.entries(report.audio.byTier)
								.map(
									([tier, n]) =>
										`${n} ${tier === "elevenlabs" ? "ElevenLabs" : tier === "edge" ? "Edge" : tier === "piper" ? "Piper" : "from the old cache"}`,
								)
								.join(", ")}
						</span>
					)}
				</p>
				<p className="text-xs text-muted-foreground">
					{report.audio.elevenLabsCharacters > 0 && (
						<>
							{report.audio.elevenLabsCharacters.toLocaleString("en-GB")} ElevenLabs characters spoken so far, counted
							against your plan.{" "}
						</>
					)}
					A sentence is spoken once, kept on this computer and replayed after that, so no clip is paid for twice.
				</p>
			</SettingsGroup>
		</div>
	);
}

function Stat({ label, value, testid }: { label: string; value: string; testid?: string }) {
	return (
		<div data-testid={testid}>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="font-ui text-xl font-semibold tabular-nums text-foreground">{value}</p>
		</div>
	);
}
