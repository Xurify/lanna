"use client";

/**
 * The log page: a day switcher over the days that have something in them,
 * and the selected day (components/log/day-log-view.tsx). Past days are read
 * only and read the same way as today.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { DayLogView } from "@/components/log/day-log-view";
import type { DayLog } from "@/src/core";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Monday, November 2" for a YYYY-MM-DD key. */
export function dayTitle(day: string): string {
	const d = new Date(`${day}T12:00:00`);
	return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
}

function shortDay(day: string): string {
	const d = new Date(`${day}T12:00:00`);
	return `${WEEKDAY[d.getDay()]!.slice(0, 3)} ${d.getDate()}`;
}

export function LogPage() {
	const [days, setDays] = useState<DayLog[] | null>(null);
	const [today, setToday] = useState("");
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		void fetch(`/api/daylog?list=60&tz=${new Date().getTimezoneOffset()}`)
			.then((r) => {
				if (!r.ok) throw new Error(String(r.status));
				return r.json() as Promise<{ today: string; days: DayLog[] }>;
			})
			.then((x) => {
				setToday(x.today);
				setDays(x.days);
			})
			.catch(() => setFailed(true));
	}, []);
	const [i, setI] = useState(0);
	const list = days ?? [];
	const log = list[i] ?? null;
	const isToday = log?.day === today;
	return (
		<div className="relative min-h-dvh bg-background" data-testid="log-page">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20">
				<Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em]">Log</h1>
				<p className="q-line dim mt-1">What you did each day, from your own records.</p>

				<div className="mt-6 flex items-center gap-2" data-testid="log-switcher">
					<button type="button" className="q-btn sec !px-2.5" onClick={() => setI((n) => Math.min(list.length - 1, n + 1))} disabled={i >= list.length - 1} aria-label="Earlier day">
						<ChevronLeftIcon className="size-4" strokeWidth={1.6} />
						<span className="max-sm:hidden">Earlier</span>
					</button>
					<div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1" role="tablist" aria-label="Days">
						{list.map((d, n) => (
							<button
								key={d.day}
								type="button"
								role="tab"
								aria-selected={n === i}
								onClick={() => setI(n)}
								className={cn("q-num h-8 shrink-0 rounded-md px-3 text-[13px]", n === i ? "bg-teal-wash font-[600] text-teal-2" : "text-ink-3 hover:bg-well hover:text-ink-2")}
							>
								{d.day === today ? "Today" : shortDay(d.day)}
							</button>
						))}
					</div>
					<button type="button" className="q-btn sec !px-2.5" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i <= 0} aria-label="Later day">
						<span className="max-sm:hidden">Later</span>
						<ChevronRightIcon className="size-4" strokeWidth={1.6} />
					</button>
				</div>

				{log ? (
					<section className="mt-6" aria-label={dayTitle(log.day)}>
						<h2 className="text-[22px] font-semibold tracking-[-0.022em]" lang="sk">
							{dayTitle(log.day)}
						</h2>
						<div className="mt-4">
							<DayLogView log={log} isToday={isToday} />
						</div>
					</section>
				) : (
					<p className="q-line dim mt-6">{failed ? "The log could not be loaded. Check that LangHarness is still running, then reload." : days ? "No days yet." : "\u00a0"}</p>
				)}
			</main>
		</div>
	);
}
