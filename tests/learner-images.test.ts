/**
 * Images the learner adds from the chat composer: kept under the profile's
 * data/sources/ with a safe file name, refused when they are not valid images.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import {
	detectImageFormat,
	learnerImageDir,
	learnerImageFileName,
	LEARNER_IMAGE_MAX_BYTES,
	saveLearnerImage,
} from "../src/server/learner-images.ts";

// 1x1 transparent PNG
const PNG_BYTES = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82,
]);

// 1x1 JPEG header
const JPG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

// GIF header
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);

// WebP header (RIFF....WEBP)
const WEBP_BYTES = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

// BMP header (BM)
const BMP_BYTES = new Uint8Array([0x42, 0x4d, 0x3e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

describe("detectImageFormat", () => {
	it("identifies supported image types from magic bytes", () => {
		assert.deepEqual(detectImageFormat(PNG_BYTES), { mimeType: "image/png", ext: ".png" });
		assert.deepEqual(detectImageFormat(JPG_BYTES), { mimeType: "image/jpeg", ext: ".jpg" });
		assert.deepEqual(detectImageFormat(GIF_BYTES), { mimeType: "image/gif", ext: ".gif" });
		assert.deepEqual(detectImageFormat(WEBP_BYTES), { mimeType: "image/webp", ext: ".webp" });
		assert.deepEqual(detectImageFormat(BMP_BYTES), { mimeType: "image/bmp", ext: ".bmp" });
		assert.equal(detectImageFormat(new Uint8Array([1, 2, 3, 4])), null);
	});
});

describe("saving a learner's image", () => {
	it("keeps the image under data/sources and returns its path, name and mimeType", async () => {
		const saved = await saveLearnerImage(PNG_BYTES, "screenshot 1.png");
		assert.equal(saved.name, "screenshot 1.png");
		assert.equal(saved.mimeType, "image/png");
		assert.equal(path.dirname(saved.path), learnerImageDir());
		assert.match(path.basename(saved.path), /^screenshot-1-[0-9a-f]{6}\.png$/);
		assert.ok(fs.existsSync(saved.path));
	});

	it("never lets a name leave the folder", () => {
		assert.match(learnerImageFileName("../../etc/passwd.png", ".png"), /^passwd-[0-9a-f]{6}\.png$/);
		assert.doesNotMatch(learnerImageFileName("..\\..\\secret.png", ".png"), /[\\/]|\^\./);
		assert.match(learnerImageFileName(".png", ".png"), /^image-[0-9a-f]{6}\.png$/);
	});

	it("refuses a file that is not an image, an empty one and one over the size cap", async () => {
		await assert.rejects(saveLearnerImage(new TextEncoder().encode("hello world"), "notes.png"), /not a supported image/);
		await assert.rejects(saveLearnerImage(new Uint8Array(0), "empty.png"), /empty/);
		await assert.rejects(saveLearnerImage(new Uint8Array(LEARNER_IMAGE_MAX_BYTES + 1), "big.png"), /larger than 10 MB/);
	});
});
