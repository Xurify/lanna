"use client";

/**
 * /curriculum — the whole map, every chapter open (LangHarness). The Today
 * page shows the same path folded to the current chapter; this is where
 * the learner sees how far the road goes and what each stage buys.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { Climb } from "@/components/climb";
import { CLIMB_VIEWS, saveClimbView, type ClimbView } from "@/lib/climb-view";
import { cn } from "@/lib/utils";
import { startTutorChat } from "@/components/lesson/tutor";
import { curriculumUnit, purposeGoals, speakScene, tutorUnitPrompt, type CurriculumState, type ExamSummary, type LearnerGoal, type UnitState, type WeakSpotSummary } from "@/src/core";

export function CurriculumPage({ initialView = "chapters", initialConfigured, state, next, goal, weak = [], exams = {} }: { initialView?: ClimbView; initialConfigured: boolean; state: CurriculumState | null; next: string; goal: LearnerGoal; weak?: WeakSpotSummary[]; exams?: Record<string, ExamSummary> }) {
	const router = useRouter();
	const pathname = usePathname();
	const [view, setView] = useState<ClimbView>(initialView);
	const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
	const choose = (next: ClimbView) => {
		setView(next);
		saveClimbView(next);
		// replaceState keeps the URL shareable without a server round trip or a scroll reset.
		window.history.replaceState(null, "", next === "chapters" ? pathname : `${pathname}?view=${next}`);
	};
	const onTabKey = (e: React.KeyboardEvent, i: number) => {
		const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? CLIMB_VIEWS.length - 1 : null;
		if (to === null) return;
		e.preventDefault();
		const target = CLIMB_VIEWS[(to + CLIMB_VIEWS.length) % CLIMB_VIEWS.length]!;
		choose(target.id);
		tabs.current[target.id]?.focus();
	};
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
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-5xl px-5 pb-16 @container" data-testid="curriculum">
				<Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Your climb to {goal.level}</h1>
				<p className="q-line dim mt-2 max-w-2xl">
					{state ? `${state.done} of ${state.total} units done. ` : ""}
					Each level is a stop on the way up. A chapter opens when the one before is nearly done, and a lesson you ace counts as done.
				</p>
				<div role="tablist" aria-label="How to read the climb" className="q-segc mt-6" data-testid="climb-views">
					{CLIMB_VIEWS.map((v, i) => (
						<button
							key={v.id}
							ref={(el) => {
								tabs.current[v.id] = el;
							}}
							type="button"
							role="tab"
							id={`climb-tab-${v.id}`}
							aria-selected={view === v.id}
							aria-controls="climb-panel"
							tabIndex={view === v.id ? 0 : -1}
							className={cn("min-w-24", view === v.id && "on")}
							onClick={() => choose(v.id)}
							onKeyDown={(e) => onTabKey(e, i)}
							data-testid={`climb-view-${v.id}`}
						>
							{v.label}
						</button>
					))}
				</div>
				<div className="mt-6" role="tabpanel" id="climb-panel" aria-labelledby={`climb-tab-${view}`}>
					<Climb view={view} state={state} next={next} mode="full" goalLevel={goal.level} goals={purposeGoals(goal.purposes ?? [])} weak={weak} exams={exams} busy={busy} onTutor={onTutor} onScene={onScene} />
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
