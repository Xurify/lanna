import { LogPage } from "@/components/log/log-page";

export const dynamic = "force-dynamic";

/** The log: what was done each day, with the time of each task. The page reads it in the browser, on the learner's own clock. */
export default function LogRoute() {
	return <LogPage />;
}
