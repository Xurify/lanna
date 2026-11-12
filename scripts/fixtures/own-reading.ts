export interface OwnReadingPart {
	title: string;
	topic: string;
	recap: string;
	sentences: Array<{ sk: string; en: string; p?: boolean }>;
	newWords: Array<{ sk: string; en: string }>;
	questions: Array<{ q: string; options: string[]; answer: number }>;
}

export const OWN_READING = {
	id: "src-the-list-that-never-ends-5eed0001",
	title: "The list that never ends",
	url: "https://example.com/the-list-that-never-ends",
	site: "example.com",
	slovakCheckedByNativeSpeaker: false,
	sections: [
		`Every Monday I write a list of things to do. By Friday the list is longer than it was on Monday. For years I thought the problem was me: I was too slow, or too lazy, or I slept too much. Then I counted. In one week I finished twenty-three tasks and added thirty-one new ones. I was not slow. The list was simply growing faster than any person could work.

Most of the new tasks did not come from my boss or my family. They came from me. Each time I read an interesting article, I wrote down "try this". Each time a friend told me about a book, I wrote down "read this". A list like that is not a plan. It is a collection of wishes.`,
		`So I tried a small experiment. For one month I kept two lists. The first list had only three lines, and I wrote it each morning: the three things that had to happen that day. The second list was for everything else, and I called it "maybe". Nothing on the second list was a promise.

The first week felt strange. Three things looked like too little, and I finished them before lunch. But I noticed that I was calmer in the afternoon, and that I started doing things from the "maybe" list because I wanted to, not because I had to. At the end of the month I had done more than in the month before.`,
		`I do not think three is a magic number. A nurse or a parent of small children cannot choose only three things. What helped me was the difference between a promise and a wish. When everything on a list is a promise, every evening ends with broken promises. When most of it is a wish, an unfinished list is just a list.

This week, try it for one day. Write three lines in the morning. Put the rest on a page called "maybe". Then write to me and tell me how the afternoon felt.`,
	],
	writtenParts: [
		{
			title: "Zoznam, ktorý rastie",
			topic: "a to-do list that keeps growing",
			recap: "The writer's to-do list grew faster than he could work, because he kept adding his own wishes to it.",
			sentences: [
				{ p: true, sk: "Každý pondelok píšem zoznam.", en: "Every Monday I write a list." },
				{ sk: "V piatok je zoznam dlhší ako v pondelok.", en: "On Friday the list is longer than on Monday." },
				{ sk: "Dlho som si myslel, že problém som ja.", en: "For a long time I thought the problem was me." },
				{ sk: "Myslel som si, že som pomalý.", en: "I thought I was slow." },
				{ p: true, sk: "Potom som to spočítal.", en: "Then I counted it." },
				{ sk: "Za jeden týždeň som urobil dvadsaťtri vecí.", en: "In one week I did twenty-three things." },
				{ sk: "Ale na zoznam som napísal tridsaťjeden nových vecí.", en: "But I wrote thirty-one new things on the list." },
				{ sk: "Nebol som pomalý.", en: "I was not slow." },
				{ sk: "Zoznam bol rýchlejší ako ja.", en: "The list was faster than me." },
				{ p: true, sk: "Nové veci neprišli od šéfa ani od rodiny.", en: "The new things did not come from my boss or my family." },
				{ sk: "Prišli odo mňa.", en: "They came from me." },
				{ sk: "Čítam zaujímavý článok a napíšem si: „Skús to.“", en: "I read an interesting article and write down: \"Try it.\"" },
				{ sk: "Kamarát hovorí o knihe a ja si napíšem: „Prečítaj to.“", en: "A friend talks about a book and I write down: \"Read it.\"" },
				{ sk: "Taký zoznam nie je plán.", en: "A list like that is not a plan." },
				{ sk: "Je to zoznam želaní.", en: "It is a list of wishes." },
			],
			newWords: [
				{ sk: "zoznam", en: "list" },
				{ sk: "pomalý", en: "slow" },
				{ sk: "želanie", en: "wish" },
			],
			questions: [
				{ q: "Kedy píše zoznam?", options: ["V pondelok", "V piatok", "V nedeľu"], answer: 0 },
				{ q: "Koľko vecí urobil za týždeň?", options: ["Tridsaťjeden", "Dvadsaťtri", "Tri"], answer: 1 },
				{ q: "Od koho prišli nové veci?", options: ["Od šéfa", "Od rodiny", "Od neho"], answer: 2 },
			],
		},
		{
			title: "Dva zoznamy",
			topic: "an experiment with two lists",
			recap: "For a month he kept a list of three things for the day and a second list called maybe, and he got more done and felt calmer.",
			sentences: [
				{ p: true, sk: "Urobil som malý experiment.", en: "I did a small experiment." },
				{ sk: "Jeden mesiac som mal dva zoznamy.", en: "For one month I had two lists." },
				{ sk: "Prvý zoznam mal iba tri riadky.", en: "The first list had only three lines." },
				{ sk: "Písal som ho každé ráno.", en: "I wrote it every morning." },
				{ sk: "Boli to tri veci, ktoré som musel urobiť v ten deň.", en: "They were the three things I had to do that day." },
				{ p: true, sk: "Druhý zoznam bol pre všetko ostatné.", en: "The second list was for everything else." },
				{ sk: "Volal sa „možno“.", en: "It was called \"maybe\"." },
				{ sk: "Na druhom zozname nebol žiadny sľub.", en: "There was no promise on the second list." },
				{ p: true, sk: "Prvý týždeň bol zvláštny.", en: "The first week was strange." },
				{ sk: "Tri veci boli hotové už pred obedom.", en: "The three things were done before lunch." },
				{ sk: "Ale poobede som bol pokojný.", en: "But in the afternoon I was calm." },
				{ sk: "Robil som veci zo zoznamu „možno“, pretože som chcel.", en: "I did things from the \"maybe\" list because I wanted to." },
				{ sk: "Nemusel som.", en: "I did not have to." },
				{ sk: "Na konci mesiaca som urobil viac ako predtým.", en: "At the end of the month I had done more than before." },
			],
			newWords: [
				{ sk: "riadok", en: "line" },
				{ sk: "sľub", en: "promise" },
				{ sk: "pokojný", en: "calm" },
			],
			questions: [
				{ q: "Koľko riadkov mal prvý zoznam?", options: ["Dva", "Tri", "Desať"], answer: 1 },
				{ q: "Ako sa volal druhý zoznam?", options: ["Možno", "Dnes", "Sľub"], answer: 0 },
				{ q: "Aký bol poobede?", options: ["Pomalý", "Pokojný", "Zvláštny"], answer: 1 },
			],
		},
	] satisfies OwnReadingPart[],
};
