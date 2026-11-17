import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { askAbout, onAskLeaving, partPrompt, sentencePrompt } from "../components/lesson/tutor.ts";

const realFetch = globalThis.fetch;

function stubWhy(reused: boolean) {
	const bodies: Record<string, string>[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		assert.equal(String(url), "/api/why");
		bodies.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify({ id: "c1", reused }), { status: 200 });
	}) as typeof fetch;
	return bodies;
}

function recordPush() {
	const pushed: string[] = [];
	return { pushed, router: { push: (href: string) => void pushed.push(href) } };
}

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("asking about a review card", () => {
	it("keys a sentence question by the sentence, so asking twice reopens one chat", async () => {
		const bodies = stubWhy(false);
		const { pushed, router } = recordPush();
		await askAbout(router, {
			kind: "sentence",
			sentence: "Prosím si pohár vody.",
			answer: "vody",
			lemma: "voda",
			given: "voda",
		});
		assert.equal(bodies[0]!.sentence, "Prosím si pohár vody.");
		assert.equal(bodies[0]!.answer, "Prosím si pohár vody.");
		const prompt = decodeURIComponent(pushed[0]!.split("?prompt=")[1]!);
		assert.equal(prompt, 'What does each part of "Prosím si pohár vody." mean? I wrote "voda" instead of "vody".');
	});

	it("keys a selection by its sentence and the selected words", async () => {
		const bodies = stubWhy(true);
		const { pushed, router } = recordPush();
		await askAbout(router, { kind: "part", part: "pohár", sentence: "Prosím si pohár vody." });
		assert.deepEqual([bodies[0]!.sentence, bodies[0]!.answer], ["Prosím si pohár vody.", "pohár"]);
		assert.deepEqual(pushed, ["/chat/c1"]);
	});

	it("settles the open card before the chat is created", async () => {
		const order: string[] = [];
		const stop = onAskLeaving(async () => void order.push("rated"));
		const { router } = recordPush();
		globalThis.fetch = (async () => {
			order.push("chat");
			return new Response(JSON.stringify({ id: "c2", reused: false }), { status: 200 });
		}) as typeof fetch;
		await askAbout(router, { kind: "part", part: "vody", sentence: "" });
		stop();
		await askAbout(router, { kind: "part", part: "vody", sentence: "" });
		assert.deepEqual(order, ["rated", "chat", "chat"]);
	});

	it("mentions the learner's answer only when it was wrong", () => {
		assert.equal(sentencePrompt({ sentence: "S", answer: "vody", given: "vody" }), 'What does each part of "S" mean?');
	});

	it("asks about a selection in its sentence, or alone without one", () => {
		assert.equal(
			partPrompt("vody", "Prosím si pohár vody."),
			'What does "vody" mean in "Prosím si pohár vody.", and why this form?',
		);
		assert.equal(partPrompt("vody", ""), 'What does "vody" mean, and why this form?');
	});
});
