/**
 * GET /api/languages — the languages the app can add, and which are ready
 * or being added.
 * POST /api/languages {action: "add", id} — start adding one in the
 * background (src/server/language-add.ts). The task shows in the sidebar's
 * Background section and ends in a ready notice; GET /api/activity has it.
 */
import { languageCatalog, startLanguageAdd } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ languages: languageCatalog() });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; id?: unknown } | null;
	if (body?.action !== "add" || typeof body.id !== "string") {
		return Response.json({ message: 'body must be {action: "add", id}' }, { status: 400 });
	}
	try {
		const { taskId } = startLanguageAdd(body.id);
		return Response.json({ ok: true, taskId });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 409 });
	}
}
