import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Lexicon } from "../src/agent/lexicon.ts";
import { CHAPTER_STORIES } from "../src/core/chapter-stories.ts";
import { isCoverMotif } from "../src/core/cover.ts";
import { foldDiacritics } from "../src/core/language.ts";
import { allUnits, buildLesson, shortGloss, type UnitId } from "../src/core/lesson.ts";
import { tokenize } from "../src/core/reading.ts";
import type { LexiconEntry } from "../src/core/review.ts";
import { WORD_CLUSTERS } from "../src/core/word-clusters.ts";
import { pictureFor, SCENE_SETS } from "../src/core/word-pictures.ts";
import { applyStoryGlosses, type ShippedStory } from "../src/server/chapter-stories.ts";
import { assembleStory, type KnownWords } from "../src/server/reading.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COURSE_LANGUAGES = ["slovak", "russian", "estonian"] as const;
const LESSON_AUDIT_SEEDS = [1, 2, 3] as const;
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

export interface AuditIssue {
	scope: "story" | "picture" | "lesson";
	language: string;
	target: string;
	message: string;
}

export interface LanguageAuditStats {
	language: string;
	lexiconLoaded: boolean;
	storiesChecked: number;
	mappedPictureWords: number;
	picturedSentenceChecks: number;
	lessonsChecked: number;
}

export interface ContentAuditReport {
	issues: AuditIssue[];
	languages: LanguageAuditStats[];
}

export function hasUnbalancedParens(text: string): boolean {
	let depth = 0;
	for (const character of text) {
		if (character === "(") depth += 1;
		else if (character === ")") {
			depth -= 1;
			if (depth < 0) return true;
		}
	}
	return depth !== 0;
}

function lexiconPathsFor(language: string, root: string, dataDir?: string): string[] {
	const candidates = [path.join(root, "curriculum", language, "lexicon.json")];
	if (dataDir) candidates.push(path.join(dataDir, "languages", language, "lexicon.json"));
	const envData = process.env.LANNA_DATA_DIR;
	if (envData) candidates.push(path.join(envData, "languages", language, "lexicon.json"));
	candidates.push(path.join(root, "data", "languages", language, "lexicon.json"));
	return candidates;
}

export function loadAuditLexicon(language: string, root: string = ROOT, dataDir?: string): Lexicon | null {
	const file = lexiconPathsFor(language, root, dataDir).find((candidate) => fs.existsSync(candidate));
	if (!file) return null;
	const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as {
		words: LexiconEntry[];
		source?: string;
		license?: string;
	};
	const bySlug = new Map<string, LexiconEntry>();
	const byForm = new Map<string, LexiconEntry[]>();
	const byFolded = new Map<string, LexiconEntry[]>();
	const append = (map: Map<string, LexiconEntry[]>, key: string, entry: LexiconEntry) => {
		if (!key) return;
		const existing = map.get(key);
		if (!existing) map.set(key, [entry]);
		else if (!existing.includes(entry)) existing.push(entry);
	};
	for (const entry of raw.words) {
		entry.lemma = entry.lemma ?? entry.sk ?? "";
		entry.sk = entry.sk ?? entry.lemma;
		for (const example of entry.examples ?? []) {
			example.text = example.text ?? example.sk ?? "";
			example.sk = example.sk ?? example.text;
		}
		bySlug.set(entry.slug, entry);
		const forms = new Set<string>([
			entry.lemma,
			...(entry.forms ?? []),
			...(entry.declension?.singular ?? []),
			...(entry.declension?.plural ?? []),
		]);
		for (const form of forms) {
			const lower = form.toLocaleLowerCase();
			append(byForm, lower, entry);
			append(byFolded, foldDiacritics(lower), entry);
		}
	}
	return { entries: raw.words, bySlug, byForm, byFolded, source: raw.source, license: raw.license };
}

function unitLemmasFor(language: string, root: string): Array<{ unit: string; lemmas: readonly string[] }> {
	if (language === "slovak") {
		return Object.entries(WORD_CLUSTERS).map(([unit, cluster]) => ({
			unit,
			lemmas: cluster.lemmas,
		}));
	}
	const coursePath = path.join(root, "curriculum", language, "course.json");
	if (!fs.existsSync(coursePath)) return [];
	const course = JSON.parse(fs.readFileSync(coursePath, "utf-8")) as {
		units: Array<{ id: string; lemmas?: string[] }>;
	};
	return course.units
		.filter((unit): unit is { id: string; lemmas: string[] } => Array.isArray(unit.lemmas))
		.map((unit) => ({ unit: unit.id, lemmas: unit.lemmas }));
}

