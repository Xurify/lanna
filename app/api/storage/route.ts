/**
 * GET /api/storage — what the app keeps on this computer (Settings → Data):
 * the voice clips, the active language's progress, and the reset backups,
 * measured on disk. Read-only. The desktop cache is cleared through the
 * desktop bridge, never from here.
 */

import { storageReport } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(await storageReport());
}
