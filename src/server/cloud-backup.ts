import { exec } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { mediaBackupPath } from "../core/media-path.ts";
import type { BackupAuth } from "../core/backup.ts";
import { authStore } from "../store/auth.ts";
import { BACKUP_PLACE_FILE } from "../store/backup-place.ts";
import { deleteKey, keyValue } from "./keys.ts";

export const BACKUP_BUCKET = "lanna";
const PREFIX = "data/";
const API = "https://api.cloudflare.com/client/v4";
const WRANGLER = "npx -y wrangler@4";
const ENV_TOKEN = "CLOUDFLARE_API_TOKEN";
const LOGIN_TIMEOUT = 180_000;

const LEFT_OUT = [
	{ path: "access.json", why: "the paired devices' token hashes belong to this computer" },
	{ path: "export/", why: "snapshots made from the rest" },
	{ path: path.basename(BACKUP_PLACE_FILE), why: "the folder this computer copies to" },
];

export interface BackupFile {
	path: string;
	size: number;
	md5: string;
}

export interface Bucket {
	list(): Promise<BackupFile[]>;
	put(file: string, data: Buffer): Promise<void>;
	get(file: string): Promise<Buffer>;
	remove?(file: string): Promise<void>;
}

export function backedUp(relative: string): boolean {
	return !LEFT_OUT.some((rule) => (rule.path.endsWith("/") ? relative.startsWith(rule.path) : relative === rule.path));
}

export function leftOut(): string[] {
	return LEFT_OUT.map((rule) => `${rule.path} (${rule.why})`);
}

export async function localFiles(root: string): Promise<BackupFile[]> {
	const files: BackupFile[] = [];
	const walk = async (dir: string): Promise<void> => {
		for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
			const absolute = path.join(dir, entry.name);
			const relative = path.relative(root, absolute).split(path.sep).join("/");
			if (entry.isDirectory()) {
				if (backedUp(`${relative}/`)) await walk(absolute);
			} else if (entry.isFile() && backedUp(relative)) {
				const data = await fs.promises.readFile(absolute);
				files.push({ path: relative, size: data.length, md5: createHash("md5").update(data).digest("hex") });
			}
		}
	};
	if (fs.existsSync(root)) await walk(root);
	return files.sort((a, b) => a.path.localeCompare(b.path));
}

export interface PushPlan {
	upload: BackupFile[];
	same: number;
	onlyInCloud: string[];
}

export function pushPlan(local: BackupFile[], remote: BackupFile[]): PushPlan {
	const inCloud = new Map(remote.map((file) => [file.path, file]));
	const here = new Set(local.map((file) => file.path));
	const upload = local.filter((file) => inCloud.get(file.path)?.md5 !== file.md5);
	return {
		upload,
		same: local.length - upload.length,
		onlyInCloud: remote.filter((file) => !here.has(file.path)).map((file) => file.path),
	};
}

export interface PullPlan {
	download: BackupFile[];
	same: number;
	different: string[];
}

export function pullPlan(local: BackupFile[], remote: BackupFile[]): PullPlan {
	const here = new Map(local.map((file) => [file.path, file]));
	const preferred = new Map<string, BackupFile>();
	for (const file of remote) {
		if (!backedUp(file.path)) continue;
		const target = mediaBackupPath(file.path);
		if (!preferred.has(target) || target === file.path) preferred.set(target, file);
	}
	const kept = [...preferred.values()];
	const download = kept.filter((file) => !here.has(mediaBackupPath(file.path)));
	const different = kept.filter((file) => {
		const local = here.get(mediaBackupPath(file.path));
		return local && local.md5 !== file.md5;
	});
	return {
		download,
		same: kept.length - download.length - different.length,
		different: different.map((file) => mediaBackupPath(file.path)),
	};
}

export function totalBytes(files: BackupFile[]): number {
	return files.reduce((sum, file) => sum + file.size, 0);
}

export async function push(
	root: string,
	bucket: Bucket,
	files: BackupFile[],
	done: (file: BackupFile) => void,
): Promise<string[]> {
	return inParallel(files, async (file) => {
		await bucket.put(file.path, fs.readFileSync(path.join(root, file.path)));
		done(file);
	});
}

export async function pull(
	root: string,
	bucket: Bucket,
	files: BackupFile[],
	done: (file: BackupFile) => void,
): Promise<string[]> {
	return inParallel(files, async (file) => {
		const target = path.join(root, mediaBackupPath(file.path));
		const data = await bucket.get(file.path);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, data, { flag: "wx" });
		done(file);
	});
}

async function inParallel(files: BackupFile[], work: (file: BackupFile) => Promise<void>): Promise<string[]> {
	const failed: string[] = [];
	const queue = [...files];
	const worker = async () => {
		for (let file = queue.shift(); file; file = queue.shift()) {
			try {
				await work(file);
			} catch (err) {
				failed.push(`${file.path}: ${err instanceof Error ? err.message : err}`);
			}
		}
	};
	await Promise.all(Array.from({ length: 6 }, worker));
	return failed;
}

const CONTENT_TYPES: Record<string, string> = {
	".json": "application/json",
	".jsonl": "application/x-ndjson",
	".md": "text/markdown",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
};

export type ShellRun = (command: string, options?: { timeout?: number }) => Promise<{ stdout: string; stderr: string }>;

const execAsync = promisify(exec);

export const shellRun: ShellRun = async (command, options = {}) => {
	const { stdout, stderr } = await execAsync(command, { ...options, encoding: "utf-8" });
	return { stdout, stderr };
};

async function cloudflareToken(run: ShellRun = shellRun): Promise<string> {
	const saved = keyValue(ENV_TOKEN)?.trim();
	if (saved) return saved;
	const { stdout } = await run(`${WRANGLER} auth token --json`);
	return (JSON.parse(stdout) as { token: string }).token;
}

