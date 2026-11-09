import { LogPage } from "@/components/log/log-page";
import type { DayLog } from "@/src/core";
import { dayLogDays } from "@/src/server";

export const metadata = { title: "Log" };

export const dynamic = "force-dynamic";

/** The log: what was done each day, with the time of each task. Read here on the server's clock, so the first HTML carries it; the page reads it again on the learner's own clock. */
export default function LogRoute() {
	const tz = new Date().getTimezoneOffset();
	const today = new Date(Date.now() - tz * 60_000).toISOString().slice(0, 10);
	let days: DayLog[] | null = null;
	try {
		days = dayLogDays(today, tz, 60);
	} catch {
		days = null;
	}
	return <LogPage initial={days ? { today, days } : null} />;
}
