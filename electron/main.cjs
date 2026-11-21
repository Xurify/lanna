/**
 * Lanna — the Electron shell (wrapper milestone, 2026-09-17).
 *
 * What this process is and is not:
 *   IS:  a thin launcher + security guard around the app's real server —
 *        `next build`'s standalone server.js (Next 16), spawned as a child
 *        on 127.0.0.1 with the BYOK auth file and the LANNA_DATA_DIR seam.
 *   NOT: a host for any app logic. Everything — teacher turns, extraction,
 *        the graph — runs in the Next server, unchanged.
 *
 * Pattern (fact-checked 2026-09-17 against current Electron 44 / Next 16
 * docs — see .memory release-strategy + electron-wrapper notes):
 *   - spawn via process.execPath + ELECTRON_RUN_AS_NODE=1 (Electron's
 *     bundled Node 24; the runAsNode fuse must stay enabled);
 *   - the server dir ships UNPACKED via extraResources (asar archives are
 *     read-only and native .node/dylib can't dlopen from one);
 *   - all mutable state under userData (never inside the .app bundle —
 *     translocated apps are read-only);
 *   - keys ride the child's ENV, never argv; auth.json (BYOK) is a flat
 *     {VAR: value} JSON map, plaintext, mode 0600 — server-managed since
 *     the auth-keys wave (2026-09-19): the child reads/writes it DIRECTLY
 *     (LANNA_AUTH_FILE below) and reflects values into its own env. The old
 *     spawn-time env injection retired with that wave — a copy made here
 *     would shadow every settings-page key change until restart.
 */

const { app, BrowserWindow, clipboard, Menu, ipcMain, nativeImage, Notification, session, shell } = require("electron");

/** The window frame in the two themes (the page's --q-bg and --q-ink). Day is the default; the page reports its theme through "lanna:theme". */
/** Whether the last session ended in Night, kept beside the window state so the window is the right color from its first frame. */
function savedNight() {
	try {
		const raw = JSON.parse(
			require("node:fs").readFileSync(require("node:path").join(app.getPath("userData"), "theme.json"), "utf8"),
		);
		return raw.night === true;
	} catch {
		return false;
	}
}
function saveNight(night) {
	try {
		require("node:fs").writeFileSync(
			require("node:path").join(app.getPath("userData"), "theme.json"),
			JSON.stringify({ night }),
		);
	} catch {
		// the next start opens in Day and the page corrects it
	}
}

