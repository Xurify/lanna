import { redirect } from "next/navigation";
import { Today } from "@/components/today";
import { languageDay, prepareCorpus, progressSummary, readSettingsRecord } from "@/src/server";
import { slotsConfigured } from "@/src/core";

export const metadata = { title: { absolute: "Today · LangHarness" } };

// Dynamic: the configured state is server-rendered into the page (Talk and
// Story need a model; without one they open the setup dialog first).
export const dynamic = "force-dynamic";

/** Today — the front page: what to do next, the day's goal, the skill path.
 *  The knowledge-graph home moved to /map. */
export default function HomePage() {
	// The corpus (data/README.md, the audio library): READMEs in place and
	// the old audio cache moved into the indexed tree, once per process.
	try {
		prepareCorpus();
	} catch {
		// never blocks the page
	}
	const record = readSettingsRecord();
	// The summary renders with the page (the server is the learner's own
	// machine, so its clock is the learner's): no empty state, no swap.
	let summary = null;
	try {
		summary = progressSummary(new Date().getTimezoneOffset());
	} catch {
		summary = null;
	}
	// A fresh profile goes through setup once (a minute, no model): what
	// the language is for, what the learner brings, the pace, and a placement
	// drill. Skipping it stamps the record too, so this never repeats.
	if (summary && !summary.goal.onboardedAt) redirect("/start");
	// Every language's plan, rendered with the page too.
	let day = null;
	try {
		day = languageDay(new Date().getTimezoneOffset());
	} catch {
		day = null;
	}
	return <Today initialConfigured={slotsConfigured(record?.models)} initialSummary={summary} initialDay={day} />;
}
