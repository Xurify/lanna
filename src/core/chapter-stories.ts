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
		title: "Story: The new neighbor",
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
		tagline: "Weather and colors on a rainy Saturday",
		after: ["lx-weather", "lx-colours"],
	},
	{
		id: "story-rainbow",
		language: "russian",
		title: "Story: A rainbow over the river",
		tagline: "Weather and colors on a rainy Saturday",
		after: ["lx-words-colors", "lx-words-weather", "lx-words-time"],
	},
	{
		id: "story-rainbow",
		language: "estonian",
		title: "Story: A rainbow over the river",
		tagline: "Weather and colors on a rainy Saturday",
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
	{
		id: "story-hello",
		language: "russian",
		title: "Story: The new neighbor",
		tagline: "Greetings on the doorstep, and a hello to the wrong person",
		after: ["lx-words-countries", "present-plural", "lx-words-basic-verbs"],
	},
	{
		id: "story-town",
		language: "russian",
		title: "Story: The way to the station",
		tagline: "Asking the way and catching a bus in time",
		after: ["lx-words-places", "prepositional-place"],
	},
	{
		id: "story-family",
		language: "russian",
		title: "Story: Who is who?",
		tagline: "Meeting a girlfriend's family over Sunday lunch",
		after: ["lx-words-family", "adjective-nominative", "lx-words-questions"],
	},
	{
		id: "story-everyday",
		language: "russian",
		title: "Story: A quick morning",
		tagline: "Overslept, in a rush, and then a surprise at breakfast",
		after: ["instrumental-singular", "lx-words-work", "lx-words-relationships"],
	},
	{
		id: "story-yesterday",
		language: "russian",
		title: "Story: Two of the same present",
		tagline: "A birthday, two books and a happy grandpa",
		after: ["past", "lx-words-day", "lx-words-time"],
	},
	{
		id: "story-hello",
		language: "estonian",
		title: "Story: The new neighbor",
		tagline: "Greetings on the doorstep, and a hello to the wrong person",
		after: ["lx-words-countries", "present-plural", "lx-words-basic-verbs"],
	},
	{
		id: "story-town",
		language: "estonian",
		title: "Story: The way to the station",
		tagline: "Asking the way and catching a bus in time",
		after: ["lx-words-places", "inner-cases", "lx-words-directions"],
	},
	{
		id: "story-family",
		language: "estonian",
		title: "Story: Who is who?",
		tagline: "Meeting a girlfriend's family over Sunday lunch",
		after: ["lx-words-family", "genitive-singular"],
	},
	{
		id: "story-everyday",
		language: "estonian",
		title: "Story: A quick morning",
		tagline: "Overslept, in a rush, and then a surprise at breakfast",
		after: ["comitative-singular", "lx-words-describing", "lx-words-relationships"],
	},
	{
		id: "story-yesterday",
		language: "estonian",
		title: "Story: Two of the same present",
		tagline: "A birthday, two books and a happy grandpa",
		after: ["past", "lx-words-day", "lx-words-time"],
	},
];

export function chapterStoriesFor(language: string): ChapterStory[] {
	return CHAPTER_STORIES.filter((s) => s.language === language);
}
