import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { SvgImage, svgImageSource } from "../components/artifacts/svg-image.tsx";
import { MermaidOverlay } from "../components/session-overlay.tsx";

// Structure-only checks: linkedom does not load images or implement CSS cascade.
// No fixture script, link, or external reference is executed by these tests.
const FIGURE = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160"><style>text{font-family:Arial,Helvetica,sans-serif;fill:#202830}</style><defs><marker id="arrow"><path d="M0 0L5 5"/></marker></defs><path marker-end="url(#arrow)" d="M0 0L20 20"/><text>θ &amp; φ: 50% #1</text></svg>`;
const ACTIVE_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="example()"><script>example()</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" onclick="example()">Example</div></foreignObject><a href="javascript:example()"><text>Link</text></a><image href="https://example.invalid/image.png"/></svg>`;
const PREFIX = "data:image/svg+xml;charset=utf-8,";

function assertImageBoundary(holder: Element, source: string) {
	const image = holder.querySelector("img");
	assert.ok(image, "figure is an image");
	assert.equal(holder.children.length, 1, "no figure markup alongside the image");
	assert.equal(
		holder.querySelector("svg, style, script, foreignObject, a, [onload], [onclick]"),
		null,
		"generated elements and CSS never enter the app document",
	);
	assert.equal(image.getAttribute("alt"), "Figure");
	assert.equal(image.getAttribute("draggable"), "false", "native image dragging must not interfere with panning");
	const src = image.getAttribute("src")!;
	assert.ok(src.startsWith(PREFIX));
	assert.equal(
		decodeURIComponent(src.slice(PREFIX.length)),
		source,
		"image URL contains the expected SVG display source, not a raster",
	);
	return image;
}

describe("SVG display compatibility", () => {
	it("leaves standalone SVG unchanged, including comments and CDATA", () => {
		const source = FIGURE.replace("</svg>", "<!-- &nbsp; <svg> --><![CDATA[&nbsp; <svg>]]></svg>");
		assert.equal(svgImageSource(source), source);
	});

	it("adds only a missing root namespace, ignoring comments and attribute values", () => {
		const source =
			'<?xml version="1.0"?><!-- <svg xmlns="wrong"> --><svg data-note=\' xmlns="not-a-declaration" >\' xmlns:xlink="http://www.w3.org/1999/xlink"><svg/></svg>';
		const expected = source.replace("<svg data-note=", '<svg xmlns="http://www.w3.org/2000/svg" data-note=');
		assert.equal(svgImageSource(source), expected);
		assert.equal(svgImageSource(expected), expected, "normalization is idempotent");
	});

	it("does not replace an explicit namespace declaration", () => {
		for (const declaration of ['xmlns="http://www.w3.org/2000/svg"', "xmlns = 'other'", 'xmlns=""']) {
			const source = `<svg ${declaration}><text>Example</text></svg>`;
			assert.equal(svgImageSource(source), source);
		}
	});

	it("converts nbsp references in text and attributes, but not comments, CDATA or processing instructions", () => {
		const source =
			'<?example &nbsp;?><svg xmlns="http://www.w3.org/2000/svg" aria-label="A&nbsp;B"><text>A&nbsp;B &amp;nbsp; &#160;</text><!-- &nbsp; --><![CDATA[&nbsp;]]></svg>';
		const expected = source
			.replace('aria-label="A&nbsp;B"', 'aria-label="A&#160;B"')
			.replace("<text>A&nbsp;B", "<text>A&#160;B");
		assert.equal(svgImageSource(source), expected);
		assert.equal(svgImageSource(expected), expected);
	});
});

describe("generated SVG image boundary", () => {
	const inline = (svg: string, width?: number) =>
		parseHTML(
			renderToStaticMarkup(
				<div>
					<SvgImage svg={svg} width={width} />
				</div>,
			),
		).document.querySelector("div")!;

	for (const [name, source] of [
		["reported style rule and fragment IDs", FIGURE],
		["active markup", ACTIVE_MARKUP],
	] as const) {
		it(`inline: isolates ${name} inside the image URL`, () => {
			assertImageBoundary(inline(source), source);
		});
	}

	for (const [name, original, display] of [
		[
			"missing namespace",
			'<svg width="320" height="160"><text>Example</text></svg>',
			'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><text>Example</text></svg>',
		],
		[
			"HTML entity",
			'<svg xmlns="http://www.w3.org/2000/svg"><text>A&nbsp;B</text></svg>',
			'<svg xmlns="http://www.w3.org/2000/svg"><text>A&#160;B</text></svg>',
		],
	] as const) {
		it(`inline: repairs ${name} only in the image source`, () => {
			assertImageBoundary(inline(original), display);
		});
	}

	it("inline: the image keeps the width it is given", () => {
		assert.equal(assertImageBoundary(inline(FIGURE, 320), FIGURE).getAttribute("width"), "320");
	});

	for (const [name, source] of [
		["reported style rule and fragment IDs", FIGURE],
		["active markup", ACTIVE_MARKUP],
	] as const) {
		it(`fullscreen: isolates ${name} inside the image URL`, () => {
			const { document } = parseHTML(renderToStaticMarkup(<MermaidOverlay svg={source} onClose={() => {}} />));
			const holder = document.querySelector("[data-lanna-overlay-chart]")!;
			assertImageBoundary(holder, source);
			assert.ok(holder.classList.contains("bg-white"), "white backing retained");
		});
	}

	for (const [name, original, display] of [
		[
			"missing namespace",
			'<svg width="320" height="160"><text>Example</text></svg>',
			'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><text>Example</text></svg>',
		],
		[
			"HTML entity",
			'<svg xmlns="http://www.w3.org/2000/svg"><text>A&nbsp;B</text></svg>',
			'<svg xmlns="http://www.w3.org/2000/svg"><text>A&#160;B</text></svg>',
		],
	] as const) {
		it(`fullscreen: repairs ${name} only in the image source`, () => {
			const html = renderToStaticMarkup(<MermaidOverlay svg={original} onClose={() => {}} />);
			const { document } = parseHTML(html);
			assertImageBoundary(document.querySelector("[data-lanna-overlay-chart]")!, display);
		});
	}

	it("fullscreen: retains inversion on the white backing", () => {
		const { document } = parseHTML(renderToStaticMarkup(<MermaidOverlay svg={FIGURE} inverted onClose={() => {}} />));
		const holder = document.querySelector("[data-lanna-overlay-chart]")!;
		assert.match(holder.getAttribute("style")!, /invert\(1\) hue-rotate\(180deg\)/);
		assert.ok(holder.classList.contains("bg-white"));
		assertImageBoundary(holder, FIGURE);
	});

	it("fullscreen: keeps the natural-size box and zoom controls", () => {
		const { document } = parseHTML(renderToStaticMarkup(<MermaidOverlay svg={FIGURE} onClose={() => {}} />));
		const holder = document.querySelector("[data-lanna-overlay-chart]")!;
		assert.equal(assertImageBoundary(holder, FIGURE).className, "block h-auto w-full");
		assert.match(holder.parentElement!.getAttribute("style")!, /width:320px/);
		for (const label of ["Zoom in", "Zoom out", "Fit diagram to view", "Close"]) {
			assert.ok(document.querySelector(`button[aria-label="${label}"]`));
		}
	});
});
