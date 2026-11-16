"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FORMER_NAME = "LangHarness";

/**
 * The app was called LangHarness before Lanna, and Electron names the
 * userData folder after the app. Moves the old folder (chats, keys, progress)
 * to the new name once. Returns the folder to use: the new one, or the old one
 * when it cannot be moved (Windows refuses while the old app still runs).
 */
function adoptFormerUserData(userData, name) {
	const parent = path.dirname(userData);
	const base = path.basename(userData);
	if (!base.startsWith(name)) return userData;
	const former = path.join(parent, FORMER_NAME + base.slice(name.length));
	if (fs.existsSync(userData) || !fs.existsSync(former)) return userData;
	try {
		fs.renameSync(former, userData);
		return userData;
	} catch {
		return former;
	}
}

module.exports = { adoptFormerUserData };