export function auditStoryDraft(
	language: string,
	storyId: string,
	draft: ShippedStory,
	lexicon: Lexicon | null,
): AuditIssue[] {
	const issues: AuditIssue[] = [];
	const record = (message: string) => issues.push({ scope: "story", language, target: storyId, message });

	const speakers = new Set(draft.sentences.map((sentence) => sentence.who).filter((who) => who && who !== "narrator"));
	const castNames = new Set(draft.cast.map((member) => member.name));
	for (const speaker of speakers) {
		if (!castNames.has(speaker!)) record(`speaker "${speaker}" is missing from cast`);
	}
	for (const member of draft.cast) {
		if (!speakers.has(member.name)) record(`cast member "${member.name}" never speaks`);
	}
	if (draft.sentences.length < 20 || draft.sentences.length > 28) {
		record(`sentence count ${draft.sentences.length} is outside 20..28`);
	}
	if (draft.questions.length !== 3) {
		record(`expected 3 questions, found ${draft.questions.length}`);
	}
	for (const [questionIndex, question] of draft.questions.entries()) {
		if (question.answer < 0 || question.answer >= question.options.length) {
			record(`question ${questionIndex} answer index ${question.answer} is out of range`);
		}
	}
	if (!isCoverMotif(draft.cover)) {
		record(`invalid cover motif "${draft.cover}"`);
	}
	for (const word of draft.newWords) {
		if (hasUnbalancedParens(word.en)) {
			record(`newWord "${word.sk}" has unbalanced parentheses in gloss "${word.en}"`);
		}
	}

	const sentenceWordLists = draft.sentences.map((sentence) =>
		tokenize(sentence.sk)
			.filter((token) => token.word)
			.map((token) => token.text.toLocaleLowerCase()),
	);
	const allStoryWords = new Set(sentenceWordLists.flat());

	for (const [form, override] of Object.entries(draft.glosses ?? {})) {
		if (form !== form.toLocaleLowerCase()) {
			record(`glosses key "${form}" must be lowercase`);
		}
		if (!allStoryWords.has(form.toLocaleLowerCase())) {
			record(`glosses key "${form}" does not match any word token in the story`);
		}
		if (hasUnbalancedParens(override.gloss)) {
			record(`glosses["${form}"] has unbalanced parentheses: "${override.gloss}"`);
		}
	}

	for (const [overrideIndex, entry] of (draft.occurrences ?? []).entries()) {
		const sentenceWords = sentenceWordLists[entry.sentence];
		if (!sentenceWords) {
			record(`occurrences[${overrideIndex}] sentence ${entry.sentence} is out of range`);
			continue;
		}
		const targetToken = entry.token.toLocaleLowerCase();
		const matches = sentenceWords.filter((word) => word === targetToken).length;
		if (matches === 0) {
			record(`occurrences[${overrideIndex}] token "${entry.token}" not found in sentence ${entry.sentence}`);
			continue;
		}
		if (entry.occurrence !== undefined && (entry.occurrence < 0 || entry.occurrence >= matches)) {
			record(
				`occurrences[${overrideIndex}] occurrence ${entry.occurrence} out of range for "${entry.token}" in sentence ${entry.sentence} (found ${matches})`,
			);
		}
		if (hasUnbalancedParens(entry.gloss)) {
			record(`occurrences[${overrideIndex}] has unbalanced parentheses: "${entry.gloss}"`);
		}
	}

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
		const wordTokens = glossed.flatMap((sentence) => sentence.tokens.filter((token) => token.word));
		const missing = wordTokens.filter((token) => !token.gloss).map((token) => token.text);
		if (missing.length > 0) {
			record(`unglossed tokens: ${[...new Set(missing)].join(", ")}`);
		}
		const badNames = wordTokens
			.filter((token) => token.gloss?.endsWith("(a name)") && token.cat)
			.map((token) => `${token.text} (${token.cat})`);
		if (badNames.length > 0) {
			record(`name tokens kept dictionary category: ${badNames.join(", ")}`);
		}
	}

	return issues;
}

