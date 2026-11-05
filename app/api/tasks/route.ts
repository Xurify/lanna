/**
 * POST /api/tasks — the finished background tasks (server/tasks.ts):
 *   {action: "dismiss", id}  close the "ready" notice; the task stays on the Tasks page
 *   {action: "remove", id}   take it off the Tasks page
 *   {action: "clear"}        take every finished task off it
 * A running task is left alone (stop it with /api/activity/abort). The list
 * itself rides GET /api/activity.
 */
import { clearFinishedTasks, dismissTask, removeTask } from "@/src/server";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; id?: unknown } | null;
	if (body?.action === "clear") return Response.json({ ok: true, removed: clearFinishedTasks() });
	if ((body?.action !== "dismiss" && body?.action !== "remove") || typeof body.id !== "string" || !/^[A-Za-z0-9:_-]+$/.test(body.id)) {
		return Response.json({ message: 'body must be {action: "dismiss" | "remove", id} or {action: "clear"}' }, { status: 400 });
	}
	return (body.action === "dismiss" ? dismissTask(body.id) : removeTask(body.id)) ? Response.json({ ok: true }) : Response.json({ message: "no finished task with that id" }, { status: 404 });
}
