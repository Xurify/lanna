import { fromThisComputer, openTailscale } from "@/src/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const NOT_THIS_COMPUTER = "Tailscale Serve is set up on this computer. Open Lanna on it.";

export async function POST(request: Request) {
	if (!fromThisComputer(request.headers, request.headers.get("host"))) {
		return Response.json({ error: NOT_THIS_COMPUTER }, { status: 403, headers: NO_STORE });
	}
	const result = await openTailscale();
	if (!result.ok) {
		return Response.json({ error: result.message ?? "Couldn’t open Tailscale." }, { status: 500, headers: NO_STORE });
	}
	return Response.json({ ok: true }, { headers: NO_STORE });
}
