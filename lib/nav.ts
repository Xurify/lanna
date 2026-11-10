/**
 * The app's map: every user-facing page, in one table. The sidebar (and the drawer that is the phone's
 * navigation), the jump palette and the document titles all read it, so a page has ONE name: its route,
 * its nav label and its page title are the same word. A test (tests/nav.test.ts) fails when a page under
 * app/ is missing here or a title and a label differ.
 */

export type NavId = "today" | "ask" | "curriculum" | "review" | "read" | "listen" | "watch" | "speak" | "eargym" | "fluency" | "words" | "grammar" | "progress" | "milestones" | "mistakes" | "log" | "experiment";

interface NavItemDef {
	id: NavId;
	href: string;
	/** The nav label and the page title: the same word. */
	label: string;
	/** A few words under the title or in the palette. */
	hint: string;
	/** Other routes that light this item (the pages reached from inside it). */
	also?: readonly string[];
	badge?: string;
}

interface NavGroupDef {
	id: "main" | "practice" | "understand" | "track" | "trial";
	/** Null for the short primary group, which has no heading. */
	label: string | null;
	items: readonly NavItemDef[];
}

export const NAV: readonly NavGroupDef[] = [
	{
		id: "main",
		label: null,
		items: [
			{ id: "today", href: "/", label: "Today", hint: "The plan for today" },
			{ id: "experiment", href: "/experiments/input-first", label: "Study", hint: "Russian input-first study vs Slovak control", also: ["/experiments", "/experiments/input-first/check", "/experiment", "/experiment/check"], badge: "42d" },
			{ id: "ask", href: "/chat/new", label: "Ask", hint: "Any question about the language, answered with a drawing", also: ["/chat"] },
			{ id: "curriculum", href: "/curriculum", label: "Curriculum", hint: "Your climb, level by level and chapter by chapter", also: ["/exam"] },
			{ id: "review", href: "/review", label: "Review", hint: "Your word deck" },
		],
	},
	{
		id: "practice",
		label: "Practice",
		items: [
			{ id: "read", href: "/read", label: "Read", hint: "Stories, every word tappable" },
			{ id: "listen", href: "/listen", label: "Listen", hint: "Ten sentences you can follow" },
			{ id: "watch", href: "/watch", label: "Watch", hint: "A video with both subtitles" },
			{ id: "speak", href: "/speak", label: "Speak", hint: "A scene said out loud" },
			{ id: "eargym", href: "/phonology", label: "Ear gym", hint: "Which of two close words did you hear", also: ["/sound"] },
			{ id: "fluency", href: "/speed", label: "Speed", hint: "Known sentences, said faster" },
		],
	},
	{
		id: "understand",
		label: "Understand",
		items: [
			{ id: "words", href: "/words", label: "Words", hint: "Everything you have met" },
			{ id: "grammar", href: "/grammar", label: "Grammar", hint: "Cases, genders, and your score on each" },
		],
	},
	{
		id: "track",
		label: "Track",
		items: [
			{ id: "progress", href: "/progress", label: "Progress", hint: "Hours, stamps, the plan's pace" },
			{ id: "milestones", href: "/milestones", label: "Milestones", hint: "When you can handle real situations" },
			{ id: "mistakes", href: "/mistakes", label: "Mistakes", hint: "What goes wrong and whether it is getting better" },
			{ id: "log", href: "/log", label: "Log", hint: "What you did, day by day" },
		],
	},
];

const NAV_ITEMS: readonly NavItemDef[] = NAV.flatMap((g) => g.items);
export function navItemFor(pathname: string): NavItemDef | undefined {
	return NAV_ITEMS.find((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`) || i.also?.some((a) => pathname === a || pathname.startsWith(`${a}/`))));
}

export function rendersAhead(pathname: string): boolean {
	return NAV_ITEMS.some((i) => i.href === pathname);
}
