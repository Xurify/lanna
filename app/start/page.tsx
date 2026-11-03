import { Start } from "@/components/onboarding/start";
import { hoursDone, type LearnerGoal } from "@/src/core";
import { progressSummary } from "@/src/server";

export const metadata = { title: "Set up" };

export const dynamic = "force-dynamic";

/** Setup: the minute that replaces the placement chat (?edit=1 reopens it
 *  pre-filled). The Today page sends a fresh profile here once. */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ edit?: string; check?: string }> }) {
	const { edit, check } = await searchParams;
	let goal: LearnerGoal | null = null;
	let hours = 0;
	let current = "hello";
	try {
		const s = progressSummary(new Date().getTimezoneOffset());
		goal = s.goal;
		hours = hoursDone(s.curriculum);
		current = s.curriculum.current;
	} catch {
		goal = null;
	}
	// ?check=1 opens on the placement check itself, for a learner who is set up.
	return <Start goal={goal} edit={edit === "1"} hoursDone={hours} currentChapter={current} onCheck={edit === "1" && check === "1" && !!goal?.onboardedAt} />;
}
