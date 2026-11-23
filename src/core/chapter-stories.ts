/**
 * Chapter stories: short stories written by hand and shipped with the app
 * (curriculum/<language>/stories/<id>.json), one stop on a chapter's path.
 * They fill the arc's story step (src/core/arc.ts) with meaning-focused
 * input between the drills, and cost no model call. Pure and browser-safe:
 * only where each story sits; the text is read on the server
 * (src/server/chapter-stories.ts).
 */

export interface ChapterStory {
	/** The unit id on the path, the story's id in the library, and its file name. */
	id: string;
	language: string;
	title: string;
	tagline: string;
	/** The story sits right after the first of these units its language's map has. */
	after: readonly string[];
}

export const CHAPTER_STORIES: readonly ChapterStory[] = [
	{
		id: "story-rainbow",
		language: "slovak",
		title: "Story: A rainbow over the river",
		tagline: "Weather and colours in a rainy Saturday",
		after: ["lx-weather", "lx-colours"],
	},
	{
		id: "story-rainbow",
		language: "russian",
		title: "Story: A rainbow over the river",
		tagline: "Weather and colours in a rainy Saturday",
		after: ["lx-words-colors", "lx-words-weather", "lx-words-time"],
	},
	{
		id: "story-rainbow",
		language: "estonian",
		title: "Story: A rainbow over the river",
		tagline: "Weather and colours in a rainy Saturday",
		after: ["lx-words-colors", "lx-words-weather", "lx-words-time"],
	},
];

export function chapterStoriesFor(language: string): ChapterStory[] {
	return CHAPTER_STORIES.filter((s) => s.language === language);
}

export function isChapterStoryId(id: string): boolean {
	return CHAPTER_STORIES.some((s) => s.id === id);
}
