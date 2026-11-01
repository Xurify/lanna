/**
 * DELETE /api/access/devices/:id: signs one device out (E21). The desktop
 * window or a paired device may do it, including the device that asks.
 */
import { accessStatus, listeningPort, revokeDevice } from "@/src/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!(await revokeDevice(id))) {
		return Response.json({ error: "No such device." }, { status: 404, headers: NO_STORE });
	}
	return Response.json(accessStatus(request.headers, listeningPort(request.url)), { headers: NO_STORE });
}
