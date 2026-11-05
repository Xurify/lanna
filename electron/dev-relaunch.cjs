/**
 * Relaunching under `npm run desktop:dev` (2026-11-05). A language switch
 * restarts the app, because the server reads the active profile once at
 * boot. The packaged app owns its server, so app.relaunch() restarts both.
 * Under desktop:dev the launcher (scripts/desktop-dev.mjs) owns `next dev`
 * and Electron, and stops both when Electron exits: app.relaunch() then
 * opened a new window on a server that had just been killed, an empty
 * black window. So in dev the shell exits with this code instead, and the
 * launcher starts Next and Electron again.
 */

/** EX_TEMPFAIL from sysexits.h: "try again". */
const RELAUNCH_EXIT_CODE = 75;

/** Set by the launcher on the Electron it starts: it can restart both. */
const LAUNCHER_ENV = "LH_DEV_LAUNCHER";

/** How the shell restarts itself: through the launcher when one started
 *  it, else by Electron's own relaunch. */
function relaunchMode(env) {
	return env.LH_DEV_URL && env[LAUNCHER_ENV] === "1" ? "launcher" : "electron";
}

/** What the launcher does when Electron exits with `code`. */
function onShellExit(code) {
	return code === RELAUNCH_EXIT_CODE ? "restart" : "stop";
}

module.exports = { RELAUNCH_EXIT_CODE, LAUNCHER_ENV, relaunchMode, onShellExit };
