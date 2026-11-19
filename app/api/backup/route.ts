/**
 * GET /api/backup — the data folder against the private `lanna` bucket
 * (server/backup.ts): the last check, any upload or restore running now, and
 * the Cloudflare login or R2 token the bucket is read with.
 * POST {action: "check" | "upload" | "restore" | "connect" | "disconnect"} —
 * a fresh check, the job, or the way in changing: wrangler signing in or out,
 * or the token saved under API keys being dropped.
 */

import {
	BackupError,
	BODY_LIMITS,
	backupState,
	bodyTooLarge,
	checkBackup,
	connectBackup,
	disconnectBackup,
	startBackup,
} from "@/src/server";
import type { BackupJob } from "@/src/core";

export const dynamic = "force-dynamic";

type Action = BackupJob["action"] | "check" | "connect" | "disconnect";
const ACTIONS: ReadonlySet<string> = new Set(["check", "upload", "restore", "connect", "disconnect"]);

export async function GET() {
	return Response.json(await backupState());
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
	const action = body?.action;
	if (typeof action !== "string" || !ACTIONS.has(action))
		return Response.json(
			{ message: 'body must be {action: "check" | "upload" | "restore" | "connect" | "disconnect"}' },
			{ status: 400 },
		);
	try {
		if (action === "check") {
			await checkBackup();
			return Response.json(await backupState());
		}
		if (action === "connect") return Response.json(await connectBackup());
		if (action === "disconnect") return Response.json(await disconnectBackup());
		void startBackup(action as Action & BackupJob["action"]);
	} catch (err) {
		if (err instanceof BackupError) return Response.json({ message: err.message }, { status: err.status });
		throw err;
	}
	return Response.json(await backupState());
}
