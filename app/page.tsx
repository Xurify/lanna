import { redirect } from "next/navigation";
import { Today } from "@/components/today";
import { datedScenesForToday, languageDay, lineState, prepareCorpus, progressSummary, readSettingsRecord, stageNow } from "@/src/server";
import { slotsConfigured } from "@/src/core";

export const metadata = { title: { absolute: "Today · LangHarness" } };

// Dynamic: the configured state is server-rendered into the page (Talk and
// Story need a model; without one they open the setup dialog first).
export const dynamic = "force-dynamic";

/** Today — the front page: what to do next, the day's goal, the skill path.
 */
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
	// A scene with a date (docs/research/creator-hooks.md, proposal 3): the nearest one, and any that waits for a line.
	let dated = null;
	try {
		dated = datedScenesForToday();
	} catch {
		dated = null;
	}
	// Today's line and the stage sentence (docs/research/creator-hooks.md, proposals 1 and 4).
	let line = null;
	try {
		line = lineState();
	} catch {
		line = null;
	}
	let stage = null;
	try {
		stage = stageNow();
	} catch {
		stage = null;
	}
	return <Today initialConfigured={slotsConfigured(record?.models)} initialSummary={summary} initialDay={day} initialLine={line} initialStage={stage} initialDated={dated} />;
}
