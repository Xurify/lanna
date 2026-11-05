/**
 * POST /api/tasks {action: "dismiss", id} — take a finished background
 * task (server/tasks.ts) off the "ready" notice. A running task is left
 * alone (stop it with /api/activity/abort). The list itself rides
 * GET /api/activity.
 */
import { dismissTask } from "@/src/server";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; id?: unknown } | null;
	if (body?.action !== "dismiss" || typeof body.id !== "string" || !/^[A-Za-z0-9:_-]+$/.test(body.id)) {
		return Response.json({ message: 'body must be {action: "dismiss", id}' }, { status: 400 });
	}
	return dismissTask(body.id) ? Response.json({ ok: true }) : Response.json({ message: "no finished task with that id" }, { status: 404 });
}
