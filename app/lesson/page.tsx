import { LessonPlayer } from "@/components/lesson/lesson-player";
import { isAtlasGender, isUnitId, type LessonPlan } from "@/src/core";
import { blitzFor, lessonFor, lessonWithBetterOptions, mixupsFor } from "@/src/server";

export const dynamic = "force-dynamic";

/** A lesson (?unit=<id>), a blitz (?mode=blitz) or the Mix-ups lesson
 *  (?mode=mixups): the fast local drill loop. The plan is built here, with
 *  the page, so the first question is in the first HTML and never swaps
 *  after load. */
export default async function LessonPage({ searchParams }: { searchParams: Promise<{ unit?: string; mode?: string; gender?: string }> }) {
	const { unit, mode, gender } = await searchParams;
	const id = isUnitId(unit) ? unit : "words";
	const gen = isAtlasGender(gender) ? gender : undefined;
	let plan: LessonPlan | null = null;
	try {
		plan = mode === "blitz" ? blitzFor() : mode === "mixups" ? mixupsFor() : await lessonWithBetterOptions(lessonFor(id, Date.now(), { gender: gen }));
		if (plan.items.length === 0) plan = null;
	} catch {
		plan = null;
	}
	if (mode === "blitz") return <LessonPlayer mode="blitz" initialPlan={plan} />;
	if (mode === "mixups") return <LessonPlayer key="mixups" mode="lesson" focus="mixups" initialPlan={plan} />;
	return <LessonPlayer key={`${id}-${gen ?? "all"}`} mode="lesson" unit={id} gender={gen} initialPlan={plan} />;
}
