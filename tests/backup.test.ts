/**
 * Settings → Backup: what one look reports about each place the data folder is
 * copied to — a folder on this computer, the bucket, or both — and the one
 * upload or restore that may run at a time.
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

const {
	BackupError,
	backupError,
	backupState,
	checkBackup,
	connectBackup,
	disconnectBackup,
	dropFolder,
	startBackup,
	useBucket,
	useFolder,
} = await import("../src/server/backup.ts");
const { AccountNotVisible, BucketMissing, whoamiAccount, wranglerAuth } = await import("../src/server/cloud-backup.ts");
const { folderNotMade, resolveFolder } = await import("../src/server/folder-backup.ts");
const { BACKUP_PLACE_FILE, readBackupPlace, writeBackupPlace } = await import("../src/store/backup-place.ts");
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

/** The places a test starts from, so none of them depends on the one before it. */
function places(folder: string | null, bucket = true): void {
	writeBackupPlace({ folder, bucket });
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

/** Nothing signed in and nothing saved, whatever the test before this one left behind. */
async function signedOutState(shell: { run: ShellRun }): Promise<void> {
	places(null);
	await disconnectBackup(fakeShell({ logout: "logged out" }).run);
	assert.equal((await backupState(shell.run)).auth, null);
}

describe("backup status", () => {
	it("counts what is here, what the bucket holds, and what each way would copy", async () => {
		write("settings.json", "{}");
		write("access.json", '{"devices":[]}');
		write("export/2026-10-28/summary.json", "{}");
		write("profiles/slovak/chats/a.json", "one");
		write("audio/sk/clip.mp3", "clip");
		places(null);
		const bucket = memoryBucket();
		bucket.objects.set("settings.json", Buffer.from("{}"));
		bucket.objects.set("profiles/slovak/chats/a.json", Buffer.from("one"));
		bucket.objects.set("profiles/slovak/speak/s1/01.wav", Buffer.from("recording"));
		bucket.objects.set("audio/sk/clip.mp3", Buffer.from("clip"));

		const state = await checkBackup({ buckets: { cloudflare: bucket } });
		const check = state.checks.cloudflare!;
		assert.equal(check.error, undefined);
		assert.deepEqual(state.here!.counts, { files: 3, bytes: 9 });
		assert.deepEqual(check.copy, { files: 4, bytes: 18 });
		assert.deepEqual(check.toUpload, { files: 0, bytes: 0 });
		assert.deepEqual(check.toRestore, { files: 1, bytes: 9 });
		assert.deepEqual(
			state.here!.areas.map((area) => [area.id, area.here.files]),
			[
				["audio", 1],
				["languages", 0],
				["profiles", 1],
				["backups", 0],
				["other", 1],
			],
			"every top folder is an area and the loose files are the rest",
		);
		assert.equal((await backupState(checking.run)).checks.cloudflare, check, "the answer is kept for the next look");
		assert.equal(
			backupOutcome(check),
			"waiting",
			"a file the bucket has and this computer does not is a difference too",
		);

		write("profiles/slovak/chats/a.json", "one more");
		const after = await checkBackup({ buckets: { cloudflare: bucket } });
		assert.deepEqual(after.checks.cloudflare!.toUpload, { files: 1, bytes: 8 });
		assert.equal(backupOutcome(after.checks.cloudflare), "waiting");
	});

	it("uploads what changed, and never the files that belong to this computer", async () => {
		places(null);
		const bucket = memoryBucket();
		const job = await startBackup("upload", "cloudflare", { buckets: { cloudflare: bucket } });
		assert.equal(job.action, "upload");
		assert.equal(job.place, "cloudflare");
		assert.equal(job.total, 3);
		assert.equal(job.done, 3);
		assert.equal(job.failed, 0);
		assert.equal(job.error, undefined);
		assert.ok(job.finishedAt);
		assert.equal(bucket.objects.size, 3);
		assert.equal(bucket.objects.get("profiles/slovak/chats/a.json")?.toString(), "one more");
		assert.equal(bucket.objects.has("access.json"), false);
		assert.equal(bucket.objects.has("export/2026-10-28/summary.json"), false);
		assert.equal(bucket.objects.has("backup-place.json"), false, "where the copies go stays on this computer");
		const settled = await checkBackup({ buckets: { cloudflare: bucket } });
		assert.deepEqual(settled.checks.cloudflare!.toUpload, { files: 0, bytes: 0 }, "the look follows the run");
		assert.deepEqual(
			settled.checks.cloudflare!.toRestore,
			{ files: 0, bytes: 0 },
			"and nothing is there that is not here",
		);
		assert.equal(backupOutcome(settled.checks.cloudflare), "even");
	});

	it("brings back what is missing and keeps this computer's own copy", async () => {
		places(null);
		const bucket = memoryBucket();
		bucket.objects.set("profiles/slovak/speak/s1/01.wav", Buffer.from("recording"));
		bucket.objects.set("profiles/slovak/chats/a.json", Buffer.from("made elsewhere"));
		const job = await startBackup("restore", "cloudflare", { buckets: { cloudflare: bucket } });
		assert.equal(job.total, 1);
		assert.equal(job.failed, 0);
		assert.equal(fs.readFileSync(path.join(DATA, "profiles/slovak/speak/s1/01.wav"), "utf-8"), "recording");
		assert.equal(fs.readFileSync(path.join(DATA, "profiles/slovak/chats/a.json"), "utf-8"), "one more");
	});

	it("refuses a second run while one is going", async () => {
		const bucket = memoryBucket();
		const first = startBackup("upload", "cloudflare", { buckets: { cloudflare: bucket } });
		assert.throws(() => startBackup("restore", "cloudflare", { buckets: { cloudflare: bucket } }), BackupError);
		await first;
	});

	it("reports a bucket it cannot read instead of throwing, and names the login", async () => {
		places(null);
		unreadable = true;
		try {
			const state = await checkBackup({ buckets: { cloudflare: memoryBucket() } });
			const check = state.checks.cloudflare!;
			assert.equal(backupOutcome(check), "unreachable");
			assert.match(check.error!, /npx wrangler login/);
			assert.ok(state.here!.counts.files > 0, "the local count is still the local count");
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

	it("asks wrangler nothing at all while the bucket is not one of the copies", async () => {
		places(null, false);
		const shell = fakeShell({});
		const next = await backupState(shell.run);
		assert.equal(next.bucketOn, false);
		assert.equal(next.auth, null, "nothing is read there, so there is no way in to report");
		assert.deepEqual(shell.ran, [], "a bucket this computer does not copy to is not read");
	});

	it("shows a token saved while the app is running, without a restart", async () => {
		const { authStore } = await import("../src/store/auth.ts");
		places(null);
		const shell = fakeShell({ whoami: WHOAMI });
		assert.equal((await backupState(shell.run)).auth?.via, "wrangler");
		await checkBackup({ buckets: { cloudflare: memoryBucket() } });
		authStore.setAuthVar("CLOUDFLARE_API_TOKEN", "token-saved-while-running");
		try {
			const next = await backupState(shell.run);
			assert.deepEqual(next.auth, { via: "settings", account: null });
			assert.equal(next.checks.cloudflare, null, "the check the login answered goes with the login");
		} finally {
			authStore.deleteAuthVar("CLOUDFLARE_API_TOKEN");
		}
		assert.equal((await backupState(shell.run)).auth?.via, "wrangler", "clearing it goes back to the login");
	});

	it("signs in through wrangler, which asks to copy there", async () => {
		const shell = fakeShell({ login: "Successfully logged in.", whoami: WHOAMI });
		writeBackupPlace({ folder: null, bucket: false });
		const next = await connectBackup(shell.run);
		assert.deepEqual(next.auth, { via: "wrangler", account: "owner@example.com" });
		assert.equal(next.bucketOn, true, "a login is a wish to copy to the bucket");
		assert.equal(next.checks.cloudflare, null);
		assert.ok(shell.ran.some((command) => command.includes("wrangler@4 login")));
	});

	it("keeps the check a signed-out learner asked for, rather than answering with nothing", async () => {
		const signedOut = fakeShell({});
		await signedOutState(signedOut);
		unreadable = true;
		try {
			const asked = await checkBackup({ buckets: { cloudflare: memoryBucket() } });
			assert.equal(backupOutcome(asked.checks.cloudflare), "unreachable");
			const next = await backupState(signedOut.run);
			assert.equal(next.auth, null);
			assert.equal(
				next.checks.cloudflare,
				asked.checks.cloudflare,
				"the answer belongs on screen, which is where the question was asked",
			);
		} finally {
			unreadable = false;
		}
	});

	it("picks up a login made on the command line once a check succeeds without one", async () => {
		await signedOutState(fakeShell({}));
		const state = await checkBackup({ buckets: { cloudflare: memoryBucket() } });
		assert.equal(state.checks.cloudflare!.error, undefined, "the bucket answers, so something can reach it");
		const next = await backupState(fakeShell({ whoami: WHOAMI }).run);
		assert.deepEqual(next.auth, { via: "wrangler", account: "owner@example.com" });
		assert.equal(next.checks.cloudflare, state.checks.cloudflare, "and the check that found the login stays on screen");
	});

	it("signs out, and keeps a failed sign-in or sign-out out of the state", async () => {
		places(null);
		const shell = fakeShell({ logout: "logged out" });
		const next = await disconnectBackup(shell.run);
		assert.equal(next.auth, null);
		assert.equal(next.checks.cloudflare, null);
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
		places(null);
		authStore.setAuthVar("CLOUDFLARE_API_TOKEN", "token-saved-under-api-keys");
		const shell = fakeShell({});
		try {
			assert.deepEqual((await backupState(shell.run)).auth, { via: "settings", account: null });
			const next = await disconnectBackup(shell.run);
			assert.equal(next.auth, null);
			assert.equal(next.checks.cloudflare, null);
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

describe("backup into a folder", () => {
	const COPIES = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-copies-"));
	const noWrangler = fakeShell({});

	after(() => {
		fs.rmSync(COPIES, { recursive: true, force: true });
		writeBackupPlace({ folder: null, bucket: true });
	});

	it("reads a path from the keyboard: Explorer's quotes, and a leading ~", () => {
		assert.equal(resolveFolder('"C:\\Users\\me\\Lanna backup"'), path.resolve("C:\\Users\\me\\Lanna backup"));
		assert.equal(resolveFolder("~"), os.homedir());
		assert.equal(resolveFolder("~/Lanna backup"), path.join(os.homedir(), "Lanna backup"));
	});

	it("says a folder it could not make in words, not in error codes", () => {
		const gone = Object.assign(new Error("ENOENT: no such file or directory, mkdir 'E:\\Lanna backup'"), {
			code: "ENOENT",
		});
		assert.match(folderNotMade("E:\\Lanna backup", gone).message, /Plug the drive in, or choose another folder/);
		assert.doesNotMatch(folderNotMade("E:\\Lanna backup", gone).message, /ENOENT/);
		const denied = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
		assert.match(folderNotMade("/media/usb/Lanna", denied).message, /not allowed to write in/);
		assert.match(folderNotMade("/x", new Error("something odd")).message, /could not make/);
	});

	it("copies into a folder on this computer, asking wrangler nothing", async () => {
		const folder = path.join(COPIES, "Lanna backup");
		places(null, false);
		const chosen = await useFolder(folder, noWrangler.run);
		assert.equal(chosen.folder, folder);
		assert.equal(chosen.bucketOn, false);
		assert.equal(chosen.checks.folder, null, "a place that just joined has no answer yet");
		assert.deepEqual(noWrangler.ran, [], "a folder has no login to read, and the bucket is not copied to");

		const empty = await checkBackup();
		assert.equal(empty.checks.folder!.error, undefined);
		assert.deepEqual(empty.checks.folder!.copy, { files: 0, bytes: 0 }, "a folder just made is empty");
		assert.ok(empty.checks.folder!.toUpload.files > 0, "so everything here is to go");
		assert.equal(empty.here!.areas.length, 5, "every area is drawn for a folder too");

		const job = await startBackup("upload", "folder");
		assert.equal(job.failed, 0);
		assert.equal(job.done, job.total);
		assert.equal(fs.readFileSync(path.join(folder, "settings.json"), "utf-8"), "{}");
		assert.equal(fs.existsSync(path.join(folder, "access.json")), false, "what stays here stays here");
		assert.equal(fs.existsSync(path.join(folder, "backup-place.json")), false, "and so does where the copies go");

		const even = await checkBackup();
		assert.deepEqual(even.checks.folder!.toUpload, { files: 0, bytes: 0 });
		assert.equal(backupOutcome(even.checks.folder), "even");
	});

	it("brings back only what is missing here, and keeps this computer's own copy", async () => {
		const folder = path.join(COPIES, "older");
		fs.mkdirSync(path.join(folder, "profiles/slovak/chats"), { recursive: true });
		fs.mkdirSync(path.join(folder, "notes"), { recursive: true });
		fs.writeFileSync(path.join(folder, "profiles/slovak/chats/a.json"), "made elsewhere");
		fs.writeFileSync(path.join(folder, "notes/n1.json"), "from the folder");
		await useFolder(folder, noWrangler.run);

		const job = await startBackup("restore", "folder");
		assert.equal(job.total, 1, "the file that differs is not the file that is missing");
		assert.equal(job.failed, 0);
		assert.equal(fs.readFileSync(path.join(DATA, "notes/n1.json"), "utf-8"), "from the folder");
		assert.equal(fs.readFileSync(path.join(DATA, "profiles/slovak/chats/a.json"), "utf-8"), "one more");
	});

	it("refuses a folder inside the data folder, and one that holds it", async () => {
		await assert.rejects(
			() => useFolder(path.join(DATA, "copy"), noWrangler.run),
			(err: unknown) => err instanceof BackupError && /away from the data folder/.test(err.message),
		);
		await assert.rejects(
			() => useFolder(path.dirname(DATA), noWrangler.run),
			(err: unknown) => err instanceof BackupError && /away from the data folder/.test(err.message),
		);
		await assert.rejects(
			() => useFolder("   ", noWrangler.run),
			(err: unknown) => err instanceof BackupError && /Type the folder/.test(err.message),
		);
		assert.equal(readBackupPlace().folder, path.join(COPIES, "older"), "a refused folder is not saved");
	});

	it("says the folder is not there, rather than reading out a missing login", async () => {
		const gone = path.join(COPIES, "gone");
		fs.mkdirSync(gone, { recursive: true });
		places(gone, false);
		fs.rmSync(gone, { recursive: true, force: true });

		const state = await checkBackup();
		assert.equal(backupOutcome(state.checks.folder), "unreachable");
		assert.match(state.checks.folder!.error!, /is not there/);
		assert.doesNotMatch(state.checks.folder!.error!, /[Nn]ot signed in/, "no login is asked for on this path");
	});

	it("stops copying to the folder, and keeps the bucket as a place", async () => {
		places(path.join(COPIES, "older"), true);
		const next = await dropFolder(noWrangler.run);
		assert.equal(next.folder, null);
		assert.equal(next.bucketOn, true, "dropping one place does not drop the other");
		assert.equal(next.checks.folder, null, "a place that left has no answer on screen");
		assert.deepEqual(readBackupPlace(), { folder: null, bucket: true });
	});
});

describe("both places at once", () => {
	const COPIES = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-both-"));
	const noWrangler = fakeShell({});

	after(() => {
		fs.rmSync(COPIES, { recursive: true, force: true });
		writeBackupPlace({ folder: null, bucket: true });
	});

	it("keeps both copies, and one being behind is not read as the other being even", async () => {
		const folder = path.join(COPIES, "both");
		fs.mkdirSync(folder, { recursive: true });
		places(null, false);
		await useFolder(folder, noWrangler.run);
		const filled = await startBackup("upload", "folder");
		assert.equal(filled.failed, 0, "the folder is filled first");

		const next = await useBucket(true, noWrangler.run);
		assert.deepEqual(readBackupPlace(), { folder, bucket: true }, "both places are kept");

		const state = await checkBackup({ buckets: { cloudflare: memoryBucket() } });
		assert.equal(backupOutcome(state.checks.folder), "even", "the folder it just filled is up to date");
		assert.ok(state.checks.cloudflare!.toUpload.files > 0, "the empty bucket is behind");
		assert.equal(backupOutcome(state.checks.cloudflare), "waiting", "and says so on its own line");
		assert.equal(next.bucketOn, true);
	});

	it("fills one place without touching the other", async () => {
		const bucket = memoryBucket();
		const state = await checkBackup({ buckets: { cloudflare: bucket } });
		const behind = state.checks.cloudflare!.toUpload.files;
		assert.ok(behind > 0, "the bucket is behind before the run");
		const job = await startBackup("upload", "cloudflare", { buckets: { cloudflare: bucket } });
		assert.equal(job.total, behind);
		assert.equal(job.failed, 0);
		const after = await checkBackup({ buckets: { cloudflare: bucket } });
		assert.equal(backupOutcome(after.checks.cloudflare), "even");
		assert.equal(backupOutcome(after.checks.folder), "even", "the folder answers for itself, and it did not change");
	});
});

describe("where the copies go", () => {
	it("reads the key an older install wrote, so the place it chose is kept", () => {
		fs.writeFileSync(BACKUP_PLACE_FILE, JSON.stringify({ destination: "folder", folder: "/somewhere" }));
		assert.deepEqual(readBackupPlace(), { folder: "/somewhere", bucket: false });
		fs.writeFileSync(BACKUP_PLACE_FILE, JSON.stringify({ destination: "cloudflare", folder: "/somewhere" }));
		assert.deepEqual(
			readBackupPlace(),
			{ folder: null, bucket: true },
			"a folder the old key was only remembering is not a place",
		);
		fs.writeFileSync(BACKUP_PLACE_FILE, "{ not json");
		assert.deepEqual(readBackupPlace(), { folder: null, bucket: true }, "a half file reads as the first boot");
	});
});
