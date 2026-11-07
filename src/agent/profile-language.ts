/**
 * Which language a profile id means. Built-in languages are in the core
 * table; an added one is read from its language.json the first time it is
 * asked for and registered, so the browser-safe core can look it up after.
 * In the agent layer so the lexicon and the learner profile can use it; the
 * server re-exports it (src/server/active-language.ts).
 */

import { activeProfile, readAddedLanguage } from "../../config.ts";
import { languageById, parseLanguageInfo, registerLanguage, type LanguageInfo } from "../core/language.ts";

export function profileLanguage(id: string): LanguageInfo | undefined {
	const known = languageById(id);
	if (known) return known;
	const added = parseLanguageInfo(readAddedLanguage(id));
	if (!added || added.id !== id) return undefined;
	registerLanguage(added);
	return added;
}

/** The running profile's language. Throws when its language.json is missing
 *  or unreadable: falling back to another language would show the learner
 *  the wrong one with no sign of the fault. */
export function activeLanguage(): LanguageInfo {
	const id = activeProfile();
	const info = profileLanguage(id);
	if (!info) throw new Error(`Language "${id}" has no readable language.json. Restore that file, or switch to another language.`);
	return info;
}