export function auditWordPictures(
	language: string,
	units: ReadonlyArray<{ unit: string; lemmas: readonly string[] }>,
	lexicon: Lexicon | null,
): { issues: AuditIssue[]; mappedPictureWords: number; picturedSentenceChecks: number } {
	const issues: AuditIssue[] = [];
	let mappedPictureWords = 0;
	let picturedSentenceChecks = 0;

	const entryByLemma = new Map<string, LexiconEntry>();
	if (lexicon) {
		for (const entry of lexicon.entries) {
			const key = (entry.lemma ?? entry.sk ?? "").toLocaleLowerCase();
			if (key && !entryByLemma.has(key)) entryByLemma.set(key, entry);
		}
	}

	for (const { unit, lemmas } of units) {
		const seenScenes = new Map<string, string>();
		for (const lemma of lemmas) {
			const picture = pictureFor(unit, lemma);
			if (!picture) continue;
			mappedPictureWords += 1;
			if (picture.kind === "scene") {
				const sceneKey = `${picture.set}:${picture.scene}`;
				const previous = seenScenes.get(sceneKey);
				if (previous) {
					issues.push({
						scope: "picture",
						language,
						target: `${unit}/${lemma}`,
						message: `scene ${sceneKey} is shared by "${previous}" and "${lemma}" in unit ${unit}`,
					});
				} else {
					seenScenes.set(sceneKey, lemma);
				}
				if (lexicon) {
					const entry = entryByLemma.get(lemma.toLocaleLowerCase());
					const examples = (entry?.examples ?? []).filter((example) => !example.rejected);
					picturedSentenceChecks += examples.length;
					const kept = examples.filter((example) => pictureFor(unit, lemma, example.en ?? ""));
					if (examples.length > 0 && kept.length === 0) {
						issues.push({
							scope: "picture",
							language,
							target: `${unit}/${lemma}`,
							message: `none of ${examples.length} dictionary sentences match scene ${sceneKey}`,
						});
					}
				}
			}
		}
	}

	return { issues, mappedPictureWords, picturedSentenceChecks };
}

