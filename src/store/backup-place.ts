/**
 * Where the copy goes, remembered across restarts (Settings → Backup): the
 * chosen destination and the folder it goes to. A record of its own at the
 * data-dir seam, on the same discipline as src/store/auth.ts: re-read at every
 * access so a hand-edit works, an absent or corrupt file is the documented
 * first-boot state (the private bucket), and the write is atomic so a half file
 * never reads as a choice.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { BackupDestination } from "../core/backup.ts";

export const BACKUP_PLACE_FILE = path.join(PATHS.base, "backup-place.json");

export interface BackupPlace {
	destination: BackupDestination;
	folder: string | null;
}

export function readBackupPlace(): BackupPlace {
	try {
		const raw = JSON.parse(fs.readFileSync(BACKUP_PLACE_FILE, "utf-8")) as { destination?: unknown; folder?: unknown };
		return {
			destination: raw.destination === "folder" ? "folder" : "cloudflare",
			folder: typeof raw.folder === "string" && raw.folder ? raw.folder : null,
		};
	} catch {
		return { destination: "cloudflare", folder: null };
	}
}

export function writeBackupPlace(place: BackupPlace): void {
	const dir = path.dirname(BACKUP_PLACE_FILE);
	fs.mkdirSync(dir, { recursive: true });
	const tmp = path.join(dir, `.${path.basename(BACKUP_PLACE_FILE)}.tmp-${process.pid}`);
	fs.writeFileSync(tmp, `${JSON.stringify(place, null, "\t")}\n`);
	fs.renameSync(tmp, BACKUP_PLACE_FILE);
}
