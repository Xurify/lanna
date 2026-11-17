import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

for (const name of ["TAVILY_API_KEY", "BRAVE_API_KEY", "DEEPL_API_KEY", "LANNA_IGNORE_ENV_KEYS"])
	delete process.env[name];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-key-disable-"));
const AUTH = path.join(TMP, "auth.json");
process.env.LANNA_AUTH_FILE = AUTH;

const FILE_KEY = "tvly-filekey0000000000";
const ENV_KEY = "b".repeat(32);
fs.writeFileSync(AUTH, JSON.stringify({ TAVILY_API_KEY: FILE_KEY }));
process.env.BRAVE_API_KEY = ENV_KEY;

const { deleteKey, initAuthEnv, keyStatuses, keyValue, saveKey, setKeyEnabled } = await import("../src/server/keys.ts");
const { authStore } = await import("../src/store/auth.ts");

const row = (id: string) => keyStatuses().find((s) => s.id === id)!;

after(() => {
	delete process.env.BRAVE_API_KEY;
	delete process.env.TAVILY_API_KEY;
	delete process.env.DEEPL_API_KEY;
	fs.rmSync(TMP, { recursive: true, force: true });
});

describe("switching a saved key off and on", () => {
	it("off: the value stays in the file but leaves env and keyValue", () => {
		setKeyEnabled("TAVILY_API_KEY", false);
		assert.equal(process.env.TAVILY_API_KEY, undefined);
		assert.equal(keyValue("TAVILY_API_KEY"), undefined);
		assert.equal(authStore.authVars().TAVILY_API_KEY, FILE_KEY);
		assert.equal(row("TAVILY_API_KEY").present, true);
		assert.equal(row("TAVILY_API_KEY").disabled, true);
	});

	it("stays off across a re-run of the boot fill-gap", () => {
		initAuthEnv();
		assert.equal(process.env.TAVILY_API_KEY, undefined);
	});

	it("on: the file value is back in env", () => {
		setKeyEnabled("TAVILY_API_KEY", true);
		assert.equal(process.env.TAVILY_API_KEY, FILE_KEY);
		assert.equal(keyValue("TAVILY_API_KEY"), FILE_KEY);
		assert.equal(row("TAVILY_API_KEY").disabled, false);
	});
});

describe("an environment key", () => {
	it("can be switched off, still shows as stored, and comes back with its env value", () => {
		setKeyEnabled("BRAVE_API_KEY", false);
		assert.equal(process.env.BRAVE_API_KEY, undefined);
		assert.equal(keyValue("BRAVE_API_KEY"), undefined);
		assert.equal(row("BRAVE_API_KEY").present, true);
		assert.equal(row("BRAVE_API_KEY").source, "env");
		assert.equal(row("BRAVE_API_KEY").disabled, true);

		setKeyEnabled("BRAVE_API_KEY", true);
		assert.equal(process.env.BRAVE_API_KEY, ENV_KEY);
		assert.equal(row("BRAVE_API_KEY").disabled, false);
	});
});

describe("saving and deleting a switched-off key", () => {
	it("saving a new value switches it back on", () => {
		saveKey("DEEPL_API_KEY", "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0:fx");
		setKeyEnabled("DEEPL_API_KEY", false);
		const fresh = "1f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0:fx";
		saveKey("DEEPL_API_KEY", fresh);
		assert.equal(keyValue("DEEPL_API_KEY"), fresh);
		assert.equal(row("DEEPL_API_KEY").disabled, false);
	});

	it("deleting it clears the off mark, so a later save is on", () => {
		setKeyEnabled("DEEPL_API_KEY", false);
		deleteKey("DEEPL_API_KEY");
		assert.equal(row("DEEPL_API_KEY").present, false);
		assert.equal(row("DEEPL_API_KEY").disabled, false);
		assert.equal(process.env.DEEPL_API_KEY, undefined);
	});
});
