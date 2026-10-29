/**
 * The AuthStore adapter (auth-keys wave, 2026-09-19): the flat {VAR: value}
 * auth.json map at config.AUTH_FILE — the SAME file the Electron app has
 * always hand-edited (owner decision: option A — same file, env-located,
 * zero migration). 0600, atomic writes, hand-edits keep working (the file
 * is re-read from disk on every access).
 *
 * The server (src/server/keys.ts) is the only intended writer: it applies
 * shape validation before setAuthVar and env precedence on top of
 * authVars(). This adapter persists what it is given, never throws
 * (absent/corrupt file = {} = "no keys yet", the documented first-boot
 * state, matching settings doctrine), and preserves unknown vars verbatim
 * (forward-compat: future entries — e.g. a plans-login token — ride along
 * untouched until a catalog entry adopts them).
 */

import fs from "node:fs";
import path from "node:path";
import { AUTH_FILE } from "../../config.ts";
import type { AuthStore } from "../core/ports.ts";

/** The flat string→string map, or {} for absent/corrupt/non-object. */
function readMap(): Record<string, string> {
	try {
		const raw = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
		return Object.fromEntries(
			Object.entries(raw).filter(([, v]) => typeof v === "string") as [string, string][],
		);
	} catch {
		return {}; // absent or corrupt — the documented state is "no keys yet"
	}
}

/** Write the map atomically at mode 0600: a partial write must never
 *  leave a 0644 file (secrets) or a truncated JSON (looks like "no keys").
 *  tmp-in-same-dir + rename keeps the swap atomic; chmod BEFORE the
 *  rename so the mode never exists relaxed on the final path. */
function writeJson(file: string, map: Record<string, string>): void {
	const dir = path.dirname(file);
	fs.mkdirSync(dir, { recursive: true });
	const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}`);
	fs.writeFileSync(tmp, `${JSON.stringify(map, null, "\t")}\n`, { mode: 0o600 });
	fs.chmodSync(tmp, 0o600); // umask may have relaxed the create mode
	fs.renameSync(tmp, file);
}

function writeMap(map: Record<string, string>): void {
	writeJson(AUTH_FILE, map);
}

/** When each key was last saved through the app (ISO time, by var name).
 *  A sidecar next to auth.json, so auth.json keeps its flat var-only shape:
 *  every string in auth.json is an env var, and a date there would leak
 *  into the environment. A hand-edited key keeps its last saved date. */
const SAVED_FILE = path.join(path.dirname(AUTH_FILE), "auth-saved.json");

function readSaved(): Record<string, string> {
	try {
		const raw = JSON.parse(fs.readFileSync(SAVED_FILE, "utf-8"));
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
		return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string") as [string, string][]);
	} catch {
		return {};
	}
}

export const authKeySavedAt = {
	all(): Record<string, string> {
		return readSaved();
	},
	set(name: string, iso: string): void {
		const map = readSaved();
		map[name] = iso;
		writeJson(SAVED_FILE, map);
	},
	delete(name: string): void {
		const map = readSaved();
		if (!(name in map)) return;
		delete map[name];
		writeJson(SAVED_FILE, map);
	},
};

export const authStore: AuthStore = {
	authVars() {
		return readMap();
	},
	setAuthVar(name, value) {
		const map = readMap();
		map[name] = value;
		writeMap(map);
	},
	deleteAuthVar(name) {
		const map = readMap();
		if (!(name in map)) return; // absent = silent success, idempotent
		delete map[name];
		writeMap(map);
	},
};
