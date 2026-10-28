import { SpeakPlayer } from "@/components/speak/speak-player";
import { speakState } from "@/src/server";

export const dynamic = "force-dynamic";

/** Speak: a scene said out loud with the tutor. ?scene=<id> opens that
 *  scene at once (the daily plan's link); without it, the picker. The
 *  state is read with the page so the scenes are in the first HTML. */
export default async function SpeakPage({ searchParams }: { searchParams: Promise<{ scene?: string }> }) {
	const { scene } = await searchParams;
	let state = null;
	try {
		state = speakState();
	} catch {
		state = null;
	}
	return <SpeakPlayer key={scene ?? "pick"} initialState={state} sceneId={scene && /^[a-z]+$/.test(scene) ? scene : null} />;
}