const CHROME = {
	day: { color: "#ffffff", symbolColor: "#16181b" },
	night: { color: "#101214", symbolColor: "#ecedee" },
};
const { desktopAPIHeaders, trustedSender } = require("./desktop-api.cjs");
const { registerStorageIPC } = require("./storage-ipc.cjs");
const { registerFontsIPC } = require("./fonts-ipc.cjs");
const { createYouTube, registerYouTubeIPC } = require("./youtube.cjs");
const { registerNotificationsIPC } = require("./notifications-ipc.cjs");
const { attachContextMenu } = require("./context-menu.cjs");
const { adoptFormerUserData } = require("./former-user-data.cjs");
const { randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

// Mirrors SIDEBAR_AUTOCLOSE in components/sidebar.tsx — keep in sync (the
// renderer owns the number; this is the IPC widen target).
const SIDEBAR_AUTOCLOSE = 900;

const PRODUCT_NAME = "Lanna";

// APP NAME → userData (owner, 2026-10-10): the Application Support dir is
// exactly "Lanna" in dev AND packaged. Packaged Electron would
// otherwise derive it from package.json "name" (now lowercase
// "lanna"), and productName metadata alone doesn't reach app.name.
// Must run before the LANNA_DEV_URL suffix below — dev becomes
// "Lanna-dev".
app.setName(PRODUCT_NAME);

// Audio playback hardening:
// Allow speech and lesson sound playback without requiring an initial user gesture.
// Do not disable AudioServiceOutOfProcess on Windows: modern Chromium relies on the
// out-of-process AudioService utility to interface with WASAPI / CoreAudio.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Unpackaged (`npm run desktop:dev`) the process is the stock electron
// binary, so the taskbar/dock would show Electron's atom. Packaged builds
// embed their icon at build time (build/icon.*), so this is dev-only.
// .ico on Windows (crisp taskbar sizes), .png elsewhere.
const DEV_ICON = app.isPackaged
	? undefined
	: path.join(__dirname, "..", "build", process.platform === "win32" ? "icon.ico" : "icon.png");

// A reminder toast carries a picture of its own: the PNG electron-builder.yml
// ships into Resources when packaged, build/icon.png in dev. Electron draws it
// from a loaded image only — the same file handed over as a path draws nothing
// in a Windows toast (measured with Electron 45 on Windows 11).
const TOAST_ICON_FILE = app.isPackaged
	? path.join(process.resourcesPath, "icon.png")
	: path.join(__dirname, "..", "build", "icon.png");

const AUTH_FILE = () => path.join(app.getPath("userData"), "auth.json");
const DATA_DIR = () => path.join(app.getPath("userData"), "data");

/** The packaged standalone server (extraResources → Resources/server).
 *  In dev LANNA_DEV_URL short-circuits everything: no spawn, no packaging —
 *  the window points at the running `next dev` server (full HMR). */
function serverEntry() {
	// extraResources ships the whole .next payload under server/standalone/
	// (copied from .next with an explicit filter — see electron-builder.yml).
	return path.join(process.resourcesPath, "server", "standalone", "server.js");
}

// ─── Single instance: two instances would fight over the data dir ─────────
// Dev shell (LANNA_DEV_URL) runs BESIDE the packaged app, not instead of it:
// its own userData so (a) the single-instance lock — checked below — doesn't
// silently kill it, and (b) it never reads/writes the real app's
// localStorage, auth.json, or logs. Must run before the lock check.
if (process.env.LANNA_DEV_URL) {
	app.setPath("userData", `${app.getPath("userData")}-dev`);
}
app.setPath("userData", adoptFormerUserData(app.getPath("userData"), PRODUCT_NAME));

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on("second-instance", () => {
		const win = BrowserWindow.getAllWindows()[0];
		if (win) {
			if (win.isMinimized()) win.restore();
			win.focus();
		}
	});
	main();
}

let serverProcess = null;
// Per-launch request capability, never OAuth tokens and never renderer state.
let desktopAPISecret = null;
let reopenWindow = null;
const trustedAppWindows = new Set();

// A GUI shell must never die to a stray exception (EPIPE dialogs, a race
// in an event handler): the window + child server are the product, and
// anything main-side is recoverable by logging it. Log-and-continue.
process.on("uncaughtException", (err) => {
	try {
		log(`uncaught: ${err?.stack ?? err}`);
	} catch {
		/* nothing left to write to */
	}
});

const { choosePort, readPreferredPort } = require("./server-port.cjs");

/** A free TCP port (listen(0) → the kernel assigns one). The close→spawn
 *  race is theoretical; localhost ports are rarely contended, and a failed
 *  spawn surfaces in the health check with the child's stderr in the log. */
function freePort() {
	return new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.listen(0, "127.0.0.1", () => {
			const { port } = srv.address();
			srv.close(() => resolve(port));
		});
		srv.on("error", reject);
	});
}

const SERVER_PORT_FILE = () => path.join(app.getPath("userData"), "server-port.json");
const SETTINGS_FILE = () => path.join(DATA_DIR(), "settings.json");

function canBind(port) {
	return new Promise((resolve) => {
		const srv = net.createServer();
		srv.once("error", () => resolve(false));
		srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
	});
}

function rememberedServerPort() {
	try {
		const saved = JSON.parse(fs.readFileSync(SERVER_PORT_FILE(), "utf8"));
		return Number.isInteger(saved.port) ? saved.port : null;
	} catch {
		return null;
	}
}

function rememberServerPort(port) {
	try {
		fs.mkdirSync(path.dirname(SERVER_PORT_FILE()), { recursive: true });
		fs.writeFileSync(SERVER_PORT_FILE(), `${JSON.stringify({ port })}\n`);
	} catch {
		/* the app still runs on the chosen port without this file */
	}
}

function serverPort() {
	return choosePort({
		canBind,
		remember: rememberServerPort,
		remembered: rememberedServerPort(),
		preferred: readPreferredPort(SETTINGS_FILE()) ?? undefined,
		fallback: freePort,
	});
}

