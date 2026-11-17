"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FORMER_NAME = "LangHarness";

// Electron names the userData folder after the app, so the rename to Lanna would start an empty one.
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
