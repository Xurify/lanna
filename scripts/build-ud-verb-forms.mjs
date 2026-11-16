/**
 * Verb forms from the Universal Dependencies Slovak treebank (LangHarness,
 * 2026-11-01). The forms are what the cloze step of the lexicon export blanks
 * in existing sentences (scripts/export-slovakwiki-lexicon.mjs).
 *
 *   node scripts/build-ud-verb-forms.mjs <dir with sk_snk-ud-{train,dev,test}.conllu> [out.json]
 *
 * UD_Slovak-SNK (CC BY-SA 4.0) assigns lemmas and morphology manually, and its
 * README says it keeps only sentences where two annotators agreed on the whole
 * analysis. A form is kept only when it is a verb (VERB or AUX) wherever it
 * occurs and has one lemma, so a homograph such as a noun cannot be blanked as
 * a verb.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["sk_snk-ud-train.conllu", "sk_snk-ud-dev.conllu", "sk_snk-ud-test.conllu"];
const norm = (s) => s.normalize("NFC").toLocaleLowerCase("sk");

/** Verb forms by lemma, from the treebank texts (one string per file). */
export function verbFormsFromConllu(texts) {
	const byForm = new Map();
	for (const text of texts) {
		for (const line of text.split("\n")) {
			if (!line || line.startsWith("#")) continue;
			const cols = line.split("\t");
			if (cols.length < 4 || cols[0].includes("-") || cols[0].includes(".")) continue;
			const form = norm(cols[1]);
			if (!byForm.has(form)) byForm.set(form, { lemmas: new Set(), nonVerb: false });
			const entry = byForm.get(form);
			if (cols[3] === "VERB" || cols[3] === "AUX") entry.lemmas.add(norm(cols[2]));
			else entry.nonVerb = true;
		}
	}
	const forms = {};
	for (const [form, { lemmas, nonVerb }] of byForm) {
		if (nonVerb || lemmas.size !== 1) continue;
		const [lemma] = lemmas;
		(forms[lemma] ??= []).push(form);
	}
	for (const list of Object.values(forms)) list.sort();
	return forms;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const [dir, outPath = "curriculum/slovak/ud-verb-forms.json"] = process.argv.slice(2);
	if (!dir) {
		console.error("usage: node scripts/build-ud-verb-forms.mjs <dir with the three conllu files> [out.json]");
		process.exit(1);
	}
	const texts = FILES.map((file) => fs.readFileSync(path.join(dir, file), "utf8"));
	const forms = verbFormsFromConllu(texts);
	const out = {
		source:
			"Universal Dependencies, UD_Slovak-SNK (sk_snk-ud-train/dev/test.conllu): lemmas and morphology assigned manually; only sentences where two annotators agreed are included.",
		license: "CC BY-SA 4.0",
		forms,
	};
	fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
	console.log(
		JSON.stringify({
			lemmas: Object.keys(forms).length,
			forms: Object.values(forms).reduce((n, list) => n + list.length, 0),
			out: outPath,
		}),
	);
}
