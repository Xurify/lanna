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
	{
		id: "story-cafe",
		language: "slovak",
		title: "Story: Coffee for two",
		tagline: "Ordering, a mixed-up order and the bill",
		after: ["lx-food", "lx-cafe", "lx-drinks"],
	},
	{
		id: "story-cafe",
		language: "russian",
		title: "Story: Coffee for two",
		tagline: "Ordering, a mixed-up order and the bill",
		after: ["lx-words-food", "accusative-singular"],
	},
	{
		id: "story-cafe",
		language: "estonian",
		title: "Story: Coffee for two",
		tagline: "Ordering, a mixed-up order and the bill",
		after: ["lx-words-food", "partitive-singular", "lx-words-shopping"],
	},
];

export function chapterStoriesFor(language: string): ChapterStory[] {
	return CHAPTER_STORIES.filter((s) => s.language === language);
}
