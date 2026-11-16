/**
 * RESET PINS: starting over moves the profile's data into data/backups/
 * (nothing deleted), leaves a fresh empty profile, and keeps what lives
 * outside the profile (settings, audio cache).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, it } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-reset-"));
process.env.LANNA_DATA_DIR = TMP;
process.env.LANNA_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const { resetProfileData, dataLocations } = await import("../src/server/reset.ts");

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

it("moves the profile into a backup and leaves a fresh one; shared files stay", () => {
	fs.mkdirSync(path.join(PATHS.data, "chats"), { recursive: true });
	fs.writeFileSync(path.join(PATHS.data, "progress.json"), '{"xp":835}');
	fs.writeFileSync(path.join(PATHS.base, "settings.json"), "{}");

	const out = resetProfileData(new Date("2026-10-30T10:00:00Z"));

	assert.equal(out.profile, "slovak");
	assert.equal(fs.readFileSync(path.join(out.backup, "progress.json"), "utf-8"), '{"xp":835}');
	assert.ok(fs.existsSync(path.join(out.backup, "chats")));
	assert.deepEqual(fs.readdirSync(PATHS.data), []);
	assert.ok(fs.existsSync(path.join(PATHS.base, "settings.json")));
});

it("reports where the data and the backups are, and how many backups exist", () => {
	const where = dataLocations();
	assert.equal(where.data, PATHS.data);
	assert.equal(where.backups, path.join(PATHS.base, "backups"));
	assert.equal(where.backupCount, fs.readdirSync(where.backups).length);
});

it("resetting an already-empty profile works and makes its own backup", () => {
	const out = resetProfileData(new Date("2026-10-30T11:00:00Z"));
	assert.ok(fs.existsSync(out.backup));
});
