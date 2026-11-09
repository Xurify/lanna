/**
 * The app's map: every user-facing page, in one table. The sidebar (and the drawer that is the phone's
 * navigation), the jump palette and the document titles all read it, so a page has ONE name: its route,
 * its nav label and its page title are the same word. A test (tests/nav.test.ts) fails when a page under
 * app/ is missing here or a title and a label differ.
 */

export type NavId = "today" | "ask" | "curriculum" | "review" | "read" | "listen" | "watch" | "speak" | "fluency" | "words" | "grammar" | "progress" | "milestones" | "mistakes" | "log" | "experiment";

interface NavItemDef {
	id: NavId;
	href: string;
	/** The nav label and the page title: the same word. */
	label: string;
	/** A few words under the title or in the palette. */
	hint: string;
	/** Other routes that light this item (the pages reached from inside it). */
	also?: readonly string[];
	/** The page only reads the learner's files when it renders, so it can be rendered before the click. Left off where a render starts paid or network work: Read tops up the shelf, Listen asks a model for close options, Watch refreshes the picks, Study draws its schedule on the first view. */
	rendersAhead?: true;
}

interface NavGroupDef {
	id: "main" | "practice" | "understand" | "track";
	/** Null for the short primary group, which has no heading. */
	label: string | null;
	items: readonly NavItemDef[];
}

export const NAV: readonly NavGroupDef[] = [
	{
		id: "main",
		label: null,
		items: [
			{ id: "today", href: "/", rendersAhead: true, label: "Today", hint: "The plan for today" },
			{ id: "ask", href: "/chat/new", rendersAhead: true, label: "Ask", hint: "Any question about the language, answered with a drawing", also: ["/chat"] },
			{ id: "curriculum", href: "/curriculum", rendersAhead: true, label: "Curriculum", hint: "Your climb, level by level and chapter by chapter", also: ["/exam"] },
			{ id: "review", href: "/review", rendersAhead: true, label: "Review", hint: "Your word deck" },
		],
	},
	{
		id: "practice",
		label: "Practice",
		items: [
			{ id: "read", href: "/read", label: "Read", hint: "Stories, every word tappable" },
			{ id: "listen", href: "/listen", label: "Listen", hint: "Ten sentences you can follow" },
			{ id: "watch", href: "/watch", label: "Watch", hint: "A video with both subtitles" },
			{ id: "speak", href: "/speak", rendersAhead: true, label: "Speak", hint: "A scene said out loud" },
			{ id: "fluency", href: "/speed", rendersAhead: true, label: "Speed", hint: "Known sentences, said faster" },
		],
	},
	{
		id: "understand",
		label: "Understand",
		items: [
			{ id: "words", href: "/words", rendersAhead: true, label: "Words", hint: "Everything you have met" },
			{ id: "grammar", href: "/grammar", rendersAhead: true, label: "Grammar", hint: "Cases, genders, and your score on each" },
		],
	},
	{
		id: "track",
		label: "Track",
		items: [
			{ id: "progress", href: "/progress", rendersAhead: true, label: "Progress", hint: "Hours, stamps, the plan's pace" },
			{ id: "milestones", href: "/milestones", rendersAhead: true, label: "Milestones", hint: "When you can handle real situations" },
			{ id: "mistakes", href: "/mistakes", rendersAhead: true, label: "Mistakes", hint: "What goes wrong and whether it is getting better" },
			{ id: "log", href: "/log", rendersAhead: true, label: "Log", hint: "What you did, day by day" },
			{ id: "experiment", href: "/experiments/input-first", label: "Study", hint: "Russian input-first study vs Slovak control", also: ["/experiments", "/experiments/input-first/check", "/experiment", "/experiment/check"] },
		],
	},
];

const NAV_ITEMS: readonly NavItemDef[] = NAV.flatMap((g) => g.items);
export function navItemFor(pathname: string): NavItemDef | undefined {
	return NAV_ITEMS.find((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`) || i.also?.some((a) => pathname === a || pathname.startsWith(`${a}/`))));
}

export function rendersAhead(pathname: string): boolean {
	return NAV_ITEMS.some((i) => i.rendersAhead && i.href === pathname);
}
