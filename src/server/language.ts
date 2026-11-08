/**
 * Language profiles (LangHarness, spec D7 / WF-01) — which language the
 * server runs and switching it.
 *
 * A switch happens in place (config.ts switchProfile): the data folder and
 * the course follow at once, and the browser reloads the page.
 */

import fs from "node:fs";
import { activeProfile, curriculumFile, isLanguageProfile, shownProfiles, switchProfile, withProfile, type LanguageProfile } from "../../config.ts";
import { emit } from "../core/events.ts";
import type { LanguageInfo } from "../core/language.ts";
import { activeLanguage, profileLanguage } from "./active-language.ts";
import { languageRemovable } from "./language-add.ts";
import { listTasks } from "./tasks.ts";
import { anyTurnRunning } from "./turn-liveness.ts";

interface ProfileStatus {
	active: LanguageProfile;
	/** The running language in full: the browser reads its tag, voices and letters here. */
	language: LanguageInfo;
	profiles: Array<{ id: LanguageProfile; tag: string; endonym: string; english: string; lexicon: boolean; /** It can be removed from the list now. */ removable: boolean }>;
}

export function profileStatus(): ProfileStatus {
	return {
		active: activeProfile(),
		language: activeLanguage(),
		profiles: shownProfiles().flatMap((id) => {
			const info = profileLanguage(id);
			if (!info) return [];
			return [{
				id,
				tag: info.tag,
				endonym: info.endonym,
				english: info.english,
				lexicon: fs.existsSync(curriculumFile(id, "lexicon.json")),
				removable: languageRemovable(id),
			}];
		}),
	};
}

export class SwitchBlocked extends Error {}

export function inShownLanguage<T>(shown: string | null, fn: () => T): T | null {
	if (!shown) return fn();
	return isLanguageProfile(shown) ? withProfile(shown, fn) : null;
}

/** Why the running language cannot change now, or null. Work in flight
 *  writes into the running language's folder when it finishes, so a switch
 *  waits for it. */
function switchBlocker(): string | null {
	if (anyTurnRunning()) return "The tutor is still answering. Switch when the reply is done.";
	const video = listTasks().find((t) => t.kind === "video" && t.status === "running");
	if (video) return `"${video.title}" is still running. Switch when it is done, or stop it on the Tasks page.`;
	return null;
}

/** Run `profile` from now on. */
export function selectProfile(profile: LanguageProfile): ProfileStatus {
	if (profile !== activeProfile()) {
		const blocked = switchBlocker();
		if (blocked) throw new SwitchBlocked(blocked);
		switchProfile(profile);
		emit("language-changed", {});
	}
	return profileStatus();
}

