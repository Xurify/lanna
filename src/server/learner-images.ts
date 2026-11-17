import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS } from "../../config.ts";

/** Next buffers at most this much of a request (next.config.ts proxyClientMaxBodySize). */
export const LEARNER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface SavedLearnerImage {
	path: string;
	name: string;
	mimeType: string;
	size: number;
}

export function learnerImageDir(): string {
	return PATHS.sentFiles;
}

export function learnerImageFileName(original: string, ext: string): string {
	const stem = path
		.basename(original)
		.replace(/\.[a-z0-9]+$/i, "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "")
		.slice(0, 60);
	return `${stem || "image"}-${randomBytes(3).toString("hex")}${ext}`;
}

export class LearnerImageError extends Error {}

export function detectImageFormat(bytes: Uint8Array): { mimeType: string; ext: string } | null {
	if (bytes.length < 4) return null;
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return { mimeType: "image/png", ext: ".png" };
	}
	// JPEG: FF D8 FF
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return { mimeType: "image/jpeg", ext: ".jpg" };
	}
	// GIF: GIF87a or GIF89a
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
		return { mimeType: "image/gif", ext: ".gif" };
	}
	// WEBP: RIFF....WEBP
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return { mimeType: "image/webp", ext: ".webp" };
	}
	// BMP: 42 4D (BM)
	if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
		return { mimeType: "image/bmp", ext: ".bmp" };
	}
	return null;
}

export async function saveLearnerImage(bytes: Uint8Array, originalName: string): Promise<SavedLearnerImage> {
	if (bytes.byteLength === 0) throw new LearnerImageError("The file is empty.");
	if (bytes.byteLength > LEARNER_IMAGE_MAX_BYTES) throw new LearnerImageError("The image is larger than 10 MB.");
	const format = detectImageFormat(bytes);
	if (!format) throw new LearnerImageError("That file is not a supported image (PNG, JPEG, GIF, WebP, BMP).");
	const dir = learnerImageDir();
	await fs.mkdir(dir, { recursive: true });
	const file = path.join(dir, learnerImageFileName(originalName, format.ext));
	await fs.writeFile(file, bytes);
	return {
		path: file,
		name: path.basename(originalName) || `image${format.ext}`,
		mimeType: format.mimeType,
		size: bytes.byteLength,
	};
}
