/**
 * GET /api/backup — the data folder against each place it is copied to
 * (server/backup.ts): what is here, the last look at each place, any upload or
 * restore running now, and the Cloudflare login or R2 token the bucket is read
 * with.
 * POST {action: "check" | "upload" | "restore" | "connect" | "disconnect" |
 * "use-folder" | "drop-folder" | "use-bucket" | "drop-bucket"} — a fresh look,
 * the job into one place, or the copies changing: a folder joining them, the
 * bucket joining or leaving them, or the way in being made and dropped.
 */

import {
	BackupError,
	BODY_LIMITS,
	backupState,
	bodyTooLarge,
	checkBackup,
	connectBackup,
	disconnectBackup,
	dropFolder,
	startBackup,
	useBucket,
	useFolder,
} from "@/src/server";
import type { BackupJob } from "@/src/core";

export const dynamic = "force-dynamic";

const ACTIONS: ReadonlySet<string> = new Set([
	"check",
	"upload",
	"restore",
	"connect",
	"disconnect",
	"use-folder",
	"drop-folder",
	"use-bucket",
	"drop-bucket",
]);
const ACTIONS_HELP =
	'body must be {action: "check" | "upload" | "restore" | "connect" | "disconnect" | "use-folder" | "drop-folder" | "use-bucket" | "drop-bucket"}';

export async function GET() {
	return Response.json(await backupState());
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { action?: unknown; folder?: unknown; place?: unknown } | null;
	const action = body?.action;
	if (typeof action !== "string" || !ACTIONS.has(action))
		return Response.json({ message: ACTIONS_HELP }, { status: 400 });
	try {
		if (action === "check") {
			await checkBackup();
			return Response.json(await backupState());
		}
		if (action === "use-folder") {
			if (typeof body?.folder !== "string")
				return Response.json({ message: "use-folder needs {folder}" }, { status: 400 });
			return Response.json(await useFolder(body.folder));
		}
		if (action === "drop-folder") return Response.json(await dropFolder());
		if (action === "use-bucket") return Response.json(await useBucket(true));
		if (action === "drop-bucket") return Response.json(await useBucket(false));
		if (action === "connect") return Response.json(await connectBackup());
		if (action === "disconnect") return Response.json(await disconnectBackup());
		const place = body?.place;
		if (place !== "folder" && place !== "cloudflare")
			return Response.json({ message: "upload and restore need {place}" }, { status: 400 });
		void startBackup(action as BackupJob["action"], place);
	} catch (err) {
		if (err instanceof BackupError) return Response.json({ message: err.message }, { status: err.status });
		throw err;
	}
	return Response.json(await backupState());
}
