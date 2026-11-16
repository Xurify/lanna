/**
 * The skill sync (scripts/sync-slovak-skill.ts): slovak.wiki is the source
 * of truth, and an edit made only in this copy is never silently undone.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planSkillSync, recordCommit } from "../scripts/sync-slovak-skill.ts";

const files = (o: Record<string, string>) => new Map(Object.entries(o));

describe("planning a skill sync", () => {
	it("updates what changed only upstream, adds and removes what upstream did", () => {
		const recorded = files({ "SKILL.md": "v1", "references/a.md": "a1", "references/old.md": "x" });
		const local = files({ "SKILL.md": "v1", "references/a.md": "a1", "references/old.md": "x", "SOURCE.md": "ours" });
		const incoming = files({ "SKILL.md": "v2", "references/a.md": "a1", "references/new.md": "n" });
		assert.deepEqual(planSkillSync(local, recorded, incoming), {
			add: ["references/new.md"],
			update: ["SKILL.md"],
			remove: ["references/old.md"],
			conflicts: [],
		});
	});

	it("calls an edit made only here a conflict, so a sync cannot undo it", () => {
		const recorded = files({ "references/numerals.md": "dvaja (m. anim.)" });
		const local = files({ "references/numerals.md": "dvaja (male persons)" });
		const incoming = files({ "references/numerals.md": "dvaja (m. anim.) and a new line" });
		assert.deepEqual(planSkillSync(local, recorded, incoming).conflicts, ["references/numerals.md"]);
	});

	it("needs nothing once the local fix has reached slovak.wiki", () => {
		const recorded = files({ "references/numerals.md": "dvaja (m. anim.)" });
		const local = files({ "references/numerals.md": "dvaja (male persons)" });
		const incoming = files({ "references/numerals.md": "dvaja (male persons)" });
		assert.deepEqual(planSkillSync(local, recorded, incoming), { add: [], update: [], remove: [], conflicts: [] });
	});

	it("never touches SOURCE.md, which is this repo's own", () => {
		const plan = planSkillSync(files({ "SOURCE.md": "ours" }), files({}), files({ "SOURCE.md": "theirs" }));
		assert.deepEqual(plan, { add: [], update: [], remove: [], conflicts: [] });
	});

	it("rewrites only the commit line of SOURCE.md", () => {
		const text = "Copied from slovak.wiki at commit `337d5fc1` (2026-10-30). Change it there first.";
		assert.equal(
			recordCommit(text, "9abc123", "2026-11-02"),
			"Copied from slovak.wiki at commit `9abc123` (2026-11-02). Change it there first.",
		);
		assert.equal(recordCommit("no line here", "9abc123", "2026-11-02"), null);
	});
});
