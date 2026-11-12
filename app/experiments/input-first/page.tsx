import { StudyPage } from "@/components/experiment/study-page";
import { activeProfile, getExperimentState } from "@/src/server";

export const metadata = { title: "Study" };
export const dynamic = "force-dynamic";

export default function InputFirstExperimentPage() {
	const { config, schedule, daily, checks, analysis, today } = getExperimentState();
	return <StudyPage config={config} schedule={schedule} daily={daily} checks={checks} analysis={analysis} today={today} runningLanguage={activeProfile()} />;
}
