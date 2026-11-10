import { ListenPlayer } from "@/components/listen/listen-player";
import type { ListenPlan } from "@/src/core";
import { cheatsheetStore, listenFor, sheetListenFor } from "@/src/server";

export const metadata = { title: "Listen" };

export const dynamic = "force-dynamic";

/** Listen: ten sentences the learner can follow, heard first and typed.
 *  The plan is built here, with the page, so the
 *  first sentence is in the first HTML and never swaps after load. */
export default async function ListenPage({ searchParams }: { searchParams: Promise<{ sheet?: string; section?: string }> }) {
	const { sheet: sheetId, section } = await searchParams;
	if (sheetId) {
		const sheet = cheatsheetStore.get(sheetId);
		const plan = sheet ? sheetListenFor(sheet, { section }) : null;
		return (
			<ListenPlayer
				key={`${sheetId}:${section ?? ""}`}
				initialPlan={plan && plan.items.length > 0 ? plan : null}
				sheet={{ id: sheetId, title: sheet?.title ?? "", ...(section ? { section } : {}) }}
			/>
		);
	}
	let plan: ListenPlan | null = null;
	try {
		plan = listenFor();
		if (plan.items.length === 0) plan = null;
	} catch {
		plan = null;
	}
	return <ListenPlayer initialPlan={plan} />;
}
