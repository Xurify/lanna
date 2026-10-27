import { LessonPlayer } from "@/components/lesson/lesson-player";
import { isUnitId } from "@/src/core";

export const dynamic = "force-dynamic";

/** A lesson (?unit=<id>) or a blitz (?mode=blitz): the fast local drill loop. */
export default async function LessonPage({ searchParams }: { searchParams: Promise<{ unit?: string; mode?: string }> }) {
	const { unit, mode } = await searchParams;
	if (mode === "blitz") return <LessonPlayer mode="blitz" />;
	return <LessonPlayer mode="lesson" unit={isUnitId(unit) ? unit : "words"} />;
}
