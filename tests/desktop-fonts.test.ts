/**
 * Settings → Appearance → Reading font, desktop side: the installed families
 * come from the OS in the main process (Electron 44's queryLocalFonts is
 * empty), only for the app's own window, and only names reach the page.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeEach, describe, it } from "node:test";

const require = createRequire(import.meta.url);
const fonts = require("../electron/fonts-ipc.cjs");

type Run = (file: string, args: string[], opts: object, cb: (err: Error | null, stdout: string) => void) => void;
const fake = (
	stdout: string,
	err: Error | null = null,
): { run: Run; calls: Array<{ file: string; args: string[] }> } => {
	const calls: Array<{ file: string; args: string[] }> = [];
	return { calls, run: (file, args, _opts, cb) => (calls.push({ file, args }), cb(err, stdout)) };
};

describe("installed fonts", () => {
	beforeEach(() => fonts.resetFontCache?.());

	it("reads families one per line: fontconfig aliases and styles dropped, hidden faces skipped, deduped, A to Z", () => {
		const out = "Noto Sans,Noto Sans Regular\nArial\n.SF NS\n@Hidden\nGeorgia:style=Bold\n\nArial\r\nCMU Serif\n";
		assert.deepEqual(fonts.parseFontList(out), ["Arial", "CMU Serif", "Georgia", "Noto Sans"]);
	});

	it("asks the OS with a fixed command per platform, no shell", async () => {
		for (const [platform, file] of [
			["win32", "powershell.exe"],
			["darwin", "osascript"],
			["linux", "fc-list"],
		] as const) {
			fonts.resetFontCache();
			const { run, calls } = fake("Arial\n");
			assert.deepEqual(await fonts.listInstalledFonts({ platform, run }), ["Arial"]);
			assert.equal(calls[0]!.file, file);
		}
	});

	it("keeps a good answer for the run, and tries again after an empty or failed one", async () => {
		const good = fake("Arial\n");
		await fonts.listInstalledFonts({ platform: "linux", run: good.run });
		await fonts.listInstalledFonts({ platform: "linux", run: good.run });
		assert.equal(good.calls.length, 1);
		fonts.resetFontCache();
		const bad = fake("", new Error("no fc-list"));
		assert.deepEqual(await fonts.listInstalledFonts({ platform: "linux", run: bad.run }), []);
		assert.deepEqual(await fonts.listInstalledFonts({ platform: "linux", run: bad.run }), []);
		assert.equal(bad.calls.length, 2, "a failure is not remembered");
	});

	it("answers only the app's own window", async () => {
		const handlers = new Map<string, (e: unknown) => unknown>();
		const ipc = { handle: (c: string, h: (e: unknown) => unknown) => handlers.set(c, h) };
		fonts.registerFontsIPC(ipc, { trusted: () => false });
		assert.throws(() => handlers.get("lanna:fonts:list")!({}), /Untrusted/);
	});

	it("the preload forwards to that one channel", () => {
		assert.match(
			readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf-8"),
			/fonts: \{\s*list: \(\) => ipcRenderer\.invoke\("lanna:fonts:list"\)/,
		);
	});
});
