import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { areaLabel, buildRulesMap, searchRules, splitBridge, type GraphLike } from "@/src/core/rules-map";

const G: GraphLike = {
	nodes: [
		{
			id: "a",
			name: "Spelling is phonetic",
			statement: "Each letter is one sound. Estonian bridge: Same as Estonian.",
		},
		{ id: "b", name: "Dĺžeň: long vowels", statement: "The dĺžeň marks a long vowel and length changes meaning." },
		{ id: "c", name: "Nominative", statement: "The case of the subject." },
		{ id: "d", name: "My own note", statement: "Something I wrote down." },
	],
	nodeSessions: { a: ["s1"], b: ["s1"], c: ["s2"] },
	fileSources: { s1: "Slovak curriculum: phonetics", s2: "Slovak curriculum: cases" },
	impLinks: [{ id: "i1", premises: ["a"], conclusion: "b" }],
};

describe("the learner's map of rules", () => {
	it("groups rules by area in the curriculum's order, with the learner's own notes last", () => {
		const areas = buildRulesMap(G);
		assert.deepEqual(
			areas.map((a) => a.label),
			["Phonetics", "Cases", "Your notes"],
		);
		assert.equal(areas[0]!.rules.length, 2);
	});

	it("leaves out the graph's link nodes (named with an arrow), which are not rules to read", () => {
		const g: GraphLike = {
			...G,
			nodes: [...G.nodes, { id: "i1", name: "⟹", statement: "Spelling is phonetic → Dĺžeň: long vowels" }],
		};
		const all = buildRulesMap(g).flatMap((a) => a.rules.map((r) => r.id));
		assert.ok(!all.includes("i1"));
		assert.equal(all.length, 4);
	});

	it("shows what a rule builds on, and none of the graph's machinery", () => {
		const b = buildRulesMap(G)[0]!.rules.find((r) => r.id === "b")!;
		assert.deepEqual(b.buildsOn, [{ id: "a", name: "Spelling is phonetic" }]);
	});

	it("keeps the native-language bridge apart from the rule", () => {
		assert.deepEqual(splitBridge("Each letter is one sound. Estonian bridge: Same as Estonian."), {
			statement: "Each letter is one sound.",
			bridge: "Same as Estonian.",
		});
		assert.deepEqual(splitBridge("No bridge here."), { statement: "No bridge here." });
	});

	it("area labels drop the course prefix", () => {
		assert.equal(areaLabel("Slovak curriculum: cases"), "Cases");
		assert.equal(areaLabel(""), "Your notes");
	});

	it("search ranks a name start before a mention in the text, and a one-letter search is names only", () => {
		const areas = buildRulesMap(G);
		const hits = searchRules(areas, "long").flatMap((r) => r.hits.map((h) => h.rule.id));
		assert.deepEqual(hits, ["b"]);
		assert.deepEqual(
			searchRules(areas, "n").flatMap((r) => r.hits.map((h) => h.rule.id)),
			["c"],
		);
		assert.deepEqual(
			searchRules(areas, "s").flatMap((r) => r.hits.map((h) => h.rule.id)),
			["a"],
		);
		assert.equal(searchRules(areas, "zzz").length, 0);
	});

	it("accents are optional in the search", () => {
		const areas = buildRulesMap(G);
		assert.deepEqual(
			searchRules(areas, "dlzen").flatMap((r) => r.hits.map((h) => h.rule.id)),
			["b"],
		);
	});

	it("an empty search lists everything", () => {
		assert.equal(
			searchRules(buildRulesMap(G), "").reduce((n, r) => n + r.hits.length, 0),
			4,
		);
	});
});
