import { MilestonesPage } from "@/components/milestones/milestones-page";
import { customMilestonesAvailable, milestonesReport, type MilestonesReport } from "@/src/server";

export const metadata = { title: "Milestones" };

export const dynamic = "force-dynamic";

/** When can I…? The milestones calculator (LangHarness): every figure is
 *  computed here, with the page, so the first HTML already carries the
 *  dates and nothing swaps after load. */
export default function MilestonesRoute() {
	let report: MilestonesReport | null = null;
	try {
		report = milestonesReport(new Date());
	} catch {
		report = null;
	}
	return <MilestonesPage initialReport={report} modelReady={customMilestonesAvailable()} />;
}
