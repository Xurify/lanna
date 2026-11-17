import { isTurnRunning } from "@/src/server";

export const dynamic = "force-dynamic";

/** Whether a turn is running for this chat: a view that lost its stream asks before it reattaches. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!/^[A-Za-z0-9_-]+$/.test(id)) return Response.json({ error: "Invalid chatId" }, { status: 400 });
	return Response.json({ turnInFlight: isTurnRunning(id) });
}
