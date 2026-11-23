export interface ChapterStory {
	id: string;
	language: string;
	title: string;
	tagline: string;
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
