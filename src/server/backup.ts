/**
 * Settings → Backup: whether the data folder and each place it is copied to
 * still hold the same files, and the one upload or restore that may be running
 * now. A copy goes to a folder on this computer, to the private `lanna` bucket
 * with the Cloudflare login it is read with, or to both: every place is read and
 * compared on its own, so one being behind never passes for the other being up
 * to date.
 *
 * Reading a place costs a hash of every local file, so each answer is kept for
 * the rest of the run and a fresh check can be asked for. The data folder stays
 * the source: an upload only adds and replaces files, a restore only writes
 * files that are missing here.
 */

import { PATHS } from "../../config.ts";
import { processWide } from "../core/process-wide.ts";
import {
	BACKUP_AREAS,
	backupAreaOf,
	type BackupArea,
	type BackupAuth,
	type BackupCheck,
	type BackupCounts,
	type BackupHere,
	type BackupJob,
	type BackupPlaceId,
	type BackupState,
} from "../core/backup.ts";
import { readBackupPlace, writeBackupPlace } from "../store/backup-place.ts";
import {
	AccountNotVisible,
	BACKUP_BUCKET,
	BucketMissing,
	cloudflareBucket,
	cloudflareSignIn,
	cloudflareSignOut,
	ensureBucket,
	forgetStoredToken,
	leftOut,
	localFiles,
	pull,
	pullPlan,
	push,
	pushPlan,
	shellRun,
	tokenPrint,
	totalBytes,
	wranglerAuth,
	type BackupFile,
	type Bucket,
	type ShellRun,
} from "./cloud-backup.ts";
import {
	FolderGone,
	FolderUnusable,
	folderBucket,
	prepareFolder,
	resolveFolder,
	suggestedFolder,
} from "./folder-backup.ts";

export class BackupError extends Error {
	constructor(
		message: string,
		readonly status = 409,
	) {
		super(message);
	}
}

const NOT_SIGNED_IN = "Not signed in to Cloudflare. Sign in under Where the copies go, or run `npx wrangler login`.";
const SIGN_IN_FAILED = "Couldn’t finish signing in. Try again, or run `npx wrangler login`.";
const SIGN_OUT_FAILED = "Couldn’t sign out. Try again, or run `npx wrangler logout`.";
const FROM_ENV = "That token comes from .env.local, so remove it there and restart.";
const NO_ACCOUNT =
	"That token cannot see a Cloudflare account, which reading the bucket needs first: give it Workers R2 Storage Edit and Account Settings Read on one account (Get a key fills both in).";

/** A failure the login would explain reads as that, so nobody looks for a key to a lock they are not holding.
 *  A folder's own failure is never read as a login: it says what is wrong with the folder. */
export function backupError(err: unknown): string {
	if (err instanceof BucketMissing)
		return `The bucket \`${BACKUP_BUCKET}\` is not in this Cloudflare account yet, so there is nothing to compare. Uploading creates it.`;
	if (err instanceof AccountNotVisible) return NO_ACCOUNT;
	if (err instanceof FolderGone || err instanceof FolderUnusable) return err.message;
	const message = err instanceof Error ? err.message : String(err);
	if (/login|logged in|authenticat|wrangler|ENOENT|401/i.test(message)) return NOT_SIGNED_IN;
	return message.split("\n")[0]!.slice(0, 160);
}

/** A bucket per place, when a caller already has one (a test, or the run that just filled it). */
type Buckets = Partial<Record<BackupPlaceId, Bucket>>;

const empty = (): BackupCounts => ({ files: 0, bytes: 0 });
const counts = (files: BackupFile[]): BackupCounts => ({ files: files.length, bytes: totalBytes(files) });

function areasOf(here: BackupFile[]): BackupArea[] {
	const areas = new Map(BACKUP_AREAS.map(({ id }) => [id, { id, here: empty() }]));
	for (const file of here) {
		const area = areas.get(backupAreaOf(file.path))!.here;
		area.files += 1;
		area.bytes += file.size;
	}
	return [...areas.values()];
}

