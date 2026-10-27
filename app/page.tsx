import { Today } from "@/components/today";
import { readSettingsRecord } from "@/src/server";
import { slotsConfigured } from "@/src/core";

// Dynamic: the configured state is server-rendered into the page (Talk and
// Story need a model; without one they open the setup dialog first).
export const dynamic = "force-dynamic";

/** Today — the front page: what to do next, the day's goal, the skill path.
 *  The knowledge-graph home moved to /map. */
export default function HomePage() {
	const record = readSettingsRecord();
	return <Today initialConfigured={slotsConfigured(record?.models)} />;
}