/** BYOK keys: auth.json in userData, flat {VAR: value} map, 0600 —
 *  SERVER-MANAGED since the auth-keys wave (2026-09-19). This shell no
 *  longer reads or injects it: the child gets LANNA_AUTH_FILE below and does
 *  its own read/reflect/write, so a key saved in the settings page takes
 *  effect on the next model call — no restart. Real environment variables
 *  still win over the file inside the child (its documented rule). */

function log(line) {
	const stamp = new Date().toISOString();
	// The stdout write is guarded (EPIPE hardening, 2026-10-10): a packaged
	// app launched with a consumer-owned pipe (a launcher that exits, a
	// piped run) must not die on its next log line when the pipe breaks.
	// The file below stays the durable channel.
	try {
		console.log(`[lanna ${stamp}] ${line}`);
	} catch {
		/* stdout gone — userData/logs/main.log still carries it */
	}
	// Belt and braces: also append to userData/logs so a misbehaving child
	// can be diagnosed after the window is gone. Best effort only.
	try {
		const dir = path.join(app.getPath("userData"), "logs");
		fs.mkdirSync(dir, { recursive: true });
		fs.appendFileSync(path.join(dir, "main.log"), `[${stamp}] ${line}\n`);
	} catch {
		/* best effort */
	}
}

function startServer(port) {
	return new Promise((resolve, _reject) => {
		const child = spawn(
			process.execPath,
			// Only the macOS backend needs this: Next's native title setter
			// otherwise checks this Node-mode process in as a foreground app.
			process.platform === "darwin"
				? ["--require", path.join(process.resourcesPath, "server-title-guard.cjs"), serverEntry()]
				: [serverEntry()],
			{
				cwd: path.dirname(serverEntry()),
				env: {
					...process.env,
					ELECTRON_RUN_AS_NODE: "1",
					NODE_ENV: "production",
					PORT: String(port),
					HOSTNAME: "127.0.0.1", // the server defaults to 0.0.0.0 — never
					LANNA_DATA_DIR: DATA_DIR(),
					// The auth/keys store — the child reads AND writes this file itself
					// (no env injection anymore: a spawn-time copy would shadow every
					// settings-page key change until restart; env wins over file).
					LANNA_AUTH_FILE: AUTH_FILE(),
					LANNA_DESKTOP_SERVER: "1",
					LANNA_DESKTOP_API_SECRET: desktopAPISecret,
				},
				stdio: ["ignore", "pipe", "pipe", "ipc"],
			},
		);
		serverProcess = child;
		const fwd = (buf) =>
			buf
				.toString()
				.trimEnd()
				.split("\n")
				.forEach((l) => l && log(`server: ${l}`));
		child.stdout.on("data", fwd);
		child.stderr.on("data", fwd);
		child.on("exit", (code, signal) => {
			log(`server exited (code=${code} signal=${signal})`);
			serverProcess = null;
		});
		resolve(child);
	});
}

/** No "ready" event exists — poll until the server answers (docs-confirmed). */
function waitUntilUp(url, tries = 150) {
	return new Promise((resolve, reject) => {
		const attempt = (n) => {
			const req = http.get(url, (res) => {
				res.resume();
				resolve(res.statusCode !== undefined);
			});
			req.on("error", () => {
				if (n <= 0) reject(new Error(`server never answered on ${url}`));
				else setTimeout(() => attempt(n - 1), 200);
			});
		};
		attempt(tries);
	});
}

function killServer() {
	if (!serverProcess) return;
	const child = serverProcess;
	serverProcess = null;
	child.kill("SIGTERM");
	setTimeout(() => {
		try {
			child.kill("SIGKILL");
		} catch {
			/* already gone */
		}
	}, 3000);
}

/** Security posture (all defaults asserted explicitly; the guards are the
 *  checklist's own recommendations for localhost-app shells):
 *  - deny-by-default permission handler allowing only our loopback origin
 *    (groundwork for the mic/STT milestone — Electron auto-approves by
 *    default, we do not);
 *  - will-navigate pinned to the app origin; window.open always denied —
 *    external links go to the real browser via shell.openExternal. */
