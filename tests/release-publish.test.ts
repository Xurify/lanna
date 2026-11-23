import assert from "node:assert/strict";
import { test } from "node:test";
import { bump, chooseVersion } from "../scripts/release-publish.ts";
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
