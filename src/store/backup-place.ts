/**
 * Where the copies go, remembered across restarts (Settings → Backup): the
 * folder this computer copies to, and whether the private bucket is one of the
 * places as well. A record of its own at the data-dir seam, on the same
 * discipline as src/store/auth.ts: re-read at every access so a hand-edit works,
 * an absent or corrupt file is the documented first-boot state (the bucket, no
 * folder), and the write is atomic so a half file never reads as a choice.
 *
 * The key it used to hold, `destination`, chose between the two. An older file
 * is read as that choice: a folder destination keeps its folder and turns the
 * bucket off, a bucket destination forgets the folder it was only remembering.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";

export const BACKUP_PLACE_FILE = path.join(PATHS.base, "backup-place.json");

export interface BackupPlace {
	/** The folder this computer copies to as well; null = it does not copy to a folder. */
	folder: string | null;
	/** Whether this computer copies to the private bucket as well. */
	bucket: boolean;
}

const FIRST_BOOT: BackupPlace = { folder: null, bucket: true };

export function readBackupPlace(): BackupPlace {
	try {
		const raw = JSON.parse(fs.readFileSync(BACKUP_PLACE_FILE, "utf-8")) as {
			folder?: unknown;
			bucket?: unknown;
			destination?: unknown;
		};
		const folder = typeof raw.folder === "string" && raw.folder ? raw.folder : null;
		if (typeof raw.bucket === "boolean") return { folder, bucket: raw.bucket };
		if (raw.destination === "folder") return { folder, bucket: false };
		return { folder: null, bucket: true };
	} catch {
		return { ...FIRST_BOOT };
	}
}

export function writeBackupPlace(place: BackupPlace): void {
	const dir = path.dirname(BACKUP_PLACE_FILE);
	fs.mkdirSync(dir, { recursive: true });
	const tmp = path.join(dir, `.${path.basename(BACKUP_PLACE_FILE)}.tmp-${process.pid}`);
	fs.writeFileSync(tmp, `${JSON.stringify(place, null, "\t")}\n`);
	fs.renameSync(tmp, BACKUP_PLACE_FILE);
}
