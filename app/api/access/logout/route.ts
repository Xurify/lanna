/** POST /api/access/logout: signs this browser out and clears its cookie (E75). */
import { DEVICE_COOKIE, clearDeviceCookie, readCookie, revokeToken, secureRequest } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const token = readCookie(request.headers, DEVICE_COOKIE);
	if (token) await revokeToken(token);
	const headers = new Headers({ "Cache-Control": "no-store" });
	headers.append("Set-Cookie", clearDeviceCookie(secureRequest(request.url, request.headers)));
	return Response.json({ ok: true }, { headers });
}
