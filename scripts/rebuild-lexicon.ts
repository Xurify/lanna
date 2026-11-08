/**
 * Build an added language's word list again from the downloads kept under
 * <data>/languages/<id>/build/, with no download and no model call. Run it
 * after a change to how sentences are matched to words, on a language that
 * was added before the change:
 *
 *   npx tsx scripts/rebuild-lexicon.ts estonian russian
 *
 * The data folder is LH_DATA_DIR, else ./data. The old lexicon.json is kept
 * beside it as build/lexicon-before-<date>.json.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../config.ts";
import { rebuildLexicon } from "../src/server/language-add.ts";

const ids = process.argv.slice(2);
if (ids.length === 0) {
	console.error("Name one or more added languages, e.g. estonian russian");
	process.exit(1);
}

for (const id of ids) {
	const file = path.join(PATHS.languages, id, "lexicon.json");
	if (fs.existsSync(file)) {
		const kept = path.join(PATHS.languages, id, "build", `lexicon-before-${new Date().toISOString().slice(0, 10)}.json`);
		if (!fs.existsSync(kept)) fs.copyFileSync(file, kept);
	}
	const { words, examples } = await rebuildLexicon(id);
	console.log(`${id}: ${words} words, ${examples} example sentences → ${file}`);
}
