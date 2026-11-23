import { Reader } from "@/components/reading/reader";
import { keepChapterStory, readingState } from "@/src/server";

export const metadata = { title: "Read" };

export const dynamic = "force-dynamic";

/** Read: a graded episode at the learner's level, every
 *  word tappable, every sentence spoken, three questions at the end.
 *  ?id=<story> reopens an episode from the library; ?library=1 opens the library. The state is read
 *  with the page so the text is in the first HTML and never swaps. */
export default async function ReadPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
	const { id } = await searchParams;
	let state = null;
	let story = null;
	try {
		if (id) story = await keepChapterStory(id);
		state = readingState(new Date().getTimezoneOffset(), undefined, { topUpShelf: false });
	} catch {
		state = null;
	}
	return <Reader key={id ?? "library"} initial={state} initialStory={story} />;
}
