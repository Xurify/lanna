/**
 * GET /api/usage — the spending report (src/server/usage-report.ts):
 * what every tutor session, extraction run and background job has cost
 * so far, by month and by kind, plus the audio library's size. Read-only,
 * folded from the records on disk at request time.
 */

import { usageReport } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(usageReport());
}
