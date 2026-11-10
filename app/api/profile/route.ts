import { deviceLanguageCookie } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, profileStatus, secureRequest, selectProfile, shownProfiles, type LanguageProfile } from "@/src/server";

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
	const status = selectProfile(body.active as LanguageProfile);
	return Response.json(status, { headers: { "set-cookie": deviceLanguageCookie(status.active, secureRequest(req.url, req.headers)) } });
}
