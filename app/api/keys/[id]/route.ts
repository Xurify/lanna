/**
 * PUT /api/keys/:id — save one key; DELETE — remove it (auth-keys wave,
 * 2026-09-19). `id` is the env-var/file key name (OPENROUTER_API_KEY, …).
 *
 * PUT body {value}: shape-gated (owner decision — bad pastes are 400s
 * naming the expected format, never stored; validation is SHAPE-ONLY, no
 * live pings). Saves take effect immediately (file + env reflected; no
 * restart). A var owned by the REAL env is persisted for later but NOT
 * reflected — the response's status row carries shadowedByEnv so the page
 * can explain why the saved key is not the live one.
 *
 * DELETE: gone from the file always; the env copy goes only when it was
 * the store's own reflection (a real env var stays — env wins). Idempotent
 * (absent key = success). Writable ids are the CURATED CATALOG ∪ THE
 * MODEL-PROVIDER env vars (provider-keys interlude); anything else is 404
 * on PUT — unknown file vars are preserved, not editable. DELETE also takes
 * an unknown var held in the file (2026-11-06), so a stray one can be
 * removed from Settings → API keys instead of by hand-editing auth.json.
 *
 * PATCH body {enabled: boolean}: switch a stored key off or on without
 * deleting it (env-owned keys too). 404 when nothing is stored under the id.
 */
import { BODY_LIMITS, bodyTooLarge, isWritableAuthKey, keyStatuses } from "@/src/server";
import { deleteKey, saveKey, setKeyEnabled } from "@/src/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const { id } = await params;
	if (!isWritableAuthKey(id)) {
		return Response.json({ error: `unknown key "${id}"` }, { status: 404 });
	}
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "body must be JSON" }, { status: 400 });
	}
	if (
		!body ||
		typeof body !== "object" ||
		Array.isArray(body) ||
		typeof (body as { value?: unknown }).value !== "string"
	) {
		return Response.json({ error: "body must be {value: string}" }, { status: 400 });
	}
	const result = saveKey(id, (body as { value: string }).value);
	if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
	return Response.json({ status: result.status });
}

export async function DELETE(_req: Request, { params }: Params) {
	const { id } = await params;
	const unknownInFile = keyStatuses().some((s) => s.id === id && !s.info && s.source === "file");
	if (!isWritableAuthKey(id) && !unknownInFile) {
		return Response.json({ error: `unknown key "${id}"` }, { status: 404 });
	}
	return Response.json({ status: deleteKey(id) });
}

export async function PATCH(req: Request, { params }: Params) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const { id } = await params;
	if (!keyStatuses().some((s) => s.id === id && s.present)) {
		return Response.json({ error: `no stored key "${id}"` }, { status: 404 });
	}
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "body must be JSON" }, { status: 400 });
	}
	const enabled = (body as { enabled?: unknown } | null)?.enabled;
	if (typeof enabled !== "boolean") {
		return Response.json({ error: "body must be {enabled: boolean}" }, { status: 400 });
	}
	return Response.json({ status: setKeyEnabled(id, enabled) });
}
