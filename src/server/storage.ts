/**
 * Measures what the app keeps on this computer for Settings → Data. Read-only:
 * saved voice clips, learning progress and backups are never cleared from Settings.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { activeLanguage } from "./active-language.ts";
import { STORAGE_AREAS, type StorageArea, type StorageReport } from "../core/storage.ts";
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
	const paths: Record<StorageArea["id"], string> = { clips: PATHS.audio, progress: PATHS.data, backups: BACKUPS_DIR };
	const areas: StorageArea[] = [];
	for (const { id, label } of STORAGE_AREAS)
		areas.push({ id, label, path: paths[id], ...(await measureTree(paths[id])) });
	return { language: activeLanguage().english, areas };
}