/** The token in use, described without keeping it: a saved token, a replaced one and none at all read differently. */
export function tokenPrint(): string {
	const token = keyValue(ENV_TOKEN)?.trim();
	return token ? `token ${token.length} ${token.slice(-4)}` : "wrangler";
}

/** A token saved under API keys reads as Settings; anything else, a shadowing .env.local included, as the environment. */
function tokenSource(token: string): "settings" | "env" {
	return authStore.authVars()[ENV_TOKEN]?.trim() === token ? "settings" : "env";
}

// `wrangler whoami` names the email it is signed in with, and closes the sentence with a full stop.
const WHOAMI_EMAIL = /associated with the email\s+([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

export function whoamiAccount(out: string): string | null {
	return WHOAMI_EMAIL.exec(out)?.[1] ?? null;
}

export async function wranglerAuth(run: ShellRun = shellRun): Promise<BackupAuth | null> {
	const token = keyValue(ENV_TOKEN)?.trim();
	if (token) return { via: tokenSource(token), account: null };
	try {
		// `wrangler whoami` exits 0 while printing "You are not authenticated", so a missing email is the sign of no login.
		const account = whoamiAccount((await run(`${WRANGLER} whoami`)).stdout);
		return account === null ? null : { via: "wrangler", account };
	} catch {
		return null;
	}
}

/** Wrangler's own sign-in: it opens the browser and waits for the callback. */
export async function cloudflareSignIn(run: ShellRun = shellRun): Promise<void> {
	await run(`${WRANGLER} login`, { timeout: LOGIN_TIMEOUT });
}

export async function cloudflareSignOut(run: ShellRun = shellRun): Promise<void> {
	await run(`${WRANGLER} logout`);
}

/** Cloudflare's own answer, so a caller can tell a missing bucket from a real refusal. */
export class CloudflareHttpError extends Error {
	constructor(
		readonly status: number,
		readonly url: string,
	) {
		super(`Cloudflare answered ${status} for ${url.slice(API.length)}`);
	}
}

/** The bucket is not in the account yet: a check says that instead of reading out a 404. */
export class BucketMissing extends Error {}

/** The token is real but cannot list an account, which reading the bucket needs before anything else. */
export class AccountNotVisible extends Error {}

/** Drop the token saved under API keys, so Settings → Backup can sign this computer out of it. */
export function forgetStoredToken(): void {
	deleteKey(ENV_TOKEN);
}

type Fetcher = typeof fetch;

function cloudflareCall(fetcher: Fetcher) {
	let token = "";
	return async (url: string, init: RequestInit = {}): Promise<Response> => {
		token ||= await cloudflareToken();
		const send = () =>
			fetcher(url, {
				...init,
				signal: init.signal ?? AbortSignal.timeout(20_000),
				headers: { ...init.headers, Authorization: `Bearer ${token}` },
			});
		let res = await send();
		if (res.status === 401) {
			token = await cloudflareToken();
			res = await send();
		}
		if (!res.ok) throw new CloudflareHttpError(res.status, url);
		return res;
	};
}

async function cloudflareAccount(call: (url: string, init?: RequestInit) => Promise<Response>): Promise<string> {
	const account =
		process.env.CLOUDFLARE_ACCOUNT_ID ??
		((await (await call(`${API}/accounts`)).json()) as { result: Array<{ id: string }> }).result[0]?.id;
	if (!account) throw new AccountNotVisible();
	return account;
}

/** Create the bucket when the account has none yet, so the first upload needs no terminal. */
export async function ensureBucket(name = BACKUP_BUCKET, fetcher: Fetcher = fetch): Promise<void> {
	const call = cloudflareCall(fetcher);
	const account = await cloudflareAccount(call);
	const buckets = (await (await call(`${API}/accounts/${account}/r2/buckets`)).json()) as {
		result: Array<{ name: string }>;
	};
	if (buckets.result.some((bucket) => bucket.name === name)) return;
	await call(`${API}/accounts/${account}/r2/buckets`, {
		method: "POST",
		body: JSON.stringify({ name }),
		headers: { "Content-Type": "application/json" },
	});
}

export async function cloudflareBucket(name = BACKUP_BUCKET, fetcher: Fetcher = fetch): Promise<Bucket> {
	const call = cloudflareCall(fetcher);
	const account = await cloudflareAccount(call);
	const objects = `${API}/accounts/${account}/r2/buckets/${name}/objects`;
	const object = (file: string) => `${objects}/${(PREFIX + file).split("/").map(encodeURIComponent).join("/")}`;
	return {
		async list() {
			const files: BackupFile[] = [];
			let cursor: string | undefined;
			do {
				const query = new URLSearchParams({ prefix: PREFIX, per_page: "1000", ...(cursor ? { cursor } : {}) });
				try {
					const page = (await (await call(`${objects}?${query}`)).json()) as {
						result: Array<{ key: string; size: number; etag: string }>;
						result_info?: { cursor?: string; is_truncated?: boolean };
					};
					for (const item of page.result)
						files.push({ path: item.key.slice(PREFIX.length), size: item.size, md5: item.etag });
					cursor = page.result_info?.is_truncated ? page.result_info.cursor : undefined;
				} catch (err) {
					if (err instanceof CloudflareHttpError && err.status === 404) throw new BucketMissing();
					throw err;
				}
			} while (cursor);
			return files;
		},
		async put(file, data) {
			await call(object(file), {
				method: "PUT",
				body: new Uint8Array(data),
				headers: { "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" },
			});
		},
		async get(file) {
			return Buffer.from(await (await call(object(file))).arrayBuffer());
		},
		async remove(file) {
			await call(object(file), { method: "DELETE" });
		},
	};
}