const state = processWide("backup.state", () => ({
	auth: undefined as BackupAuth | null | undefined,
	/** What the answer above was read from, so saving or clearing a token shows up without a restart. */
	authPrint: undefined as string | undefined,
	/** The check the answer above was read at, so a login made after a failed check is picked up once. */
	authAt: undefined as string | undefined,
	/** The last look at each place. A place that is off has none. */
	checks: { folder: null, cloudflare: null } as { folder: BackupCheck | null; cloudflare: BackupCheck | null },
	/** This computer, from the last look. */
	here: null as BackupHere | null,
	job: null as BackupJob | null,
}));

/** Read the way in again when the token print changed, or when the bucket's check on hand contradicts it
 *  — a login made on the command line, or one that went away. A later check is read for the same way, once.
 *  A bucket this computer does not copy to asks wrangler nothing. */
async function refreshAuth(run: ShellRun): Promise<void> {
	if (!readBackupPlace().bucket) {
		state.auth = null;
		state.authPrint = undefined;
		state.authAt = undefined;
		state.checks.cloudflare = null;
		return;
	}
	const print = tokenPrint();
	const check = state.checks.cloudflare;
	const changed = state.auth !== undefined && state.authPrint !== print;
	const disagrees =
		state.auth !== undefined &&
		check !== null &&
		state.authAt !== check.at &&
		(state.auth === null ? !check.error : Boolean(check.error));
	if (state.auth !== undefined && !changed && !disagrees) return;
	// The check on hand was answered by the way in that just changed, so it goes with it. One that only
	// disagrees keeps its own answer: it is the check the learner asked for.
	if (changed) state.checks.cloudflare = null;
	if (disagrees) state.authAt = check?.at;
	state.auth = await wranglerAuth(run);
	state.authPrint = print;
}

/** The state as it stands, without asking wrangler anything: what a look answers with. */
function snapshot(): BackupState {
	const saved = readBackupPlace();
	return {
		folder: saved.folder,
		suggestedFolder: suggestedFolder(),
		bucket: BACKUP_BUCKET,
		bucketOn: saved.bucket,
		auth: state.auth ?? null,
		leftOut: leftOut(),
		here: state.here,
		checks: { folder: state.checks.folder, cloudflare: state.checks.cloudflare },
		job: state.job,
	};
}

export async function backupState(run: ShellRun = shellRun): Promise<BackupState> {
	await refreshAuth(run);
	return snapshot();
}

const NO_PATH = "Type the folder to copy to.";

/** A folder on this computer joins the copies: no account, no key, nothing to sign in to.
 *  It joins the bucket rather than replacing it; the folder's own check is the one that goes. */
export async function useFolder(rawFolder: string, run: ShellRun = shellRun): Promise<BackupState> {
	if (!rawFolder.trim()) throw new BackupError(NO_PATH, 400);
	const folder = resolveFolder(rawFolder);
	try {
		prepareFolder(folder);
	} catch (err) {
		throw new BackupError(backupError(err), 400);
	}
	writeBackupPlace({ folder, bucket: readBackupPlace().bucket });
	state.checks.folder = null;
	return backupState(run);
}

/** This computer stops copying to that folder; the path goes with it. */
export async function dropFolder(run: ShellRun = shellRun): Promise<BackupState> {
	writeBackupPlace({ folder: null, bucket: readBackupPlace().bucket });
	state.checks.folder = null;
	return backupState(run);
}

/** The private bucket joins the copies, or stops being one. Its way in is untouched either way. */
export async function useBucket(on: boolean, run: ShellRun = shellRun): Promise<BackupState> {
	writeBackupPlace({ folder: readBackupPlace().folder, bucket: on });
	state.checks.cloudflare = null;
	if (on) {
		state.auth = undefined;
		state.authPrint = undefined;
		state.authAt = undefined;
	}
	return backupState(run);
}

/** Wrangler signs in and out; the bucket's last check goes with the old login. Signing in asks to copy there. */
export async function connectBackup(run: ShellRun = shellRun): Promise<BackupState> {
	try {
		await cloudflareSignIn(run);
	} catch {
		throw new BackupError(SIGN_IN_FAILED, 502);
	}
	writeBackupPlace({ folder: readBackupPlace().folder, bucket: true });
	state.auth = await wranglerAuth(run);
	state.authPrint = tokenPrint();
	state.authAt = state.checks.cloudflare?.at;
	state.checks.cloudflare = null;
	return backupState(run);
}

