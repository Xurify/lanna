/**
 * Scripted scenes (LangHarness, 2026-10-30, E13): each Speak scene has an
 * authored script the learner can walk through before saying it live —
 * the tutor's line, then a choice of three next lines, one right and two
 * plausible slips. The scripts are data in curriculum/slovak/scenes/
 * (authored, not generated — no model cost), and this module is the pure
 * machinery on top: look a script up, and grade a choice with an
 * explanation a learner can act on.
 *
 * Pure and browser-safe: the JSON is bundled, no fs, no model, no API.
 */

import cafe from "../../curriculum/slovak/scenes/cafe.json";
import colleague from "../../curriculum/slovak/scenes/colleague.json";
import doctor from "../../curriculum/slovak/scenes/doctor.json";
import family from "../../curriculum/slovak/scenes/family.json";
import hotel from "../../curriculum/slovak/scenes/hotel.json";
import restaurant from "../../curriculum/slovak/scenes/restaurant.json";
import shop from "../../curriculum/slovak/scenes/shop.json";
import station from "../../curriculum/slovak/scenes/station.json";
import way from "../../curriculum/slovak/scenes/way.json";

import { LANGUAGE_IDS, type LanguageId } from "./language.ts";

export interface SceneOption {
	/** Target language line. */
	text?: string;
	/** The line in Slovak (legacy). */
	sk?: string;
	/** True on the one line that answers the tutor well. */
	correct?: boolean;
	/** On the correct option: the lexicon lemmas behind the key words. */
	lemmas?: string[];
	/** On a wrong option: the one-line English explanation of the slip. */
	why?: string;
}

export function sceneOptionText(option: SceneOption): string {
	return option.text ?? option.sk ?? "";
}

/** The tutor line of a turn in the target language (text, else the legacy sk). */
export function tutorLineText(tutor: ScriptTurn["tutor"]): string {
	return tutor.text ?? tutor.sk ?? "";
}

export interface ScriptTurn {
	/** The tutor's line, in target language with its English meaning. */
	tutor: { text?: string; sk?: string; en: string };
	/** Exactly three options, exactly one correct. */
	options: SceneOption[];
}

export interface SceneScript {
	/** The scene id (one of SPEAK_SCENES, src/core/speak.ts). */
	scene: string;
	turns: ScriptTurn[];
}

const RAW_BY_LANGUAGE: Partial<Record<LanguageId, SceneScript[]>> = {
	slovak: [cafe, colleague, doctor, family, hotel, restaurant, shop, station, way].map((script) => script as SceneScript),
};

const BY_SCENE_BY_LANGUAGE = new Map<LanguageId, Map<string, SceneScript>>();
for (const [lang, scripts] of Object.entries(RAW_BY_LANGUAGE)) {
	BY_SCENE_BY_LANGUAGE.set(lang as LanguageId, new Map((scripts as SceneScript[]).map((script) => [script.scene, script])));
}

/** The scene's script, or undefined when the scene has none. */
export function scriptFor(sceneId: string, lang: string = "slovak"): SceneScript | undefined {
	const known = LANGUAGE_IDS.find((id) => id === lang);
	return known ? BY_SCENE_BY_LANGUAGE.get(known)?.get(sceneId) : undefined;
}

/** What the grader says about one choice. */
interface ScriptGrade {
	correct: boolean;
	/** The right line — the choice itself when correct, otherwise shown after the retry. */
	right: string;
	/** On a wrong choice: the English explanation of the slip. */
	explanation?: string;
}

/** Grade one choice (option index) against one turn (turn index) of the
 *  script. A wrong index returns undefined — the UI treats that as "no
 *  such turn", never as an answer. */
export function grade(script: SceneScript, turn: number, choice: number): ScriptGrade | undefined {
	const t = script.turns[turn];
	if (!t) return undefined;
	const picked = t.options[choice];
	if (!picked) return undefined;
	if (picked.correct) return { correct: true, right: sceneOptionText(picked) };
	const right = t.options.find((o) => o.correct);
	return { correct: false, right: right ? sceneOptionText(right) : "", explanation: picked.why };
}
