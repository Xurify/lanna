import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUsableServerPort, sanitizeUserSettings } from "../src/core/settings.ts";
import { parseDevicesSettingsBody, SETTINGS_SECTIONS } from "../src/server/settings-body.ts";

describe("the preferred port setting", () => {
	it("is a settings section of its own", () => {
		assert.equal(SETTINGS_SECTIONS.devices, parseDevicesSettingsBody);
	});

	it("takes a saved port", () => {
		const parsed = parseDevicesSettingsBody({ preferredPort: 4100 });
		assert.deepEqual(parsed, { ok: true, settings: { preferredPort: 4100 } });
	});

	it("clears back to the factory port on an empty or null value", () => {
		assert.deepEqual(parseDevicesSettingsBody({}), { ok: true, settings: {} });
		assert.deepEqual(parseDevicesSettingsBody({ preferredPort: null }), { ok: true, settings: {} });
	});

	it("refuses what the shell would refuse", () => {
		for (const value of [80, 0, 65536, 3010.5, "4000", Number.NaN, 1455]) {
			const parsed = parseDevicesSettingsBody({ preferredPort: value });
			assert.equal(parsed.ok, false, `${String(value)} must be refused`);
		}
	});

	it("drops keys it does not know", () => {
		assert.deepEqual(parseDevicesSettingsBody({ preferredPort: 4100, extra: true }), {
			ok: true,
			settings: { preferredPort: 4100 },
		});
	});

	it("survives a round trip through the record sanitizer", () => {
		const record = sanitizeUserSettings({ version: 1, devices: { preferredPort: 4100 } });
		assert.equal(record?.devices?.preferredPort, 4100);
		const fossil = sanitizeUserSettings({ version: 1, devices: { preferredPort: 1455, junk: 1 } });
		assert.deepEqual(fossil?.devices, {});
	});

	it("holds the same rule both sides of the file", () => {
		assert.equal(isUsableServerPort(4100), true);
		assert.equal(isUsableServerPort(1455), false);
		assert.equal(isUsableServerPort(65535), true);
	});
});
