/**
 * POST /api/reset {confirm: "RESET"} — start over on the active language
 * profile. The data folder is moved to data/backups/, not deleted.
 */

import { resetProfileData } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
	if (body?.confirm !== "RESET") {
		return Response.json({ error: 'confirm must be "RESET"' }, { status: 400 });
	}
	try {
		return Response.json({ ok: true, ...resetProfileData() });
	} catch (err) {
		return Response.json({ error: err instanceof Error ? err.message : "reset failed" }, { status: 500 });
	}
}
