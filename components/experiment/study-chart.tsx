"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHECK_ROUTE, type StudyLanguage } from "@/components/experiment/study-language";
import type { DailyExperimentRecord, WeeklyCheckRow } from "@/src/core";

export interface ChartDay {
	dayNumber: number;
	label: string;
}

export interface ChartFit {
	b0: number;
	b1: number;
	b2: number;
	b3: number;
}

interface StudyChartProps {
	days: ChartDay[];
	daily: DailyExperimentRecord[];
	checks: WeeklyCheckRow[];
	todayDay: number;
	treatment: StudyLanguage;
	control: StudyLanguage;
	onsetDay: number | null;
	switchWindow: { from: number; to: number };
	switchLabel: string;
	fit: ChartFit | null;
	minReps: number;
}

const GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_2rem] gap-x-2 sm:grid-cols-[5rem_minmax(0,1fr)_2rem]";
const TICKS = [0, 50, 100];
const pct = (fraction: number) => `${fraction * 100}%`;
const clampShare = (share: number) => Math.max(0, Math.min(1, share));

export function StudyChart({
	days,
	daily,
	checks,
	todayDay,
	treatment,
	control,
	onsetDay,
	switchWindow,
	switchLabel,
	fit,
	minReps,
}: StudyChartProps) {
	const total = days.length;
	const running = todayDay >= 1 && todayDay <= total;
	const [readDay, setReadDay] = useState<number | null>(null);
	const shownDay = readDay ?? (running ? todayDay : null);
	const byLanguage = useMemo(() => {
		const map = new Map<string, Map<number, DailyExperimentRecord>>();
		for (const record of daily) {
			if (!map.has(record.language)) map.set(record.language, new Map());
			map.get(record.language)!.set(record.dayNumber, record);
		}
		return map;
	}, [daily]);
	const firstOpen = checks.find((c) => c.state === "open");

	const dayFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
		const box = e.currentTarget.getBoundingClientRect();
		setReadDay(Math.max(1, Math.min(total, Math.floor(((e.clientX - box.left) / box.width) * total) + 1)));
	};
	const dayFromKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
		const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
		if (!step) return;
		e.preventDefault();
		setReadDay((d) => Math.max(1, Math.min(total, (d ?? (running ? todayDay : 1)) + step)));
	};

	const lanes = [
		{
			language: treatment,
			switchDay: onsetDay,
			fit,
			note: onsetDay !== null ? `listening first from day ${onsetDay}` : "switches on a random day",
		},
		{ language: control, switchDay: null, fit: null, note: "normal plan" },
	];

	return (
		<figure className="q-card px-3 pb-4 pt-4 sm:px-5 sm:pb-5" data-testid="study-chart">
			<figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-1 sm:px-0">
				<h2 className="font-ui text-sm font-semibold text-foreground">Understood on the first play</h2>
				<p className="font-ui text-xs text-muted-foreground">
					share of the day&apos;s Listen sentences typed right, with no replay
				</p>
			</figcaption>

			<div className={cn(GRID, "mt-3")} aria-hidden="true">
				<span />
				<div className="relative h-5">
					{onsetDay !== null ? (
						<>
							<span className="absolute inset-y-0 w-[1.5px] bg-teal" style={{ left: pct((onsetDay - 1) / total) }} />
							<span
								className="absolute bottom-0 whitespace-nowrap pl-2 font-ui text-[11.5px] leading-5 text-ink-2"
								style={{ left: pct((onsetDay - 1) / total) }}
							>
								{switchLabel}
							</span>
						</>
					) : (
						<>
							<span
								className="absolute bottom-0.5 h-2 rounded-t-[3px] border-x-[1.5px] border-t-[1.5px] border-[var(--q-teal-line)]"
								style={{
									left: pct((switchWindow.from - 1) / total),
									width: pct((switchWindow.to - switchWindow.from + 1) / total),
								}}
								data-testid="study-switch-window"
							/>
							<span
								className="absolute bottom-2.5 -translate-x-1/2 whitespace-nowrap font-ui text-[11.5px] leading-none text-ink-2"
								style={{ left: pct((switchWindow.from - 1 + (switchWindow.to - switchWindow.from + 1) / 2) / total) }}
							>
								{switchLabel}
							</span>
						</>
					)}
				</div>
				<span />
			</div>

			<div
				role="group"
				tabIndex={0}
				aria-label={`${treatment.name} and ${control.name}, ${total} days. Left and right arrow keys read one day at a time.`}
				onKeyDown={dayFromKey}
				onBlur={() => setReadDay(null)}
				className="flex flex-col gap-3 rounded-md outline-none focus-visible:shadow-[0_0_0_2px_var(--q-teal)]"
			>
				{lanes.map((lane) => (
					<div key={lane.language.id} className={cn(GRID, "gap-y-1.5")} data-testid={`study-lane-${lane.language.id}`}>
						<div className="min-w-0 pt-1">
							<p className="font-ui text-[13px] font-semibold leading-tight text-foreground">
								<span className="sm:hidden" title={lane.language.name}>
									{(lane.language.code ?? lane.language.name.slice(0, 2)).toUpperCase()}
								</span>
								<span className="max-sm:hidden">{lane.language.name}</span>
							</p>
							<p className="mt-0.5 font-ui text-[11px] leading-tight text-ink-3 max-sm:hidden">{lane.note}</p>
						</div>
						<div
							className="relative h-24 touch-pan-y sm:h-28"
							onPointerMove={dayFromPointer}
							onPointerDown={dayFromPointer}
							onPointerLeave={(e) => {
								if (e.pointerType === "mouse") setReadDay(null);
							}}
						>
							{lane.switchDay !== null && (
								<div
									className="absolute inset-y-0 right-0 rounded-r-md bg-teal-wash"
									style={{ left: pct((lane.switchDay - 1) / total) }}
								/>
							)}
							{shownDay !== null && (
								<div
									className="absolute inset-y-0 bg-[rgb(var(--q-shadow-rgb)/0.07)] dark:bg-[rgb(255_255_255/0.07)]"
									style={{ left: pct((shownDay - 1) / total), width: pct(1 / total) }}
								/>
							)}
							{Array.from({ length: total / 7 - 1 }, (_, i) => (
								<div
									key={i}
									className="absolute inset-y-0 w-px bg-[var(--q-line)]"
									style={{ left: pct(((i + 1) * 7) / total) }}
								/>
							))}
							<div className="absolute inset-x-0 bottom-2 top-2">
								{TICKS.map((tick) => (
									<div
										key={tick}
										className="absolute inset-x-0 h-px bg-[var(--q-line-2)]"
										style={{ bottom: `${tick}%` }}
									/>
								))}
								{lane.switchDay !== null && (
									<div
										className="absolute -bottom-2 -top-2 w-[1.5px] bg-teal"
										style={{ left: pct((lane.switchDay - 1) / total) }}
									/>
								)}
								{running && (
									<div
										className="absolute -bottom-2 -top-2 w-px bg-[var(--q-ink-3)]"
										style={{ left: pct((todayDay - 0.5) / total) }}
									/>
								)}
								{lane.fit && lane.switchDay !== null && (
									<Trend
										fit={lane.fit}
										total={total}
										switchDay={lane.switchDay}
										lastDay={Math.max(lane.switchDay, Math.min(total, todayDay))}
									/>
								)}
								{days.map((day) => {
									const record = byLanguage.get(lane.language.id)?.get(day.dayNumber);
									if (!record || (record.dictationReps === 0 && record.minutes === 0)) return null;
									const surface =
										lane.switchDay !== null && day.dayNumber >= lane.switchDay ? "var(--q-teal-wash)" : "var(--q-card)";
									const counted = record.firstPlayShare !== null;
									return (
										<span
											key={day.dayNumber}
											className={cn(
												"absolute size-[5px] -translate-x-1/2 translate-y-1/2 rounded-full sm:size-2",
												counted
													? "bg-[var(--q-ink-2)] sm:shadow-[0_0_0_2px_var(--surface)]"
													: "bg-[var(--surface)] shadow-[inset_0_0_0_1.5px_var(--q-ink-4)]",
												counted && day.dayNumber === shownDay && "bg-teal",
											)}
											style={
												{
													left: pct((day.dayNumber - 0.5) / total),
													bottom: pct(counted ? clampShare(record.firstPlayShare!) : 0),
													"--surface": surface,
												} as React.CSSProperties
											}
										/>
									);
								})}
							</div>
						</div>
						<div className="relative h-24 sm:h-28" aria-hidden="true">
							<div className="absolute inset-x-0 bottom-2 top-2">
								{TICKS.map((tick) => (
									<span
										key={tick}
										className="absolute left-0 translate-y-1/2 font-ui text-[10.5px] leading-none tabular-nums text-ink-3"
										style={{ bottom: `${tick}%` }}
									>
										{tick}%
									</span>
								))}
							</div>
						</div>

						<p className="self-center font-ui text-[10.5px] leading-none text-ink-3">check</p>
						<ol className="grid" style={{ gridTemplateColumns: `repeat(${total / 7}, minmax(0, 1fr))` }}>
							{checks
								.filter((c) => c.language === lane.language.id)
								.map((check) => (
									<li
										key={check.week}
										className="flex h-9 items-center justify-center font-ui text-[11.5px] tabular-nums sm:h-7"
										data-testid={`study-check-${check.week}-${check.language}`}
									>
										{check.state === "done" ? (
											<span
												className="flex flex-col items-center gap-0.5 font-semibold leading-none text-foreground sm:flex-row sm:gap-1.5"
												aria-label={`Week ${check.week}: ${check.probesUnderstood} of ${check.probesAnswered} heard right, ${Math.round((check.productionMatch ?? 0) * 100)}% of the words right when speaking`}
											>
												<span>
													{check.probesUnderstood}
													<span className="max-[359px]:hidden">/{check.probesAnswered}</span>
												</span>
												<span className="font-normal text-ink-3">
													{Math.round((check.productionMatch ?? 0) * 100)}%
												</span>
											</span>
										) : check.state === "open" ? (
											<Link
												href={`${CHECK_ROUTE}?week=${check.week}&lang=${check.language}`}
												aria-label={`Start the week ${check.week} check in ${lane.language.name}`}
												className={cn(
													"lanna-press inline-flex h-6 min-w-6 items-center justify-center rounded-md font-semibold pointer-coarse:h-9 pointer-coarse:min-w-9 sm:px-2",
													check === firstOpen
														? "bg-teal text-sun-ink hover:bg-teal-2"
														: "bg-teal-wash text-teal-2 hover:bg-well-2",
												)}
											>
												<span className="max-sm:hidden">Start</span>
												<ArrowRightIcon className="size-3.5 sm:hidden" strokeWidth={2} aria-hidden="true" />
											</Link>
										) : check.state === "missed" ? (
											<span
												className="text-ink-3"
												role="img"
												aria-label={`Week ${check.week}: missed, the make-up days are over`}
											>
												missed
											</span>
										) : (
											<span
												className="size-1 rounded-full bg-[var(--q-dash)]"
												role="img"
												aria-label={`Week ${check.week}: not open yet`}
											/>
										)}
									</li>
								))}
						</ol>
						<span />
					</div>
				))}
			</div>

			<div className={cn(GRID, "mt-1")} aria-hidden="true">
				<span />
				<ol className="grid border-t pt-1.5" style={{ gridTemplateColumns: `repeat(${total / 7}, minmax(0, 1fr))` }}>
					{Array.from({ length: total / 7 }, (_, i) => {
						const current = running && Math.ceil(todayDay / 7) === i + 1;
						return (
							<li
								key={i}
								className={cn(
									"text-center font-ui text-[11px] leading-tight",
									current ? "font-semibold text-foreground" : "text-ink-3",
								)}
							>
								<span className="sm:hidden">W{i + 1}</span>
								<span className="max-sm:hidden">Week {i + 1}</span>
								<span className="block font-normal text-ink-3 max-sm:hidden">
									to {days[i * 7 + 6]?.label.replace(/^\S+\s/, "")}
								</span>
							</li>
						);
					})}
				</ol>
				<span />
			</div>

			<Readout
				day={shownDay !== null ? days[shownDay - 1] : undefined}
				isToday={shownDay === todayDay}
				lanes={lanes.map((lane) => ({
					language: lane.language,
					record: shownDay !== null ? byLanguage.get(lane.language.id)?.get(shownDay) : undefined,
					listeningFirst: lane.switchDay !== null && shownDay !== null && shownDay >= lane.switchDay,
				}))}
				minReps={minReps}
				ahead={shownDay !== null && shownDay > todayDay}
			/>

			<p className="q-legend !mt-3 px-1 sm:px-0">
				<span>
					<i className="!size-2 !rounded-full" style={{ background: "var(--q-ink-2)" }} />a day that counts
				</span>
				<span>
					<i className="!size-2 !rounded-full" style={{ boxShadow: "inset 0 0 0 1.5px var(--q-ink-4)" }} />
					practice, under {minReps} sentences
				</span>
				<span>
					<i style={{ background: "var(--q-teal-wash)", boxShadow: "inset 0 0 0 1px var(--q-teal-line)" }} />
					listening first
				</span>
				<span>
					<i className="!h-3 !w-px !rounded-none" style={{ background: "var(--q-ink-3)" }} />
					today
				</span>
				{fit && (
					<span>
						<i className="!h-0.5 !w-3.5 !rounded-full" style={{ background: "var(--q-teal)" }} />
						trend before and after
					</span>
				)}
			</p>
			<p className="mt-1.5 px-1 font-ui text-[12.5px] text-ink-3 sm:px-0">
				Check: sentences heard right on one play, out of {checks[0]?.probesAnswered || 10}, then the share of words
				right in the five you say.
			</p>
		</figure>
	);
}

