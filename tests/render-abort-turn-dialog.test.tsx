/**
 * SSR pins — abort-turn-dialog (ESC-abort guard, owner 2026-10-02):
 * the confirm popup EVERYWHERE ruling. AbortTurnBody is the pure seam
 * (the DeleteNodeBody pattern); the wrapper owns effects + portal.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AbortTurnBody } from "@/components/abort-turn-dialog";

describe("AbortTurnBody", () => {
	it("turn mode: names the answer, the partial-stays promise, Stop", () => {
		const html = renderToStaticMarkup(
			<AbortTurnBody mode="turn" onClose={() => {}} onConfirm={() => {}} />,
		);
		assert.ok(html.includes('data-testid="abort-turn-dialog"'));
		assert.match(html, /Stop the tutor&#x27;s answer\?/);
		assert.match(html, /What it has written so far stays in the chat\./);
		assert.match(html, /Cancel/);
		assert.match(html, /Stop/);
	});

	it("question mode: names the skip, Skip", () => {
		const html = renderToStaticMarkup(
			<AbortTurnBody mode="question" onClose={() => {}} onConfirm={() => {}} />,
		);
		assert.match(html, /Skip this question\?/);
		assert.match(html, /The tutor moves on without your answer\./);
		assert.match(html, /Skip/);
		// the abort copy must not leak into the dismissal mode
		assert.ok(!html.includes("Stop the tutor"));
	});

	it("the confirm action is the destructive pair, never the cancel", () => {
		const html = renderToStaticMarkup(
			<AbortTurnBody mode="turn" onClose={() => {}} onConfirm={() => {}} />,
		);
		const confirmAt = html.indexOf('data-testid="abort-turn-confirm"');
		const cancelAt = html.indexOf('data-testid="abort-turn-cancel"');
		assert.ok(confirmAt > -1 && cancelAt > -1);
		const tag = (at: number) => html.slice(html.lastIndexOf("<button", at), html.indexOf("</button>", at));
		assert.match(tag(confirmAt), /data-variant="destructive"/);
		assert.doesNotMatch(tag(cancelAt), /data-variant="destructive/);
	});
});
