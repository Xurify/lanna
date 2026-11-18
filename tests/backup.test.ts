/**
 * Settings → Backup: what one check reports about the folder against the
 * bucket, and the one upload or restore that may run at a time.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import type { Bucket, ShellRun } from "../src/server/cloud-backup.ts";

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-backup-"));
process.env.LANNA_DATA_DIR = DATA;
process.env.LANNA_PROFILE = "slovak";

const { BackupError, backupError, backupState, checkBackup, connectBackup, disconnectBackup, startBackup } =
	await import("../src/server/backup.ts");
const { AccountNotVisible, BucketMissing, whoamiAccount, wranglerAuth } = await import("../src/server/cloud-backup.ts");
const { backupOutcome } = await import("../src/core/backup.ts");

after(() => fs.rmSync(DATA, { recursive: true, force: true }));

// `wrangler whoami` with the mail line, and a shell that only knows the commands a test gives it.
const WHOAMI = "👋 You are logged in with an OAuth Token, associated with the email owner@example.com.\n";

function fakeShell(answers: Record<string, string>): { run: ShellRun; ran: string[] } {
	const ran: string[] = [];
	return {
		ran,
		run: async (command) => {
			ran.push(command);
			const name = Object.keys(answers).find((word) => command.includes(word));
			if (!name) throw new Error(`Command failed: ${command}`);
			return { stdout: answers[name]!, stderr: "" };
		},
	};
}

const checking = fakeShell({ whoami: WHOAMI });

function write(file: string, text: string): void {
	fs.mkdirSync(path.dirname(path.join(DATA, file)), { recursive: true });
	fs.writeFileSync(path.join(DATA, file), text);
}

let unreadable = false;

function memoryBucket(): Bucket & { objects: Map<string, Buffer> } {
	const objects = new Map<string, Buffer>();
	return {
		objects,
		list: async () => {
			if (unreadable) throw new Error("Command failed: npx -y wrangler@4 auth token --json");
			return [...objects].map(([file, data]) => ({
				path: file,
				size: data.length,
				md5: createHash("md5").update(data).digest("hex"),
			}));
		},
		put: async (file, data) => void objects.set(file, data),
		get: async (file) => objects.get(file)!,
	};
}

describe("backup status", () => {
	it("counts what is here, what is in the bucket, and what each way would copy", async () => {
		write("settings.json", "{}");
		write("access.json", '{"devices":[]}');
		write("export/2026-10-28/summary.json", "{}");
		write("profiles/slovak/chats/a.json", "one");
		write("audio/sk/clip.mp3", "clip");
		const bucket = memoryBucket();
		bucket.objects.set("settings.json", Buffer.from("{}"));
		bucket.objects.set("profiles/slovak/chats/a.json", Buffer.from("one"));
		bucket.objects.set("profiles/slovak/speak/s1/01.wav", Buffer.from("recording"));
		bucket.objects.set("audio/sk/clip.mp3", Buffer.from("clip"));

		const check = await checkBackup({ bucket });
		assert.equal(check.error, undefined);
		assert.deepEqual(check.here, { files: 3, bytes: 9 });
		assert.deepEqual(check.cloud, { files: 4, bytes: 18 });
		assert.deepEqual(check.toUpload, { files: 0, bytes: 0 });
		assert.deepEqual(check.toRestore, { files: 1, bytes: 9 });
		assert.deepEqual(
			check.areas.map((area) => [area.id, area.here.files, area.cloud.files]),
			[
				["audio", 1, 1],
				["languages", 0, 0],
				["profiles", 1, 2],
				["backups", 0, 0],
				["other", 1, 1],
			],
			"every top folder is an area and the loose files are the rest",
		);
		assert.equal((await backupState(checking.run)).last, check, "the answer is kept for the next look");
		assert.equal(
			backupOutcome(check),
			"waiting",
			"a file the bucket has and this computer does not is a difference too",
		);

		write("profiles/slovak/chats/a.json", "one more");
		const after = await checkBackup({ bucket });
		assert.deepEqual(after.toUpload, { files: 1, bytes: 8 });
		assert.deepEqual(
			after.areas.find((area) => area.id === "profiles"),
			{ id: "profiles", here: { files: 1, bytes: 8 }, cloud: { files: 2, bytes: 12 } },
		);
		assert.equal(backupOutcome(after), "waiting");
	});

	it("uploads what changed and never the paired devices' file", async () => {
		const bucket = memoryBucket();
		const job = await startBackup("upload", { bucket });
		assert.equal(job.action, "upload");
		assert.equal(job.total, 3);
		assert.equal(job.done, 3);
		assert.equal(job.failed, 0);
		assert.equal(job.error, undefined);
		assert.ok(job.finishedAt);
		assert.equal(bucket.objects.size, 3);
		assert.equal(bucket.objects.get("profiles/slovak/chats/a.json")?.toString(), "one more");
		assert.equal(bucket.objects.has("access.json"), false);
		assert.equal(bucket.objects.has("export/2026-10-28/summary.json"), false);
		const settled = await checkBackup({ bucket });
		assert.deepEqual(settled.toUpload, { files: 0, bytes: 0 }, "the check follows the run");
		assert.deepEqual(settled.toRestore, { files: 0, bytes: 0 }, "and nothing is in the bucket that is not here");
		assert.equal(backupOutcome(settled), "even");
	});

	it("brings back what is missing and keeps this computer's own copy", async () => {
		const bucket = memoryBucket();
		bucket.objects.set("profiles/slovak/speak/s1/01.wav", Buffer.from("recording"));
		bucket.objects.set("profiles/slovak/chats/a.json", Buffer.from("made elsewhere"));
		const job = await startBackup("restore", { bucket });
		assert.equal(job.total, 1);
		assert.equal(job.failed, 0);
		assert.equal(fs.readFileSync(path.join(DATA, "profiles/slovak/speak/s1/01.wav"), "utf-8"), "recording");
		assert.equal(fs.readFileSync(path.join(DATA, "profiles/slovak/chats/a.json"), "utf-8"), "one more");
	});

	it("refuses a second run while one is going", async () => {
		const bucket = memoryBucket();
		const first = startBackup("upload", { bucket });
		assert.throws(() => startBackup("restore", { bucket }), BackupError);
		await first;
	});

	it("reports a bucket it cannot read instead of throwing, and names the login", async () => {
		unreadable = true;
		try {
			const before = (await backupState(checking.run)).last!;
			const check = await checkBackup({ bucket: memoryBucket() });
			assert.equal(backupOutcome(check), "unreachable");
			assert.match(check.error!, /npx wrangler login/);
			assert.deepEqual(check.here, before.here, "the local count is still the local count");
			for (const area of check.areas)
				assert.deepEqual(area.cloud, { files: 0, bytes: 0 }, "and no bucket side is claimed for any area");
		} finally {
			unreadable = false;
		}
	});

	it("says the bucket is not in the account yet, rather than reading out a 404", () => {
		assert.match(backupError(new BucketMissing()), /bucket `lanna` is not in this Cloudflare account yet/);
	});

	it("names the rights a token needs before it can read a bucket at all", () => {
		assert.match(
			backupError(new AccountNotVisible()),
			/Workers R2 Storage Edit and Account Settings Read/,
			"a real token that cannot list accounts is not a missing login",
		);
	});

	it("keeps an unfamiliar failure as it came, in one line", () => {
		assert.equal(
			backupError(new Error("getaddrinfo ENOTFOUND api.cloudflare.com\nmore noise")),
			"getaddrinfo ENOTFOUND api.cloudflare.com",
		);
		assert.equal(backupOutcome(null), "unchecked");
	});
});

describe("backup sign-in", () => {
	it("reads the account wrangler names, and finds none without a login", async () => {
		assert.equal(whoamiAccount(WHOAMI), "owner@example.com");
		assert.equal(whoamiAccount("You are not authenticated. Run `wrangler login`."), null);
		assert.deepEqual(await wranglerAuth(fakeShell({ whoami: WHOAMI }).run), {
			via: "wrangler",
			account: "owner@example.com",
		});
		assert.equal(await wranglerAuth(fakeShell({}).run), null);
		assert.equal(
			await wranglerAuth(fakeShell({ whoami: "You are not authenticated. Run `wrangler login`." }).run),
			null,
		);
	});

	it("takes a token in .env.local and asks wrangler nothing for it", async () => {
		process.env.CLOUDFLARE_API_TOKEN = "token-in-env";
		try {
			const shell = fakeShell({});
			assert.deepEqual(await wranglerAuth(shell.run), { via: "env", account: null });
			assert.deepEqual(shell.ran, []);
		} finally {
			delete process.env.CLOUDFLARE_API_TOKEN;
		}
	});

	it("takes a token saved under API keys as its own way in, with no wrangler at all", async () => {
		const { authStore } = await import("../src/store/auth.ts");
		authStore.setAuthVar("CLOUDFLARE_API_TOKEN", "token-saved-under-api-keys");
		try {
			const shell = fakeShell({});
			assert.deepEqual(await wranglerAuth(shell.run), { via: "settings", account: null });
			assert.deepEqual(shell.ran, [], "a saved token asks wrangler nothing");
		} finally {
			authStore.deleteAuthVar("CLOUDFLARE_API_TOKEN");
		}
	});

	it("shows a token saved while the app is running, without a restart", async () => {
		const { authStore } = await import("../src/store/auth.ts");
		const shell = fakeShell({ whoami: WHOAMI });
		assert.equal((await backupState(shell.run)).auth?.via, "wrangler");
		await checkBackup({ bucket: memoryBucket() });
		authStore.setAuthVar("CLOUDFLARE_API_TOKEN", "token-saved-while-running");
		try {
			const next = await backupState(shell.run);
			assert.deepEqual(next.auth, { via: "settings", account: null });
			assert.equal(next.last, null, "the check the login answered goes with the login");
		} finally {
			authStore.deleteAuthVar("CLOUDFLARE_API_TOKEN");
		}
		assert.equal((await backupState(shell.run)).auth?.via, "wrangler", "clearing it goes back to the login");
	});

	it("signs in through wrangler and drops the check the old login answered", async () => {
		const shell = fakeShell({ login: "Successfully logged in.", whoami: WHOAMI });
		const next = await connectBackup(shell.run);
		assert.deepEqual(next.auth, { via: "wrangler", account: "owner@example.com" });
		assert.equal(next.last, null);
		assert.ok(shell.ran.some((command) => command.includes("wrangler@4 login")));
	});

	it("signs out, and keeps a failed sign-in or sign-out out of the state", async () => {
		const shell = fakeShell({ logout: "logged out" });
		const next = await disconnectBackup(shell.run);
		assert.equal(next.auth, null);
		assert.equal(next.last, null);
		assert.equal((await backupState(shell.run)).auth, null, "the answer is kept for the next look");
		await assert.rejects(
			() => connectBackup(fakeShell({}).run),
			(err: unknown) => err instanceof BackupError && err.status === 502 && /signing in/.test(err.message),
		);
		await assert.rejects(
			() => disconnectBackup(fakeShell({}).run),
			(err: unknown) => err instanceof BackupError && /sign out/.test(err.message),
		);
	});

	it("drops the token saved under API keys when the backup is disconnected, with no wrangler", async () => {
		const { authStore } = await import("../src/store/auth.ts");
		authStore.setAuthVar("CLOUDFLARE_API_TOKEN", "token-saved-under-api-keys");
		const shell = fakeShell({});
		try {
			assert.deepEqual((await backupState(shell.run)).auth, { via: "settings", account: null });
			const next = await disconnectBackup(shell.run);
			assert.equal(next.auth, null);
			assert.equal(next.last, null);
			assert.equal(
				shell.ran.some((command) => /wrangler@4 (login|logout)/.test(command)),
				false,
				"dropping a token is not a wrangler sign-out",
			);
			assert.equal(authStore.authVars().CLOUDFLARE_API_TOKEN, undefined);
			assert.equal(process.env.CLOUDFLARE_API_TOKEN, undefined, "and nothing left in the environment");
			assert.equal((await backupState(shell.run)).auth, null, "the answer is kept for the next look");
		} finally {
			authStore.deleteAuthVar("CLOUDFLARE_API_TOKEN");
			delete process.env.CLOUDFLARE_API_TOKEN;
		}
	});

	it("leaves a token that comes from .env.local alone, and says where it is", async () => {
		process.env.CLOUDFLARE_API_TOKEN = "token-in-env";
		try {
			await assert.rejects(
				() => disconnectBackup(fakeShell({}).run),
				(err: unknown) => err instanceof BackupError && /\.env\.local/.test(err.message),
			);
			assert.equal(process.env.CLOUDFLARE_API_TOKEN, "token-in-env", "the token is still in use");
		} finally {
			delete process.env.CLOUDFLARE_API_TOKEN;
		}
	});
});