function normalizeSentenceKey(sentence: string): string {
	return sentence
		.normalize("NFC")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

export function auditLessons(
	language: string,
	lexicon: Lexicon | null,
	root: string = ROOT,
	seeds: readonly number[] = LESSON_AUDIT_SEEDS,
): { issues: AuditIssue[]; lessonsChecked: number } {
	if (!lexicon) return { issues: [], lessonsChecked: 0 };
	const issues: AuditIssue[] = [];
	let lessonsChecked = 0;

	const globals = globalThis as Record<string, unknown>;
	const previousCourse = globals.__lhCourse;
	const coursePath = path.join(root, "curriculum", language, "course.json");
	if (language !== "slovak" && fs.existsSync(coursePath)) {
		globals.__lhCourse = JSON.parse(fs.readFileSync(coursePath, "utf-8"));
	} else {
		globals.__lhCourse = undefined;
	}

	try {
		const playableUnits = allUnits().filter((unit) => unit.kind === "words" || unit.kind === "grammar");
		for (const unit of playableUnits) {
			for (const seed of seeds) {
				const plan = buildLesson(lexicon.entries, unit.id as UnitId, { seed, stage: "new" });
				if (plan.items.length === 0) continue;
				lessonsChecked += 1;

				const testedSentenceKeys = new Set(plan.items.map((item) => normalizeSentenceKey(item.sentence)));
				const seenCardLeak = new Set<string>();
				for (const item of plan.items) {
					if (hasUnbalancedParens(item.hint)) {
						issues.push({
							scope: "lesson",
							language,
							target: `${unit.id}#${seed}`,
							message: `unbalanced parentheses in hint for "${item.lemma}": "${item.hint}"`,
						});
					}
					const displayedGloss = shortGloss(item.gloss);
					if (hasUnbalancedParens(displayedGloss)) {
						issues.push({
							scope: "lesson",
							language,
							target: `${unit.id}#${seed}`,
							message: `unbalanced parentheses in shortGloss for "${item.lemma}": "${displayedGloss}"`,
						});
					}
					for (const example of item.card?.examples ?? []) {
						const fullSentence = `${example.before}${example.word}${example.after}`;
						const key = normalizeSentenceKey(fullSentence);
						if (testedSentenceKeys.has(key) && !seenCardLeak.has(`${item.slug}:${key}`)) {
							seenCardLeak.add(`${item.slug}:${key}`);
							issues.push({
								scope: "lesson",
								language,
								target: `${unit.id}#${seed}`,
								message: `word card for "${item.lemma}" leaks tested sentence "${fullSentence}"`,
							});
						}
					}
				}

				const lemmaBySlug = new Map(plan.items.map((item) => [item.slug, item.lemma]));
				for (const [slug, intro] of Object.entries(plan.introductions ?? {})) {
					const fullSentence = `${intro.before}${intro.word}${intro.after}`;
					if (testedSentenceKeys.has(normalizeSentenceKey(fullSentence))) {
						issues.push({
							scope: "lesson",
							language,
							target: `${unit.id}#${seed}`,
							message: `intro sentence for "${slug}" duplicates a tested rep: "${fullSentence}"`,
						});
					}
					const lemma = lemmaBySlug.get(slug);
					if (lemma && pictureFor(unit.id, lemma) && !pictureFor(unit.id, lemma, intro.en)) {
						issues.push({
							scope: "lesson",
							language,
							target: `${unit.id}#${seed}`,
							message: `intro sentence for pictured word "${lemma}" does not match its picture: "${intro.en}"`,
						});
					}
				}
			}
		}
	} finally {
		globals.__lhCourse = previousCourse;
	}

	return { issues, lessonsChecked };
}

export function auditAllContent(
	options: { root?: string; dataDir?: string; languages?: readonly string[] } = {},
): ContentAuditReport {
	const root = options.root ?? ROOT;
	const languages = options.languages ?? COURSE_LANGUAGES;
	const issues: AuditIssue[] = [];
	const stats: LanguageAuditStats[] = [];

	const allUnitsByLanguage = new Map<string, Array<{ unit: string; lemmas: readonly string[] }>>();
	for (const language of languages) {
		allUnitsByLanguage.set(language, unitLemmasFor(language, root));
	}

	const allUnitLemmas = new Map<string, Set<string>>();
	for (const unitList of allUnitsByLanguage.values()) {
		for (const { unit, lemmas } of unitList) {
			const bucket = allUnitLemmas.get(unit) ?? new Set<string>();
			for (const lemma of lemmas) bucket.add(lemma);
			allUnitLemmas.set(unit, bucket);
		}
	}
	for (const sceneSet of SCENE_SETS) {
		const validLemmas = new Set<string>();
		for (const unit of sceneSet.units) {
			for (const lemma of allUnitLemmas.get(unit) ?? []) validLemmas.add(lemma);
		}
		if (validLemmas.size === 0) continue;
		for (const lemma of Object.keys(sceneSet.of)) {
			if (!validLemmas.has(lemma)) {
				issues.push({
					scope: "picture",
					language: "all",
					target: `${sceneSet.set}/${lemma}`,
					message: `mapped lemma "${lemma}" is not present in units ${sceneSet.units.join(", ")}`,
				});
			}
		}
	}

	for (const language of languages) {
		const lexicon = loadAuditLexicon(language, root, options.dataDir);
		const stories = CHAPTER_STORIES.filter((story) => story.language === language);
		for (const story of stories) {
			const filePath = path.join(root, "curriculum", language, "stories", `${story.id}.json`);
			if (!fs.existsSync(filePath)) {
				issues.push({ scope: "story", language, target: story.id, message: `missing file ${filePath}` });
				continue;
			}
			const draft = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ShippedStory;
			issues.push(...auditStoryDraft(language, story.id, draft, lexicon));
		}

		const pictureAudit = auditWordPictures(language, allUnitsByLanguage.get(language) ?? [], lexicon);
		issues.push(...pictureAudit.issues);

		const lessonAudit = auditLessons(language, lexicon, root);
		issues.push(...lessonAudit.issues);

		stats.push({
			language,
			lexiconLoaded: lexicon !== null,
			storiesChecked: stories.length,
			mappedPictureWords: pictureAudit.mappedPictureWords,
			picturedSentenceChecks: pictureAudit.picturedSentenceChecks,
			lessonsChecked: lessonAudit.lessonsChecked,
		});
	}

	return { issues, languages: stats };
}

function main(): void {
	const args = process.argv.slice(2);
	const asJson = args.includes("--json");
	const dataDirIndex = args.indexOf("--data-dir");
	const dataDir = dataDirIndex >= 0 ? args[dataDirIndex + 1] : undefined;
	const langIndex = args.indexOf("--languages");
	const languages = langIndex >= 0 && args[langIndex + 1] ? args[langIndex + 1]!.split(",") : undefined;

	const report = auditAllContent({ dataDir, languages });
	if (asJson) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		for (const stat of report.languages) {
			const lexiconNote = stat.lexiconLoaded ? "lexicon ok" : "no lexicon on disk";
			console.log(
				`${stat.language.padEnd(10)} stories=${stat.storiesChecked}  pictured_words=${stat.mappedPictureWords}  sentences_checked=${stat.picturedSentenceChecks}  lessons=${stat.lessonsChecked}  (${lexiconNote})`,
			);
		}
		if (report.issues.length > 0) {
			console.error(`\n${report.issues.length} content issue(s):`);
			for (const issue of report.issues) {
				console.error(`  [${issue.scope}/${issue.language}/${issue.target}] ${issue.message}`);
			}
		} else {
			console.log("\nContent audit passed with 0 issues.");
		}
	}
	process.exit(report.issues.length > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main();
}
