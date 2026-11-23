export interface ChapterStory {
	id: string;
	language: string;
	title: string;
	tagline: string;
	after: readonly string[];
}

export const CHAPTER_STORIES: readonly ChapterStory[] = [
	{
		id: "story-hello",
		language: "slovak",
		title: "Story: The new neighbour",
		tagline: "Greetings on the doorstep, and ahoj to the wrong person",
		after: ["present", "lx-questions", "lx-greetings"],
	},
	{
		id: "story-town",
		language: "slovak",
		title: "Story: The way to the station",
		tagline: "Asking the way and catching a bus in time",
		after: ["lx-transport", "kam-kde", "lx-directions"],
	},
	{
		id: "story-family",
		language: "slovak",
		title: "Story: Who is who?",
		tagline: "Meeting a girlfriend's family over Sunday lunch",
		after: ["lx-home", "lx-people", "lx-family"],
	},
	{
		id: "story-everyday",
		language: "slovak",
		title: "Story: A quick morning",
		tagline: "Overslept, in a rush, and then a surprise at breakfast",
		after: ["lx-colours", "lx-meals", "lx-routine"],
	},
	{
		id: "story-yesterday",
		language: "slovak",
		title: "Story: Two of the same present",
		tagline: "A birthday, two books and a happy grandpa",
		after: ["byt-past", "lx-shopping", "dat"],
	},
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
