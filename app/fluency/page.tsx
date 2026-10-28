import { FluencyPlayer, type FastPlan, type RereadPlan } from "@/components/fluency/fluency-player";
import { fastFor, rereadFor, sttEngine } from "@/src/server";

export const dynamic = "force-dynamic";

/** Fluency: ?mode=reread times an episode already read; ?mode=fast (the
 *  default) is "say it faster" on known sentences. Built with the page,
 *  so the text is in the first HTML and never swaps after load. */
export default async function FluencyPage({ searchParams }: { searchParams: Promise<{ mode?: string; id?: string }> }) {
	const { mode, id } = await searchParams;
	const reread = mode === "reread";
	let rereadPlan: RereadPlan | null = null;
	let fastPlan: FastPlan | null = null;
	let stt = false;
	try {
		stt = sttEngine() !== null;
		if (reread) rereadPlan = rereadFor({ id: id && /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : undefined });
		else {
			fastPlan = fastFor();
			if (fastPlan.items.length === 0) fastPlan = null;
		}
	} catch {
		rereadPlan = null;
		fastPlan = null;
	}
	return <FluencyPlayer key={mode ?? "fast"} mode={reread ? "reread" : "fast"} initialReread={rereadPlan} initialFast={fastPlan} stt={stt} />;
}
