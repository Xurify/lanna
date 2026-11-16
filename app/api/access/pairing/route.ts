/**
 * POST /api/access/pairing: makes the six-digit code a device types on its own
 * screen (E21). One code at a time, valid for five minutes and five wrong
 * tries. Only the desktop window or a paired device can ask for one.
 */
import { createPairingCode, formatCode } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST() {
	const made = await createPairingCode();
	if (made === "off") {
		return Response.json(
			{ error: "Turn on remote access first." },
			{ status: 409, headers: { "Cache-Control": "no-store" } },
		);
	}
	return Response.json(
		{ code: formatCode(made.code), expiresAt: made.expiresAt },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
