"use strict";

/*
 * Reminder alerts → the OS notification (desktop). Raised in the main process
 * because the renderer's own Notification API is unusable in this shell: the
 * permission check grants "notifications", but Chromium still reports
 * Notification.permission as "denied" and the constructor fires an error
 * instead of showing one (measured with Electron 45 on Windows). Electron's
 * main-process Notification does show.
 *
 * `trusted(event)` gates the channel: only the app's own window may raise one
 * (electron/main.cjs passes the same check the other lanna:* handlers use). A
 * click focuses the window and reports the id back, so the renderer opens the
 * reminder the notification was about.
 */
function registerNotificationsIPC(ipcMain, { trusted, BrowserWindow, Notification, icon }) {
	ipcMain.handle("lanna:notify", (event, payload) => {
		if (!trusted(event)) throw new Error("Untrusted desktop request.");
		if (!Notification.isSupported()) return false;
		const { id = "", title = "", body = "" } = payload ?? {};
		const notification = new Notification({
			title: String(title),
			body: String(body),
			silent: true,
			...(icon ? { icon } : {}),
		});
		notification.on("click", () => {
			const win = BrowserWindow.fromWebContents(event.sender);
			if (!win) return;
			if (win.isMinimized()) win.restore();
			win.show();
			win.focus();
			event.sender.send("lanna:notification-open", String(id));
		});
		notification.show();
		return true;
	});
}

module.exports = { registerNotificationsIPC };
