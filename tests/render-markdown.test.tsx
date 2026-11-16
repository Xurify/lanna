/**
 * Render tests for the presentation layer (W3): the \(...\)/\[...\] math
 * delimiter contract, single-newline line breaks, and mermaid rendering.
 *
 * Same idiom as render-cards.test.tsx: static HTML via react-dom/server, no
 * DOM. tsx note: tsx uses the CLASSIC JSX transform, so `React` must be a
 * resolvable global — the shim below provides it.
 */

import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageResponse } from "../components/ai-elements/message.tsx";
import { MermaidError } from "../components/mermaid-error.tsx";

/** Render through MessageResponse in static mode (no streaming/remend artifacts). */
function render(md: string): string {
	return renderToStaticMarkup(<MessageResponse mode="static">{md}</MessageResponse>);
}

describe("render — line breaks (remark-breaks)", () => {
	it("renders a single newline as a visible line break", () => {
		const html = render("line one\nline two");
		assert.match(html, /<br\s*\/?>/, "single \\n becomes a hard break");
	});

	it("keeps single newlines inside code blocks as code lines (no <br>)", () => {
		const html = render("```js\nline one\nline two\n```");
		assert.ok(html.includes("code-block"), "code block renders");
		assert.ok(!html.includes("<br"), "code blocks have no injected breaks");
	});

	it("keeps lists as lists (no break-collapse)", () => {
		const html = render("- alpha\n- beta");
		const items = html.match(/data-streamdown="list-item"/g) ?? [];
		assert.equal(items.length, 2, "two list items");
		assert.ok(!html.includes("<br"), "list lines are not breaks");
	});

	it("keeps GFM tables intact (remark-breaks did not replace the defaults)", () => {
		const html = render("| a | b |\n|---|---|\n| 1 | 2 |");
		assert.ok(html.includes("<table"), "GFM table renders");
	});
});

describe("render — mermaid", () => {
	it("renders a mermaid fence as a diagram container, not a raw code block", () => {
		// SSR renders the lazy chunk's Suspense skeleton (the diagram itself
		// mounts client-side after hydration) — so assert on what must NOT
		// happen: the mermaid language must not take the code-block path, and
		// the chart source must not leak as visible code.
		const html = render("```mermaid\ngraph TD\nA --> B\n```");
		assert.ok(!html.includes('data-streamdown="code-block"'), "mermaid fences must not render as code blocks");
		assert.ok(!html.includes("graph TD"), "chart source is not leaked as text");
	});

	it("still renders ordinary code fences as code blocks (contrast)", () => {
		const html = render("```js\nconst x = 1;\n```");
		assert.ok(html.includes('data-streamdown="code-block"'), "js fences keep the code-block path");
	});

	it("renders the error fallback for invalid mermaid: error + source + retry", () => {
		// The fallback component mounts client-side when mermaid fails to
		// parse; render it directly to pin its contract.
		const html = renderToStaticMarkup(
			<MermaidError
				chart={"not a diagram @@@\nA --> B"}
				error="Parse error on line 1: unexpected text"
				retry={() => {}}
			/>,
		);
		assert.match(html, /Diagram failed to render/);
		assert.match(html, /Parse error on line 1/);
		assert.match(html, /Show diagram source/);
		assert.match(html, /not a diagram/);
		assert.match(html, />Retry</);
	});
});

describe("render — bold is the real <strong> (the dead Bold-color fix)", () => {
	// Streamdown's default `strong` renders <span class="font-semibold"
	// data-streamdown="strong"> — and the app's ink token rule
	// (.lanna-prose :where(strong, b), globals.css) matches strong/b
	// ELEMENTS, so bold never took the --lanna-ink-strong color (neither the
	// factory #ee928c nor a settings boldColor). The mdComponents override
	// renders the semantic element.
	it("bold renders a real <strong> element inside .lanna-prose", () => {
		const html = render("plain **bold** plain");
		assert.ok(
			html.includes('<strong data-streamdown="strong">bold</strong>'),
			"bold renders as a semantic strong element",
		);
		assert.ok(html.includes("lanna-prose"), "the markdown surface carries .lanna-prose (the token rule's anchor)");
	});

	it("no span-for-bold regression: the font-semibold span is gone", () => {
		const html = render("plain **bold** plain");
		assert.ok(!html.includes('class="font-semibold"'), "streamdown's span/600 default must not render bold");
	});

	it("italic stays native <em> (the case that always worked)", () => {
		const html = render("plain *emph* plain");
		assert.ok(html.includes("<em>"), "italic renders a native em element");
	});
});

// ─── escaped dollars inside math (owner, 2026-10-12) ────────────────────────
//
// micromark's mathText closer is code-span logic — ANY size-matched `$` run
// closes, `\$` included — so `$x = \$5$` closed at the escape and errored.
// KaTeX itself renders `\$` fine (and its own auto-render scanner skips
// escaped dollars). The fix normalizes at the render seam: inside balanced
// inline spans, `\$` becomes the dollar-free `\text{\textdollar}` BEFORE
// tokenization, so the scanner's closer is the one the author meant.
