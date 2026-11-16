import { referenceLink, type LanguageReferenceSite } from "@/src/core";

interface WordLinkInput {
	text: string;
	langCode: string;
	langEnglish: string;
	referenceSite?: LanguageReferenceSite;
	slug?: string;
	lemma?: string;
	lookupUrl?: string;
	lookupLabel?: string;
}

export function wordLinks({
	text,
	langCode,
	langEnglish,
	referenceSite,
	slug,
	lemma,
	lookupUrl,
	lookupLabel,
}: WordLinkInput) {
	const encodedWord = encodeURIComponent(text);
	const referenceUrl =
		lookupUrl ??
		(referenceSite ? referenceLink(referenceSite, { slug, lemma: lemma ?? text, query: text }) : undefined);
	return {
		referenceUrl,
		referenceLabel: lookupLabel ?? referenceSite?.label,
		wiktionaryUrl: `https://en.wiktionary.org/wiki/${encodedWord}#${encodeURIComponent(langEnglish)}`,
		googleTranslateUrl: `https://translate.google.com/?sl=${encodeURIComponent(langCode)}&tl=en&text=${encodedWord}&op=translate`,
		deeplUrl: `https://www.deepl.com/translator#${encodeURIComponent(langCode)}/en/${encodedWord}`,
		forvoUrl: `https://forvo.com/word/${encodedWord}/#${encodeURIComponent(langCode)}`,
	};
}
