import { WatchPlayer } from "@/components/watch/watch-player";
import { currentVideo, discoverState, watchState } from "@/src/server";

export const metadata = { title: "Media" };

export const dynamic = "force-dynamic";

/** Watch: a YouTube video the learner chose, with both
 *  subtitles, one line at a time, every word tappable, questions at the
 *  end. ?id=<video> opens a prepared video from the library; ?url=<link>
 *  prepares one. The state and the picks are read with the page so the
 *  library is in the first HTML and never swaps. */
export default async function WatchPage({
	searchParams,
}: {
	searchParams: Promise<{ id?: string; url?: string; tab?: string }>;
}) {
	const { id, url, tab } = await searchParams;
	let state = null;
	let video = null;
	let discover = null;
	try {
		state = watchState(new Date().getTimezoneOffset());
		if (id) video = currentVideo(id);
	} catch {
		state = null;
	}
	try {
		discover = discoverState();
	} catch {
		discover = null;
	}
	return (
		<WatchPlayer
			key={id ?? url ?? "shelf"}
			initial={state}
			initialVideo={video}
			initialUrl={url ?? null}
			initialDiscover={discover}
			initialTab={tab === "notes" ? "notes" : undefined}
		/>
	);
}
