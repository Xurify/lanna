/**
 * Settings → Backup: whether the data folder and the private `lanna` bucket
 * still hold the same files, the one upload or restore that may be running,
 * and the Cloudflare login the bucket is read with.
 *
 * Reading the bucket needs the login `wrangler login` made, and a check hashes
 * every local file, so the answer is kept for the rest of the run and a fresh
 * check can be asked for. The folder stays the source: an upload only adds and
 * replaces objects, a restore only writes files that are missing here.
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
	type BackupJob,
	type BackupState,
} from "../core/backup.ts";
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

export class BackupError extends Error {
	constructor(
		message: string,
		readonly status = 409,
	) {
		super(message);
	}
}

const NOT_SIGNED_IN = "Not signed in to Cloudflare. Sign in under Where the copy goes, or run `npx wrangler login`.";
const SIGN_IN_FAILED = "Couldn’t finish signing in. Try again, or run `npx wrangler login`.";
const SIGN_OUT_FAILED = "Couldn’t sign out. Try again, or run `npx wrangler logout`.";
const FROM_ENV = "That token comes from .env.local, so remove it there and restart.";
const NO_ACCOUNT =
	"That token cannot see a Cloudflare account, which reading the bucket needs first: give it Workers R2 Storage Edit and Account Settings Read on one account (Get a key fills both in).";

/** A failure the login would explain reads as that, so nobody looks for a key to a lock they are not holding. */
export function backupError(err: unknown): string {
	if (err instanceof BucketMissing)
		return `The bucket \`${BACKUP_BUCKET}\` is not in this Cloudflare account yet, so there is nothing to compare. Uploading creates it.`;
	if (err instanceof AccountNotVisible) return NO_ACCOUNT;
	const message = err instanceof Error ? err.message : String(err);
	if (/login|logged in|authenticat|wrangler|ENOENT|401/i.test(message)) return NOT_SIGNED_IN;
	return message.split("\n")[0]!.slice(0, 160);
}

const empty = (): BackupCounts => ({ files: 0, bytes: 0 });
const counts = (files: BackupFile[]): BackupCounts => ({ files: files.length, bytes: totalBytes(files) });

function areasOf(here: BackupFile[], cloud: BackupFile[]): BackupArea[] {
	const areas = new Map(BACKUP_AREAS.map(({ id }) => [id, { id, here: empty(), cloud: empty() }]));
	for (const [side, files] of [
		["here", here],
		["cloud", cloud],
	] as const)
		for (const file of files) {
			const area = areas.get(backupAreaOf(file.path))![side];
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
	last: null as BackupCheck | null,
	job: null as BackupJob | null,
}));

/** Read the way in again when it changed, or once after a check that failed with none. Either way the
 *  check on hand was answered by the way in before it, so it goes with it rather than staying on screen. */
async function refreshAuth(run: ShellRun): Promise<void> {
	const print = tokenPrint();
	const changed = state.auth !== undefined && state.authPrint !== print;
	const laterFailed = state.auth === null && state.last !== null && state.authAt !== state.last.at;
	if (state.auth !== undefined && !changed && !laterFailed) return;
	if (changed || laterFailed) state.last = null;
	state.auth = await wranglerAuth(run);
	state.authPrint = print;
	state.authAt = state.last?.at;
}

export async function backupState(run: ShellRun = shellRun): Promise<BackupState> {
	await refreshAuth(run);
	return { bucket: BACKUP_BUCKET, auth: state.auth!, leftOut: leftOut(), last: state.last, job: state.job };
}

/** Wrangler signs in and out; the last check goes with the old login, so the next look answers for the new one. */
export async function connectBackup(run: ShellRun = shellRun): Promise<BackupState> {
	try {
		await cloudflareSignIn(run);
	} catch {
		throw new BackupError(SIGN_IN_FAILED, 502);
	}
	state.auth = await wranglerAuth(run);
	state.authPrint = tokenPrint();
	state.authAt = state.last?.at;
	state.last = null;
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
	state.authAt = state.last?.at;
	state.last = null;
	return backupState(run);
}

async function bucketFor(options: { bucket?: Bucket }): Promise<Bucket> {
	return options.bucket ?? (await cloudflareBucket());
}

export async function checkBackup(options: { bucket?: Bucket } = {}): Promise<BackupCheck> {
	const local = await localFiles(PATHS.base);
	const check: BackupCheck = {
		at: new Date().toISOString(),
		here: counts(local),
		cloud: empty(),
		toUpload: empty(),
		toRestore: empty(),
		areas: areasOf(local, []),
	};
	try {
		const remote = await (await bucketFor(options)).list();
		check.cloud = counts(remote);
		check.toUpload = counts(pushPlan(local, remote).upload);
		check.toRestore = counts(pullPlan(local, remote).download);
		check.areas = areasOf(local, remote);
	} catch (err) {
		check.error = backupError(err);
	}
	state.last = check;
	return check;
}

async function run(action: BackupJob["action"], options: { bucket?: Bucket }, running: BackupJob): Promise<void> {
	try {
		if (action === "upload" && !options.bucket) await ensureBucket();
		const bucket = await bucketFor(options);
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
		await checkBackup({ bucket });
	} catch (err) {
		running.error = backupError(err);
	} finally {
		running.finishedAt = new Date().toISOString();
	}
}

/** Start one upload or restore; the returned promise settles when it is done
 *  (the route lets it run, a test waits on it). */
export function startBackup(action: BackupJob["action"], options: { bucket?: Bucket } = {}): Promise<BackupJob> {
	const running = state.job;
	if (running && !running.finishedAt) throw new BackupError("A backup is already running.");
	const job: BackupJob = { action, total: 0, done: 0, failed: 0, startedAt: new Date().toISOString() };
	state.job = job;
	return run(action, options, job).then(() => job);
}
