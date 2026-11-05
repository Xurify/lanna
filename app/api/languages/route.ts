/**
 * GET /api/languages — the languages the app can add, and which are ready
 * or being added.
 * POST /api/languages {action: "add", id} — start adding one in the
 * background (src/server/language-add.ts). The task shows in the sidebar's
 * Background section and ends in a ready notice; GET /api/activity has it.
 * POST /api/languages {action: "remove", id} — delete an added language's
 * words and grammar map. The learner's progress in it stays.
 */
import { addBlocker, languageCatalog, removeLanguage, startLanguageAdd } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ languages: languageCatalog(), blocker: addBlocker() });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; id?: unknown } | null;
	if ((body?.action !== "add" && body?.action !== "remove") || typeof body.id !== "string") {
		return Response.json({ message: 'body must be {action: "add" | "remove", id}' }, { status: 400 });
	}
	try {
		if (body.action === "remove") {
			removeLanguage(body.id);
			return Response.json({ ok: true });
		}
		const { taskId } = startLanguageAdd(body.id);
		return Response.json({ ok: true, taskId });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 409 });
	}
}
