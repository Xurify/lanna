import { Reader } from "@/components/reading/reader";
import { readingState, storyStore } from "@/src/server";

export const dynamic = "force-dynamic";

/** Read (LangHarness): a graded episode at the learner's level, every
 *  word tappable, every sentence spoken, three questions at the end.
 *  ?id=<story> reopens an episode from the library. The state is read
 *  with the page so the text is in the first HTML and never swaps. */
export default async function ReadPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
	const { id } = await searchParams;
	let state = null;
	let story = null;
	try {
		state = readingState(new Date().getTimezoneOffset());
		if (id) story = storyStore.get(id);
	} catch {
		state = null;
	}
	return <Reader key={id ?? "next"} initial={state} initialStory={story} />;
}
