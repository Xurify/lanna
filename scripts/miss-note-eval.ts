/**
 * Writes the AI note for chosen word pairs through the app's own path
 * (src/server/miss-note.ts: Cheap slot, deterministic check, judge call) and
 * saves what came back, with cost and time, for a person to grade.
 *
 *   LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<auth.json> \
 *     tsx scripts/miss-note-eval.ts <out-dir> <a/b> [<a/b> ...]
 *   ... tsx scripts/miss-note-eval.ts <out-dir> --dry <a/b> ...   prints the prompt, calls nothing
 *
 * The sandbox's settings.json must set the Cheap slot. EVAL_MAX_CALLS (default
 * 100) caps the model calls of one run.
 */

import fs from "node:fs";
import path from "node:path";

const [outDir, ...rest] = process.argv.slice(2);
const dry = rest.includes("--dry");
const wanted = rest.filter((a) => a !== "--dry");
if (!outDir || wanted.length === 0 || !process.env.LH_DATA_DIR) {
	console.error("usage: LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<auth.json> tsx scripts/miss-note-eval.ts <out-dir> [--dry] <a/b> ...");
	process.exit(1);
}

const { initAuthEnv } = await import("../src/server/keys.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { activeLanguage } = await import("../src/server/active-language.ts");
const { ensureMissNote } = await import("../src/server/miss-note.ts");
const { missNoteBrief, missNoteEvidence } = await import("../src/core/miss-note.ts");
const { pairContrastRule } = await import("../src/core/mixups.ts");
const { entryLemma } = await import("../src/core/review.ts");
initAuthEnv();

const lexicon = loadLexicon();
if (!lexicon) throw new Error("no lexicon");
const { english, tag, id: language } = activeLanguage();
const senseHead = (s: string) => s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const senses = (en: string) => new Set(en.split(";").map(senseHead).filter(Boolean));
const commonness = (e: { rank?: number; examples: unknown[] }) => e.rank ?? 100_000 - e.examples.length;

function entriesOf(pair: string) {
	const [la, lb] = pair.split("/").map((s) => s.trim());
	const as = lexicon!.entries.filter((e) => entryLemma(e) === la).sort((x, y) => commonness(x) - commonness(y));
	const bs = lexicon!.entries.filter((e) => entryLemma(e) === lb).sort((x, y) => commonness(x) - commonness(y));
	for (const a of as) for (const b of bs) if ([...senses(a.en)].some((s) => senses(b.en).has(s))) return [a, b] as const;
	return as[0] && bs[0] ? ([as[0], bs[0]] as const) : null;
}

fs.mkdirSync(outDir, { recursive: true });
const maxCalls = Number(process.env.EVAL_MAX_CALLS ?? 100);
let calls = 0;
const rows: object[] = [];
for (const pair of wanted) {
	const found = entriesOf(pair);
	if (!found) {
		console.log(`${pair}: not in the lexicon`);
		continue;
	}
	const [a, b] = found;
	const evidence = missNoteEvidence(a, b, tag);
	if (dry) {
		console.log(`\n=== ${pair}\n${missNoteBrief(evidence, english)}`);
		continue;
	}
	if (calls + 2 > maxCalls) {
		console.log(`stopped: ${calls} calls made, the cap is ${maxCalls}`);
		break;
	}
	const note = await ensureMissNote(a, b);
	calls += note ? (note.judge ? 2 : 1) : 1;
	const rule = pairContrastRule(language, { slug: a.slug, lemma: entryLemma(a) }, { slug: b.slug, lemma: entryLemma(b) });
	const row = { pair, sentences: evidence.words.map((w) => w.sentences.length), rule, ...note };
	rows.push(row);
	console.log(`${pair} [${note?.status ?? "error"}${note?.reason ? `: ${note.reason}` : ""}] ${note?.note ?? ""} ($${(note?.cost ?? 0).toFixed(4)}, ${note?.ms ?? 0} ms)`);
	fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(rows, null, "\t"));
}
if (!dry) console.log(`${calls} calls`);
