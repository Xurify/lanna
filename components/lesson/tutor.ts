"use client";

/**
 * Starting a tutor chat from outside the composer (LangHarness redesign):
 * Talk, Story and a lesson's "Why?" all open a session with a prepared
 * first message, the same way the old home composer did (POST /api/chats,
 * then /chat/<id>?prompt=…, whose page delivers the message as turn 1).
 *
 * Talk and Story run as practice-kind sessions: those skip the placement
 * probe and the plan, and the practice prompt's language section tells
 * the agent how to run a conversation or a story (prompts/practice/
 * 20-language-drills.md). "Why?" runs as one too: it is a question, not a
 * course.
 */

export interface WhyReuse {
	sentence: string;
	answer: string;
	lemma: string;
	given: string;
}

/**
 * Open a tutor chat with a prepared first message. With `reuse` (a lesson's
 * Why?), POST /api/why first looks the (sentence, answer) pair up in the
 * profile's Why? index: an existing chat is reopened as it is, with no new
 * turn, so the explanation is paid for once.
 */
export async function startTutorChat(
	router: { push: (href: string) => void },
	opts: { title: string; prompt: string; activity?: "talk" | "story" | "tutor"; unit?: string; reuse?: WhyReuse; kind?: "practice" | "teach" },
): Promise<void> {
	// The day's plan counts a Talk or a Story as its speaking task when it
	// opens. A tutor unit's session counts when the learner first types
	// (the server, src/server/turn-service.ts), so the chat carries the unit.
	const activity = opts.activity ?? (opts.title.startsWith("Talk:") ? "talk" : opts.title.startsWith("Story:") ? "story" : undefined);
	const tutorUnit = activity === "tutor" && !opts.reuse ? opts.unit : undefined;
	if (activity && activity !== "tutor") {
		void fetch(`/api/progress?tz=${new Date().getTimezoneOffset()}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ activity, unit: opts.unit }),
		}).catch(() => undefined);
	}
	if (opts.reuse) {
		const res = await fetch("/api/why", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: opts.title, ...opts.reuse }),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const { id, reused } = (await res.json()) as { id: string; reused: boolean };
		router.push(reused ? `/chat/${id}` : `/chat/${id}?prompt=${encodeURIComponent(opts.prompt)}`);
		return;
	}
	const res = await fetch("/api/chats", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		// A "teach" session (the placement follow-up) runs the prober with
		// the learner profile in its prompt, then the teacher.
		body: JSON.stringify({ title: opts.title, kind: opts.kind ?? "practice", ...(tutorUnit ? { tutorUnit } : {}) }),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const { id } = (await res.json()) as { id: string };
	router.push(`/chat/${id}?prompt=${encodeURIComponent(opts.prompt)}`);
}

export interface Scene {
	id: string;
	title: string;
	blurb: string;
	/** The role-play brief sent as the first message. */
	brief: string;
}

export const TALK_SCENES: Scene[] = [
	{ id: "cafe", title: "Kaviareň", blurb: "Order coffee and cake in Bratislava", brief: "a waiter in a small café in Bratislava's old town; I want to order coffee and something sweet, and ask what's good" },
	{ id: "way", title: "Na ulici", blurb: "Ask a stranger the way to the station", brief: "a friendly local on Obchodná ulica; I am lost and need to get to the main train station" },
	{ id: "colleague", title: "Nový kolega", blurb: "Meet a new colleague on day one", brief: "my new colleague at the office; we meet at the coffee machine on my first day and get to know each other" },
	{ id: "shop", title: "Na trhu", blurb: "Buy vegetables at the market", brief: "a stallholder at the Miletičova market; I want vegetables and fruit for a soup, and to ask about prices" },
	{ id: "doctor", title: "U lekára", blurb: "Explain to a doctor what hurts", brief: "a GP in a Slovak clinic; I have a sore throat and a headache since yesterday" },
	{ id: "family", title: "Rodina", blurb: "Talk about your family with a new friend", brief: "a new Slovak friend at a party who asks about my family, where they live and what they do" },
];

export function talkPrompt(scene: Scene): string {
	return [
		`Talk: role-play. You are ${scene.brief}.`,
		"Speak only Slovak, short lines at my level, one turn at a time, and wait for my reply.",
		"Stay in the scene. When I slip, prompt me to fix it myself with a hint, not the answer; do not recast my line. When I write 'koniec' (or after about 10 turns), step out and give me my 3 most useful corrections with the right forms in say: spans, then 2 phrases worth keeping.",
		"Start the scene now with your first line.",
	].join(" ");
}

export function storyPrompt(unitsStarted: string[]): string {
	return [
		"Story: tell me the next episode of a short ongoing story in Slovak about Robo, a young guy who has just moved to Bratislava.",
		"About 8 short sentences at my level, each in a say: span so I can hear it, with a one-line English gloss only for words I am unlikely to know.",
		unitsStarted.length ? `Use the grammar I am practising: ${unitsStarted.join(", ")}.` : "",
		"Then check I understood with 3 quick problems, one at a time, answered in Slovak. End with a one-line cliffhanger for next time.",
	]
		.filter(Boolean)
		.join(" ");
}

export function whyPrompt(item: { sentence: string; answer: string; given: string; lemma: string }): string {
	return [
		`Why? In the sentence "${item.sentence}" the form is "${item.answer}" (from ${item.lemma}), and I wrote "${item.given || "nothing"}".`,
		"Explain in 3 or 4 short lines what decides the form here, compare it with what I wrote, and give me 2 more examples in say: spans. Then give me one quick problem on the same point.",
	].join(" ");
}
