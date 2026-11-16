/**
 * The story library (reading, 2026-10-28) — the active
 * profile's data/profiles/<language>/stories/:
 *
 *   <id>.json      one story as generated: every sentence with its
 *                  glossed tokens, the questions, the new words, the
 *                  model and tokens it cost (src/core/reading.ts
 *                  StoryRecord). Written once, never changed.
 *   index.jsonl    one line per story (StoryIndexEntry), appended when
 *                  the story is written, so the library lists without
 *                  opening every file.
 *   reads.jsonl    one line per reading (ReadLogEntry): when, how long,
 *                  the comprehension score, the words tapped and queued.
 *
 * A story is paid for once: the Read task opens the newest unread
 * episode before it asks for another. Same idioms as the other stores:
 * sync fs, small files, atomic renames, torn lines skipped.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { ReadLogEntry, StoryIndexEntry, StoryRecord } from "../core/reading.ts";
import { processWide } from "../core/process-wide.ts";

const INDEX = () => path.join(PATHS.stories, "index.jsonl");
const READS = () => path.join(PATHS.stories, "reads.jsonl");

function storyFile(id: string): string {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`bad story id ${id}`);
	return path.join(PATHS.stories, `${id}.json`);
}

function readJsonl<T>(file: string): T[] {
	let raw: string;
	try {
		raw = fs.readFileSync(file, "utf-8");
	} catch {
		return [];
	}
	const out: T[] = [];
	for (const line of raw.split("\n")) {
		const s = line.trim();
		if (!s) continue;
		try {
			out.push(JSON.parse(s) as T);
		} catch {
			// a torn line (crash mid-append) is skipped, never fatal
		}
	}
	return out;
}

function appendJsonl(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.appendFileSync(file, `${JSON.stringify(value)}\n`, "utf-8");
}

const parsedStories = processWide(
	"stories.parsed",
	() => new Map<string, { mtimeMs: number; size: number; story: StoryRecord }>(),
);

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const inner of Object.values(value)) deepFreeze(inner);
	}
	return value;
}

function indexEntryOf(story: StoryRecord): StoryIndexEntry {
	return {
		id: story.id,
		series: story.series,
		episode: story.episode,
		title: story.title,
		level: story.level,
		theme: story.theme,
		...(story.chapter ? { chapter: story.chapter } : {}),
		...(story.genre ? { genre: story.genre } : {}),
		...(story.topic ? { topic: story.topic } : {}),
		...(story.cover ? { cover: story.cover } : {}),
		createdAt: story.createdAt,
		wordCount: story.wordCount,
		coverage: story.coverage,
		newWords: story.newWords.map((w) => w.lemma),
		model: story.usage.model,
		...(story.source ? { source: story.source } : {}),
	};
}

export const storyStore = {
	/** Every story's index line, oldest first. */
	list(): StoryIndexEntry[] {
		return readJsonl<StoryIndexEntry>(INDEX()).sort(
			(a, b) => a.episode - b.episode || a.createdAt.localeCompare(b.createdAt),
		);
	},
	/** The story as saved. Parsed once per change on disk and shared, so it is frozen. */
	get(id: string): StoryRecord | null {
		try {
			const file = storyFile(id);
			const { mtimeMs, size } = fs.statSync(file);
			const kept = parsedStories.get(file);
			if (kept && kept.mtimeMs === mtimeMs && kept.size === size) return kept.story;
			const story = deepFreeze(JSON.parse(fs.readFileSync(file, "utf-8")) as StoryRecord);
			parsedStories.set(file, { mtimeMs, size, story });
			return story;
		} catch {
			return null;
		}
	},
	/** Write the story and its index line. */
	put(story: StoryRecord): void {
		const file = storyFile(story.id);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(story, null, "\t"), "utf-8");
		fs.renameSync(tmp, file);
		appendJsonl(INDEX(), indexEntryOf(story));
	},
	appendRead(entry: ReadLogEntry): void {
		appendJsonl(READS(), entry);
	},
	/** Every reading, oldest first. */
	reads(): ReadLogEntry[] {
		return readJsonl<ReadLogEntry>(READS());
	},
};
