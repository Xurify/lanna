/**
 * Sends typed meanings through the word check's own marking (the dictionary
 * first, then the Cheap slot) and saves each verdict beside the verdict
 * expected, for a person to read.
 *
 *   LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<auth.json> \
 *     tsx scripts/word-check-judge-eval.ts <out-dir>
 *   ... tsx scripts/word-check-judge-eval.ts <out-dir> --dry   prints the prompts, calls nothing
 *
 * The sandbox's settings.json must set the Cheap slot. EVAL_MAX_CALLS (default
 * 100) caps the model calls of one run. The cases are Slovak.
 */

import fs from "node:fs";
import path from "node:path";

const [outDir, flag] = process.argv.slice(2);
const dry = flag === "--dry";
if (!outDir || !process.env.LH_DATA_DIR) {
	console.error(
		"usage: LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<auth.json> tsx scripts/word-check-judge-eval.ts <out-dir> [--dry]",
	);
	process.exit(1);
}

const { initAuthEnv } = await import("../src/server/keys.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { entryLemma } = await import("../src/core/review.ts");
const { dictionaryAccepts } = await import("../src/core/word-estimate.ts");
const { judgeMeaning, meaningJudgePrompt, wordCheckModel } = await import("../src/server/word-check-judge.ts");
const { turnCost } = await import("../src/server/pricing.ts");
initAuthEnv();

type Kind =
	| "synonym"
	| "paraphrase"
	| "other form"
	| "spelling slip"
	| "different meaning"
	| "opposite"
	| "look-alike word"
	| "too broad"
	| "several guesses"
	| "not a meaning";
const ACCEPT: Array<[lemma: string, typed: string, kind: Kind]> = [
	["auto", "automobile", "synonym"],
	["pes", "canine", "synonym"],
	["dieťa", "kid", "synonym"],
	["lacný", "inexpensive", "synonym"],
	["smutný", "unhappy", "synonym"],
	["chorý", "unwell", "synonym"],
	["priateľ", "buddy", "synonym"],
	["zatvoriť", "to shut", "synonym"],
	["kričať", "to yell", "synonym"],
	["kúpiť", "to purchase", "synonym"],
	["pomáhať", "to assist", "synonym"],
	["bývať", "to reside", "synonym"],
	["dážď", "rainfall", "synonym"],
	["odpoveď", "a reply", "synonym"],
	["rýchlo", "rapidly", "synonym"],
	["raňajky", "morning meal", "paraphrase"],
	["súhlasiť", "to be in agreement", "paraphrase"],
	["učiteľ", "a person who teaches", "paraphrase"],
	["obchod", "a place where you buy things", "paraphrase"],
	["nemocnica", "a place for sick people with doctors", "paraphrase"],
	["zabudnúť", "not remember", "paraphrase"],
	["kúpiť", "buying", "other form"],
	["pracovať", "working", "other form"],
	["vidieť", "seeing", "other form"],
	["zabudnúť", "forgot", "other form"],
	["hovoriť", "speaking", "other form"],
	["zlepšiť", "improvement", "other form"],
	["chlieb", "bred", "spelling slip"],
	["nemocnica", "hospitol", "spelling slip"],
	["raňajky", "brekfast", "spelling slip"],
	["knižnica", "libary", "spelling slip"],
	["zajtra", "tommorow", "spelling slip"],
	["zaujímavý", "intresting", "spelling slip"],
	["susedia", "neighbours", "spelling slip"],
	["sused", "neighbour", "spelling slip"],
	["farba", "colour", "spelling slip"],
];
const REJECT: Array<[lemma: string, typed: string, kind: Kind]> = [
	["stôl", "chair", "different meaning"],
	["teta", "uncle", "different meaning"],
	["brat", "sister", "different meaning"],
	["noha", "arm", "different meaning"],
	["pondelok", "Tuesday", "different meaning"],
	["kuchyňa", "bathroom", "different meaning"],
	["ráno", "evening", "different meaning"],
	["včera", "tomorrow", "different meaning"],
	["jablko", "pear", "different meaning"],
	["mačka", "dog", "different meaning"],
	["drahý", "cheap", "opposite"],
	["otvoriť", "to close", "opposite"],
	["kúpiť", "to sell", "opposite"],
	["zima", "summer", "opposite"],
	["starý", "young", "opposite"],
	["byt", "to be", "look-alike word"],
	["plakať", "to swim", "look-alike word"],
	["vedieť", "to see", "look-alike word"],
	["večer", "dinner", "look-alike word"],
	["hlad", "cold", "look-alike word"],
	["list", "list", "look-alike word"],
	["aktuálny", "actual", "look-alike word"],
	["sympatický", "sympathetic", "look-alike word"],
	["gymnázium", "gym", "look-alike word"],
	["hosť", "host", "look-alike word"],
	["šéf", "chef", "look-alike word"],
	["pes", "animal", "too broad"],
	["jablko", "food", "too broad"],
	["bežať", "to move", "too broad"],
	["nemocnica", "a building", "too broad"],
	["kôň", "dog, cat, horse", "several guesses"],
	["streda", "Monday or Tuesday or Wednesday", "several guesses"],
	["okno", "okno", "not a meaning"],
	["kniha", "noun", "not a meaning"],
	["voda", "idk maybe something", "not a meaning"],
	["mesto", "a Slovak word", "not a meaning"],
];

const lexicon = loadLexicon();
if (!lexicon) throw new Error("no lexicon");
const model = wordCheckModel();
const usage = {
	model,
	steps: [] as Array<{
		inputTokens: number | undefined;
		outputTokens: number | undefined;
		cacheReadTokens: number | undefined;
		cacheWriteTokens: number | undefined;
		cacheWrite1hTokens?: number;
		reasoningTokens: number | undefined;
	}>,
};
const maxCalls = Number(process.env.EVAL_MAX_CALLS ?? 100);
fs.mkdirSync(outDir, { recursive: true });

const rows: Array<Record<string, unknown>> = [];
for (const [expected, cases] of [
	["accept", ACCEPT],
	["reject", REJECT],
] as const) {
	for (const [lemma, typed, kind] of cases) {
		const entries = lexicon.entries.filter((e) => entryLemma(e) === lemma);
		if (entries.length === 0) {
			rows.push({ lemma, typed, kind, expected, got: "not in the dictionary" });
			continue;
		}
		const glosses = entries.map((e) => e.en);
		const toJudge = { slug: entries[0]!.slug, word: lemma, glosses, typed };
		if (dictionaryAccepts(glosses, typed)) {
			rows.push({ lemma, typed, kind, expected, glosses, got: "accept", markedBy: "dictionary" });
			continue;
		}
		if (dry) {
			console.log(`\n=== ${lemma}\n${meaningJudgePrompt(toJudge)}`);
			continue;
		}
		if (usage.steps.length >= maxCalls) {
			console.log(`stopped: ${usage.steps.length} calls made, the cap is ${maxCalls}`);
			break;
		}
		const started = Date.now();
		const judged = await judgeMeaning(toJudge, usage);
		const got = judged ? (judged.accepted ? "accept" : "reject") : "no verdict";
		rows.push({
			lemma,
			typed,
			kind,
			expected,
			glosses,
			got,
			markedBy: "model",
			note: judged?.note ?? "",
			ms: Date.now() - started,
		});
		console.log(
			`${got === expected ? "ok  " : "DIFF"} ${lemma} <- ${JSON.stringify(typed)} [${kind}] expected ${expected}, got ${got}${judged?.note ? `: ${judged.note}` : ""}`,
		);
	}
}

if (!dry) {
	const judged = rows.filter((r) => r.markedBy === "model");
	const tally = (expected: string, got: string) =>
		judged.filter((r) => r.expected === expected && r.got === got).length;
	let usd: number | null = null;
	try {
		usd = turnCost(usage as Parameters<typeof turnCost>[0]);
	} catch {
		usd = null;
	}
	const summary = {
		model,
		calls: usage.steps.length,
		usd,
		markedByTheDictionary: rows.filter((r) => r.markedBy === "dictionary").length,
		notInTheDictionary: rows.filter((r) => r.got === "not in the dictionary").length,
		shouldAccept: {
			accepted: tally("accept", "accept"),
			rejected: tally("accept", "reject"),
			noVerdict: tally("accept", "no verdict"),
		},
		shouldReject: {
			accepted: tally("reject", "accept"),
			rejected: tally("reject", "reject"),
			noVerdict: tally("reject", "no verdict"),
		},
	};
	fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ summary, rows }, null, "\t"));
	console.log(JSON.stringify(summary, null, 2));
}
