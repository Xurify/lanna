import { SpeakPlayer } from "@/components/speak/speak-player";
import { ScriptPlayer } from "@/components/speak/script-player";
import { scriptFor } from "@/src/core";
import { activeLanguage, speakState } from "@/src/server";

export const metadata = { title: "Speak" };

export const dynamic = "force-dynamic";

/** Speak: a scene said out loud with the tutor. ?scene=<id> opens that
 *  scene at once (the daily plan's link); without it, the picker. ?mode=typed
 *  opens it with the keyboard on (Today's "Talk in writing"); ?mode=script
 *  walks the scene on its rails first (E13) — no model, graded locally.
 *  The state is read with the page so the scenes are in the first HTML. */
export default async function SpeakPage({ searchParams }: { searchParams: Promise<{ scene?: string; mode?: string }> }) {
	const { scene, mode } = await searchParams;
	const sceneId = scene && /^[a-z]+$/.test(scene) ? scene : null;
	// Script mode runs its own player and must never auto-start the live
	// scene (SpeakPlayer starts when sceneId is set). A scene without a
	// script falls through to the normal player.
	const language = activeLanguage();
	const lang = { id: language.id, tag: language.tag };
	if (mode === "script" && sceneId && scriptFor(sceneId, lang.id)) {
		return <ScriptPlayer key={`script-${sceneId}`} sceneId={sceneId} lang={lang.id} />;
	}
	let state = null;
	try {
		state = speakState();
	} catch {
		state = null;
	}
	return <SpeakPlayer key={scene ?? "pick"} initialState={state} sceneId={sceneId} typed={mode === "typed"} lang={lang} />;
}
