/**
 * Language profiles (spec D7 / WF-01) — which language the
 * server runs and switching it.
 *
 */

import fs from "node:fs";
import {
	activeProfile,
	curriculumFile,
	shownProfiles,
	switchProfile,
	withProfile,
	type LanguageProfile,
} from "../../config.ts";
import type { LanguageInfo } from "../core/language.ts";
import { activeLanguage, profileLanguage } from "./active-language.ts";
import { languageRemovable } from "./language-add.ts";

export { activeProfile, shownProfiles, withProfile };

interface ProfileStatus {
	active: LanguageProfile;
	/** The running language in full: the browser reads its tag, voices and letters here. */
	language: LanguageInfo;
	profiles: Array<{
		id: LanguageProfile;
		tag: string;
		endonym: string;
		english: string;
		lexicon: boolean;
		/** It can be removed from the list now. */ removable: boolean;
	}>;
}

export function profileStatus(): ProfileStatus {
	return {
		active: activeProfile(),
		language: activeLanguage(),
		profiles: shownProfiles().flatMap((id) => {
			const info = profileLanguage(id);
			if (!info) return [];
			return [
				{
					id,
					tag: info.tag,
					endonym: info.endonym,
					english: info.english,
					lexicon: fs.existsSync(curriculumFile(id, "lexicon.json")),
					removable: languageRemovable(id),
				},
			];
		}),
	};
}

export function selectProfile(profile: LanguageProfile): ProfileStatus {
	switchProfile(profile);
	return withProfile(profile, profileStatus);
}
