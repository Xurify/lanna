import { notFound } from "next/navigation";
import { ExamPlayer } from "@/components/exam/exam-player";
import { CHAPTERS } from "@/src/core";
import { examFor } from "@/src/server";

export const metadata = { title: "Exam" };

export const dynamic = "force-dynamic";

/** The chapter exam (E14): ?chapter=<id> plays that chapter's exam. The path
 *  is the way in (E15), so a bare /exam or an unknown chapter is a 404. The
 *  first draw is built with the page, so the first item is in the first HTML. */
export default async function ExamPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
	const { chapter } = await searchParams;
	const ch = CHAPTERS.find((c) => c.id === chapter);
	if (!ch) notFound();
	let draw = null;
	try {
		draw = examFor(ch.id);
	} catch {
		draw = null;
	}
	return <ExamPlayer chapterId={ch.id} title={ch.title} initial={draw} />;
}
