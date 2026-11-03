import { PlanPage } from "@/components/plan/plan-page";
import { chartData } from "@/components/quiet/chart-data";
import { milestonesReport, progressSummary, type MilestonesReport } from "@/src/server";

export const dynamic = "force-dynamic";

/** The Plan: goal, pace sliders, hours, milestones and weak spots in one
 *  place (LangHarness). Computed here with the page, so the first HTML
 *  already carries the dates. */
export default function PlanRoute() {
	const tz = new Date().getTimezoneOffset();
	const summary = progressSummary(tz);
	let report: MilestonesReport | null = null;
	try {
		report = milestonesReport(new Date(), tz);
	} catch {
		report = null;
	}
	return <PlanPage goal={summary.goal} report={report} weak={summary.weakSpots} stamps={summary.stamps.all} log={summary.log} charts={chartData(summary)} />;
}
