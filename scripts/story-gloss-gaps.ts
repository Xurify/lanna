import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { auditStoryDraft, loadAuditLexicon } from "./audit-content.ts";
import { applyStoryGlosses, type ShippedStory } from "../src/server/chapter-stories.ts";
import { assembleStory, type KnownWords } from "../src/server/reading.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EMPTY_KNOWN_WORDS: KnownWords = {
	level: "A1",
	chapter: "",
	chapterTitle: "",
	met: new Set(),
	known: new Set(),
	expected: new Set(),
	expectedWords: 0,
	sample: [],
	grammar: [],
	practicing: [],
	purposes: [],
};

export interface UnglossedHit {
	form: string;
	sentenceIndex: number;
	sentence: string;
	english: string;
}

export interface StoryGlossReport {
	language: string;
	storyId: string;
	lexiconLoaded: boolean;
	totalWordTokens: number;
	unglossed: UnglossedHit[];
	multiSentenceOverrides: Array<{ form: string; sentences: number[] }>;
	issues: Array<{ scope: string; language: string; target: string; message: string }>;
}

export function inferLanguageAndId(storyPath: string): { language: string; storyId: string } {
	const normalized = storyPath.replace(/\\/g, "/");
	const match = normalized.match(/curriculum\/([^/]+)\/stories\/([^/]+)\.json$/);
	if (match) return { language: match[1]!, storyId: match[2]! };
	return { language: "slovak", storyId: path.basename(storyPath, ".json") };
}

export function analyzeStoryGlossGaps(
	storyPath: string,
	options: { language?: string; dataDir?: string; root?: string } = {},
): StoryGlossReport {
	const root = options.root ?? ROOT;
	const inferred = inferLanguageAndId(storyPath);
	const language = options.language ?? inferred.language;
	const storyId = inferred.storyId;
	const draft = JSON.parse(fs.readFileSync(storyPath, "utf-8")) as ShippedStory;
	const lexicon = loadAuditLexicon(language, root, options.dataDir);
	const issues = auditStoryDraft(language, storyId, draft, lexicon);

	const unglossed: UnglossedHit[] = [];
	const seenForms = new Set<string>();
	const overrideSentences = new Map<string, Set<number>>();
	let totalWordTokens = 0;

	if (lexicon) {
		const assembled = assembleStory(
			draft,
			{ genre: "dialogue", episode: 0, theme: draft.topic, prompt: "" },
			EMPTY_KNOWN_WORDS,
			lexicon,
			{ model: "audit", steps: [] },
			0,
			new Date(0),
			new Set(),
		);
		const glossed = applyStoryGlosses(assembled.sentences, draft.glosses, draft.occurrences);
		const overrideKeys = new Set(Object.keys(draft.glosses ?? {}));

		for (const [sentenceIndex, sentence] of glossed.entries()) {
			for (const token of sentence.tokens) {
				if (!token.word) continue;
				totalWordTokens += 1;
				const lower = token.text.toLocaleLowerCase();
				if (overrideKeys.has(lower)) {
					const bucket = overrideSentences.get(lower) ?? new Set<number>();
					bucket.add(sentenceIndex);
					overrideSentences.set(lower, bucket);
				}
				if (!token.gloss && !seenForms.has(lower)) {
					seenForms.add(lower);
					unglossed.push({
						form: lower,
						sentenceIndex,
						sentence: sentence.sk,
						english: sentence.en,
					});
				}
			}
		}
	}

	const multiSentenceOverrides = [...overrideSentences.entries()]
		.filter(([, sentenceSet]) => sentenceSet.size > 1)
		.map(([form, sentenceSet]) => ({ form, sentences: [...sentenceSet].sort((first, second) => first - second) }));

	return {
		language,
		storyId,
		lexiconLoaded: lexicon !== null,
		totalWordTokens,
		unglossed,
		multiSentenceOverrides,
		issues,
	};
}

function main(): void {
	const args = process.argv.slice(2);
	const asJson = args.includes("--json");
	const dataDirIndex = args.indexOf("--data-dir");
	const dataDir = dataDirIndex >= 0 ? args[dataDirIndex + 1] : undefined;
	const langIndex = args.indexOf("--language");
	const language = langIndex >= 0 ? args[langIndex + 1] : undefined;
	const storyPath = args.find(
		(arg, index) =>
			!arg.startsWith("--") &&
			(dataDirIndex < 0 || index !== dataDirIndex + 1) &&
			(langIndex < 0 || index !== langIndex + 1),
	);
	if (!storyPath) {
		console.error(
			"Usage: bun scripts/story-gloss-gaps.ts <story.json> [--language slovak|russian|estonian] [--data-dir <dir>] [--json]",
		);
		process.exit(1);
	}

	const report = analyzeStoryGlossGaps(path.resolve(storyPath), { language, dataDir });
	if (asJson) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(
			`${report.language}/${report.storyId}: ${report.totalWordTokens} word tokens, ${report.unglossed.length} unglossed, ${report.issues.length} issue(s)`,
		);
		for (const hit of report.unglossed) {
			console.log(`  UNGLOSSED "${hit.form}" [s${hit.sentenceIndex}]: ${hit.sentence} (${hit.english})`);
		}
		for (const issue of report.issues) {
			console.error(`  ISSUE: ${issue.message}`);
		}
		if (report.multiSentenceOverrides.length > 0) {
			console.log(
				`  Word-wide overrides appearing in multiple sentences (check for homograph clashes): ${report.multiSentenceOverrides.map((entry) => `${entry.form}[s${entry.sentences.join(",s")}]`).join(", ")}`,
			);
		}
	}
	process.exit(report.issues.length > 0 || report.unglossed.length > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
