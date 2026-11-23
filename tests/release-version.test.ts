import assert from "node:assert/strict";
import { test } from "node:test";
import { compareVersions, judgeVersion, nextPatch } from "../scripts/release-version.mjs";

test("versions compare numerically, and a prerelease sorts before its release", () => {
	assert.ok(compareVersions("0.1.10", "0.1.9") > 0);
	assert.ok(compareVersions("0.1.1", "0.1.2") < 0);
	assert.equal(compareVersions("v0.1.2", "0.1.2"), 0);
	assert.ok(compareVersions("0.2.0-rc.1", "0.2.0") < 0);
	assert.equal(nextPatch("0.1.2"), "0.1.3");
});

test("a build older than the published release is refused", () => {
	const verdict = judgeVersion("0.1.1", "0.1.2");
	assert.equal(verdict.ok, false);
	assert.match(verdict.message, /0\.1\.3/);
	assert.match(verdict.message, /LANNA_ALLOW_OLD_VERSION/);
});

test("a local build may match the published release; a release must be newer", () => {
	assert.equal(judgeVersion("0.1.2", "0.1.2").ok, true);
	assert.equal(judgeVersion("0.1.2", "0.1.2", { release: true }).ok, false);
	assert.equal(judgeVersion("0.1.3", "0.1.2", { release: true }).ok, true);
	assert.equal(judgeVersion("0.1.0", null, { release: true }).ok, true);
});
