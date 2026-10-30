import { GrammarAtlas } from "@/components/grammar/atlas";
import { progressStore } from "@/src/server";
import { grammarAtlas } from "@/src/core";

export const dynamic = "force-dynamic";

/** The grammar atlas (LangHarness): every case × gender cell with the
 *  learner's accuracy, each opening its drill. The cells are computed with
 *  the page, so the table is in the first HTML and never swaps. */
export default function GrammarRoute() {
	let cells = null;
	try {
		cells = grammarAtlas(progressStore.read().units);
	} catch {
		cells = null;
	}
	return <GrammarAtlas initial={cells} />;
}
