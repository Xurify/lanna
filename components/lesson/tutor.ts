"use client";

/**
 * Starting a tutor chat from outside the composer (redesign):
 * a tutor unit, a lesson's "Why?" and the placement follow-up open a session
 * with a prepared first message, the same way the old home composer did
 * (POST /api/chats, then /chat/<id>?prompt=…, whose page delivers the
 * message as turn 1). Talk and Story are not chats any more: they are the
 * Speak and Read screens (decision E8).
 *
 * These run as practice-kind sessions: those skip the placement probe and
 * the plan, and the practice prompt's language section says how to answer.
 * "Why?" is a question, not a course (prompts/practice/20-language-drills.md).
 */

interface WhyReuse {
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
	opts: {
		title: string;
		prompt: string;
		activity?: "tutor";
		unit?: string;
		reuse?: WhyReuse;
		kind?: "practice" | "chat";
	},
): Promise<void> {
	// A tutor unit's session counts when the learner first types (the server,
	// src/server/turn/persist.ts), so the chat carries the unit.
	const tutorUnit = opts.activity === "tutor" && !opts.reuse ? opts.unit : undefined;
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
		body: JSON.stringify({ title: opts.title, kind: opts.kind ?? "practice", ...(tutorUnit ? { tutorUnit } : {}) }),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const { id } = (await res.json()) as { id: string };
	router.push(`/chat/${id}?prompt=${encodeURIComponent(opts.prompt)}`);
}

export function whyPrompt(item: { sentence: string; answer: string; given: string; lemma: string }): string {
	return [
		`Why? In the sentence "${item.sentence}" the form is "${item.answer}" (from ${item.lemma}), and I wrote "${item.given || "nothing"}".`,
		"Explain in 3 or 4 short lines what decides the form here, compare it with what I wrote, and give me 2 more examples in say: spans. Then give me one quick problem on the same point.",
	].join(" ");
}