function createWindow(url) {
	const win = new BrowserWindow({
		width: 1440,
		height: 900,
		title: PRODUCT_NAME,
		...(DEV_ICON ? { icon: DEV_ICON } : {}),
		// Merged chrome (owner, 2026-09-17): the system title bar is gone;
		// the app's own 60px header bands ARE the title bar. The traffic
		// lights float over the sidebar's Lanna wordmark band, vertically
		// Aligned to the PHASE PILL's drawn box, not the band's geometric
		// center (owner ask, 2026-09-17): macOS centers each 12px circle at
		// y+6.75, and the pill box center measures 29.25 in the running app
		// (band 0–59.5, pill box 19–39.5) — y 22.5 lands the circles at
		// 29.25, exactly on the pill. Wordmark gutter: components/sidebar.tsx.
		// Dragging comes from the renderer's .lanna-drag bands (app/globals.css).
		...(process.platform === "darwin"
			? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 22.5 } }
			: {
					titleBarStyle: "hidden",
					// Native min/max/close on the right, at the OS's compact default
					// height. Do not force the zoom-invariant native overlay to match
					// the renderer's 60 CSS px bar: zooming out would cover its border.
					// The renderer reserves the actual width via env(titlebar-area-*).
					titleBarOverlay: { ...(savedNight() ? CHROME.night : CHROME.day) },
					// Keep the custom bar alone; Alt reveals the native menu.
					autoHideMenuBar: true,
				}),
		webPreferences: {
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			backgroundThrottling: false,
			preload: path.join(__dirname, "preload.cjs"),
		},
		// Live-resize + first-paint flash (owner, 2026-09-17): during a resize
		// the native window surface changes size before Chromium's compositor
		// has a frame at the new size, and the gap shows the window's NATIVE
		// background — Electron's default is white, glaring on a dark app.
		// The app background (white, or #101214 once the page reports Night) fills the lag instead. `show: false` +
		// ready-to-show is the same treatment for first paint: the window
		// appears only once the page has actually rendered.
		backgroundColor: (savedNight() ? CHROME.night : CHROME.day).color,
		show: false,
		// Narrow-window behavior (owner, 2026-09-17): 640px is the floor —
		// below it even a wrapped chrome row gets cramped and the chat header
		// (lights gutter 92 + toggle + title) runs out of room. The sidebar
		// auto-closes below 928 = 640 + 288 (sidebar) in the renderer
		// (components/sidebar.tsx, SIDEBAR_AUTOCLOSE); its "lanna:expand-window"
		// IPC widens the window back to that threshold.
		minWidth: 640,
		minHeight: 600,
	});

	trustedAppWindows.add(win);
	win.once("closed", () => trustedAppWindows.delete(win));
	const allowedOrigin = () => new URL(url).origin;
	// Deny-by-default; the ONLY grants are media (mic/STT groundwork) and
	// clipboard-sanitized-write — the copy affordances in the transcript
	// (md-blocks copy corners) call navigator.clipboard.writeText(), which
	// Chromium only honors with that permission (chrome-melt tweaks wave,
	// 2026-09-19; before this grant every copy silently rejected). Still
	// loopback-origin only — Electron's default is auto-approve-everything,
	// and we do not ship that.
	// "local-fonts": the appearance section's reading-font picker (2026-09-26).
	// "notifications": reminder alerts. Without it Chromium resolves
	// Notification.requestPermission() as "denied" with no prompt, so the
	// desktop app could never reach the granted state.
	const allowedPermissions = new Set(["media", "clipboard-sanitized-write", "local-fonts", "notifications"]);
	const fromOwnOrigin = (origin, permission) => origin === allowedOrigin() && allowedPermissions.has(permission);
	session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
		const requestOrigin = details.requestingUrl ? new URL(details.requestingUrl).origin : null;
		callback(fromOwnOrigin(requestOrigin, permission));
	});
	session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => {
		return fromOwnOrigin(origin, permission);
	});

	win.webContents.on("will-navigate", (event, target) => {
		if (new URL(target).origin !== allowedOrigin()) {
			event.preventDefault();
			void shell.openExternal(target);
		}
	});
	win.webContents.setWindowOpenHandler(({ url: target }) => {
		void shell.openExternal(target);
		return { action: "deny" };
	});
	attachContextMenu(win, allowedOrigin, { Menu, clipboard, shell });

	void win.loadURL(url);
	// Zoom truth reaches the renderer for EVERY load (reload, nav): the
	// renderer's --lanna-zoom must never go stale. The fallback catcher below
	// covers ⌘= / layout variants the menu's ⌘Plus may not claim — menu-
	// claimed keys never reach before-input-event, so exactly one of the
	// two applies any given zoom keypress.
	win.webContents.on("did-finish-load", () => {
		win.webContents.send("lanna:zoom", win.webContents.getZoomFactor());
	});
	win.webContents.on("before-input-event", (event, input) => {
		if (input.type !== "keyDown" || !(input.meta || input.control)) return;
		if (input.key === "=" || input.key === "+") zoomStep(win, +1);
		else if (input.key === "-") zoomStep(win, -1);
		else if (input.key === "0") applyZoom(win, 1);
		else return;
		event.preventDefault();
	});

	win.once("ready-to-show", () => win.show());
	return win;
}

