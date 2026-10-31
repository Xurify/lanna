/**
 * Settings → Storage, server side: measure what the app keeps on this
 * computer. Read-only on purpose. The one thing the app clears is the desktop
 * shell's HTTP cache (electron/storage-ipc.cjs). Saved voice clips, learning
 * progress and backups are never cleared from Settings.
 */

import fs from "node:fs";
import path from "node:path";
import { ACTIVE_PROFILE, PATHS } from "../../config.ts";
import { LANGUAGES } from "../core/language.ts";
import type { StorageArea, StorageReport } from "../core/storage.ts";
import { BACKUPS_DIR } from "./reset.ts";

/** Size and file count of everything under `dir`. A missing folder is empty. */
export async function measureTree(dir: string): Promise<{ bytes: number; files: number }> {
	let bytes = 0;
	let files = 0;
	const walk = async (folder: string): Promise<void> => {
		let entries: fs.Dirent[];
		try {
			entries = await fs.promises.readdir(folder, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = path.join(folder, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.isFile()) {
				try {
					bytes += (await fs.promises.stat(full)).size;
					files += 1;
				} catch {
					// Removed while measuring: not counted.
				}
			}
		}
	};
	await walk(dir);
	return { bytes, files };
}

/** What the app keeps for the learner, measured now. */
export async function storageReport(): Promise<StorageReport> {
	const folders: { id: StorageArea["id"]; label: string; path: string }[] = [
		{ id: "clips", label: "Voice clips", path: PATHS.audio },
		{ id: "progress", label: "Learning progress", path: PATHS.data },
		{ id: "backups", label: "Backups", path: BACKUPS_DIR },
	];
	const areas: StorageArea[] = [];
	for (const folder of folders) areas.push({ ...folder, ...(await measureTree(folder.path)) });
	return { language: LANGUAGES[ACTIVE_PROFILE].english, areas };
}
