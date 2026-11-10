import { ListenPlayer } from "@/components/listen/listen-player";
import type { ListenPlan } from "@/src/core";
import { listenFor } from "@/src/server";

export const metadata = { title: "Listen" };

export const dynamic = "force-dynamic";

/** Listen: ten sentences the learner can follow, heard first and typed.
 *  The plan is built here, with the page, so the
 *  first sentence is in the first HTML and never swaps after load. */
export default function ListenPage() {
	let plan: ListenPlan | null = null;
	try {
		plan = listenFor();
		if (plan.items.length === 0) plan = null;
	} catch {
		plan = null;
	}
	return <ListenPlayer initialPlan={plan} />;
}
