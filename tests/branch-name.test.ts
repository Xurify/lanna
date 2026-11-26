import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateBranchName } from "../scripts/branch-name.mjs";

describe("validateBranchName", () => {
	it("accepts descriptive <type>/<kebab-case-slug> branches", () => {
		for (const branch of [
			"feat/mobile-language-picker",
			"fix/letter-bar-closed",
			"docs/branch-naming",
			"refactor/settings-revamp",
			"chore/update-deps",
			"test/audio-smoke",
			"perf/fast-typecheck",
			"ci/hook-check",
			"build/electron-notary",
			"style/drawer-spacing",
		]) {
			assert.deepEqual(validateBranchName(branch), { ok: true }, branch);
		}
	});

	it("rejects generated tool prefixes and suggests renaming", () => {
		const t3 = validateBranchName("t3/mobile-language-picker-ux");
		assert.equal(t3.ok, false);
		assert.match(t3.reason ?? "", /git branch -m feat\/mobile-language-picker-ux/);

		const hexT3 = validateBranchName("t3/28c3fa85");
		assert.equal(hexT3.ok, false);
		assert.match(hexT3.reason ?? "", /git branch -m feat\/<short-slug>/);

		assert.equal(validateBranchName("freebuff/repeated-questions").ok, false);
		assert.equal(validateBranchName("claude/fix-thing").ok, false);
		assert.equal(validateBranchName("codex/experiment").ok, false);
	});

	it("rejects malformed, uppercase, underscored, or non-descriptive slugs", () => {
		for (const branch of [
			"",
			"mobile-language-picker",
			"feature/mobile-language-picker",
			"feat/Mobile-Picker",
			"feat/mobile_picker",
			"feat/ab",
			"feat/28c3fa85",
			"feat/",
		]) {
			assert.equal(validateBranchName(branch).ok, false, branch);
		}
	});

	it("blocks main by default and allows it only with allowMain", () => {
		assert.equal(validateBranchName("main").ok, false);
		assert.deepEqual(validateBranchName("main", { allowMain: true }), { ok: true });
	});
});
