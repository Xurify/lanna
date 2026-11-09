import Link from "next/link";
import { getExperimentState } from "@/src/server/experiment";

export const metadata = { title: "Input-First Russian Experiment | LangHarness" };
export const dynamic = "force-dynamic";

export default async function InputFirstExperimentPage() {
	const state = getExperimentState();
	const { config, schedule, daily, checks, analysis, today } = state;

	const russianDaily = daily.filter((d) => d.language === "russian");
	const slovakDaily = daily.filter((d) => d.language === "slovak");

	const isIntervention = today.schedule.phase === "intervention";

	return (
		<main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 max-w-6xl mx-auto font-sans space-y-8">
			{/* Header */}
			<header className="border-b border-neutral-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
							Single-Case Experimental Design (SCED Protocol v3)
						</span>
						<span className="text-xs font-mono text-neutral-400">Mulberry32 Seed: {config.seed}</span>
					</div>
					<h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
						Input-First Russian Experiment
					</h1>
					<p className="text-sm text-neutral-300 mt-1 max-w-3xl leading-relaxed">
						<strong>What type of experiment is this?</strong> An interrupted time series with randomized onset ($N=1$). We test whether delaying speech, drills, and grammar output to prioritize pure receptive input (Listen, Read, Watch, Words) accelerates listening comprehension speed without degrading spoken fluency.
					</p>
					<p className="text-xs text-neutral-400 mt-1">
						Timeline: 42 Days &bull; {config.startDate} to {config.endDate} &bull; Russian (Treatment Arm) vs. Slovak (Concurrent Control Arm)
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Link
						href="/"
						className="px-3.5 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition"
					>
						&larr; Today's Plan
					</Link>
					<Link
						href="/listen"
						className="px-3.5 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition"
					>
						Listen Dictations
					</Link>
					<Link
						href="/experiments/input-first/check"
						className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition"
					>
						Weekly Check &rarr;
					</Link>
				</div>
			</header>

			{/* Scientific Arms & Hypotheses Explainer */}
			<section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-4">
				<h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
					Study Design & Arms Breakdown
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
					<div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-4 space-y-2">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-emerald-400 uppercase tracking-wide">Russian (Treatment Arm)</span>
							<span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">Switches Day {config.onsetDay}</span>
						</div>
						<p className="text-neutral-300">
							<strong>Baseline (Days 1–{config.onsetDay - 1}):</strong> Normal plan (lesson drills, strengthen, speak, fluency, words, read, watch).
						</p>
						<p className="text-neutral-300">
							<strong>Intervention (Days {config.onsetDay}–42):</strong> <em>Input-First Arm</em>. All production tasks (speaking, tutor chat, form drills, fluency microphone) are dropped. Session time is dedicated entirely to Listen dictations, Words, Read, and Watch.
						</p>
					</div>

					<div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-4 space-y-2">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-blue-400 uppercase tracking-wide">Slovak (Control Arm)</span>
							<span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">All 42 Days</span>
						</div>
						<p className="text-neutral-300">
							<strong>Constant Standard Curriculum:</strong> Serves as the concurrent control. Follows the normal curriculum with regular speaking, tutor, and grammar exercises throughout the entire 6 weeks.
						</p>
						<p className="text-neutral-300">
							<strong>Comparison Goal:</strong> Controls for general learner maturation, study habits, and interface familiarity.
						</p>
					</div>
				</div>
			</section>

			{/* Phase & Status Banner */}
			<section className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
					<div className="text-xs text-neutral-400 uppercase font-semibold">Today's Phase</div>
					<div className="text-xl font-bold mt-2 text-white flex items-center gap-2">
						<span
							className={`inline-block w-2.5 h-2.5 rounded-full ${
								isIntervention ? "bg-amber-400 animate-pulse" : "bg-blue-400 animate-pulse"
							}`}
						/>
						{isIntervention ? "Input-First" : "Baseline"}
					</div>
					<div className="text-xs text-neutral-400 mt-1">
						Day {today.dayNumber} of {config.days} ({today.date})
					</div>
				</div>

				<div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
					<div className="text-xs text-neutral-400 uppercase font-semibold">Onset Day</div>
					<div className="text-xl font-bold mt-2 text-amber-300">Day {config.onsetDay}</div>
					<div className="text-xs text-neutral-400 mt-1">{config.onsetDate} (Uniform draw 12..22)</div>
				</div>

				<div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
					<div className="text-xs text-neutral-400 uppercase font-semibold">Level Shift (b₂)</div>
					<div className="text-xl font-bold mt-2 text-emerald-400">
						{(analysis.b2 * 100).toFixed(1)} <span className="text-xs font-normal text-neutral-400">pp</span>
					</div>
					<div className="text-xs text-neutral-400 mt-1">Target: &ge; +10.0 pp</div>
				</div>

				<div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
					<div className="text-xs text-neutral-400 uppercase font-semibold">Verdict Status</div>
					<div className="text-xl font-bold mt-2 capitalize text-neutral-200">
						{analysis.verdictStatus.replace(/_/g, " ")}
					</div>
					<div className="text-xs text-neutral-400 mt-1">
						p = {analysis.pValue.toFixed(4)} (Threshold: 0.0909)
					</div>
				</div>
			</section>

			{/* Timeline Visualizer */}
			<section className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 space-y-3">
				<div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
					<span>Day 1 ({config.startDate})</span>
					<span className="text-amber-400 font-semibold">Onset Day {config.onsetDay} ({config.onsetDate})</span>
					<span>Day 42 ({config.endDate})</span>
				</div>
				<div className="grid grid-cols-42 gap-1 h-7">
					{schedule.map((s) => {
						const isToday = s.date === today.date;
						const isPast = s.dayNumber < today.dayNumber;
						const isCheck = s.weeklyCheckDue;
						const isPost = s.dayNumber >= config.onsetDay;

						let bg = "bg-neutral-800";
						if (isToday) bg = "bg-emerald-500 ring-2 ring-emerald-300";
						else if (isPost) bg = isPast ? "bg-amber-600" : "bg-amber-950/60 border border-amber-800/50";
						else bg = isPast ? "bg-blue-600" : "bg-blue-950/60 border border-blue-800/50";

						return (
							<div
								key={s.dayNumber}
								title={`Day ${s.dayNumber} (${s.date}): ${s.phase}${isCheck ? " [Weekly Check Due]" : ""}`}
								className={`rounded-sm relative ${bg} flex items-center justify-center transition hover:scale-110 cursor-pointer`}
							>
								{isCheck && <div className="w-1.5 h-1.5 rounded-full bg-white absolute -top-1" />}
							</div>
						);
					})}
				</div>
				<div className="flex items-center gap-6 text-xs text-neutral-400 pt-1">
					<div className="flex items-center gap-1.5">
						<span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
						<span>Baseline Phase (Normal Plan)</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-3 h-3 rounded-sm bg-amber-600 inline-block" />
						<span>Input-First Phase</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
						<span>Today</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
						<span>Weekly Check Day (Sunday)</span>
					</div>
				</div>
			</section>

			{/* Weekly Checks Table */}
			<section className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
						Weekly Sunday Checks (10 Dictation Probes + 5 Spoken Prompts)
					</h2>
					<Link
						href="/experiments/input-first/check"
						className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
					>
						Launch Check Session &rarr;
					</Link>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs border-collapse">
						<thead>
							<tr className="border-b border-neutral-800 text-neutral-400 font-medium">
								<th className="py-2 px-3">Week</th>
								<th className="py-2 px-3">Date</th>
								<th className="py-2 px-3">Language</th>
								<th className="py-2 px-3">Listening Probe (10 items)</th>
								<th className="py-2 px-3">Spoken Production (5 items)</th>
								<th className="py-2 px-3">Status</th>
								<th className="py-2 px-3 text-right">Action</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-neutral-800/60 font-mono">
							{[1, 2, 3, 4, 5, 6].map((w) => {
								const checkSchedule = schedule.find((s) => s.weekNumber === w);
								const checkDate = checkSchedule?.date ?? `Week ${w}`;
								return (["russian", "slovak"] as const).map((lang) => {
									const langChecks = checks.filter((c) => c.week === w && c.language === lang);
									const probes = langChecks.filter((c) => c.type === "probe");
									const prods = langChecks.filter((c) => c.type === "production");
									const completed = probes.length === 10 && prods.length === 5;

									const probeScore =
										probes.length > 0 ? `${probes.filter((p) => p.score === 1).length}/${probes.length}` : "-";
									const prodAvg =
										prods.length > 0
											? `${Math.round((prods.reduce((a, b) => a + b.score, 0) / prods.length) * 100)}%`
											: "-";

									return (
										<tr key={`${w}:${lang}`} className="hover:bg-neutral-800/40">
											<td className="py-2.5 px-3 font-semibold text-neutral-200">W{w}</td>
											<td className="py-2.5 px-3 text-neutral-400">{checkDate}</td>
											<td className="py-2.5 px-3 capitalize text-neutral-300">{lang}</td>
											<td className="py-2.5 px-3 text-neutral-200">{probeScore}</td>
											<td className="py-2.5 px-3 text-neutral-200">{prodAvg}</td>
											<td className="py-2.5 px-3">
												<span
													className={`px-2 py-0.5 rounded text-[11px] ${
														completed
															? "bg-emerald-950 text-emerald-300 border border-emerald-800"
															: "bg-neutral-800 text-neutral-400"
													}`}
												>
													{completed ? "Completed" : "Scheduled"}
												</span>
											</td>
											<td className="py-2.5 px-3 text-right font-sans">
												<Link
													href={`/experiments/input-first/check?week=${w}&lang=${lang}`}
													className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
												>
													{completed ? "Review" : "Start"}
												</Link>
											</td>
										</tr>
									);
								});
							})}
						</tbody>
					</table>
				</div>
			</section>

			{/* Daily Log Snapshot */}
			<section className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
						Recent Daily Practice Logs ({daily.length} records)
					</h2>
					<span className="text-xs text-neutral-400">
						Minimum 5 dictation reps required for valid daily understanding score
					</span>
				</div>
				{daily.length === 0 ? (
					<p className="text-xs text-neutral-400 py-3">No practice logged yet. Complete today's listen or lesson tasks to populate daily stats.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs border-collapse">
							<thead>
								<tr className="border-b border-neutral-800 text-neutral-400 font-medium font-sans">
									<th className="py-2 px-3">Date</th>
									<th className="py-2 px-3">Day</th>
									<th className="py-2 px-3">Lang</th>
									<th className="py-2 px-3">Phase</th>
									<th className="py-2 px-3">Arm</th>
									<th className="py-2 px-3">Dictation Reps</th>
									<th className="py-2 px-3">First-Play Share</th>
									<th className="py-2 px-3">Practice Min</th>
									<th className="py-2 px-3">Compliance</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800/60 font-mono">
								{daily.slice(-10).reverse().map((d, i) => (
									<tr key={`${d.date}:${d.language}:${i}`} className="hover:bg-neutral-800/40">
										<td className="py-2.5 px-3 text-neutral-400">{d.date}</td>
										<td className="py-2.5 px-3 font-semibold text-neutral-200">Day {d.dayNumber}</td>
										<td className="py-2.5 px-3 capitalize text-neutral-300">{d.language}</td>
										<td className="py-2.5 px-3 text-neutral-300">{d.phase}</td>
										<td className="py-2.5 px-3 text-neutral-300">{d.arm}</td>
										<td className="py-2.5 px-3 text-neutral-200">{d.dictationReps}</td>
										<td className="py-2.5 px-3 text-emerald-400 font-semibold">
											{d.firstPlayShare !== null ? `${(d.firstPlayShare * 100).toFixed(0)}%` : "N/A (<5)"}
										</td>
										<td className="py-2.5 px-3 text-neutral-300">{d.minutes}m</td>
										<td className="py-2.5 px-3">
											<span className={d.compliant ? "text-emerald-400" : "text-amber-400"}>
												{d.compliance}%
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</main>
	);
}
