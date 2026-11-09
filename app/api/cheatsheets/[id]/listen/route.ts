import { cheatsheetStore, recordOnce, recordSheetListen, sessionClientId, sheetListenFor, type SheetListenRep } from "@/src/server";

export const dynamic = "force-dynamic";

const NOT_FOUND = () => Response.json({ message: "This cheatsheet is not here." }, { status: 404 });

const sectionOf = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 80) : undefined);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const sheet = cheatsheetStore.get(id);
	if (!sheet) return NOT_FOUND();
	return Response.json(sheetListenFor(sheet, { section: sectionOf(new URL(req.url).searchParams.get("section")) }));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const sheet = cheatsheetStore.get(id);
	if (!sheet) return NOT_FOUND();
	const body = (await req.json().catch(() => null)) as { reps?: unknown; section?: unknown; ms?: unknown; activeMs?: unknown; tz?: unknown; clientId?: unknown } | null;
	if (!body || !Array.isArray(body.reps)) return Response.json({ message: "reps must be an array" }, { status: 400 });
	const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 600) : "");
	const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(Math.min(v, 3_600_000)) : undefined);
	const reps: SheetListenRep[] = body.reps.slice(0, 40).map((r: Record<string, unknown>) => ({
		itemId: str(r.itemId),
		given: str(r.given),
		peeked: r.peeked === true,
		...(num(r.replays) !== undefined ? { replays: num(r.replays) } : {}),
		...(num(r.ms) !== undefined ? { ms: num(r.ms) } : {}),
		...(num(r.heardMs) !== undefined ? { heardMs: num(r.heardMs) } : {}),
	}));
	const tz = Number(body.tz);
	return Response.json(
		recordOnce("sheet-listen", sessionClientId(body.clientId), () =>
			recordSheetListen(sheet, {
				reps,
				section: sectionOf(body.section),
				ms: num(body.ms),
				activeMs: num(body.activeMs),
				tz: Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined,
			}),
		),
	);
}
