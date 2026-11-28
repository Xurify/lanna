/**
 * POST /api/declare-widget — stores a ```declare widget source under its
 * content hash and returns the URL the widget sandbox boots it from.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DECLARE_WIDGETS_DIR } from "@/config";
import { bodyTooLarge } from "@/src/server";

export const dynamic = "force-dynamic";

const MAX_WIDGET_BYTES = 256 * 1024;

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, MAX_WIDGET_BYTES);
	if (oversized) return oversized;
	const source = await req.text();
	if (!source.trim()) return Response.json({ message: "widget source is required" }, { status: 400 });

	const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
	const file = path.join(DECLARE_WIDGETS_DIR, `${hash}.declare`);
	if (!fs.existsSync(file)) {
		fs.mkdirSync(DECLARE_WIDGETS_DIR, { recursive: true });
		fs.writeFileSync(file, source, "utf-8");
	}
	return Response.json({ url: `/api/declare-widget/${hash}` });
}
