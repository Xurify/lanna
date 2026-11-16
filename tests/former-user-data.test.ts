import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { adoptFormerUserData } = require("../electron/former-user-data.cjs") as {
	adoptFormerUserData: (userData: string, name: string) => string;
};

function scratch() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "former-user-data-"));
}

test("moves the LangHarness folder to Lanna with its contents", () => {
	const root = scratch();
	fs.mkdirSync(path.join(root, "LangHarness", "data"), { recursive: true });
	fs.writeFileSync(path.join(root, "LangHarness", "auth.json"), "{}");
	const target = path.join(root, "Lanna");
	assert.equal(adoptFormerUserData(target, "Lanna"), target);
	assert.ok(fs.existsSync(path.join(target, "auth.json")));
	assert.ok(fs.existsSync(path.join(target, "data")));
	assert.ok(!fs.existsSync(path.join(root, "LangHarness")));
});

test("the dev folder moves to the dev folder", () => {
	const root = scratch();
	fs.mkdirSync(path.join(root, "LangHarness-dev"));
	fs.mkdirSync(path.join(root, "LangHarness"));
	const target = path.join(root, "Lanna-dev");
	assert.equal(adoptFormerUserData(target, "Lanna"), target);
	assert.ok(fs.existsSync(target));
	assert.ok(fs.existsSync(path.join(root, "LangHarness")), "the packaged app's folder stays");
});

test("an existing Lanna folder is never overwritten", () => {
	const root = scratch();
	fs.mkdirSync(path.join(root, "LangHarness"));
	fs.mkdirSync(path.join(root, "Lanna"));
	fs.writeFileSync(path.join(root, "Lanna", "auth.json"), "new");
	const target = path.join(root, "Lanna");
	assert.equal(adoptFormerUserData(target, "Lanna"), target);
	assert.equal(fs.readFileSync(path.join(target, "auth.json"), "utf8"), "new");
	assert.ok(fs.existsSync(path.join(root, "LangHarness")));
});

test("a first install with no former folder changes nothing", () => {
	const root = scratch();
	const target = path.join(root, "Lanna");
	assert.equal(adoptFormerUserData(target, "Lanna"), target);
	assert.ok(!fs.existsSync(target));
});
