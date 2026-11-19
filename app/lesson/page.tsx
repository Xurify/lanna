import { LessonPlayer } from "@/components/lesson/lesson-player";
import { isAtlasGender, isUnitId, type LessonPlan } from "@/src/core";
import { blitzFor, mixupsFor, personalFor, unitLesson } from "@/src/server";

export const metadata = { title: "Lesson" };

export const dynamic = "force-dynamic";

/** A lesson (?unit=<id>), a blitz (?mode=blitz), the Mix-ups lesson
 *  (?mode=mixups) or the personal lesson (?mode=personal): the fast local
 *  drill loop. The plan is built here, with the page, so the first question
 *  is in the first HTML and never swaps after load. A unit lesson opens on
 *  the learn-first case sketch when the unit has one, before rep 1. */
export default async function LessonPage({
	searchParams,
}: {
	searchParams: Promise<{ unit?: string; mode?: string; gender?: string }>;
}) {
	const { unit, mode, gender } = await searchParams;
	const id = isUnitId(unit) ? unit : "words";
	const gen = isAtlasGender(gender) ? gender : undefined;
	let plan: LessonPlan | null = null;
	try {
		plan =
			mode === "blitz"
				? blitzFor()
				: mode === "mixups"
					? mixupsFor()
					: mode === "personal"
						? personalFor()
						: await unitLesson(id, { gender: gen });
		if (plan.items.length === 0) plan = null;
	} catch {
		plan = null;
	}
	if (mode === "blitz") return <LessonPlayer mode="blitz" initialPlan={plan} />;
	if (mode === "mixups" || mode === "personal")
		return <LessonPlayer key={mode} mode="lesson" focus={mode} initialPlan={plan} />;
	return <LessonPlayer key={`${id}-${gen ?? "all"}`} mode="lesson" unit={id} gender={gen} initialPlan={plan} />;
}
