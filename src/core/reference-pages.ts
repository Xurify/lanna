/**
 * The slovak.wiki pages a static explanation may link to (page level only).
 * Every slug is under /grammar/, the path the live pages use (fetched
 * 2026-11-04: /grammar/aspect and /grammar/demonstratives; the index lists the
 * other three). No deeper URL is used. tests/aspect-families.test.ts holds every explanation link
 * in curriculum/slovak/mixups.json to this list and to the Slovak base URL.
 *
 * Pure: the base comes from the language table, no network.
 */

import { LANGUAGES } from "./language.ts";

export const REFERENCE_PAGES: readonly string[] = [
	"/grammar/aspect",
	"/grammar/demonstratives",
	"/grammar/motion-verbs",
	"/grammar/future-tense",
	"/grammar/cases-overview",
];

/** The allowed page URL for a slug, or null when the slug is not on the list. */
export function referencePageUrl(slug: string, lang: keyof typeof LANGUAGES = "slovak"): string | null {
	if (!REFERENCE_PAGES.includes(slug)) return null;
	const base = LANGUAGES[lang].referenceSite?.baseUrl;
	return base ? `${base}${slug}` : null;
}

/** True when a URL is exactly an allowed page of the language's reference site. */
export function isAllowedReferenceUrl(url: string, lang: keyof typeof LANGUAGES = "slovak"): boolean {
	return REFERENCE_PAGES.some((slug) => referencePageUrl(slug, lang) === url);
}
