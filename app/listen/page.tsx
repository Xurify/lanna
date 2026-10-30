import { ListenPlayer } from "@/components/listen/listen-player";
import type { ListenPlan } from "@/src/core";
import { listenFor, listenWithBetterOptions } from "@/src/server";

export const dynamic = "force-dynamic";

/** Listen: ten sentences the learner can follow, heard first, understood
 *  by picking the meaning. The plan is built here, with the page, so the
 *  first sentence is in the first HTML and never swaps after load. */
export default async function ListenPage() {
	let plan: ListenPlan | null = null;
	try {
		plan = await listenWithBetterOptions(listenFor());
		if (plan.items.length === 0) plan = null;
	} catch {
		plan = null;
	}
	return <ListenPlayer initialPlan={plan} />;
}
