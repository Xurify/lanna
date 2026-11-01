import { MistakesPage } from "@/components/mistakes/mistakes-page";
import { mistakesReport, type MistakesReport } from "@/src/server";

export const dynamic = "force-dynamic";

/** My mistakes: the analysis is read here, with the page, so the first HTML
 *  already carries the figures and nothing swaps after load. */
export default function MistakesRoute() {
	let report: MistakesReport | null = null;
	try {
		report = mistakesReport();
	} catch {
		report = null;
	}
	return <MistakesPage initial={report} />;
}
