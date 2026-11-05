/**
 * Which language a profile id means. Built-in languages are in the core
 * table; an added one is read from its language.json the first time it is
 * asked for and registered, so the browser-safe core can look it up after.
 * In the agent layer so the lexicon and the learner profile can use it; the
 * server re-exports it (src/server/active-language.ts).
 */

import { activeProfile, readAddedLanguage } from "../../config.ts";
import { LANGUAGES, languageById, parseLanguageInfo, registerLanguage, type LanguageInfo } from "../core/language.ts";

export function profileLanguage(id: string): LanguageInfo | undefined {
	const known = languageById(id);
	if (known) return known;
	const added = parseLanguageInfo(readAddedLanguage(id));
	if (!added || added.id !== id) return undefined;
	registerLanguage(added);
	return added;
}

/** The running profile's language. Slovak when its language.json has gone
 *  missing, so a page still renders. */
export function activeLanguage(): LanguageInfo {
	return profileLanguage(activeProfile()) ?? LANGUAGES.slovak;
}