/** One way out per way in: wrangler logs out, a token saved under API keys is dropped. */
export async function disconnectBackup(run: ShellRun = shellRun): Promise<BackupState> {
	await refreshAuth(run);
	const via = state.auth?.via;
	if (via === "env") throw new BackupError(FROM_ENV);
	if (via === "settings") forgetStoredToken();
	else {
		try {
			await cloudflareSignOut(run);
		} catch {
			throw new BackupError(SIGN_OUT_FAILED, 502);
		}
	}
	state.auth = await wranglerAuth(run);
	state.authPrint = tokenPrint();
	state.authAt = state.checks.cloudflare?.at;
	state.checks.cloudflare = null;
	return backupState(run);
}

/** What one place holds, and what one copy each way would move. */
async function look(local: BackupFile[], at: string, bucket: Bucket): Promise<BackupCheck> {
	const check: BackupCheck = { at, copy: empty(), toUpload: empty(), toRestore: empty() };
	try {
		const remote = await bucket.list();
		check.copy = counts(remote);
		check.toUpload = counts(pushPlan(local, remote).upload);
		check.toRestore = counts(pullPlan(local, remote).download);
	} catch (err) {
		check.error = backupError(err);
	}
	return check;
}

/** The bucket one place is read through: one a caller already has, else the place itself. */
async function bucketFor(place: BackupPlaceId, buckets?: Buckets): Promise<Bucket> {
	const given = buckets?.[place];
	if (given) return given;
	const saved = readBackupPlace();
	if (place === "folder") {
		if (saved.folder === null) throw new BackupError("That place is not one of the copies.");
		return folderBucket(saved.folder);
	}
	return cloudflareBucket();
}

/** Read this computer, then every place it is copied to that is on. One place failing never hides another's answer. */
export async function checkBackup(options: { buckets?: Buckets } = {}): Promise<BackupState> {
	const local = await localFiles(PATHS.base);
	const at = new Date().toISOString();
	state.here = { at, counts: counts(local), areas: areasOf(local) };
	const saved = readBackupPlace();
	const wanted: BackupPlaceId[] = [];
	if (saved.folder !== null) wanted.push("folder");
	if (saved.bucket) wanted.push("cloudflare");
	await Promise.all(
		wanted.map(async (id) => {
			state.checks[id] = await look(local, at, await bucketFor(id, options.buckets));
		}),
	);
	if (saved.folder === null) state.checks.folder = null;
	if (!saved.bucket) state.checks.cloudflare = null;
	return snapshot();
}

async function run(action: BackupJob["action"], options: { buckets?: Buckets }, running: BackupJob): Promise<void> {
	try {
		const bucket = await bucketFor(running.place, options.buckets);
		if (action === "upload" && running.place === "cloudflare" && !options.buckets?.cloudflare) await ensureBucket();
		const local = await localFiles(PATHS.base);
		const remote = await bucket.list();
		const plan = action === "upload" ? pushPlan(local, remote).upload : pullPlan(local, remote).download;
		running.total = plan.length;
		const copy = action === "upload" ? push : pull;
		const failed = await copy(PATHS.base, bucket, plan, () => {
			running.done++;
		});
		running.failed = failed.length;
		if (failed[0]) running.error = failed[0];
		await checkBackup({ buckets: { [running.place]: bucket } });
	} catch (err) {
		running.error = backupError(err);
	} finally {
		running.finishedAt = new Date().toISOString();
	}
}

/** Start one upload or restore into one place; the returned promise settles when it is done
 *  (the route lets it run, a test waits on it). */
export function startBackup(
	action: BackupJob["action"],
	place: BackupPlaceId,
	options: { buckets?: Buckets } = {},
): Promise<BackupJob> {
	const running = state.job;
	if (running && !running.finishedAt) throw new BackupError("A backup is already running.");
	const job: BackupJob = { action, place, total: 0, done: 0, failed: 0, startedAt: new Date().toISOString() };
	state.job = job;
	return run(action, options, job).then(() => job);
}