/* ── Zoom (owner round 7, 2026-10-05): ⌘±/⌘0 as an OWNED ladder ──────────
 * The stock zoomIn/zoomOut roles change zoomLevel silently — the renderer
 * never learns the factor, and the native traffic lights (physical-fixed,
 * hiddenInset) drift out of relation to the scaled chrome: the graph
 * button rides away from them zoomed in, content slides under them
 * zoomed out. Here zoom is explicit: a factor ladder, applied through
 * setZoomFactor, and broadcast to the renderer ("lanna:zoom" — it publishes
 * --lanna-zoom so gutter lengths can divide by it and stay PHYSICAL-
 * constant). The traffic lights themselves stay at their construction
 * position ({x:16, y:22.5} — Electron 44 has NO runtime setter, only
 * the BrowserWindow option), which is HIG-correct anyway: native lights
 * hug the window corner while the web chrome compensates around them.
 * Vertical note: at large factors the taller bands' content centers
 * drift below the fixed lights — accepted (the alternative, moving the
 * lights, is impossible without rebuilding the window). */
const ZOOM_LADDER = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

/* ── Auto-update (Wave C, owner 2026-10-10: silent download + restart ─────
 * banner; checks at startup + every 24h) ─────────────────────────────────
 *
 * Feed: GitHub Releases (electron-builder.yml publish → app-update.yml,
 * baked + signed into the bundle). macOS needs the app signed (it is —
 * Developer ID) and updates ride the zip target (Squirrel.Mac); blockmaps
 * give differential downloads for free. Windows uses NSIS; Linux uses
 * AppImage or DebUpdater (6.8.9 supports deb; installation can request
 * administrator permission via the package manager — owner 2026-10-11).
 *
 * Hard rules:
 *  - DEV NEVER UPDATES: !app.isPackaged skips the updater entirely — the
 *    dev world runs `next dev` and has no signed bundle.
 *  - THE UPDATER CAN NEVER TAKE THE APP DOWN: every event and check is
 *    caught and logged (feed down, disk full, bad signature — all just
 *    log lines; the app keeps working, update or no update).
 *  - LANNA_UPDATE_FEED (env): overrides the baked GitHub feed with a generic
 *    local server — the pre-release verification drill (serve
 *    latest-mac.yml + zip + blockmap from any localhost HTTP dir and
 *    watch a real installed copy find/download/restart). Test-only seam.
 *
 * Install path: the downloaded update applies on quit (autoInstallOnAppQuit
 * — Squirrel.Mac stages natively and swaps on relaunch). The renderer
 * banner asks for an immediate restart via "lanna:update-install"; we kill
 * the child server FIRST — deterministic ordering: the server lives
 * inside the .app bundle Squirrel is about to replace (extraResources),
 * and before-quit alone would race the swap. */
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
let autoUpdater = null; // electron-updater's, packaged builds only
// Observational only: this snapshot NEVER gates a check, download or install.
// The revision lets late subscribers reject an older in-flight IPC snapshot.
let updateState = { status: "idle", version: null, revision: 0 };

