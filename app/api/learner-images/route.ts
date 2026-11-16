import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
	bodyTooLarge,
	LEARNER_IMAGE_MAX_BYTES,
	LearnerImageError,
	learnerImageDir,
	saveLearnerImage,
} from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, LEARNER_IMAGE_MAX_BYTES + 64 * 1024);
	if (oversized) return oversized;
	let file: File;
	try {
		const form = await req.formData();
		const entry = form.get("file");
		if (!(entry instanceof File)) return Response.json({ message: "file is required" }, { status: 400 });
		file = entry;
	} catch {
		return Response.json({ message: "bad request" }, { status: 400 });
	}
	try {
		return Response.json(await saveLearnerImage(new Uint8Array(await file.arrayBuffer()), file.name));
	} catch (err) {
		if (err instanceof LearnerImageError) return Response.json({ message: err.message }, { status: 400 });
		throw err;
	}
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const fileName = url.searchParams.get("file");
	if (!fileName) return new Response("file is required", { status: 400 });
	const safeBase = path.basename(fileName);
	const filePath = path.join(learnerImageDir(), safeBase);
	try {
		const buf = await fs.readFile(filePath);
		const ext = path.extname(safeBase).toLowerCase();
		const mime: Record<string, string> = {
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".webp": "image/webp",
			".bmp": "image/bmp",
		};
		return new Response(buf, {
			headers: {
				"Content-Type": mime[ext] ?? "application/octet-stream",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch {
		return new Response("Not found", { status: 404 });
	}
}
