import { WatchPlayer } from "@/components/watch/watch-player";
import { videoStore, watchState } from "@/src/server";

export const dynamic = "force-dynamic";

/** Watch (LangHarness): a YouTube video the learner chose, with both
 *  subtitles, one line at a time, every word tappable, questions at the
 *  end. ?id=<video> opens a prepared video from the library; ?url=<link>
 *  prepares one. The state is read with the page so the library is in
 *  the first HTML and never swaps. */
export default async function WatchPage({ searchParams }: { searchParams: Promise<{ id?: string; url?: string }> }) {
	const { id, url } = await searchParams;
	let state = null;
	let video = null;
	try {
		state = watchState(new Date().getTimezoneOffset());
		if (id) video = videoStore.get(id);
	} catch {
		state = null;
	}
	return <WatchPlayer key={id ?? url ?? "shelf"} initial={state} initialVideo={video} initialUrl={url ?? null} />;
}
