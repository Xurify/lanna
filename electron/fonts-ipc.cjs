"use strict";

/*
 * Settings → Appearance → Reading font (desktop). The renderer's
 * window.queryLocalFonts resolves with an empty list in Electron 44 even when
 * the user allows it, so the picker had nothing to show but a short list of
 * common families. The families come from the OS instead, asked in the main
 * process with a fixed command per platform (no shell, no input from the
 * page), deduped and sorted, and kept for the life of the app:
 *
 *   win32   System.Drawing's installed font families, through PowerShell
 *   darwin  NSFontManager's families, through osascript (JavaScript)
 *   linux   fontconfig's families (fc-list)
 *
 * An empty result or a failure resolves with [] and the picker falls back to
 * its common families. Only family names leave this file.
 */

const { execFile } = require("node:child_process");

const COMMANDS = {
	win32: {
		file: "powershell.exe",
		args: [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			"[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }",
		],
	},
	darwin: {
		file: "osascript",
		args: [
			"-l",
			"JavaScript",
			"-e",
			'ObjC.import("AppKit"); ObjC.unwrap($.NSFontManager.sharedFontManager.availableFontFamilies).join("\\n")',
		],
	},
	linux: { file: "fc-list", args: [":", "family"] },
};

/** Family names out of a command's output: one per line (fontconfig may give
 *  "Family,Alias" or "Family:style"; the first name is the family), no hidden
 *  system faces (a leading "." or "@"), deduped, A to Z. */
function parseFontList(stdout) {
	const names = new Set();
	for (const line of String(stdout).split(/\r?\n/)) {
		const family = line.split(",")[0].split(":")[0].trim();
		if (family && !/^[.@]/.test(family)) names.add(family);
	}
	return [...names].sort((a, b) => a.localeCompare(b));
}

let cached = null;

/** The installed families, once per run. `run` is a test seam. */
function listInstalledFonts({ platform = process.platform, run = execFile } = {}) {
	if (cached) return cached;
	const command = COMMANDS[platform] ?? COMMANDS.linux;
	const read = new Promise((resolve) => {
		run(command.file, command.args, { timeout: 15_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout) =>
			resolve(err ? [] : parseFontList(stdout)),
		);
	});
	cached = read;
	// A failed or empty read is tried again next time instead of staying empty until a restart.
	void read.then((families) => {
		if (families.length === 0 && cached === read) cached = null;
	});
	return cached;
}

function registerFontsIPC(ipcMain, { trusted }) {
	ipcMain.handle("lh:fonts:list", (event) => {
		if (!trusted(event)) throw new Error("Untrusted desktop request.");
		return listInstalledFonts();
	});
}

/** Test seam: forget the kept list. */
function resetFontCache() {
	cached = null;
}

module.exports = { registerFontsIPC, listInstalledFonts, parseFontList, resetFontCache };
