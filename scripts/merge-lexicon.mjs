/**
 * Merge a fresh slovak.wiki lexicon export into the shipped one without
 * moving any example (LangHarness, 2026-10-30). Card and lesson ids are
 * word#position, so an export that reorders a word's examples would point
 * existing cards at other sentences. Here every example the shipped lexicon
 * has keeps its position, new examples are appended after them, and examples
 * the wiki has since dropped stay where they are, so nothing a learner has
 * seen changes meaning.
 *
 *   node scripts/merge-lexicon.mjs <shipped.json> <fresh.json> [out.json]
 */
import fs from "node:fs";
import path from "node:path";

const norm = (s) => s.normalize("NFC").trim();

export function mergeLexicon(shipped, fresh) {
	const freshBySlug = new Map(fresh.words.map((w) => [w.slug, w]));
	const shippedBySlug = new Set(shipped.words.map((w) => w.slug));
	const stats = { wordsAdded: 0, examplesKept: 0, examplesAdded: 0, examplesDroppedByWiki: 0 };
	const words = [];

	for (const old of shipped.words) {
		const next = freshBySlug.get(old.slug);
		const freshTexts = new Set((next?.examples ?? []).map((e) => norm(e.sk)));
		const have = new Set(old.examples.map((e) => norm(e.sk)));
		const examples = [...old.examples];
		stats.examplesKept += old.examples.length;
		stats.examplesDroppedByWiki += old.examples.filter((e) => !freshTexts.has(norm(e.sk))).length;
		for (const e of next?.examples ?? []) {
			const text = norm(e.sk);
			if (have.has(text)) continue;
			have.add(text);
			examples.push(e);
			stats.examplesAdded++;
		}
		words.push({ ...(next ?? old), examples });
	}

	for (const w of fresh.words) {
		if (shippedBySlug.has(w.slug)) continue;
		words.push(w);
		stats.wordsAdded++;
		stats.examplesAdded += w.examples.length;
	}

	return { lexicon: { ...fresh, words }, stats };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
	const [shippedPath, freshPath, outPath = shippedPath] = process.argv.slice(2);
	if (!shippedPath || !freshPath) {
		console.error("usage: node scripts/merge-lexicon.mjs <shipped.json> <fresh.json> [out.json]");
		process.exit(1);
	}
	const shipped = JSON.parse(fs.readFileSync(shippedPath, "utf8"));
	const fresh = JSON.parse(fs.readFileSync(freshPath, "utf8"));
	const { lexicon, stats } = mergeLexicon(shipped, fresh);
	fs.writeFileSync(outPath, JSON.stringify(lexicon));
	console.log(JSON.stringify({ ...stats, words: lexicon.words.length, out: outPath }));
}
