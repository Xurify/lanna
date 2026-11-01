/**
 * Export the slovak.wiki dictionary into curriculum/slovak/lexicon.json
 * (LangHarness). Runs slovak.wiki's OWN catalog code (its words, verified
 * form generator and example-lemma matcher) through jiti, so the cloze
 * blanks and form lists are exactly what the site shows:
 *
 *   node scripts/export-slovakwiki-lexicon.mjs <path-to-slovak.wiki> [out]
 *
 * Needs slovak.wiki's node_modules installed (for jiti). Default out:
 * curriculum/slovak/lexicon.json.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const wiki = path.resolve(process.argv[2] ?? "../slovak.wiki");
const out = path.resolve(process.argv[3] ?? "curriculum/slovak/lexicon.json");
const { createJiti } = await import(pathToFileURL(path.join(wiki, "node_modules/jiti/lib/jiti.mjs")).href);
const jiti = createJiti(import.meta.url, { alias: { $lib: path.join(wiki, "src/lib"), "@": path.join(wiki, "src") }, interopDefault: true });
const lib = (p) => jiti.import(path.join(wiki, "src/lib/catalog", p));
const { words } = await lib("dictionary/words.ts");
const { searchFormsForLemma, formsVerified } = await lib("search/forms.ts");
const { tokenMatchesVerbStem, verbStemForMatch } = await lib("dictionary/example-lemma-match.ts");

const TOKEN_RE = /[\p{L}\p{M}]+/gu;
/** The first token of `text` that is a form of the lemma — the cloze blank. */
function findCloze(text, lemma, category, gender) {
	const base = lemma.toLocaleLowerCase("sk").replace(/ s[ai]$/u, "");
	if (/\s/.test(base)) return null; // multi-word lemmas are not blanked
	const keys = new Set([base, ...searchFormsForLemma(lemma, category, gender).map((f) => f.toLocaleLowerCase("sk"))]);
	const stem = category === "Verbs" ? verbStemForMatch(base) : undefined;
	for (const m of text.matchAll(TOKEN_RE)) {
		const t = m[0].toLocaleLowerCase("sk");
		if (keys.has(t) || (stem && tokenMatchesVerbStem(t, stem))) return { answer: m[0], at: m.index };
	}
	return null;
}

let clozes = 0;
const exported = words.map((w) => {
	const examples = (w.examples ?? []).map((e) => {
		const cloze = findCloze(e.slovak, w.slovak, w.category, w.gender);
		if (cloze) clozes++;
		return {
			sk: e.slovak,
			en: e.english,
			src: e.note === "Tatoeba" ? "tatoeba" : "curated",
			...(e.tatoebaId ? { tatoebaId: e.tatoebaId } : {}),
			...(cloze ? { cloze } : {}),
		};
	});
	const generatedForms = searchFormsForLemma(w.slovak, w.category, w.gender);
	const verified = formsVerified(w.slovak, w.category, w.gender);
	return {
		slug: w.slug,
		sk: w.slovak,
		en: w.english,
		cat: w.category,
		...(w.topics?.length ? { topics: w.topics } : {}),
		...(w.gender ? { gender: w.gender } : {}),
		...(w.register ? { register: w.register } : {}),
		...(w.frequency ? { rank: w.frequency.rank, pos: w.frequency.partOfSpeech } : {}),
		...(w.declension ? { declension: w.declension } : {}),
		...(generatedForms.length > 0 ? { forms: generatedForms } : {}),
		...(verified ? { formsVerified: true } : {}),
		origin: w.origin,
		examples,
		related: w.related ?? [],
	};
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
	out,
	JSON.stringify({
		source: "slovak.wiki (github.com/Xurify/slovakwiki)",
		exportedAt: new Date().toISOString(),
		license: "Examples marked tatoeba: Tatoeba, CC BY 2.0 FR",
		words: exported,
	}),
);
console.log(`${exported.length} words, ${clozes} cloze-able examples → ${out}`);
