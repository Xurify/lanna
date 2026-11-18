/**
 * The cloud copy of the data folder: a push sends only what is new or
 * changed and never the paired devices' file; a pull writes only what is
 * missing and never replaces a file that is already here.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import {
	AccountNotVisible,
	BucketMissing,
	cloudflareBucket,
	ensureBucket,
	localFiles,
	pull,
	pullPlan,
	push,
	pushPlan,
	type BackupFile,
	type Bucket,
} from "../src/server/cloud-backup.ts";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-cloud-backup-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function folder(name: string, files: Record<string, string>): string {
	const root = path.join(scratch, name);
	for (const [file, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), text);
	}
	return root;
}

function memoryBucket(): Bucket & { objects: Map<string, Buffer> } {
	const objects = new Map<string, Buffer>();
	return {
		objects,
		list: async () =>
			[...objects].map(([file, data]): BackupFile => ({
				path: file,
				size: data.length,
				md5: createHash("md5").update(data).digest("hex"),
			})),
		put: async (file, data) => void objects.set(file, data),
		get: async (file) => objects.get(file)!,
	};
}

describe("cloud backup", () => {
	it("a push sends every file but the paired devices and the exports, then only what changed", async () => {
		const root = folder("pc", {
			"settings.json": "{}",
			"access.json": '{"devices":[]}',
			"export/2026-10-28/summary.json": "{}",
			"audio/sk/female/ťava-0123456789ab.mp3": "clip",
			"profiles/slovak/chats/a.json": "one",
		});
		const bucket = memoryBucket();

		const first = pushPlan(await localFiles(root), await bucket.list());
		assert.deepEqual(
			first.upload.map((file) => file.path),
			["audio/sk/female/ťava-0123456789ab.mp3", "profiles/slovak/chats/a.json", "settings.json"],
		);
		assert.deepEqual(await push(root, bucket, first.upload, () => {}), []);

		fs.writeFileSync(path.join(root, "profiles/slovak/chats/a.json"), "two");
		fs.rmSync(path.join(root, "settings.json"));
		const second = pushPlan(await localFiles(root), await bucket.list());
		assert.deepEqual(
			second.upload.map((file) => file.path),
			["profiles/slovak/chats/a.json"],
		);
		assert.equal(second.same, 1);
		assert.deepEqual(second.onlyInCloud, ["settings.json"]);
	});

	it("a pull writes what is missing and keeps a file that differs", async () => {
		const bucket = memoryBucket();
		bucket.objects.set("profiles/slovak/progress.json", Buffer.from("from the cloud"));
		bucket.objects.set("profiles/slovak/speak/s1/01.wav", Buffer.from("recording"));
		bucket.objects.set("access.json", Buffer.from("never restored"));
		const root = folder("laptop", { "profiles/slovak/progress.json": "made here" });

		const plan = pullPlan(await localFiles(root), await bucket.list());
		assert.deepEqual(
			plan.download.map((file) => file.path),
			["profiles/slovak/speak/s1/01.wav"],
		);
		assert.deepEqual(plan.different, ["profiles/slovak/progress.json"]);
		assert.deepEqual(await pull(root, bucket, plan.download, () => {}), []);

		assert.equal(fs.readFileSync(path.join(root, "profiles/slovak/speak/s1/01.wav"), "utf-8"), "recording");
		assert.equal(fs.readFileSync(path.join(root, "profiles/slovak/progress.json"), "utf-8"), "made here");
		assert.equal(fs.existsSync(path.join(root, "access.json")), false);
	});

	it("a pull does not replace a file that appeared after the plan", async () => {
		const bucket = memoryBucket();
		bucket.objects.set("notes.json", Buffer.from("from the cloud"));
		const root = folder("race", {});
		const plan = pullPlan(await localFiles(root), await bucket.list());
		fs.mkdirSync(root, { recursive: true });
		fs.writeFileSync(path.join(root, "notes.json"), "written meanwhile");

		const failed = await pull(root, bucket, plan.download, () => {});
		assert.equal(failed.length, 1);
		assert.equal(fs.readFileSync(path.join(root, "notes.json"), "utf-8"), "written meanwhile");
	});
});

const API = "https://api.cloudflare.com/client/v4";

function fakeCloudflare(names: string[]): {
	calls: Array<{ url: string; method: string; body: string }>;
	fetcher: typeof fetch;
} {
	const calls: Array<{ url: string; method: string; body: string }> = [];
	const fetcher = async (url: string, init: RequestInit = {}): Promise<Response> => {
		calls.push({ url, method: init.method ?? "GET", body: String(init.body ?? "") });
		const result = url.endsWith("/accounts") ? [{ id: "acct" }] : names.map((name) => ({ name }));
		return new Response(JSON.stringify({ result }), { status: 200 });
	};
	return { calls, fetcher: fetcher as unknown as typeof fetch };
}

describe("the bucket", () => {
	it("is created on the first upload when the account has none yet, and left alone when it has", async () => {
		process.env.CLOUDFLARE_API_TOKEN = "cloudflare-test-token";
		try {
			const fresh = fakeCloudflare([]);
			await ensureBucket("lanna", fresh.fetcher);
			assert.deepEqual(
				fresh.calls.filter((call) => call.method === "POST"),
				[{ url: `${API}/accounts/acct/r2/buckets`, method: "POST", body: '{"name":"lanna"}' }],
			);

			const kept = fakeCloudflare(["lanna"]);
			await ensureBucket("lanna", kept.fetcher);
			assert.equal(kept.calls.filter((call) => call.method === "POST").length, 0);
		} finally {
			delete process.env.CLOUDFLARE_API_TOKEN;
		}
	});

	it("reads a bucket that is not in the account as missing, not as a 404 line", async () => {
		process.env.CLOUDFLARE_API_TOKEN = "cloudflare-test-token";
		try {
			const fetcher = (async (url: string): Promise<Response> =>
				url.endsWith("/accounts")
					? new Response(JSON.stringify({ result: [{ id: "acct" }] }), { status: 200 })
					: new Response("no such bucket", { status: 404 })) as unknown as typeof fetch;
			const bucket = await cloudflareBucket("lanna", fetcher);
			await assert.rejects(
				() => bucket.list(),
				(err: unknown) => err instanceof BucketMissing,
			);
		} finally {
			delete process.env.CLOUDFLARE_API_TOKEN;
		}
	});

	it("reads a token that cannot list an account as that, not as a missing login", async () => {
		process.env.CLOUDFLARE_API_TOKEN = "cloudflare-test-token";
		try {
			const fetcher = (async () =>
				new Response(JSON.stringify({ result: [] }), { status: 200 })) as unknown as typeof fetch;
			await assert.rejects(
				() => cloudflareBucket("lanna", fetcher),
				(err: unknown) => err instanceof AccountNotVisible,
			);
		} finally {
			delete process.env.CLOUDFLARE_API_TOKEN;
		}
	});
});
