import assert from "node:assert/strict";
import { test } from "node:test";
import { bump, chooseVersion, composeNotes, learnerChange, mergedPrs } from "../scripts/release-publish.ts";
import { expectedAssets, verifyAssets, type ReleaseRecord } from "../scripts/verify-release.ts";

test("the next version is above the published release, not above a stale main", () => {
	assert.equal(chooseVersion("0.1.0", "0.1.2", undefined), "0.1.3");
	assert.equal(chooseVersion("0.1.2", "0.1.2", undefined), "0.1.3");
	assert.equal(chooseVersion("0.1.2", "0.1.2", "minor"), "0.2.0");
	assert.equal(chooseVersion("0.1.2", "0.1.2", "major"), "1.0.0");
	assert.equal(chooseVersion("0.1.0", null, undefined), "0.1.0");
	assert.equal(bump("0.9.9", "patch"), "0.9.10");
});

test("a bump already on main is released as it is", () => {
	assert.equal(chooseVersion("0.2.0", "0.1.2", undefined), "0.2.0");
});

test("an explicit version must be higher than the published release", () => {
	assert.equal(chooseVersion("0.1.2", "0.1.2", "0.3.0"), "0.3.0");
	assert.throws(() => chooseVersion("0.1.2", "0.1.2", "0.1.2"), /not higher/);
	assert.throws(() => chooseVersion("0.1.2", "0.1.2", "huge"), /Unknown version/);
});

test("a Windows and Linux release is complete without the macOS files, and refuses stray ones", () => {
	const expected = expectedAssets("0.1.3", ["win", "linux"]);
	assert.equal(expected.files.length, 6);
	const asset = (name: string, id: number) => ({ id, name, size: 10, state: "uploaded" });
	const release: ReleaseRecord = {
		id: 1,
		tag_name: "v0.1.3",
		draft: true,
		assets: expected.files.map(asset),
	};
	assert.equal(verifyAssets(release, expected).ok, true);
	release.assets.push(asset("Lanna-0.1.3-arm64.dmg", 99));
	assert.equal(verifyAssets(release, expected).ok, false);
	assert.equal(expectedAssets("0.1.3").files.length, 11);
});

test("release notes come from merge commits whose work has not shipped", () => {
	const log = [
		"aaa\tp1 h1\tMerge pull request #5 from Xurify/feat/port",
		"bbb\tp2\tSettings search: drop the / shortcut",
		"ccc\tp3\tFix the timer (#7)",
	].join("\n");
	assert.deepEqual(mergedPrs(log), [
		{ number: 5, sha: "aaa", base: "p1", head: "h1" },
		{ number: 7, sha: "ccc", base: "p3", head: "ccc" },
	]);
});

test("the learner section's first paragraph is the change; 'Nothing' marks an internal PR", () => {
	const body = [
		"## What changes for the learner",
		"",
		"<!-- template hint -->",
		"Settings has search.",
		"Second line.",
		"",
		"More detail.",
		"",
		"## Screenshots",
	].join("\n");
	assert.equal(learnerChange(body), "Settings has search.\nSecond line.");
	assert.equal(learnerChange("## What changes for the learner\n\nNothing in the app. Builds check themselves."), null);
	assert.equal(learnerChange("No template here."), null);
	const introducesList = "## What changes for the learner\n\nSettings now says:\n\n- one\n- two\n\nMore.";
	assert.equal(learnerChange(introducesList), "Settings now says:\n- one\n- two");
});

test("notes list learner changes first, internal PRs under the hood", () => {
	const notes = composeNotes([
		{ number: 3, title: "Settings: grouped list and search", change: "Settings has search.\nSecond line." },
		{ number: 6, title: "Add bun run release:publish", change: null },
	]);
	assert.equal(
		notes,
		[
			"## What's new",
			"",
			"- **Settings: grouped list and search.** Settings has search.",
			"  Second line. (#3)",
			"",
			"## Under the hood",
			"",
			"- Add bun run release:publish (#6)",
			"",
		].join("\n"),
	);
	assert.equal(composeNotes([]), "Maintenance release.\n");
});
