/**
 * GET /api/profile — the language profiles and which one is running.
 * POST /api/profile {active: <profile id>} — select a profile for
 * the next start (data/profile.json). The response says whether a restart
 * is needed; the desktop app relaunches itself, `next dev` must be
 * restarted by hand.
 */

import { ensureSeeded, profileStatus, selectProfile, shownProfiles, type LanguageProfile } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	ensureSeeded();
	return Response.json(profileStatus());
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { active?: unknown } | null;
	if (typeof body?.active !== "string" || !shownProfiles().includes(body.active)) {
		return Response.json({ message: "active must be a language in the list" }, { status: 400 });
	}
	return Response.json(selectProfile(body!.active as LanguageProfile));
}
