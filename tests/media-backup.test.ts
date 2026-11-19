import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { mediaBackupPath } from "../src/core/media-path.ts";
import { migrateMediaBackup } from "../src/server/media-backup.ts";
import { cloudflareBucket, localFiles, pull, pullPlan, type Bucket } from "../src/server/cloud-backup.ts";
import { folderBucket } from "../src/server/folder-backup.ts";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-media-backup-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function memoryBucket(entries: Record<string, string>) {
	const objects = new Map<string, Buffer>(Object.entries(entries).map(([file, text]) => [file, Buffer.from(text)]));
	const operations: string[] = [];
	const bucket: Bucket = {
		list: async () =>
			[...objects].map(([file, data]) => ({
				path: file,
				size: data.length,
				md5: createHash("md5").update(data).digest("hex"),
			})),
		get: async (file) => {
			operations.push(`get ${file}`);
			const data = objects.get(file);
			if (!data) throw new Error(`Missing ${file}`);
			return data;
		},
		put: async (file, data) => {
			operations.push(`put ${file}`);
			objects.set(file, data);
		},
		remove: async (file) => {
			operations.push(`remove ${file}`);
			objects.delete(file);
		},
	};
	return { bucket, objects, operations };
}

test("backup paths rename only a profile's videos directory", () => {
	assert.equal(mediaBackupPath("profiles/slovak/videos/audio/track.mp3"), "profiles/slovak/media/audio/track.mp3");
	for (const file of ["audio/videos/clip.mp3", "profiles/slovak/media/track.json", "profiles/slovak/videos-old/x"])
		assert.equal(mediaBackupPath(file), file);
});

test("all backup copies are verified before any legacy object is removed", async () => {
	const entries = {
		"profiles/slovak/videos/audio/track.mp3": "audio",
		"profiles/slovak/videos/watches.jsonl": "history",
		"profiles/russian/videos/captions/track.json": "captions",
		"profiles/slovak/progress.json": "progress",
	};
	const { bucket, objects, operations } = memoryBucket(entries);
	assert.equal(await migrateMediaBackup(bucket), 3);
	for (const [file, content] of Object.entries(entries)) {
		assert.equal(objects.get(mediaBackupPath(file))?.toString(), content);
		if (mediaBackupPath(file) !== file) assert.equal(objects.has(file), false);
	}
	const firstRemoval = operations.findIndex((operation) => operation.startsWith("remove "));
	const lastVerification = operations.lastIndexOf("get profiles/russian/media/captions/track.json");
	assert.ok(firstRemoval > lastVerification);
	assert.equal(await migrateMediaBackup(bucket), 0);
});

test("a conflict preserves both versions and makes no changes anywhere", async () => {
	const { bucket, operations, objects } = memoryBucket({
		"profiles/slovak/videos/audio/track.mp3": "audio",
		"profiles/slovak/videos/index.jsonl": "old",
		"profiles/slovak/media/index.jsonl": "new",
	});
	await assert.rejects(migrateMediaBackup(bucket), /conflicting file/);
	assert.deepEqual(operations, []);
	assert.equal(objects.get("profiles/slovak/videos/index.jsonl")?.toString(), "old");
	assert.equal(objects.get("profiles/slovak/media/index.jsonl")?.toString(), "new");
});

test("bad verification leaves all legacy objects available", async () => {
	const { bucket, operations, objects } = memoryBucket({
		"profiles/slovak/videos/a.json": "first",
		"profiles/slovak/videos/b.json": "second",
	});
	const put = bucket.put;
	bucket.put = async (file, data) => put(file, file.endsWith("b.json") ? Buffer.from("wrong") : data);
	await assert.rejects(migrateMediaBackup(bucket), /verification failed/);
	assert.equal(objects.has("profiles/slovak/videos/a.json"), true);
	assert.equal(objects.has("profiles/slovak/videos/b.json"), true);
	assert.ok(!operations.some((operation) => operation.startsWith("remove ")));
});

test("an interrupted upload resumes from verified copies without re-uploading them", async () => {
	const { bucket, objects, operations } = memoryBucket({
		"profiles/slovak/videos/a.json": "first",
		"profiles/slovak/videos/b.json": "second",
	});
	const put = bucket.put;
	bucket.put = async (file, data) => {
		if (file.endsWith("b.json")) throw new Error("offline");
		await put(file, data);
	};
	await assert.rejects(migrateMediaBackup(bucket), /offline/);
	assert.equal(objects.has("profiles/slovak/videos/a.json"), true);
	bucket.put = put;
	operations.length = 0;
	assert.equal(await migrateMediaBackup(bucket), 2);
	assert.ok(!operations.includes("put profiles/slovak/media/a.json"));
	assert.equal(objects.has("profiles/slovak/videos/a.json"), false);
	assert.equal(objects.has("profiles/slovak/videos/b.json"), false);
});

