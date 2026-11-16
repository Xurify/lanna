import { accessStatus, clearDeviceCookie, listeningPort, revokeDevice, secureRequest } from "@/src/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const port = listeningPort(request.url);
	const askedAsThisDevice = accessStatus(request.headers, port).devices.some(
		(device) => device.id === id && device.current,
	);
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (!(await revokeDevice(id))) {
		return Response.json({ error: "No such device." }, { status: 404, headers });
	}
	if (askedAsThisDevice) headers.append("Set-Cookie", clearDeviceCookie(secureRequest(request.url, request.headers)));
	return Response.json(accessStatus(request.headers, port), { headers });
}
