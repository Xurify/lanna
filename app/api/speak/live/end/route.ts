/**
 * POST /api/speak/live/end — the call is over: its timed turns, the pauses
 * the microphone measured and the transcript the browser kept come back,
 * and the talk is read, saved and paid for here.
 */

import { BODY_LIMITS, bodyTooLarge, liveEnd, nextIslandStep } from "@/src/server";
import type { LiveCallInput, LiveToolEvent, LiveTurn } from "@/src/core";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

function turnsOf(raw: unknown): LiveTurn[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.slice(0, 300)
		.map((row) => {
			const r = (row ?? {}) as Record<string, unknown>;
			const role = r.role === "learner" ? "learner" : r.role === "tutor" ? "tutor" : null;
			const text = str(r.text, 1200).replace(/\s+/g, " ").trim();
			if (!role || !text) return null;
			const start = num(r.start);
			const end = Math.max(start, num(r.end));
			return { role, text, start, end, ...(r.approximate === true ? { approximate: true } : {}) };
		})
		.filter((t): t is LiveTurn => !!t);
}

function toolsOf(raw: unknown): LiveToolEvent[] {
	if (!Array.isArray(raw)) return [];
	const kinds = new Set(["prompt_repair", "vault_word_used", "new_chunk", "filler_used", "end_talk"]);
	return raw
		.slice(0, 200)
		.map((row) => {
			const r = (row ?? {}) as Record<string, unknown>;
			const tool = typeof r.tool === "string" && kinds.has(r.tool) ? (r.tool as LiveToolEvent["tool"]) : null;
			if (!tool) return null;
			return {
				tool,
				at: num(r.at),
				...(typeof r.yours === "string" ? { yours: str(r.yours, 300) } : {}),
				...(typeof r.hint === "string" ? { hint: str(r.hint, 300) } : {}),
				...(typeof r.kind === "string" ? { kind: str(r.kind, 20) } : {}),
				...(typeof r.lemma === "string" ? { lemma: str(r.lemma, 80) } : {}),
				...(typeof r.sk === "string" ? { sk: str(r.sk, 160) } : {}),
				...(typeof r.en === "string" ? { en: str(r.en, 200) } : {}),
			};
		})
		.filter((t): t is LiveToolEvent => !!t);
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) return Response.json({ message: "A body is required" }, { status: 400 });
	const kind = body.kind === "island" ? "island" : body.kind === "scene" ? "scene" : null;
	const ref = str(body.ref, 80).trim();
	const turns = turnsOf(body.turns);
	if (!kind || !ref) return Response.json({ message: "kind and ref are required" }, { status: 400 });
	if (!turns.some((t) => t.role === "learner"))
		return Response.json({ message: "Nothing was said in this talk." }, { status: 400 });
	const now = new Date().toISOString();
	const input: LiveCallInput = {
		kind,
		ref,
		...(typeof body.title === "string" ? { title: str(body.title, 120) } : {}),
		turns,
		pausesMs: Array.isArray(body.pausesMs)
			? body.pausesMs
					.slice(0, 200)
					.map(num)
					.filter((ms) => ms > 0)
			: [],
		approximate: body.approximate === true,
		startedAt: typeof body.startedAt === "string" ? str(body.startedAt, 40) : now,
		endedAt: typeof body.endedAt === "string" ? str(body.endedAt, 40) : now,
		tools: toolsOf(body.tools),
		...(typeof body.conversationId === "string" ? { conversationId: str(body.conversationId, 120) } : {}),
	};
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	try {
		const outcome = await liveEnd(input, tz);
		const next = outcome.island ? nextIslandStep(outcome.island) : null;
		return Response.json({
			report: outcome.report,
			xp: outcome.xp,
			queued: outcome.queued,
			island: outcome.island,
			next,
		});
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
	}
}
