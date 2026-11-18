import { VariantPicker } from "@/components/variant-picker";
import { LAYOUTS, chosen, harnessGroups } from "@/components/speak/variants/harness";
import { SpeakPlayer } from "@/components/speak/speak-player";
import { ScriptPlayer } from "@/components/speak/script-player";
import { scriptFor } from "@/src/core";
import { activeLanguage, speakState } from "@/src/server";

export const metadata = { title: "Speak with a tutor" };

export const dynamic = "force-dynamic";

/** A scene said out loud with the tutor. ?scene=<id> opens that
 *  scene at once (the daily plan's link); without it, the picker. ?mode=typed
 *  opens it with the keyboard on (Today's "Talk in writing"); ?mode=script
 *  walks the scene on its rails first (E13) — no model, graded locally.
 *  The state is read with the page so the scenes are in the first HTML. */
export default async function SpeakTutorPage({
	searchParams,
}: {
	searchParams: Promise<{ scene?: string; mode?: string; __variant?: string; __motion?: string }>;
}) {
	const { scene, mode, __variant, __motion } = await searchParams;
	const picker = <VariantPicker groups={harnessGroups("tutor", __variant, __motion)} />;
	const sceneId = scene && /^[a-z]+$/.test(scene) ? scene : null;
	// Script mode runs its own player and must never auto-start the live
	// scene (SpeakPlayer starts when sceneId is set). A scene without a
	// script falls through to the normal player.
	const language = activeLanguage();
	const lang = { id: language.id, tag: language.tag };
	if (mode === "script" && sceneId && scriptFor(sceneId, lang.id)) {
		return (
			<>
				<ScriptPlayer key={`script-${sceneId}`} sceneId={sceneId} langId={lang.id} />
				{picker}
			</>
		);
	}
	let state = null;
	try {
		state = speakState();
	} catch {
		state = null;
	}
	return (
		<>
			<SpeakPlayer
				board={chosen(LAYOUTS.tutor, __variant)}
				key={scene ?? "pick"}
				initialState={state}
				sceneId={sceneId}
				typed={mode === "typed"}
				sceneLang={lang}
			/>
			{picker}
		</>
	);
}
