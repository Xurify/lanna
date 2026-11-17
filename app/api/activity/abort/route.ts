/**
 * POST /api/activity/abort — stop a running process. Body {kind: "turn"|"task", id}:
 * the chatId for a turn (any client may stop it; a view leaving never does),
 * the task id for a background task. not running → 409, stopped → 200.
 */
import { abortTask, abortTurn, BODY_LIMITS, bodyTooLarge } from "@/src/server";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}
	const { kind, id } = (body ?? {}) as { kind?: string; id?: string };
	if ((kind !== "turn" && kind !== "task") || typeof id !== "string" || id === "") {
		return Response.json({ error: 'Body must be {kind: "turn"|"task", id: string}' }, { status: 400 });
	}
	if (!/^[A-Za-z0-9:_-]+$/.test(id)) {
		return Response.json({ error: "Invalid id" }, { status: 400 });
	}

	if (kind === "task") {
		// A background task (server/tasks.ts): its signal fires and the work ends it.
		return abortTask(id)
			? Response.json({ ok: true })
			: Response.json({ ok: false, reason: "not_running" }, { status: 409 });
	}
	if (kind === "turn") {
		const outcome = abortTurn(id);
		if (!outcome.ok) return Response.json({ ok: false, reason: outcome.reason }, { status: 409 });
		return Response.json({ ok: true });
	}
}
