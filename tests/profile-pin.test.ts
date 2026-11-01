/**
 * The active profile is fixed at boot. `next dev` evaluates config.ts more
 * than once in one process, so a profile.json saved after boot must not
 * reach a later evaluation (2026-11-01: one server ran Slovak and Russian
 * at once). A query string makes Node evaluate the module again, which is
 * what a route compile or HMR does.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-profile-pin-"));
process.env.LH_DATA_DIR = dir;
delete process.env.LH_PROFILE;

describe("boot profile pin", () => {
	it("keeps the boot profile when config.ts is evaluated again after a switch", async () => {
		fs.writeFileSync(path.join(dir, "profile.json"), JSON.stringify({ active: "slovak" }));
		const first = (await import(new URL("../config.ts?first", import.meta.url).href)) as typeof import("../config.ts");
		assert.equal(first.ACTIVE_PROFILE, "slovak");

		fs.writeFileSync(path.join(dir, "profile.json"), JSON.stringify({ active: "russian" }));
		const again = (await import(new URL("../config.ts?again", import.meta.url).href)) as typeof import("../config.ts");
		assert.equal(again.ACTIVE_PROFILE, "slovak");
		assert.equal(again.PATHS.data, path.join(dir, "profiles", "slovak"));
	});

	it("still reports the saved switch as waiting for a restart", async () => {
		const { profileStatus } = await import("../src/server/language.ts");
		const status = profileStatus();
		assert.equal(status.active, "slovak");
		assert.equal(status.selected, "russian");
		assert.equal(status.restartRequired, true);
	});
});
