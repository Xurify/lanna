/**
 * The data folder against the private `lanna` bucket (Settings → Backup): the
 * report's shape and the one reading the browser takes from it. Pure: the
 * server measures (src/server/backup.ts), the browser shows (backup-section.tsx).
 *
 * One object per file under `data/`, so the bucket reads like the folder, and a
 * file is known to be the same in both places by its MD5, which is the `etag`
 * Cloudflare returns for an object uploaded in one request
 * (developers.cloudflare.com/r2/objects/upload-objects).
 */

/** A count of files and their total size. */
export interface BackupCounts {
	files: number;
	bytes: number;
}

/** One part of the data folder, counted on this computer and in the bucket. */
export type BackupAreaId = "audio" | "languages" | "profiles" | "backups" | "other";

/** The saved areas in the order Settings shows them. Every row is drawn before the measure lands, so nothing shifts. */
export const BACKUP_AREAS: readonly { id: BackupAreaId; label: string }[] = [
	{ id: "audio", label: "Voice clips" },
	{ id: "languages", label: "Language data" },
	{ id: "profiles", label: "Learning progress" },
	{ id: "backups", label: "Backups" },
	{ id: "other", label: "Everything else" },
];

export interface BackupArea {
	id: BackupAreaId;
	here: BackupCounts;
	cloud: BackupCounts;
}

/** The folder a file belongs to: its top folder when that is one of the areas, everything else together. */
export function backupAreaOf(relative: string): BackupAreaId {
	const cut = relative.indexOf("/");
	const top = cut === -1 ? "" : relative.slice(0, cut);
	return BACKUP_AREAS.some((area) => area.id === top) ? (top as BackupAreaId) : "other";
}

/** What one check of the folder against the bucket found. */
export interface BackupCheck {
	/** When it ran, ISO. */
	at: string;
	/** Everything the app keeps that belongs in the backup, as it is now. */
	here: BackupCounts;
	cloud: BackupCounts;
	/** New or changed here, so an upload would send them. */
	toUpload: BackupCounts;
	/** In the bucket, not here, so a restore would fetch them. */
	toRestore: BackupCounts;
	/** Every area, counted on both sides. */
	areas: BackupArea[];
	/** Why the bucket could not be read; the two counts above are the local ones alone then. */
	error?: string;
}

/** One upload or restore run. */
export interface BackupJob {
	action: "upload" | "restore";
	/** Files to copy; 0 while the plan is still being worked out. */
	total: number;
	done: number;
	failed: number;
	startedAt: string;
	finishedAt?: string;
	/** The first file that failed, or why the run stopped. */
	error?: string;
}

export interface BackupState {
	bucket: string;
	/** null = this computer has no Cloudflare login and no token. */
	auth: BackupAuth | null;
	/** What stays on this computer. */
	leftOut: string[];
	last: BackupCheck | null;
	job: BackupJob | null;
}

/** How Lanna reaches the bucket. */
export interface BackupAuth {
	/** The login `wrangler login` made on this computer, or a CLOUDFLARE_API_TOKEN saved under API keys or in .env.local. */
	via: "wrangler" | "settings" | "env";
	/** The email wrangler is signed in with; a token carries no name. */
	account: string | null;
}

export type BackupOutcome = "unchecked" | "unreachable" | "waiting" | "even";

export function backupOutcome(check: BackupCheck | null): BackupOutcome {
	if (!check) return "unchecked";
	if (check.error) return "unreachable";
	return check.toUpload.files > 0 || check.toRestore.files > 0 ? "waiting" : "even";
}
