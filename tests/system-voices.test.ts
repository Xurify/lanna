import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { systemVoiceStatus } from "../components/settings/system-voices.tsx";

const PC_VOICES = [
	{ lang: "en-US", name: "Microsoft David - English (United States)" },
	{ lang: "ru-RU", name: "Microsoft Irina - Russian (Russia)" },
	{ lang: "ru-RU", name: "Microsoft Pavel - Russian (Russia)" },
	{ lang: "sk-SK", name: "Microsoft Filip - Slovak (Slovakia)" },
];

describe("systemVoiceStatus", () => {
	it("names the installed voices for a language", () => {
		assert.deepEqual(systemVoiceStatus("sk", PC_VOICES), { kind: "installed", names: ["Filip"] });
		assert.deepEqual(systemVoiceStatus("ru", PC_VOICES), { kind: "installed", names: ["Irina", "Pavel"] });
	});

	it("offers Windows when Windows has a voice for a missing language", () => {
		assert.deepEqual(systemVoiceStatus("pl", PC_VOICES), { kind: "missing", windowsHasOne: true });
	});

	it("says Windows has none for Estonian", () => {
		assert.deepEqual(systemVoiceStatus("et", PC_VOICES), { kind: "missing", windowsHasOne: false });
	});

	it("matches a voice whose tag is lowercase or has no region", () => {
		assert.equal(systemVoiceStatus("sk", [{ lang: "sk", name: "Laura" }]).kind, "installed");
		assert.equal(systemVoiceStatus("sk", [{ lang: "SK-sk", name: "Laura" }]).kind, "installed");
	});
});
