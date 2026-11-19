/**
 * GET /api/backup — the data folder against its copy (server/backup.ts): where
 * the copy goes, the last check, any upload or restore running now, and the
 * Cloudflare login or R2 token the bucket is read with.
 * POST {action: "check" | "upload" | "restore" | "connect" | "disconnect" |
 * "use-folder" | "use-cloudflare"} — a fresh check, the job, or where the copy
 * goes changing: a folder on this computer, back to the bucket, wrangler
 * signing in or out, or the token saved under API keys being dropped.
 */

import {
	BackupError,
	BODY_LIMITS,
	backupState,
	bodyTooLarge,
	checkBackup,
	chooseCloudflare,
	chooseFolder,
	connectBackup,
	disconnectBackup,
	startBackup,
} from "@/src/server";
import type { BackupJob } from "@/src/core";

export const dynamic = "force-dynamic";

type Action = BackupJob["action"] | "check" | "connect" | "disconnect" | "use-folder" | "use-cloudflare";
const ACTIONS: ReadonlySet<string> = new Set([
	"check",
	"upload",
	"restore",
	"connect",
	"disconnect",
	"use-folder",
	"use-cloudflare",
]);
const ACTIONS_HELP =
	'body must be {action: "check" | "upload" | "restore" | "connect" | "disconnect" | "use-folder" | "use-cloudflare"}';

export async function GET() {
	return Response.json(await backupState());
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { action?: unknown; folder?: unknown } | null;
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
			return Response.json(await chooseFolder(body.folder));
		}
		if (action === "use-cloudflare") return Response.json(await chooseCloudflare());
		if (action === "connect") return Response.json(await connectBackup());
		if (action === "disconnect") return Response.json(await disconnectBackup());
		void startBackup(action as Action & BackupJob["action"]);
	} catch (err) {
		if (err instanceof BackupError) return Response.json({ message: err.message }, { status: err.status });
		throw err;
	}
	return Response.json(await backupState());
}
