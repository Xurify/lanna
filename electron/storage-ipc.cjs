"use strict";

/*
 * Settings → Storage (desktop). The one thing the app clears is Electron's
 * HTTP cache: the copies of audio and pages it keeps so they load faster,
 * which download again on demand. Saved voice clips, progress, settings and
 * keys live under the data folder and are never reachable from here.
 *
 * `trusted(event)` gates both handlers: only the app's own window may ask
 * (electron/main.cjs passes the same check the other lanna:* handlers use).
 */
function registerStorageIPC(ipcMain, { session, trusted }) {
	const guard = (event) => {
		if (!trusted(event)) throw new Error("Untrusted desktop request.");
	};
	ipcMain.handle("lanna:storage:cache-size", (event) => {
		guard(event);
		return session.defaultSession.getCacheSize();
	});
	ipcMain.handle("lanna:storage:clear-cache", async (event) => {
		guard(event);
		await session.defaultSession.clearCache();
		return session.defaultSession.getCacheSize();
	});
}

module.exports = { registerStorageIPC };
