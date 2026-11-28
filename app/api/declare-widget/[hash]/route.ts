/**
 * GET /api/declare-widget/<hash> — the stored widget source, fetched by the
 * sandboxed Declare runtime inside the chat's widget iframe.
 */

import fs from "node:fs";
import path from "node:path";
import { DECLARE_WIDGETS_DIR } from "@/config";

export const dynamic = "force-dynamic";

const HASH_RE = /^[0-9a-f]{16}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
	const { hash } = await params;
	if (!HASH_RE.test(hash)) return new Response("not found", { status: 404 });
	const file = path.join(DECLARE_WIDGETS_DIR, `${hash}.declare`);
	let source: string;
	try {
		source = fs.readFileSync(file, "utf-8");
	} catch {
		return new Response("not found", { status: 404 });
	}
	return new Response(source, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "private, max-age=31536000, immutable",
		},
	});
}
