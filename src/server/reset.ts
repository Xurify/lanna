/**
 * Start over: move the active language profile's whole data folder (progress,
 * chats, review cards, skill map, speak sessions...) into
 * <data>/backups/<profile>-<stamp>/ and leave a fresh empty one. Nothing is
 * deleted, so a mistaken reset is undone by moving the folder back. Settings,
 * keys and the shared audio cache live outside the profile and are kept.
 */

import fs from "node:fs";
import path from "node:path";
import { ACTIVE_PROFILE, PATHS } from "../../config.ts";

export const BACKUPS_DIR = path.join(PATHS.base, "backups");

export interface ResetOutcome {
	profile: string;
	backup: string;
}

export function resetProfileData(now = new Date()): ResetOutcome {
	const stamp = now.toISOString().replace(/[:.]/g, "-");
	const backup = path.join(BACKUPS_DIR, `${ACTIVE_PROFILE}-${stamp}`);
	fs.mkdirSync(BACKUPS_DIR, { recursive: true });
	if (fs.existsSync(PATHS.data)) fs.renameSync(PATHS.data, backup);
	fs.mkdirSync(PATHS.data, { recursive: true });
	return { profile: ACTIVE_PROFILE, backup };
}
