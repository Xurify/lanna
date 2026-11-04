import { cookies } from "next/headers";
import { CurriculumPage } from "@/components/curriculum-page";
import { CLIMB_VIEW_COOKIE, resolveClimbView } from "@/lib/climb-view";
import { progressSummary, readSettingsRecord } from "@/src/server";
import { slotsConfigured } from "@/src/core";

export const metadata = { title: "Curriculum" };

export const dynamic = "force-dynamic";

/** The whole A1→B2 map (LangHarness): every chapter open, with the
 *  learner's progress on it. The Today page shows the same path folded. */
export default async function CurriculumRoute({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
	const view = resolveClimbView((await searchParams).view, (await cookies()).get(CLIMB_VIEW_COOKIE)?.value);
	const record = readSettingsRecord();
	let summary = null;
	try {
		summary = progressSummary(new Date().getTimezoneOffset());
	} catch {
		summary = null;
	}
	return (
		<CurriculumPage
			initialView={view}
			initialConfigured={slotsConfigured(record?.models)}
			state={summary?.curriculum ?? null}
			next={summary?.next ?? "words"}
			goal={summary?.goal ?? { level: "B2", minutesPerDay: 30 }}
			weak={summary?.weakSpots ?? []}
			exams={summary?.exams ?? {}}
			zones={summary?.flow.units ?? {}}
		/>
	);
}
