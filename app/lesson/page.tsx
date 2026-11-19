import { LessonPlayer } from "@/components/lesson/lesson-player";
import { isAtlasGender, isUnitId, type LessonPlan } from "@/src/core";
import { aiStatus, blitzFor, mixupsFor, personalFor, slippingFor, unitLesson } from "@/src/server";

export const metadata = { title: "Lesson" };

export const dynamic = "force-dynamic";

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
						: mode === "slipping"
							? slippingFor()
							: await unitLesson(id, { gender: gen });
		if (plan.items.length === 0) plan = null;
	} catch {
		plan = null;
	}
	if (mode === "blitz") return <LessonPlayer mode="blitz" initialPlan={plan} />;
	if (mode === "mixups" || mode === "personal" || mode === "slipping")
		return (
			<LessonPlayer
				key={mode}
				mode="lesson"
				focus={mode}
				initialPlan={plan}
				sentenceCheckReady={mode === "slipping" ? aiStatus("cheap").ready : false}
			/>
		);
	return <LessonPlayer key={`${id}-${gen ?? "all"}`} mode="lesson" unit={id} gender={gen} initialPlan={plan} />;
}