function reportUpdateStatus(status, version = null) {
	try {
		// A later check/error must not hide an update already staged for quit.
		if (updateState.status === "downloaded" && status !== "downloaded") return;
		updateState = { status, version: typeof version === "string" ? version : null, revision: updateState.revision + 1 };
		for (const win of BrowserWindow.getAllWindows()) {
			try {
				win.webContents.send("lanna:update-status", updateState);
			} catch {
				/* window mid-teardown — snapshot retrieval covers a later load */
			}
		}
	} catch {
		/* Status reporting must never interrupt the updater. */
	}
}

/** Read the SAME data directory passed to the packaged server. Only an
 * explicit false opts out; absent/corrupt/unreadable settings keep updates ON.
 * Re-read for each automatic check so saving the toggle needs no restart. */
function automaticUpdatesEnabled() {
	try {
		const settings = JSON.parse(fs.readFileSync(path.join(DATA_DIR(), "settings.json"), "utf8"));
		return settings?.general?.autoUpdate !== false;
	} catch {
		return true;
	}
}

function checkForUpdates({ manual = false } = {}) {
	if (!autoUpdater) return;
	if (!manual && !automaticUpdatesEnabled()) {
		log("auto-update: automatic check skipped (turned off in Settings)");
		return;
	}
	// Do not gate on display state: a stale spinner/error must never disable
	// future background checks. electron-updater owns its in-flight work.
	autoUpdater
		.checkForUpdates()
		.then((result) => {
			// A declined check (e.g. an unsupported package) establishes no
			// latest-version claim. Real results arrive through updater events.
			if (!result) reportUpdateStatus("idle");
		})
		.catch((err) => {
			log(`update check failed: ${err?.message ?? err}`);
			reportUpdateStatus("error");
		});
}

function installUpdateNow() {
	// Kill the server BEFORE the quit-and-install (see block comment).
	try {
		killServer();
	} catch {
		/* already dead */
	}
	autoUpdater?.quitAndInstall();
}

function setupAutoUpdater() {
	if (!app.isPackaged) {
		log("auto-update: dev build — updater disabled");
		reportUpdateStatus("disabled");
		return;
	}
	try {
		autoUpdater = require("electron-updater").autoUpdater;
	} catch (err) {
		log(`auto-update: electron-updater unavailable (${err?.message ?? err}) — updates disabled`);
		reportUpdateStatus("disabled");
		return;
	}
	const feed = process.env.LANNA_UPDATE_FEED;
	if (feed) {
		autoUpdater.setFeedURL({ provider: "generic", url: feed });
		log(`auto-update: LANNA_UPDATE_FEED override → ${feed}`);
	}
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	// Route every updater log line through the shell's own log (userData/
	// logs/main.log) — feed failures must be diagnosable after the fact.
	autoUpdater.logger = {
		info: (m) => log(`updater: ${m}`),
		warn: (m) => log(`updater warn: ${m}`),
		debug: (_m) => {}, // too chatty for the persistent log
		error: (m) => log(`updater error: ${m}`),
	};
	autoUpdater.on("checking-for-update", () => reportUpdateStatus("checking"));
	autoUpdater.on("update-available", (info) => reportUpdateStatus("downloading", info?.version));
	autoUpdater.on("update-not-available", () => reportUpdateStatus("up-to-date"));
	autoUpdater.on("update-downloaded", (info) => {
		log(`update downloaded: ${info?.version} — banner shown`);
		reportUpdateStatus("downloaded", info?.version);
	});
	autoUpdater.on("error", (err) => {
		log(`updater error: ${err?.message ?? err}`);
		reportUpdateStatus("error");
	});
}

/** One result surface for manual checks. Preload buffers the navigation
 * request until React subscribes, including when all macOS windows closed. */
function checkForUpdatesFromMenu() {
	try {
		const win = BrowserWindow.getAllWindows()[0] ?? reopenWindow?.();
		if (win) {
			if (win.isMinimized()) win.restore();
			win.focus();
			const openSettings = () => {
				try {
					win.webContents.send("lanna:open-settings", "general");
				} catch {
					/* window closed */
				}
			};
			if (win.webContents.isLoadingMainFrame()) win.webContents.once("did-finish-load", openSettings);
			else openSettings();
		}
	} catch {
		/* Navigation failure must not prevent the manual check. */
	}
	checkForUpdates({ manual: true });
}

