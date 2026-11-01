/**
 * GET /api/access: the remote-access state for Settings → Devices (E21).
 * PUT turns it on or off. Turning it on hands the window that asked a session
 * as "This computer", so the computer that switched it on is not locked out of
 * its own app. Turning it off signs every device out.
 */
import { DEVICE_COOKIE, accessStatus, clearDeviceCookie, deviceCookie, desktopWindowRequest, disableRemoteAccess, enableRemoteAccess, isPairedToken, listeningPort, readCookie, secureRequest } from "@/src/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export function GET(request: Request) {
	return Response.json(accessStatus(request.headers, listeningPort(request.url)), { headers: NO_STORE });
}

export async function PUT(request: Request) {
	const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
	if (typeof body?.enabled !== "boolean") {
		return Response.json({ error: 'Send {"enabled": true} or {"enabled": false}.' }, { status: 400, headers: NO_STORE });
	}
	const headers = new Headers(NO_STORE);
	const secure = secureRequest(request.url, request.headers);
	if (body.enabled) {
		const alreadyPaired = isPairedToken(readCookie(request.headers, DEVICE_COOKIE));
		const { token } = await enableRemoteAccess({ issueThisComputer: !alreadyPaired && !desktopWindowRequest(request.headers) });
		if (token) headers.append("Set-Cookie", deviceCookie(token, secure));
	} else {
		await disableRemoteAccess();
		headers.append("Set-Cookie", clearDeviceCookie(secure));
	}
	return Response.json(accessStatus(request.headers, listeningPort(request.url)), { headers });
}
