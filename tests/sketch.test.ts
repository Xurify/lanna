import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSketch, sketchValue } from "../src/core/sketch.ts";

const RIDDLED_STYLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" style="fill:none;stroke-linecap:round;stroke-linejoin:round"><text x="16" y="28" style="fill:var(--ink);font-family:var(--font-voice);font-size:18">Pointing things out</text><circle cx="30" cy="96" r="8" style="stroke:var(--graphite);stroke-width:1.3"/><path d="M102 87 L127 91 L127 123 L102 119 Z" style="fill:var(--riddle-wash);stroke:var(--ink);stroke-width:1.3"/><g text-anchor="middle" style="fill:var(--graphite);font-family:var(--font-sans);font-size:12"><text x="61" y="61">táto kniha</text></g></svg>`;

describe("parseSketch", () => {
	it("keeps a drawing written with theme tokens, and maps the tokens to the page's", () => {
		const sketch = parseSketch(RIDDLED_STYLE);
		assert.ok(sketch);
		assert.equal(sketch.viewBox, "0 0 320 120");
		assert.equal(sketch.width, 320);
		assert.equal(sketch.height, 120);
		assert.match(sketch.body, /^<g style="fill:none;stroke-linecap:round;stroke-linejoin:round">/);
		assert.match(sketch.body, /fill:var\(--sk-ink\);font-family:var\(--sk-font\);font-size:18/);
		assert.match(sketch.body, /fill:var\(--sk-wash\);stroke:var\(--sk-ink\)/);
		assert.ok(sketch.body.includes(">táto kniha</text>"));
		assert.ok(!sketch.body.includes("xmlns"));
	});

	it("drops scripts, handlers, links, images, foreign content and url() paints", () => {
		const sketch = parseSketch(
			`<svg viewBox="0 0 100 50"><script>alert(1)</script><a href="javascript:alert(1)"><text x="1" y="1">link</text></a><image href="https://x.test/a.png"/><foreignObject><div>hi</div></foreignObject><rect x="0" y="0" width="10" height="10" onclick="alert(1)" fill="url(https://x.test/p)" style="stroke:url(#a);fill:var(--ink)"/><style>*{}</style><use href="#a"/></svg>`,
		);
		assert.ok(sketch);
		assert.ok(!/script|alert|href|image|foreignObject|onclick|url\(|<style|<use|<a\b|link|hi</.test(sketch.body), sketch.body);
		assert.match(sketch.body, /<rect x="0" y="0" width="10" height="10" style="fill:var\(--sk-ink\)"\/>/);
	});

	it("reads a hard-coded color for its lightness, so it still shows in Night", () => {
		assert.equal(sketchValue("fill", "#ffffff"), "var(--sk-paper)");
		assert.equal(sketchValue("stroke", "#111"), "var(--sk-ink)");
		assert.equal(sketchValue("stroke", "#888888"), "var(--sk-graphite)");
		assert.equal(sketchValue("fill", "var(--unknown)"), "var(--sk-ink)");
		assert.equal(sketchValue("fill", "var(--mark)"), "var(--sk-mark)");
		assert.equal(sketchValue("font-family", "Comic Sans MS"), "var(--sk-font)");
	});

	it("escapes text and keeps tspans only inside text", () => {
		const sketch = parseSketch(`<svg viewBox="0 0 10 10"><text x="1" y="2">a &lt; b &amp; <tspan dx="2">č</tspan></text><tspan>loose</tspan></svg>`);
		assert.ok(sketch);
		assert.equal(sketch.body, `<g><text x="1" y="2">a &lt; b &amp; <tspan dx="2">č</tspan></text></g>`);
	});

	it("takes the title as the label and leaves it out of the body", () => {
		const sketch = parseSketch(`<svg viewBox="0 0 10 10"><title>this and that</title><line x1="0" y1="0" x2="5" y2="5"/></svg>`);
		assert.equal(sketch?.label, "this and that");
		assert.equal(sketch?.body, `<g><line x1="0" y1="0" x2="5" y2="5"/></g>`);
	});

	it("refuses a drawing with no size, one cut off before it closes, or one too large", () => {
		assert.equal(parseSketch(`<svg><line x1="0" y1="0" x2="5" y2="5"/></svg>`), null);
		assert.equal(parseSketch(`<svg viewBox="0 0 10 10"><line x1="0" y1="0" x2="5" y2="5"/>`), null);
		assert.equal(parseSketch(`<svg viewBox="0 0 10 10">${"<circle r='1'/>".repeat(401)}</svg>`), null);
		assert.equal(parseSketch("x".repeat(30_000)), null);
	});

	it("takes the size from width and height when there is no viewBox", () => {
		assert.equal(parseSketch(`<svg width="200" height="80"></svg>`)?.viewBox, "0 0 200 80");
	});

	it("drops path data and transforms that are not plain numbers and commands", () => {
		assert.equal(sketchValue("d", "M0 0 L10 10 Z"), "M0 0 L10 10 Z");
		assert.equal(sketchValue("d", "M0 0 url(x)"), null);
		assert.equal(sketchValue("transform", "translate(10 20) rotate(-3)"), "translate(10 20) rotate(-3)");
		assert.equal(sketchValue("transform", "translate(10) expression(x)"), null);
		assert.equal(sketchValue("text-anchor", "middle"), "middle");
		assert.equal(sketchValue("text-anchor", "evil"), null);
	});
});

describe("parseSketch steps and drawing", () => {
	it("keeps numbered steps with their captions, in order", () => {
		const sketch = parseSketch(
			`<svg viewBox="0 0 100 50"><g data-step="2" data-caption="Then the distance"><line x1="0" y1="0" x2="9" y2="9"/></g><g data-step="1" data-caption="First the gender &amp; noun" onclick="x"><circle cx="5" cy="5" r="2"/></g><g data-step="12"><rect x="0" y="0" width="1" height="1"/></g></svg>`,
		);
		assert.deepEqual(sketch?.steps, [
			{ step: 1, caption: "First the gender & noun" },
			{ step: 2, caption: "Then the distance" },
		]);
		assert.ok(sketch?.body.includes(`<g data-step="2">`));
		assert.ok(sketch?.body.includes(`<g data-step="1">`));
		assert.ok(!sketch?.body.includes("onclick"));
		assert.ok(sketch?.body.includes("<g><rect"), "a step past the last allowed one shows from the start");
	});

	it("draws strokes in order when asked, leaving dashed lines and the root alone", () => {
		const sketch = parseSketch(`<svg viewBox="0 0 100 50"><path d="M0 0 L5 5" style="stroke:var(--ink)"/><line x1="0" y1="0" x2="9" y2="9" stroke-dasharray="3 6"/><text x="1" y="1">a</text></svg>`, { animate: true });
		assert.ok(sketch);
		assert.match(sketch.body, /<path d="M0 0 L5 5" style="--ink-delay:0\.05s;stroke:var\(--sk-ink\)" pathLength="1" class="ink-draw"\/>/);
		assert.match(sketch.body, /<line x1="0" y1="0" x2="9" y2="9" stroke-dasharray="3 6"\/>/);
		assert.match(sketch.body, /<text x="1" y="1" style="--ink-delay:0\.15s" class="ink-fade">a<\/text>/);
		assert.equal(parseSketch(`<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>`)?.body, `<g><path d="M0 0"/></g>`);
	});

	it("closes what the drawing left open when the root closes", () => {
		assert.equal(parseSketch(`<svg viewBox="0 0 1 1"><g><path d="M0 0"/></svg>`)?.body, `<g><g><path d="M0 0"/></g></g>`);
	});
});

describe("parseSketch on hostile numbers", () => {
	it("checks long number lists and transforms in linear time", () => {
		const started = Date.now();
		assert.equal(sketchValue("points", `${"1".repeat(5000)} x`), null);
		assert.equal(sketchValue("points", `${"1.1 ".repeat(4000)}x`), null);
		assert.equal(sketchValue("transform", `${"translate(1, 1) ".repeat(2000)}!`), null);
		assert.equal(sketchValue("stroke-dasharray", `${"1,".repeat(5000)}x`), null);
		assert.ok(Date.now() - started < 500, "no catastrophic backtracking");
		assert.equal(sketchValue("points", "0,0 10,5 20 10"), "0,0 10,5 20 10");
		assert.equal(sketchValue("transform", "translate(10 20), rotate(-3)"), "translate(10 20), rotate(-3)");
		assert.equal(sketchValue("transform", "translate(1) url(x)"), null);
	});
});
