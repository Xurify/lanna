import Link from "next/link";
import { WeeklyCheckPlayer } from "@/components/experiment/weekly-check-player";

export const metadata = { title: "Weekly Check | SCED Experiment" };
export const dynamic = "force-dynamic";

export default async function WeeklyCheckPage({
	searchParams,
}: {
	searchParams: Promise<{ week?: string; lang?: string }>;
}) {
	const params = await searchParams;
	const week = params.week ? Math.max(1, Math.min(6, parseInt(params.week, 10))) : 1;
	const lang = (params.lang === "slovak" ? "slovak" : "russian") as "russian" | "slovak";

	return (
		<main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans space-y-6">
			<div className="max-w-2xl mx-auto flex items-center justify-between pb-2 border-b border-neutral-800">
				<Link
					href="/experiment"
					className="text-xs text-neutral-400 hover:text-neutral-200 transition flex items-center gap-1"
				>
					&larr; Back to Experiment Dashboard
				</Link>
				<span className="text-xs font-mono text-neutral-500">SCED Check Session</span>
			</div>

			<WeeklyCheckPlayer initialWeek={week} initialLang={lang} />
		</main>
	);
}
