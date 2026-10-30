/**
 * Draft extra sentences for the thin vocabulary units (LangHarness, 2026-10-30).
 * A unit's lesson takes only short sentences (at most nine words) that contain
 * one of its words, so a few vocabulary units stay below the 42 sentences a
 * three-lesson unit needs. This asks the cheap model for short Slovak sentences
 * with English translations, checks each one against those rules, and writes a
 * batch for review. The batch is not part of the lexicon until it is approved.
 *
 *   npx tsx scripts/draft-extra-sentences.ts
 */

import fs from "node:fs";
import path from "node:path";
import { candidatesFor, UNITS, unitInfo, type UnitId } from "../src/core/lesson.ts";
import type { LexiconEntry } from "../src/core/review.ts";
import { runSubagent } from "../src/agent/subagents/pi-run.ts";
import { storyEngine } from "../src/server/reading.ts";

const REPO = path.resolve(import.meta.dirname, "..");
const LEXICON = path.join(REPO, "curriculum/slovak/lexicon.json");
const OUT = path.join(REPO, "curriculum/slovak/extra-sentences.json");
const TARGET = 42;
const PER_LEMMA = 4;
const MAX_WORDS = 9;
const ATTEMPTS = 3;

const norm = (s: string) => s.normalize("NFC").trim();
const tokens = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

type Word = { sk: string; forms?: string[]; declension?: { singular?: string[]; plural?: string[] }; examples: Array<{ sk: string }> };
const lexicon = JSON.parse(fs.readFileSync(LEXICON, "utf8")) as { words: Word[] };
const existing = new Set(lexicon.words.flatMap((w) => w.examples.map((e) => norm(e.sk))));
const byLemma = new Map(lexicon.words.map((w) => [w.sk.toLowerCase(), w]));

const engine = storyEngine();
if (!engine) throw new Error("No cheap model is configured (Settings → Models).");

const SYSTEM = `You write example sentences for a Slovak learning app. Reply with ONE JSON object and nothing else: {"items": [{"lemma": "...", "sk": "...", "en": "..."}]}.

For every lemma you are given, write ${PER_LEMMA} different sentences in Slovak. Rules:
- Each sentence is 3 to 7 words and contains its lemma as a whole word, in the base form where possible: nouns in the nominative singular, verbs in the infinitive. Example for "slovenčina": "Slovenčina je ťažký jazyk."
- Everyday Slovak at A1 to A2 level. Natural, true, and useful for learning this word.
- Correct Slovak diacritics. No names of people, no slang, no multi-word phrases.
- The English is an accurate translation of that sentence.
- Each sentence says something different from the others.`;

function parse(text: string): Array<{ lemma?: string; sk?: string; en?: string }> {
	const a = text.indexOf("{");
	const b = text.lastIndexOf("}");
	try {
		return (JSON.parse(text.slice(a, b + 1)) as { items?: Array<{ lemma?: string; sk?: string; en?: string }> }).items ?? [];
	} catch {
		return [];
	}
}

type Item = { unit: string; lemma: string; sk: string; en: string; cloze: { answer: string; at: number }; src: "model" };

const jobs = UNITS.flatMap((u: { id: UnitId; title: string }) => {
	const lemmas = (unitInfo(u.id).lemmas ?? []) as string[];
	const single = lemmas.map((l) => l.toLowerCase()).filter((l) => !/\s/.test(l) && byLemma.has(l));
	const now = candidatesFor(lexicon.words as unknown as LexiconEntry[], u.id).length;
	return single.length && now < TARGET ? [{ unit: u.id, title: u.title, lemmas: single, need: TARGET - now }] : [];
});

const usage = { in: 0, out: 0 };

async function draft(job: { unit: string; title: string; lemmas: string[]; need: number }): Promise<Item[]> {
	const items: Item[] = [];
	const seen = new Set<string>();
	for (let attempt = 0; attempt < ATTEMPTS && items.length < job.need + 4; attempt++) {
		const prompt = `Unit: ${job.title}\nLemmas (use each one exactly): ${job.lemmas.join(", ")}`;
		const { text } = await runSubagent([], {
			role: "researcher",
			engine: engine!.engine,
			systemPrompt: SYSTEM,
			prompt,
			maxTurns: 1,
			onUsage: (u: { input: number; output: number }) => {
				usage.in += u.input;
				usage.out += u.output;
			},
		});
		for (const raw of parse(text)) {
			const lemma = (raw.lemma ?? "").toLowerCase();
			const sk = norm(raw.sk ?? "");
			const en = norm(raw.en ?? "");
			if (!job.lemmas.includes(lemma) || !en || seen.has(sk) || existing.has(sk)) continue;
			const n = tokens(sk).length;
			if (n < 3 || n > MAX_WORDS) continue;
			// The blank may be any form of the word the lexicon knows (the lesson's cluster rule takes any form).
			const entry = byLemma.get(lemma)!;
			const forms = new Set([lemma, ...(entry.forms ?? []), ...(entry.declension?.singular ?? []), ...(entry.declension?.plural ?? [])].map((f) => f.toLowerCase()));
			const hit = [...sk.matchAll(/[\p{L}\p{N}]+/gu)].find((m) => forms.has(m[0].toLowerCase()));
			if (!hit) continue;
			seen.add(sk);
			items.push({ unit: job.unit, lemma, sk, en, cloze: { answer: hit[0], at: hit.index ?? 0 }, src: "model" });
		}
	}
	return items.slice(0, job.need + 6);
}

const batches = await Promise.all(jobs.map(async (job) => ({ job, items: await draft(job) })));
const all = batches.flatMap((b) => b.items);
fs.writeFileSync(
	OUT,
	`${JSON.stringify({ status: "pending-review", generated: new Date().toISOString(), model: engine.model, target: TARGET, items: all }, null, 1)}\n`,
);
for (const b of batches) console.log(`${b.job.unit}: need ${b.job.need}, drafted ${b.items.length}`);
console.log(JSON.stringify({ units: batches.length, drafted: all.length, usage, out: path.relative(REPO, OUT) }));
