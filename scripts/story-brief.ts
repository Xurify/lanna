import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CHAPTER_STORIES } from "../src/core/chapter-stories.ts";
import { allChapters, STAGES } from "../src/core/curriculum.ts";
import { WORD_CLUSTERS } from "../src/core/word-clusters.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface StoryBrief {
	language: string;
	storyId: string;
	title: string;
	tagline: string;
	chapterId: string;
	chapterTitle: string;
	level: string;
	targetUnits: readonly string[];
	chapterUnitIds: readonly string[];
	chapterWordLemmas: readonly string[];
	existingStoryPath: string;
	exists: boolean;
}

export function buildStoryBrief(language: string, storyId: string, root: string = ROOT): StoryBrief {
	const entry = CHAPTER_STORIES.find((story) => story.language === language && story.id === storyId);
	if (!entry) {
		throw new Error(`Story "${storyId}" is not registered for language "${language}" in CHAPTER_STORIES`);
	}

	const globals = globalThis as Record<string, unknown>;
	const previousCourse = globals.__lhCourse;
	const coursePath = path.join(root, "curriculum", language, "course.json");
	let courseData: { units?: Array<{ id: string; lemmas?: string[] }> } | undefined;
	if (language !== "slovak" && fs.existsSync(coursePath)) {
		courseData = JSON.parse(fs.readFileSync(coursePath, "utf-8")) as {
			units?: Array<{ id: string; lemmas?: string[] }>;
		};
		globals.__lhCourse = courseData;
	} else {
		globals.__lhCourse = undefined;
	}

	try {
		const chapters = allChapters();
		const chapter = chapters.find((candidate) => candidate.units.includes(storyId));
		if (!chapter) {
			throw new Error(`Story "${storyId}" is not placed in any chapter for "${language}"`);
		}
		const stage = STAGES.find((candidate) => candidate.id === chapter.stage);
		const lemmas = new Set<string>();
		for (const unitId of chapter.units) {
			if (language === "slovak") {
				const cluster = WORD_CLUSTERS[unitId as keyof typeof WORD_CLUSTERS];
				for (const lemma of cluster?.lemmas ?? []) lemmas.add(lemma);
			} else {
				const unit = courseData?.units?.find((candidate) => candidate.id === unitId);
				for (const lemma of unit?.lemmas ?? []) lemmas.add(lemma);
			}
		}

		const existingStoryPath = path.join(root, "curriculum", language, "stories", `${storyId}.json`);
		return {
			language,
			storyId,
			title: entry.title,
			tagline: entry.tagline,
			chapterId: chapter.id,
			chapterTitle: chapter.title,
			level: stage?.level ?? "A1",
			targetUnits: entry.after,
			chapterUnitIds: chapter.units,
			chapterWordLemmas: [...lemmas],
			existingStoryPath,
			exists: fs.existsSync(existingStoryPath),
		};
	} finally {
		globals.__lhCourse = previousCourse;
	}
}

function main(): void {
	const args = process.argv.slice(2);
	const asJson = args.includes("--json");
	const positional = args.filter((arg) => !arg.startsWith("--"));
	const [language, storyId] = positional;
	if (!language || !storyId) {
		console.error("Usage: bun scripts/story-brief.ts <slovak|russian|estonian> <story-id> [--json]");
		process.exit(1);
	}
	const brief = buildStoryBrief(language, storyId);
	if (asJson) {
		console.log(JSON.stringify(brief, null, 2));
		return;
	}
	console.log(
		`${brief.language}/${brief.storyId} (${brief.level}, chapter: ${brief.chapterId} - ${brief.chapterTitle})`,
	);
	console.log(`Title:   ${brief.title}`);
	console.log(`Tagline: ${brief.tagline}`);
	console.log(`After:   ${brief.targetUnits.join(", ")}`);
	console.log(`Units:   ${brief.chapterUnitIds.join(", ")}`);
	console.log(`Words (${brief.chapterWordLemmas.length}): ${brief.chapterWordLemmas.join(", ")}`);
	console.log(`File:    ${brief.existingStoryPath} (${brief.exists ? "exists" : "new"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
