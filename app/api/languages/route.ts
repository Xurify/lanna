/**
 * GET /api/languages — the languages the app can add, and which are ready
 * or being added.
 * POST /api/languages {action: "add", id, slot?: "strong" | "cheap" | "dictionary"} — start adding one in the
 * background (src/server/language-add.ts). The task shows in the sidebar's
 * Background section and ends in a ready notice; GET /api/activity has it.
 * POST /api/languages {action: "remove", id} — take a language off the
 * list: an added one's words and grammar map are deleted, a built-in one is
 * hidden. The learner's progress in it stays. Adding a hidden built-in puts
 * it back.
 */
import { addEstimates, BODY_LIMITS, bodyTooLarge, languageCatalog, removeLanguage, restoreLanguage, startLanguageAdd } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ languages: languageCatalog(), writers: addEstimates() });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { action?: unknown; id?: unknown; slot?: unknown } | null;
	if ((body?.action !== "add" && body?.action !== "remove") || typeof body.id !== "string") {
		return Response.json({ message: 'body must be {action: "add" | "remove", id}' }, { status: 400 });
	}
	try {
		if (body.action === "remove") {
			removeLanguage(body.id);
			return Response.json({ ok: true });
		}
		if (restoreLanguage(body.id)) return Response.json({ ok: true, restored: true });
		const slot = body.slot === "cheap" || body.slot === "dictionary" ? body.slot : "strong";
		const { taskId } = startLanguageAdd(body.id, { slot });
		return Response.json({ ok: true, taskId });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 409 });
	}
}
