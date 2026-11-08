/**
 * The slovak.wiki pages a static explanation may link to, and the sections
 * (#anchors) on them that a link may point at. Every slug is under /grammar/,
 * the path the live pages use. All five pages, and the anchors listed below,
 * were fetched on 2026-11-05 from the server-rendered HTML; the bare domain
 * redirects to www, which is why the language table's base is www.
 * tests/aspect-families.test.ts holds every explanation link in
 * curriculum/slovak/mixups.json to this list and to the Slovak base URL.
 *
 * The six case pages (under /grammar/cases/) were verified live on
 * 2026-11-07 and against the site source's own case table
 * (slovak.wiki: src/lib/catalog/reference/cases.ts). They carry no verified
 * #anchors yet.
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
	"/grammar/cases/nominative",
	"/grammar/cases/genitive",
	"/grammar/cases/dative",
	"/grammar/cases/accusative",
	"/grammar/cases/locative",
	"/grammar/cases/instrumental",
];

/** The verified section anchors per page. A link may carry only one of these. */
export const REFERENCE_ANCHORS: Readonly<Record<string, readonly string[]>> = {
	"/grammar/aspect": ["contrasts", "rule"],
	"/grammar/demonstratives": ["contrasts", "rule"],
};

/** The allowed URL for a slug (and an optional verified anchor), or null when either is not on the list. */
export function referencePageUrl(slug: string, lang: keyof typeof LANGUAGES = "slovak", anchor?: string): string | null {
	if (!REFERENCE_PAGES.includes(slug)) return null;
	if (anchor !== undefined && !(REFERENCE_ANCHORS[slug] ?? []).includes(anchor)) return null;
	const base = LANGUAGES[lang].referenceSite?.baseUrl;
	if (!base) return null;
	return anchor === undefined ? `${base}${slug}` : `${base}${slug}#${anchor}`;
}

/** True when a URL is exactly an allowed page of the language's reference site, optionally with a verified anchor. */
export function isAllowedReferenceUrl(url: string, lang: keyof typeof LANGUAGES = "slovak"): boolean {
	const hash = url.indexOf("#");
	const page = hash === -1 ? url : url.slice(0, hash);
	const anchor = hash === -1 ? undefined : url.slice(hash + 1);
	return REFERENCE_PAGES.some((slug) => referencePageUrl(slug, lang) === page && (anchor === undefined || referencePageUrl(slug, lang, anchor) === url));
}
