/** GET /api/speak/live/report — the saved talks and their trends. */

import { liveReports } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(liveReports());
}
