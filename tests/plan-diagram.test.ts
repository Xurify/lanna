import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderPlan, wrapTitle } from "../components/plan-diagram.ts";

const nodes = [
	{ id: "limits", title: "Limits" },
	{ id: "chain", title: "Chain rule" },
	{ id: "implicit", title: "Implicit differentiation" },
];
const edges = [
	{ from: "limits", to: "chain" },
	{ from: "chain", to: "implicit" },
	{ from: "chain", to: "ghost" },
];
const statuses: Record<string, "visited" | "current" | "upcoming"> = {
	limits: "visited",
	chain: "current",
	implicit: "upcoming",
};
const statusOf = (id: string) => statuses[id] ?? "upcoming";
const opts = { monochrome: false, pad: 8, idPrefix: "t" };

describe("plan diagram", () => {
	it("wraps long titles at word boundaries and chunks oversized words", () => {
		assert.deepEqual(wrapTitle("Implicit differentiation"), ["Implicit differentiation"]);
		assert.deepEqual(wrapTitle("alpha beta", 6), ["alpha", "beta"]);
		assert.deepEqual(wrapTitle("abcdefgh", 3), ["abc", "def", "gh"]);
		assert.deepEqual(wrapTitle("   "), [""]);
	});

	it("returns null when there is no node to draw", () => {
		assert.equal(renderPlan([], [], statusOf, opts), null);
	});

	it("draws every node with its status class and skips dangling edges", () => {
		const out = renderPlan(nodes, edges, statusOf, opts);
		assert.ok(out);
		assert.ok(out.width > 0 && out.height > 0);
		assert.match(out.svg, /class="pele-node pele-shape-rect visited"/);
		assert.match(out.svg, /class="pele-node pele-shape-rect current"/);
		assert.match(out.svg, /class="pele-node pele-shape-rect upcoming"/);
		assert.equal((out.svg.match(/class="pele-edge(?: dim)?"/g) ?? []).length, 2, "the ghost edge is dropped");
	});

	it("grays an arrow when either end is upcoming, and keeps visited-to-current white", () => {
		const out = renderPlan(nodes, edges, statusOf, opts);
		assert.ok(out);
		assert.equal((out.svg.match(/class="pele-edge dim"/g) ?? []).length, 1);
		assert.match(out.svg, /class="pele-edge dim" data-id="L_p1_p2_0"/);
		assert.match(out.svg, /class="pele-edge" data-id="L_p0_p1_0"/);
	});

	it("leaves every node and arrow unstyled in the monochrome chat block", () => {
		const out = renderPlan(nodes, edges, statusOf, { ...opts, monochrome: true });
		assert.ok(out);
		assert.ok(!/pele-node pele-shape-rect (visited|current|upcoming)/.test(out.svg));
		assert.ok(!out.svg.includes("pele-edge dim"));
	});

	it("keeps quotes, hashes and angle brackets in titles as text", () => {
		const tricky = [{ id: "a", title: 'Say "hi" #1 <tag>' }];
		const out = renderPlan(tricky, [], () => "upcoming", opts);
		assert.ok(out);
		assert.match(out.svg, /Say &quot;hi&quot; #1 &lt;tag&gt;|Say "hi" #1 <tag>/);
	});
});