test("failed deletion keeps its verified copy and can be retried", async () => {
	const { bucket, objects } = memoryBucket({ "profiles/slovak/videos/a.json": "first" });
	const remove = bucket.remove!;
	bucket.remove = async () => {
		throw new Error("delete refused");
	};
	await assert.rejects(migrateMediaBackup(bucket), /delete refused/);
	assert.equal(objects.get("profiles/slovak/media/a.json")?.toString(), "first");
	assert.equal(objects.get("profiles/slovak/videos/a.json")?.toString(), "first");
	bucket.remove = remove;
	assert.equal(await migrateMediaBackup(bucket), 1);
});

test("a bucket without deletion support is left untouched", async () => {
	const { bucket, operations } = memoryBucket({ "profiles/slovak/videos/a.json": "first" });
	delete bucket.remove;
	await assert.rejects(migrateMediaBackup(bucket), /cannot remove legacy/);
	assert.deepEqual(operations, []);
});

test("restoring an old backup writes directly to media and never replaces local work", async () => {
	const { bucket } = memoryBucket({
		"profiles/slovak/videos/audio/track.mp3": "audio",
		"profiles/slovak/videos/index.jsonl": "older index",
		"profiles/slovak/media/index.jsonl": "newer index",
	});
	const root = path.join(scratch, "restore");
	fs.mkdirSync(root);
	const plan = pullPlan([], await bucket.list());
	assert.equal(plan.download.length, 2);
	assert.deepEqual(await pull(root, bucket, plan.download, () => {}), []);
	assert.equal(fs.existsSync(path.join(root, "profiles/slovak/videos")), false);
	assert.equal(fs.readFileSync(path.join(root, "profiles/slovak/media/audio/track.mp3"), "utf-8"), "audio");
	assert.equal(fs.readFileSync(path.join(root, "profiles/slovak/media/index.jsonl"), "utf-8"), "newer index");
	const index = path.join(root, "profiles/slovak/media/index.jsonl");
	fs.writeFileSync(index, "local work");
	const again = pullPlan(await localFiles(root), await bucket.list());
	assert.deepEqual(again.download, []);
	assert.deepEqual(again.different, ["profiles/slovak/media/index.jsonl"]);
});

test("folder backups remove the empty legacy directories after verification", async () => {
	const root = path.join(scratch, "folder");
	const legacy = path.join(root, "profiles/slovak/videos/audio");
	fs.mkdirSync(legacy, { recursive: true });
	fs.writeFileSync(path.join(legacy, "track.mp3"), "audio");
	assert.equal(await migrateMediaBackup(folderBucket(root)), 1);
	assert.equal(fs.existsSync(path.join(root, "profiles/slovak/videos")), false);
	assert.equal(fs.readFileSync(path.join(root, "profiles/slovak/media/audio/track.mp3"), "utf-8"), "audio");
});

test("R2 removes only the named legacy object with a bounded DELETE request", async () => {
	process.env.CLOUDFLARE_API_TOKEN = "test-token";
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const fetcher = (async (url: string, init: RequestInit = {}) => {
		calls.push({ url, init });
		return new Response(JSON.stringify({ result: [{ id: "acct" }] }), { status: 200 });
	}) as unknown as typeof fetch;
	try {
		const bucket = await cloudflareBucket("lanna", fetcher);
		await bucket.remove!("profiles/slovak/videos/audio/track.mp3");
		const removal = calls.find(({ init }) => init.method === "DELETE")!;
		assert.equal(
			removal.url,
			"https://api.cloudflare.com/client/v4/accounts/acct/r2/buckets/lanna/objects/data/profiles/slovak/videos/audio/track.mp3",
		);
		assert.ok(removal.init.signal instanceof AbortSignal);
	} finally {
		delete process.env.CLOUDFLARE_API_TOKEN;
	}
});

test("a backup upload migrates the old prefix before copying current local media", async () => {
	const { PATHS } = await import("../config.ts");
	const { startBackup } = await import("../src/server/backup.ts");
	const { bucket, objects } = memoryBucket({ "profiles/slovak/videos/audio/track.mp3": "old audio" });
	const audio = path.join(PATHS.media, "audio");
	fs.mkdirSync(audio, { recursive: true });
	fs.writeFileSync(path.join(audio, "track.mp3"), "current audio");
	const job = await startBackup("upload", "cloudflare", { buckets: { cloudflare: bucket } });
	assert.equal(job.failed, 0);
	assert.equal(job.error, undefined);
	assert.equal(objects.has("profiles/slovak/videos/audio/track.mp3"), false);
	assert.equal(objects.get("profiles/slovak/media/audio/track.mp3")?.toString(), "current audio");
});
