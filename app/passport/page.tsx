import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { bestAttempt, CHAPTERS, curriculumState, curriculumUnit } from "@/src/core";
import { progressStore } from "@/src/server";

export const dynamic = "force-dynamic";

/** The passport (phase 6a, E14): one row per chapter — its can-do line as
 *  "I can…", where the chapter stands (goal reached or units along), and
 *  what the exam has on record (passed, or the best score), with a link
 *  to the exam. Record only: the exam's attempts never change the path. */
export default function PassportPage() {
	let p = null;
	try {
		p = progressStore.read();
	} catch {
		p = null;
	}
	const goal = p?.goal;
	const state = curriculumState(p?.units ?? {}, goal?.level ?? "B2", { startChapter: goal?.startChapter });
	const byChapter = new Map(state.chapters.map((c) => [c.id, c]));

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="relative flex items-center gap-2 px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-16" data-testid="passport">
				<Link href="/" className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
					<ArrowLeftIcon className="size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 font-ui text-3xl font-black tracking-tight text-foreground">Passport</h1>
				<p className="mt-2 max-w-2xl font-prose text-base text-muted-foreground">
					What each chapter is for, and the exam that shows you have it. An attempt is recorded here; nothing opens or closes on it yet.
				</p>
				<ol className="mt-8 flex flex-col gap-3" data-testid="passport-rows">
					{CHAPTERS.map((ch) => {
						const goalUnit = curriculumUnit(ch.units[ch.units.length - 1]!);
						const canDo = goalUnit ? goalUnit.title.replace(/^Can /, "I can ") : ch.title;
						const cs = byChapter.get(ch.id);
						const best = bestAttempt(p?.exams?.[ch.id] ?? []);
						return (
							<li key={ch.id} data-testid="passport-row" className="rounded-2xl border bg-card px-5 py-4">
								<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
									<p className="font-prose text-lg font-semibold text-foreground">{canDo}</p>
									<Link href={`/exam?chapter=${ch.id}`} className="shrink-0 rounded-full border border-xp/40 bg-xp/10 px-3 py-1 font-ui text-xs font-bold text-foreground transition-colors hover:bg-xp/20" data-testid={`passport-exam-${ch.id}`}>
										Skúška
									</Link>
								</div>
								<p className="mt-1 font-ui text-sm text-muted-foreground" data-testid={`passport-status-${ch.id}`}>
									{cs?.done ? "Goal reached" : cs ? `${cs.doneCount}/${cs.total} units` : ""}
									{best ? (best.passed ? ` · Exam passed — best ${best.score}/${best.total}` : ` · Exam not passed yet — best ${best.score}/${best.total}`) : " · Exam not taken"}
								</p>
							</li>
						);
					})}
				</ol>
			</main>
		</div>
	);
}
