/*
 * Preload (2026-09-17, narrow-window wave): the ONLY bridge between the
 * sandboxed renderer and the main process. contextIsolation + sandbox are
 * on (electron/main.cjs), so this file is the renderer's entire access to
 * Electron — keep it a minimal, explicit API surface.
 *
 *   window.lanna.platform — read-only OS identity for native window-control
 *   gutters (darwin: left traffic lights; win32/linux: right overlay).
 *
 *   window.lanna.expandWindow() — widen the window to the sidebar auto-close
 *   threshold (928px) when the sidebar is opened below it. The main
 *   process clamps: no-op if the window is already wide enough.
 *
 *   window.lanna.onZoom(cb) / window.lanna.getZoom() — the zoom truth (owner
 *   round 7, 2026-10-05): every ⌘±/⌘0 change arrives as "lanna:zoom" with
 *   the new factor; getZoom covers the first-paint race. The renderer
 *   publishes it as --lanna-zoom so physical-constant lengths (the traffic-
 *   light gutter) can divide by it.
 *
 *   window.lanna.onUpdateStatus(cb) / window.lanna.installUpdate() — the
 *   auto-update channel (Wave C, 2026-10-10): "lanna:update-status" pushes
 *   {status, version, revision} on updater events; installUpdate asks main
 *   to kill the server and quit-and-install. getUpdateState retrieves the
 *   snapshot for a late subscriber; checkForUpdates requests a manual
 *   check (including download/install-on-quit, even with automatic checks OFF).
 *
 *   window.lanna.onOpenSettings(cb) — menu navigation, buffered until React
 *   subscribes after a window is reopened. Browser builds have no bridge.
 *
 *   window.lanna.fonts.list() — Settings → Appearance: the installed font
 *   families (names only), read by the main process.
 *
 *   window.lanna.storage — Settings → Storage: the HTTP cache's size and
 *   clearing it. Nothing else on disk is reachable from the renderer.
 *
 *   window.lanna.youtube — Watch → picks: sign in to YouTube in a window with its
 *   own session, read the history, home and channels pages, sign out
 *   (electron/youtube.cjs). Only page text comes back; never a cookie.
 *
 * Channel names are mirrored in electron/main.cjs — keep them in sync.
 */
const { contextBridge, ipcRenderer } = require("electron");

let openSettingsListener = null;
let pendingOpenSettings = null;
ipcRenderer.on("lanna:open-settings", (_event, section) => {
	if (openSettingsListener) openSettingsListener(section);
	else pendingOpenSettings = section;
});

contextBridge.exposeInMainWorld("lanna", {
	platform: process.platform,
	expandWindow: () => ipcRenderer.send("lanna:expand-window"),
	/** Tell the window frame which theme the page is in, so its background and title bar follow. */
	setTheme: (night) => ipcRenderer.send("lanna:theme", night === true),
	onZoom: (cb) => {
		const listener = (_event, factor) => cb(factor);
		ipcRenderer.on("lanna:zoom", listener);
		return () => ipcRenderer.removeListener("lanna:zoom", listener);
	},
	getZoom: () => ipcRenderer.invoke("lanna:zoom:get"),
	onUpdateStatus: (cb) => {
		const listener = (_event, status) => cb(status);
		ipcRenderer.on("lanna:update-status", listener);
		return () => ipcRenderer.removeListener("lanna:update-status", listener);
	},
	installUpdate: () => ipcRenderer.send("lanna:update-install"),
	getUpdateState: () => ipcRenderer.invoke("lanna:update:get"),
	checkForUpdates: () => ipcRenderer.invoke("lanna:update:check"),
	/** Settings → Storage: the HTTP cache's size in bytes, and clearing it
	 *  (clear resolves with the size after). Nothing else is cleared. */
	storage: {
		cacheSize: () => ipcRenderer.invoke("lanna:storage:cache-size"),
		clearCache: () => ipcRenderer.invoke("lanna:storage:clear-cache"),
	},
	/** Settings → Appearance: the installed font families, A to Z; [] when the OS would not say. */
	fonts: {
		list: () => ipcRenderer.invoke("lanna:fonts:list"),
	},
	/** Watch → picks: sign in to YouTube in a window of its own, read one list's
	 *  page (history, recommended, subscriptions) and who is signed in through
	 *  that session, sign out. */
	youtube: {
		status: () => ipcRenderer.invoke("lanna:youtube", { op: "status" }),
		connect: () => ipcRenderer.invoke("lanna:youtube", { op: "connect" }),
		read: (list) => ipcRenderer.invoke("lanna:youtube", { op: "read", list }),
		account: () => ipcRenderer.invoke("lanna:youtube", { op: "account" }),
		disconnect: () => ipcRenderer.invoke("lanna:youtube", { op: "disconnect" }),
	},
	onOpenSettings: (cb) => {
		openSettingsListener = cb;
		if (pendingOpenSettings !== null) {
			const section = pendingOpenSettings;
			pendingOpenSettings = null;
			cb(section);
		}
		return () => {
			if (openSettingsListener === cb) openSettingsListener = null;
		};
	},
});
