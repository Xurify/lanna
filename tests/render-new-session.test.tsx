import React from "react";
(globalThis as Record<string, unknown>).React = React;

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DraftShell, startDraftSession } from "../components/new-session.tsx";
import { ChatDraft } from "../components/chat-draft.tsx";

/**
 * The sessionless draft view (/chat/new, owner 2026-09-13): "+ New session"
 * opens the draft — NOTHING is created until the first message is sent, and
 * that message becomes the session's title. These pins hold the two seams:
 * startDraftSession (the create-on-send contract) and DraftShell (the
 * visible surface: composer blob + stats bar + the fresh-chat empty state).
 */

/** A fetch double: records calls, answers /api/chats with a canned id. */
function fakeFetch(id: string) {
	const calls: { url: string; method: string; body: unknown }[] = [];
	const f = (async (url: string, init?: RequestInit) => {
		calls.push({
			url: String(url),
			method: init?.method ?? "GET",
			body: init?.body ? JSON.parse(String(init.body)) : null,
		});
		return new Response(JSON.stringify({ id }), { status: 200 });
	}) as typeof fetch;
	return { f, calls };
}

describe("startDraftSession — the create-on-send contract", () => {
	it("creates the session titled with the first message, returns the prompt redirect", async () => {
		const { f, calls } = fakeFetch("c_new");
		const target = await startDraftSession("teach me orbital mechanics", f);
		assert.equal(target, "/chat/c_new?prompt=teach%20me%20orbital%20mechanics");
		assert.equal(calls.length, 1);
		assert.equal(calls[0]!.url, "/api/chats");
		assert.equal(calls[0]!.method, "POST");
		assert.deepEqual(calls[0]!.body, { title: "teach me orbital mechanics" });
	});

	it("no settings PUT on create — the server stamps the newborn (per-session models, owner 2026-09-28)", async () => {
		const { f, calls } = fakeFetch("c_3");
		await startDraftSession("hello", f);
		assert.equal(calls.length, 1, "a single create call — the birth stamp is server-side");
	});

	it('the plain chat carries kind:"chat" to the create route', async () => {
		const { f, calls } = fakeFetch("c_chat");
		await startDraftSession("this and that", f, "chat");
		assert.deepEqual(calls[0]!.body, { title: "this and that", kind: "chat" });
	});

	it("empty or whitespace text never creates anything", async () => {
		const { f, calls } = fakeFetch("never");
		assert.equal(await startDraftSession("", f), null);
		assert.equal(await startDraftSession("   ", f), null);
		assert.equal(calls.length, 0);
	});
});

describe("DraftShell — the sessionless surface", () => {
	it("renders the composer blob and the empty state with its starting points", () => {
		const html = renderToStaticMarkup(<DraftShell busy={false} text="" onChange={() => {}} onSend={() => {}} />);
		// The composer, ready for the first message.
		assert.ok(html.includes('data-testid="composer"'));
		// No CTA by default: a configured surface stays quiet.
		assert.ok(!html.includes('data-testid="setup-cta"'));
		assert.match(html, /What should we drill\?/);
		assert.ok(html.includes("Short drills on one thing. Describe it, pick skills, or paste a sentence of your own."));
		assert.ok(html.includes('data-testid="draft-suggestions"'));
		// The pointer-events pattern (953b22b): the wrapper stays inert…
		assert.ok(html.includes("pointer-events-none"));
		// …and the blob re-enables it.
		assert.ok(/rounded-xl[^>]*pointer-events-auto|pointer-events-auto[^>]*rounded-xl/.test(html));
	});

	it("renders the setup CTA above the composer blob when passed (fix wave chunk B: /chat/new mirrors home)", () => {
		const html = renderToStaticMarkup(
			<DraftShell
				busy={false}
				text=""
				onChange={() => {}}
				onSend={() => {}}
				setupCta={
					<button type="button" data-testid="setup-cta">
						Set up your models
					</button>
				}
			/>,
		);
		// The same affordance home carries, above the draft shell's blob.
		assert.ok(html.includes('data-testid="setup-cta"'));
		assert.match(html, />Set up your models<\/button>/);
		assert.doesNotMatch(html, /chats start after/);
		// Above the composer: the CTA's markup precedes the blob's.
		const cta = html.indexOf('data-testid="setup-cta"');
		const blob = html.search(/rounded-xl[^>]*pointer-events-auto|pointer-events-auto[^>]*rounded-xl/);
		assert.ok(cta !== -1 && blob !== -1 && cta < blob, "CTA above the blob");
	});

	it("no chat id anywhere — nothing in the markup references a session", () => {
		const html = renderToStaticMarkup(<DraftShell busy={false} text="" onChange={() => {}} onSend={() => {}} />);
		assert.ok(!/\/chat\/c[a-z0-9_]+/.test(html));
	});
});
describe("the plain chat draft (/chat/new)", () => {
	it("opens on the question line, with the language named and no model control", () => {
		const html = renderToStaticMarkup(
			<ChatDraft busy={false} text="" onChange={() => {}} onSend={() => {}} language="Slovak" />,
		);
		assert.match(html, /A Slovak word you keep forgetting/);
		assert.match(html, /What(?:'|&#x27;)s on your mind\?/);
		assert.match(html, /Paste it or describe it/);
		assert.ok(html.includes('data-testid="draft-suggestions"'));
		assert.ok(!html.includes('data-testid="stats-model"'));
	});
});
describe("the practice draft (?mode=practice, 2026-10-04)", () => {
	it("the shell swaps copy: practice title, empty state, placeholder", () => {
		const html = renderToStaticMarkup(
			<DraftShell busy={false} text="" onChange={() => {}} onSend={() => {}} mode="practice" />,
		);
		assert.match(html, /What should we drill\?/);
		assert.ok(html.includes("Short drills on one thing. Describe it, pick skills, or paste a sentence of your own."));
		assert.ok(html.includes('data-testid="draft-suggestions"'), "one-tap starting points");
		assert.match(html, /What do you want to practice\?/);
	});

	it('startDraftSession carries kind:"practice" to the create route', async () => {
		let body: Record<string, unknown> | null = null;
		const f = (async (_url: string, init?: RequestInit) => {
			body = JSON.parse(String(init?.body));
			return new Response(JSON.stringify({ id: "c9" }), { status: 201 });
		}) as unknown as typeof fetch;
		const target = await startDraftSession("the parity chain", f, "practice");
		assert.equal(target, "/chat/c9?prompt=the%20parity%20chain");
		assert.deepEqual(body, { title: "the parity chain", kind: "practice" });
	});

	it("no mode sends no kind key on the wire — the server gives the record its chat kind", async () => {
		let body: Record<string, unknown> | null = null;
		const f = (async (_url: string, init?: RequestInit) => {
			body = JSON.parse(String(init?.body));
			return new Response(JSON.stringify({ id: "c8" }), { status: 201 });
		}) as unknown as typeof fetch;
		await startDraftSession("orbital mechanics", f);
		assert.deepEqual(body, { title: "orbital mechanics" });
	});
});
