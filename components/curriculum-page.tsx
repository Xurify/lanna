"use client";

/**
 * /curriculum — the whole map, every chapter open (LangHarness). The Today
 * page shows the same path folded to the current chapter; this is where
 * the learner sees how far the road goes and what each stage buys.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { CurriculumPath } from "@/components/curriculum-path";
import { startTutorChat } from "@/components/lesson/tutor";
import { curriculumUnit, purposeGoals, speakScene, tutorUnitPrompt, type CurriculumState, type ExamSummary, type LearnerGoal, type UnitState, type WeakSpotSummary } from "@/src/core";

export function CurriculumPage({ initialConfigured, state, next, goal, weak = [], exams = {} }: { initialConfigured: boolean; state: CurriculumState | null; next: string; goal: LearnerGoal; weak?: WeakSpotSummary[]; exams?: Record<string, ExamSummary> }) {
	const router = useRouter();
	const [configured, setConfigured] = useState(initialConfigured);
	const [setupOpen, setSetupOpen] = useState(false);
	const [pending, setPending] = useState<null | (() => Promise<void>)>(null);
	const [busy, setBusy] = useState(false);
	const zeroKeys = useZeroKeys();
	const strongKeyless = useStrongKeyless();

	const withTutor = (run: () => Promise<void>) => {
		if (!configured || zeroKeys || strongKeyless) {
			setPending(() => run);
			setSetupOpen(true);
			return;
		}
		setBusy(true);
		void run().catch(() => setBusy(false));
	};
	const onTutor = (u: UnitState) => {
		const unit = curriculumUnit(u.id);
		if (!unit) return;
		withTutor(() => startTutorChat(router, { title: `Tutor: ${unit.title}`, prompt: tutorUnitPrompt(unit), activity: "tutor", unit: unit.id }));
	};
	const onScene = (sceneId: string) => {
		if (speakScene(sceneId)) router.push(`/speak?scene=${sceneId}`);
	};

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="relative flex items-center gap-2 px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-16" data-testid="curriculum">
				<Link href="/" className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
					<ArrowLeftIcon className="size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 font-ui text-3xl font-black tracking-tight text-foreground">Your path to {goal.level}</h1>
				<p className="mt-2 max-w-2xl font-prose text-base text-muted-foreground">
					{state ? `${state.done} of ${state.total} units done. ` : ""}
					Each chapter mixes lessons you can do on your own (built from real sentences), short sessions with the tutor for what a sentence drill cannot
					check, and ends in something you can do. A chapter opens when the one before is nearly done; a lesson you ace in one go counts as done, so
					you are never held in what you already know. Each chapter ends with an exam. Its scores show here, and they do not lock anything yet.
				</p>
				<div className="mt-8">
					<CurriculumPath state={state} next={next} mode="full" goals={purposeGoals(goal.purposes ?? [])} weak={weak} exams={exams} busy={busy} onTutor={onTutor} onScene={onScene} />
				</div>
			</main>
			<SetupDialog
				open={setupOpen}
				onClose={() => setSetupOpen(false)}
				onDone={() => {
					setConfigured(true);
					setSetupOpen(false);
					const run = pending;
					setPending(null);
					if (run) {
						setBusy(true);
						void run().catch(() => setBusy(false));
					}
				}}
			/>
		</div>
	);
}
