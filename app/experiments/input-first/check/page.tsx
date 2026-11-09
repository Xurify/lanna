import { WeeklyCheckPlayer } from "@/components/experiment/weekly-check-player";
import { EXPERIMENT_CONSTANTS } from "@/src/core";
import { ensureExperimentInitialized } from "@/src/server";

export const metadata = { title: "Study" };
export const dynamic = "force-dynamic";

export default async function InputFirstWeeklyCheckPage({ searchParams }: { searchParams?: Promise<{ week?: string; lang?: string }> }) {
	const params = searchParams ? await searchParams : {};
	const { config } = ensureExperimentInitialized();
	const languages = [config.languages.treatment, config.languages.control];
	const asked = Math.round(Number(params.week));
	const week = asked >= 1 && asked <= EXPERIMENT_CONSTANTS.TOTAL_WEEKS ? asked : 1;
	const language = languages.includes(params.lang ?? "") ? params.lang! : languages[0]!;
	return <WeeklyCheckPlayer initialWeek={week} initialLanguage={language} languages={languages} />;
}
