/**
 * GET /api/access/serve: whether Serve publishes this window's port. POST
 * starts it with the command the screen shows (E21).
 *
 * Both answer only this computer's own window: Serve runs a program here, so a
 * paired phone may not ask for it.
 */
import { fromThisComputer, listeningPort, readAccess, serveState, startServe } from "@/src/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const NOT_THIS_COMPUTER = "Tailscale Serve is set up on this computer. Open Lanna on it.";

function refusedUnlessThisComputer(request: Request): Response | null {
	if (fromThisComputer(request.headers, request.headers.get("host"))) return null;
	return Response.json({ error: NOT_THIS_COMPUTER }, { status: 403, headers: NO_STORE });
}

export async function GET(request: Request) {
	const refused = refusedUnlessThisComputer(request);
	if (refused) return refused;
	return Response.json(await serveState(listeningPort(request.url)), { headers: NO_STORE });
}

export async function POST(request: Request) {
	const refused = refusedUnlessThisComputer(request);
	if (refused) return refused;
	if (!readAccess().enabled) {
		return Response.json({ error: "Turn on remote access first." }, { status: 409, headers: NO_STORE });
	}
	const started = await startServe(listeningPort(request.url));
	if (!started.ok) return Response.json({ error: started.message }, { status: 500, headers: NO_STORE });
	return Response.json(started.state, { headers: NO_STORE });
}
