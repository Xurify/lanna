/** The settings nav: four headed groups in a fixed order, and the search that narrows them. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SETTINGS_SECTIONS, sectionMatches } from "../components/settings/settings-dialog.tsx";

const ids = (query: string) => SETTINGS_SECTIONS.filter((s) => sectionMatches(s, query)).map((s) => s.id);

describe("settings nav", () => {
	it("lists lesson settings first and the app's own settings last, each group in one run", () => {
		const groups = SETTINGS_SECTIONS.map((s) => s.group);
		assert.deepEqual([...new Set(groups)], ["Lessons", "Look and controls", "AI", "App and data"]);
		const runs = groups.filter((g, i) => i === 0 || groups[i - 1] !== g);
		assert.equal(runs.length, 4);
		assert.equal(SETTINGS_SECTIONS[0]?.id, "learner");
	});

	it("keeps all thirteen sections", () => {
		assert.equal(SETTINGS_SECTIONS.length, 13);
	});

	it("matches a label, a group or a keyword, and every word must match", () => {
		assert.deepEqual(
			ids(""),
			SETTINGS_SECTIONS.map((s) => s.id),
		);
		assert.deepEqual(ids("theme"), ["appearance"]);
		assert.deepEqual(ids("Tailscale"), ["devices"]);
		assert.ok(ids("api key").includes("keys"));
		assert.deepEqual(ids("volume night"), []);
	});
});