function Trend({
	fit,
	total,
	switchDay,
	lastDay,
}: {
	fit: ChartFit;
	total: number;
	switchDay: number;
	lastDay: number;
}) {
	const before = (day: number) => 100 - clampShare(fit.b0 + fit.b1 * day) * 100;
	const after = (day: number) => 100 - clampShare(fit.b0 + fit.b1 * day + fit.b2 + fit.b3 * (day - switchDay)) * 100;
	const line = {
		stroke: "var(--q-teal)",
		strokeWidth: 2,
		strokeLinecap: "round" as const,
		vectorEffect: "non-scaling-stroke" as const,
	};
	return (
		<svg
			className="absolute inset-0 size-full overflow-visible"
			viewBox={`0 0 ${total} 100`}
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<line x1={0.5} y1={before(1)} x2={switchDay - 1} y2={before(switchDay - 0.5)} {...line} />
			<line x1={switchDay - 1} y1={after(switchDay - 0.5)} x2={lastDay - 0.5} y2={after(lastDay)} {...line} />
		</svg>
	);
}

interface ReadoutLane {
	language: StudyLanguage;
	record: DailyExperimentRecord | undefined;
	listeningFirst: boolean;
}

function Readout({
	day,
	isToday,
	lanes,
	minReps,
	ahead,
}: {
	day: ChartDay | undefined;
	isToday: boolean;
	lanes: ReadoutLane[];
	minReps: number;
	ahead: boolean;
}) {
	return (
		<div
			className="mt-3 flex min-h-[4.75rem] flex-col gap-x-6 gap-y-1 rounded-md bg-well px-3 py-2.5 font-ui text-[13px] sm:min-h-11 sm:flex-row sm:items-center"
			aria-live="polite"
			data-testid="study-readout"
		>
			{day ? (
				<>
					<p className="shrink-0 font-semibold text-foreground">
						Day {day.dayNumber}
						<span className="font-normal text-ink-3">
							{" "}
							· {day.label}
							{isToday && " · today"}
						</span>
					</p>
					{lanes.map(({ language, record, listeningFirst }) => {
						const practiced = record && (record.dictationReps > 0 || record.minutes > 0);
						return (
							<p key={language.id} className="min-w-0 text-ink-3">
								<span className="text-ink-2">{language.name}</span>{" "}
								{practiced && record.firstPlayShare !== null ? (
									<>
										<b className="font-semibold tabular-nums text-foreground">
											{Math.round(record.firstPlayShare * 100)}%
										</b>{" "}
										· {record.understoodReps} of {record.dictationReps}
									</>
								) : practiced ? (
									`${record.dictationReps} of the ${minReps} sentences it needs`
								) : ahead ? (
									listeningFirst ? (
										"listening first"
									) : (
										"normal plan"
									)
								) : (
									"no Listen yet"
								)}
							</p>
						);
					})}
				</>
			) : (
				<p className="text-ink-3">Pick a day in the chart to read it.</p>
			)}
		</div>
	);
}
