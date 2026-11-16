/**
 * POST /api/access/pair: the device side of pairing (E21). While remote access
 * is on, this is one of the few requests an unpaired phone may make. A right
 * code signs the device in for 180 days; the cookie is HttpOnly.
 */
import {
	cleanDeviceName,
	deviceCookie,
	deviceNameFromAgent,
	normalizeCode,
	redeemPairingCode,
	secureRequest,
} from "@/src/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { code?: unknown; name?: unknown } | null;
	const code = normalizeCode(body?.code);
	if (!code) {
		return Response.json({ error: "Enter the six-digit code from the computer." }, { status: 400, headers: NO_STORE });
	}
	const name = cleanDeviceName(body?.name, deviceNameFromAgent(request.headers.get("user-agent")));
	const result = await redeemPairingCode({ code, name });
	if (!result.ok) {
		if (result.reason === "off") {
			return Response.json({ error: "Remote access is off on this computer." }, { status: 409, headers: NO_STORE });
		}
		if (result.reason === "wrong") {
			const left = result.attemptsLeft;
			const message =
				left > 0
					? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`
					: "That code is used up. Make a new code on the computer.";
			return Response.json({ error: message, attemptsLeft: left }, { status: 401, headers: NO_STORE });
		}
		return Response.json(
			{ error: "That code has expired, or none is waiting. Make a new code on the computer." },
			{ status: 410, headers: NO_STORE },
		);
	}
	const headers = new Headers(NO_STORE);
	headers.append("Set-Cookie", deviceCookie(result.token, secureRequest(request.url, request.headers)));
	return Response.json({ ok: true, name: result.device.name }, { headers });
}
