import { clientAddress, deviceCookie, deviceNameFromAgent, safeNext, secureRequest, signInWithPassword } from "@/src/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { password?: unknown; next?: unknown } | null;
	const result = await signInWithPassword({
		password: body?.password,
		client: clientAddress(request.headers),
		deviceName: deviceNameFromAgent(request.headers.get("user-agent")),
	});
	if (!result.ok) {
		switch (result.reason) {
			case "locked":
				return Response.json(
					{ error: "Too many tries. Wait a while, then try again.", retryAfterSec: result.retryAfterSec },
					{ status: 429, headers: { ...NO_STORE, "Retry-After": String(result.retryAfterSec) } },
				);
			case "wrong":
				return Response.json(
					{ error: result.triesLeft > 0 ? "That password is not right." : "That password is not right. The next wrong try locks sign-in for a while.", triesLeft: result.triesLeft },
					{ status: 401, headers: NO_STORE },
				);
			case "no-password":
				return Response.json({ error: "No password is set. On the server, run npm run web:password." }, { status: 409, headers: NO_STORE });
			case "off":
				return Response.json({ error: "Web access is off. Turn it on in Settings → Devices on the server." }, { status: 409, headers: NO_STORE });
			default:
				return Response.json({ error: "Enter your password." }, { status: 400, headers: NO_STORE });
		}
	}
	const headers = new Headers(NO_STORE);
	headers.append("Set-Cookie", deviceCookie(result.token, secureRequest(request.url, request.headers)));
	return Response.json({ ok: true, next: safeNext(typeof body?.next === "string" ? body.next : null) }, { headers });
}
