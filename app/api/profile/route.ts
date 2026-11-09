/**
 * GET /api/profile — the language profiles and which one is running.
 * POST /api/profile {active: <profile id>} — run that language from now on,
 * in place (src/server/language.ts selectProfile). 409 with the reason while
 * work that writes into the running language is still in flight. The
 * browser reloads the page afterwards (components/switch-language.ts).
 */

import { BODY_LIMITS, bodyTooLarge, profileStatus, selectProfile, shownProfiles, SwitchBlocked, type LanguageProfile } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(profileStatus());
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { active?: unknown } | null;
	if (typeof body?.active !== "string" || !shownProfiles().includes(body.active)) {
		return Response.json({ message: "active must be a language in the list" }, { status: 400 });
	}
	try {
		return Response.json(selectProfile(body.active as LanguageProfile));
	} catch (err) {
		if (err instanceof SwitchBlocked) return Response.json({ message: err.message }, { status: 409 });
		throw err;
	}
}
