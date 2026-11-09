import { GrammarAtlas } from "@/components/grammar/atlas";
import { CaseTable } from "@/components/grammar/case-table";
import { progressStore } from "@/src/server";
import { activeCourse, caseTable, grammarAtlas } from "@/src/core";

export const metadata = { title: "Grammar" };

export const dynamic = "force-dynamic";

export default function GrammarRoute() {
	const course = activeCourse();
	let units = {};
	try {
		units = progressStore.read().units;
	} catch {
		units = {};
	}
	if (course) return <CaseTable rows={caseTable(course, units)} />;
	let cells = null;
	try {
		cells = grammarAtlas(units);
	} catch {
		cells = null;
	}
	return <GrammarAtlas initial={cells} />;
}
