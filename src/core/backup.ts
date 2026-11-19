/**
 * The data folder against its copies (Settings → Backup): the report's shape and
 * the one reading the browser takes from it. Pure: the server measures
 * (src/server/backup.ts), the browser shows (backup-section.tsx).
 *
 * A copy is a folder on this computer and/or the private `lanna` bucket, and
 * each reads like the data folder: one file each. A file is known to be the same
 * in two places by its MD5, which is the `etag` a bucket object carries when it
 * was uploaded in one request (developers.cloudflare.com/r2/objects/upload-objects).
 * Every place is compared on its own, so one place being behind never reads as
 * the other being up to date.
 */

/** A count of files and their total size. */
export interface BackupCounts {
	files: number;
	bytes: number;
}

/** One part of the data folder. */
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
	/** What this part holds on this computer. */
	here: BackupCounts;
}

/** The folder a file belongs to: its top folder when that is one of the areas, everything else together. */
export function backupAreaOf(relative: string): BackupAreaId {
	const cut = relative.indexOf("/");
	const top = cut === -1 ? "" : relative.slice(0, cut);
	return BACKUP_AREAS.some((area) => area.id === top) ? (top as BackupAreaId) : "other";
}

/** One place a copy can go. */
export type BackupPlaceId = "folder" | "cloudflare";

/** What one look at one place found. A place that is off has no check at all. */
export interface BackupCheck {
	/** When it ran, ISO. */
	at: string;
	/** Everything the app keeps that belongs in the backup, in that place. */
	copy: BackupCounts;
	/** New or changed here, so an upload there would send them. */
	toUpload: BackupCounts;
	/** In that place, not here, so a restore would fetch them. */
	toRestore: BackupCounts;
	/** Why that place could not be read; the three counts are empty then. */
	error?: string;
}

/** This computer, as the last look counted it. */
export interface BackupHere {
	at: string;
	counts: BackupCounts;
	/** Every area, in the order Settings shows them. */
	areas: BackupArea[];
}

/** One upload or restore run. */
export interface BackupJob {
	action: "upload" | "restore";
	/** The place the run is filling. */
	place: BackupPlaceId;
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
	/** The folder this computer copies to as well; null = it does not copy to a folder. */
	folder: string | null;
	/** The folder offered before one was chosen. */
	suggestedFolder: string;
	/** The private bucket's name. */
	bucket: string;
	/** Whether this computer copies to the bucket too. */
	bucketOn: boolean;
	/** null = no Cloudflare login and no token, so the bucket cannot be read. */
	auth: BackupAuth | null;
	/** What stays on this computer. */
	leftOut: string[];
	/** This computer, from the last look; null before the first one. */
	here: BackupHere | null;
	/** The last look at each place that is on. */
	checks: { folder: BackupCheck | null; cloudflare: BackupCheck | null };
	/** The one run going now, upload or restore, and where it is going. */
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
