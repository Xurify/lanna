import { Suspense } from "react";
import Link from "next/link";
import { WeeklyCheckPlayer } from "@/components/experiment/weekly-check-player";

export const metadata = { title: "Weekly Check | Input-First Experiment" };
export const dynamic = "force-dynamic";

export default async function InputFirstWeeklyCheckPage({
	searchParams,
}: {
	searchParams?: Promise<{ week?: string; lang?: string }>;
}) {
	const params = searchParams ? await searchParams : {};
	const initialWeek = Number(params.week || "1");
	const initialLang = (params.lang === "slovak" ? "slovak" : "russian") as "russian" | "slovak";

	return (
		<main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 max-w-4xl mx-auto font-sans space-y-6">
			{/* Top breadcrumb & navigation */}
			<div className="flex items-center justify-between border-b border-neutral-800 pb-4">
				<div>
					<Link
						href="/experiments/input-first"
						className="text-xs text-neutral-400 hover:text-neutral-200 transition flex items-center gap-1.5"
					>
						&larr; Back to Input-First Dashboard
					</Link>
					<h1 className="text-xl md:text-2xl font-bold text-white mt-1">
						Weekly Experiment Check
					</h1>
					<p className="text-xs text-neutral-400 mt-0.5">
						10 single-play listening dictation probes + 5 spoken production prompts
					</p>
				</div>
				<span className="text-xs px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono">
					Protocol v3
				</span>
			</div>

			<Suspense
				fallback={
					<div className="p-12 text-center text-sm text-neutral-500 animate-pulse">
						Loading assessment session...
					</div>
				}
			>
				<WeeklyCheckPlayer initialWeek={initialWeek} initialLang={initialLang} />
			</Suspense>
		</main>
	);
}
