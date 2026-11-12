/**
 * How much a Review miss on another word can explain, from data alone
 * (E104). Every pair of lexicon words that share a meaning, unless grading
 * accepts one for the other (src/core/variants.ts), is a miss that can
 * happen; for each, the card's best line comes from a curated rule, the parts
 * of speech, a note in the gloss, a question, or only an example sentence.
 * The uncovered common pairs are the queue for curated rules
 * (curriculum/<language>/pairs.json).
 *
 *   npm run miss:coverage              the active profile
 *   npm run miss:coverage -- slovak 40 a profile, and how many uncovered pairs to list
 */

import { activeProfile } from "../config.ts";
import { loadLexicon } from "../src/agent/lexicon.ts";
import { profileLanguage } from "../src/agent/profile-language.ts";
import { contrastExample, contrastSource, missWordOf, startsQuestion, type ContrastSource } from "../src/core/review-miss.ts";
import { entryLemma, type LexiconEntry } from "../src/core/review.ts";
import { isVariantMatch } from "../src/core/variants.ts";

const profile = process.argv[2] ?? activeProfile();
const listed = Number(process.argv[3] ?? 30);
const lexicon = loadLexicon(profile);
const language = profileLanguage(profile);
if (!lexicon || !language) {
	console.error(`No lexicon or language.json for "${profile}".`);
	process.exit(1);
}
const tag = language.tag;

const COMMON_RANK = 300;
const isCommon = (e: LexiconEntry) => e.cat === "Phrases" || (e.rank ?? Infinity) <= COMMON_RANK;
const senseHead = (s: string) => s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const bySense = new Map<string, LexiconEntry[]>();
for (const e of lexicon.entries) {
	for (const head of new Set(e.en.split(";").map(senseHead).filter(Boolean))) {
		const list = bySense.get(head) ?? [];
		list.push(e);
		bySense.set(head, list);
	}
}
const pairs = new Map<string, [LexiconEntry, LexiconEntry]>();
const gradedRight = (card: LexiconEntry, other: LexiconEntry) => isVariantMatch(entryLemma(card), entryLemma(other), tag);
for (const list of bySense.values()) for (const card of list) for (const other of list) if (card !== other && !gradedRight(card, other)) pairs.set(`${card.slug}>${other.slug}`, [card, other]);

const SOURCES: ContrastSource[] = ["rule", "part of speech", "meaning note", "question", "example", "none"];
const tally = (rows: Array<[LexiconEntry, LexiconEntry, ContrastSource]>) => {
	const counts = new Map(SOURCES.map((s) => [s, 0]));
	for (const [, , s] of rows) counts.set(s, counts.get(s)! + 1);
	return `${rows.length} pairs · ` + SOURCES.map((s) => `${s} ${((100 * counts.get(s)!) / Math.max(rows.length, 1)).toFixed(1)}%`).join(" · ");
};

const rows: Array<[LexiconEntry, LexiconEntry, ContrastSource]> = [...pairs.values()].map(([card, other]) => {
	const lemma = entryLemma(card);
	const word = missWordOf({ slug: card.slug, lemma, entry: card }, other, { typed: entryLemma(other), isLemma: true, language: language.id }, tag);
	const own = contrastExample(card.examples, lemma, tag);
	return [card, other, contrastSource(word, own ? startsQuestion(own.text, lemma, tag) : false)];
});
const common = rows.filter(([a, b]) => isCommon(a) && isCommon(b));

console.log(`${profile}: what a miss on another word can say, beyond an example sentence`);
console.log(`  every pair sharing a meaning   ${tally(rows)}`);
console.log(`  both words common              ${tally(common)}`);

const seen = new Set<string>();
const queue = common
	.filter(([, , s]) => s === "example" || s === "none")
	.filter(([a, b]) => {
		const key = [a.slug, b.slug].sort().join("~");
		return !seen.has(key) && seen.add(key);
	})
	.sort(([a1, b1], [a2, b2]) => Math.max(a1.rank ?? 0, b1.rank ?? 0) - Math.max(a2.rank ?? 0, b2.rank ?? 0));
console.log(`\nUncovered common pairs (${queue.length}), commonest first:`);
for (const [a, b] of queue.slice(0, listed)) console.log(`  ${entryLemma(a)} / ${entryLemma(b)}    ${a.en} | ${b.en}`);
