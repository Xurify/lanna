import { StudyPage } from "@/components/experiment/study-page";
import { getExperimentState } from "@/src/server";

export const metadata = { title: "Study" };
export const dynamic = "force-dynamic";

export default function InputFirstExperimentPage() {
	const { config, schedule, daily, checks, study, deviations, today } = getExperimentState();
	return <StudyPage config={config} schedule={schedule} daily={daily} checks={checks} study={study} deviations={deviations} today={today} />;
}
