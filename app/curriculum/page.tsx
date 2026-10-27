import { CurriculumPage } from "@/components/curriculum-page";
import { progressSummary, readSettingsRecord } from "@/src/server";
import { slotsConfigured } from "@/src/core";

export const dynamic = "force-dynamic";

/** The whole A1→B2 map (LangHarness): every chapter open, with the
 *  learner's progress on it. The Today page shows the same path folded. */
export default function CurriculumRoute() {
	const record = readSettingsRecord();
	let summary = null;
	try {
		summary = progressSummary(new Date().getTimezoneOffset());
	} catch {
		summary = null;
	}
	return (
		<CurriculumPage
			initialConfigured={slotsConfigured(record?.models)}
			state={summary?.curriculum ?? null}
			next={summary?.next ?? "words"}
			goal={summary?.goal ?? { level: "B2", minutesPerDay: 30 }}
		/>
	);
}