function zoomStep(win, dir) {
	const current = win.webContents.getZoomFactor();
	const next =
		dir > 0
			? (ZOOM_LADDER.find((f) => f > current + 0.001) ?? ZOOM_LADDER[ZOOM_LADDER.length - 1])
			: ([...ZOOM_LADDER].reverse().find((f) => f < current - 0.001) ?? ZOOM_LADDER[0]);
	applyZoom(win, next);
}

function applyZoom(win, factor) {
	factor = Math.min(2, Math.max(0.75, factor)); // ladder clamps; ⌘0 = 1
	win.webContents.setZoomFactor(factor);
	win.webContents.send("lanna:zoom", factor);
}

/** macOS needs an application menu with the Edit roles — without one,
 *  Cmd+C/V/A do nothing in the renderer. Everything else stays minimal. */
function installMenu() {
	const template = [
		{
			label: app.name,
			submenu: [
				{ role: "about" },
				// Manual checks report their result in Settings → General.
				{ label: "Check for Updates…", click: () => checkForUpdatesFromMenu() },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ type: "separator" },
				{ role: "quit" },
			],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" },
			],
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				// OWNED zoom (see applyZoom): the roles change zoomLevel
				// silently; these broadcast the factor and re-seat the
				// traffic lights. The renderer's --lanna-zoom depends on
				// hearing every change.
				{
					label: "Actual Size",
					accelerator: "CommandOrControl+0",
					click: () => applyZoom(BrowserWindow.getAllWindows()[0], 1),
				},
				{
					label: "Zoom In",
					accelerator: "CommandOrControl+Plus",
					click: () => zoomStep(BrowserWindow.getAllWindows()[0], +1),
				},
				{
					label: "Zoom Out",
					accelerator: "CommandOrControl+-",
					click: () => zoomStep(BrowserWindow.getAllWindows()[0], -1),
				},
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{ role: "windowMenu" },
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function main() {
	app.on("window-all-closed", () => {
		// macOS convention: the app stays resident, reactivated from the Dock.
		if (process.platform !== "darwin") app.quit();
	});

	// The child must not outlive us — cover every quit path.
	app.on("before-quit", killServer);
	process.on("exit", killServer);
	process.on("SIGHUP", killServer);

	await app.whenReady();
	if (DEV_ICON && process.platform === "darwin") app.dock?.setIcon(DEV_ICON);

	// Embedded YouTube (the Watch task) refuses to play when the user agent
	// names the app or Electron ("An error occurred. Please try again
	// later." with a Playback ID, seen 2026-10-28): the player is served a
	// build for a browser it does not recognize. Present as the Chrome we
	// are; nothing else keys off these tokens.
	app.userAgentFallback = app.userAgentFallback.replace(/ (Lanna|lanna|Electron)\/\S+/g, "");

	// Dev mode: point at a running `next dev` server (LANNA_DEV_URL) — no
	// spawn, no packaging, full HMR. The rest of this shell still applies
	// (guards, menu, single instance).
	const devUrl = process.env.LANNA_DEV_URL;
	const url = devUrl ?? `http://127.0.0.1:${await serverPort()}`;
	if (!devUrl) {
		desktopAPISecret = randomBytes(32).toString("hex");
		const ownedOrigin = new URL(url).origin;
		// All URLs, not only /api: remove the header again on external redirects.
		session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["<all_urls>"] }, (details, callback) => {
			callback({ requestHeaders: desktopAPIHeaders(details, ownedOrigin, desktopAPISecret, [...trustedAppWindows]) });
		});
		log(`starting server: ${serverEntry()}`);
		log(
			`data dir: ${DATA_DIR()}${fs.existsSync(AUTH_FILE()) ? " · auth.json: present" : " · auth.json: ABSENT (no BYOK keys yet)"}`,
		);
		await startServer(new URL(url).port);
		await waitUntilUp(url);
		log(`server up: ${url}`);
	} else {
		log(`dev mode: ${devUrl}`);
	}

	installMenu();

	// Auto-update (Wave C): wire the updater before the window so the
	// banner channel is live from first paint; the first check and the 24h
	// interval fire after it below. setupAutoUpdater's contract: failures
	// are log lines — this can never block boot.
	setupAutoUpdater();
	ipcMain.on("lanna:update-install", () => installUpdateNow());
	ipcMain.handle("lanna:update:get", (event) => {
		if (
			!trustedAppWindows.has(BrowserWindow.fromWebContents(event.sender)) ||
			!trustedSender(event, new URL(url).origin, BrowserWindow)
		)
			throw new Error("Untrusted desktop request.");
		return updateState;
	});
	ipcMain.handle("lanna:update:check", (event) => {
		if (
			!trustedAppWindows.has(BrowserWindow.fromWebContents(event.sender)) ||
			!trustedSender(event, new URL(url).origin, BrowserWindow)
		)
			throw new Error("Untrusted desktop request.");
		checkForUpdates({ manual: true });
	});

	// Settings → Storage: the HTTP cache is the only thing the app clears
	// (electron/storage-ipc.cjs). Same sender check as the handlers above.
	registerStorageIPC(ipcMain, {
		session,
		trusted: (event) =>
			trustedAppWindows.has(BrowserWindow.fromWebContents(event.sender)) &&
			trustedSender(event, new URL(url).origin, BrowserWindow),
	});

	// Settings → Appearance → Reading font: the installed families, asked of the OS
	// here because the renderer's queryLocalFonts is empty in Electron 44 (electron/fonts-ipc.cjs).
	registerFontsIPC(ipcMain, {
		trusted: (event) =>
			trustedAppWindows.has(BrowserWindow.fromWebContents(event.sender)) &&
			trustedSender(event, new URL(url).origin, BrowserWindow),
	});

	// Watch → picks: the learner's YouTube history, recommendations and
	// subscriptions, read through a signed-in session of its own (electron/youtube.cjs).
	registerYouTubeIPC(ipcMain, {
		trusted: (event) =>
			trustedAppWindows.has(BrowserWindow.fromWebContents(event.sender)) &&
			trustedSender(event, new URL(url).origin, BrowserWindow),
		youtube: createYouTube({ session, BrowserWindow, userAgent: app.userAgentFallback }),
		BrowserWindow,
	});

	// Reminder alerts → the OS notification: raised here, not in the renderer
	// (electron/notifications-ipc.cjs).
	registerNotificationsIPC(ipcMain, {
		trusted: (event) =>
			trustedAppWindows.has(BrowserWindow.fromWebContents(event.sender)) &&
			trustedSender(event, new URL(url).origin, BrowserWindow),
		BrowserWindow,
		Notification,
		icon: nativeImage.createFromPath(TOAST_ICON_FILE),
	});

	// Sidebar-at-narrow-window (owner, 2026-09-17): the renderer auto-closes
	// the sidebar below SIDEBAR_AUTOCLOSE (928px); opening it again at that
	// width asks the window to widen instead — the layout never has to
	// accommodate a narrow window + open sidebar. Top-left stays fixed, the
	// window grows right. No-op when already wide.
	// The renderer's first paint can race did-finish-load — it asks for
	// the current factor itself (mirrors "lanna:zoom" pushes).
	ipcMain.handle(
		"lanna:zoom:get",
		(event) => BrowserWindow.fromWebContents(event.sender)?.webContents.getZoomFactor() ?? 1,
	);
	ipcMain.on("lanna:theme", (event, night) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (!win) return;
		const c = night === true ? CHROME.night : CHROME.day;
		saveNight(night === true);
		win.setBackgroundColor(c.color);
		// Only the Windows and Linux frames have an overlay to recolor.
		if (process.platform !== "darwin") win.setTitleBarOverlay?.({ ...c });
	});
	ipcMain.on("lanna:expand-window", (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (!win) return;
		const { x, y, width, height } = win.getBounds();
		const target = SIDEBAR_AUTOCLOSE;
		if (width < target) win.setBounds({ x, y, width: target, height });
	});
	reopenWindow = () => {
		return createWindow(url);
	};
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) reopenWindow();
	});
	createWindow(url);
	log(`window open: ${url}`);
	// Startup + 24h checks stay main-owned and read the current preference.
	// No renderer subscription is required; late loads retrieve the snapshot.
	if (autoUpdater) {
		checkForUpdates();
		setInterval(() => checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
	}
}
