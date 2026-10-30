import { LessonPlayer } from "@/components/lesson/lesson-player";
import { isUnitId, type LessonPlan } from "@/src/core";
import { blitzFor, lessonFor, lessonWithBetterOptions } from "@/src/server";

export const dynamic = "force-dynamic";

/** A lesson (?unit=<id>) or a blitz (?mode=blitz): the fast local drill loop.
 *  The plan is built here, with the page, so the first question is in the
 *  first HTML and never swaps after load. */
export default async function LessonPage({ searchParams }: { searchParams: Promise<{ unit?: string; mode?: string }> }) {
	const { unit, mode } = await searchParams;
	const id = isUnitId(unit) ? unit : "words";
	let plan: LessonPlan | null = null;
	try {
		plan = mode === "blitz" ? blitzFor() : await lessonWithBetterOptions(lessonFor(id));
		if (plan.items.length === 0) plan = null;
	} catch {
		plan = null;
	}
	if (mode === "blitz") return <LessonPlayer mode="blitz" initialPlan={plan} />;
	return <LessonPlayer key={id} mode="lesson" unit={id} initialPlan={plan} />;
}
