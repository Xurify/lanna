/** Settings → Storage: the size formatter, the folder measurement, and the report's shape. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { PATHS } from "../config.ts";
import { formatBytes } from "../src/core/storage.ts";
import { measureTree, storageReport } from "../src/server/storage.ts";

describe("formatBytes", () => {
	it("prints bytes whole below 1 KB, one decimal below 10 units, and whole numbers from 10 up", () => {
		assert.equal(formatBytes(0), "0 B");
		assert.equal(formatBytes(512), "512 B");
		assert.equal(formatBytes(1024), "1.0 KB");
		assert.equal(formatBytes(1536), "1.5 KB");
		assert.equal(formatBytes(100 * 1024), "100 KB");
		assert.equal(formatBytes(12 * 1024 * 1024), "12 MB");
		assert.equal(formatBytes(210 * 1024 * 1024), "210 MB");
		assert.equal(formatBytes(1.4 * 1024 ** 3), "1.4 GB");
	});

	it("never prints NaN or a negative size", () => {
		assert.equal(formatBytes(Number.NaN), "0 B");
		assert.equal(formatBytes(-5), "0 B");
	});
});

describe("measureTree", () => {
	it("sums every file under the folder, recursively, and treats a missing folder as empty", async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "lh-storage-"));
		try {
			fs.mkdirSync(path.join(root, "a", "b"), { recursive: true });
			fs.writeFileSync(path.join(root, "one.bin"), Buffer.alloc(10));
			fs.writeFileSync(path.join(root, "a", "two.bin"), Buffer.alloc(20));
			fs.writeFileSync(path.join(root, "a", "b", "three.bin"), Buffer.alloc(30));
			assert.deepEqual(await measureTree(root), { bytes: 60, files: 3 });
			assert.deepEqual(await measureTree(path.join(root, "missing")), { bytes: 0, files: 0 });
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});

describe("storageReport", () => {
	it("lists the three kept areas at their real folders, for the active language", async () => {
		const report = await storageReport();
		assert.deepEqual(report.areas.map((area) => area.id), ["clips", "progress", "backups"]);
		assert.deepEqual(report.areas.map((area) => area.path), [PATHS.audio, PATHS.data, path.join(PATHS.base, "backups")]);
		assert.ok(["Slovak", "Russian"].includes(report.language));
		for (const area of report.areas) assert.ok(area.bytes >= 0 && area.files >= 0);
	});
});
