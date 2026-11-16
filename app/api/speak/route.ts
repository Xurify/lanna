/**
 * GET /api/speak — the scenes (the chapter's and the purposes' first),
 * whether a model and a speech-to-text engine are set, a scene left
 * unfinished, recent scenes (src/server/speak.ts). ?id=<scene id> adds
 * that scene's record as `session` (to carry on with it).
 * POST /api/speak {action: "start", scene} — open a scene: the record and
 *   the tutor's first line.
 * POST /api/speak {action: "turn", id, text, via, ms?, pron?} — the learner's
 *   line (text, or multipart with the recording as `audio`; `pron` the score
 *   /api/pronounce gave it); the tutor's reply.
 * POST /api/speak {action: "end", id, ms?, tz?} — the summary, XP, the day's
 *   speaking, the slips' words into the review deck.
 * POST /api/speak {action: "drop", id} — forget a scene that never got going.
 */

import { isPronScore, type PronScore } from "@/src/core";
import {
	BODY_LIMITS,
	bodyTooLarge,
	speakDrop,
	speakEnd,
	speakStart,
	speakState,
	speakStore,
	speakTurn,
	STT_MAX_BYTES,
} from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const id = new URL(req.url).searchParams.get("id");
	const state = speakState();
	if (id && /^[a-z0-9][a-z0-9-]*$/.test(id)) return Response.json({ ...state, session: speakStore.get(id) });
	return Response.json(state);
}

interface Body {
	action?: unknown;
	scene?: unknown;
	id?: unknown;
	text?: unknown;
	via?: unknown;
	ms?: unknown;
	activeMs?: unknown;
	tz?: unknown;
	pron?: unknown;
}

/** A pronunciation score the client got from /api/pronounce, as JSON (a
 *  string in multipart, an object in JSON); anything else is dropped. */
function pronOf(v: unknown): PronScore | undefined {
	const o = typeof v === "string" ? (JSON.parse(v.slice(0, 20_000)) as unknown) : v;
	return isPronScore(o) ? o : undefined;
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) =>
	typeof v === "number" && Number.isFinite(v)
		? v
		: typeof v === "string" && v !== "" && Number.isFinite(Number(v))
			? Number(v)
			: undefined;

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.recording);
	if (oversized) return oversized;
	let body: Body = {};
	let audio: { data: Uint8Array } | undefined;
	const type = req.headers.get("content-type") ?? "";
	try {
		if (type.startsWith("multipart/form-data")) {
			const form = await req.formData();
			body = {
				action: form.get("action"),
				id: form.get("id"),
				text: form.get("text"),
				via: form.get("via"),
				ms: form.get("ms"),
				tz: form.get("tz"),
				pron: form.get("pron"),
			};
			const file = form.get("audio");
			if (file instanceof Blob && file.size > 0 && file.size <= STT_MAX_BYTES) {
				audio = { data: new Uint8Array(await file.arrayBuffer()) };
			}
		} else body = ((await req.json().catch(() => null)) as Body | null) ?? {};
	} catch {
		return Response.json({ message: "bad request" }, { status: 400 });
	}
	const tz = num(body.tz);
	try {
		switch (body.action) {
			case "start":
				return Response.json(await speakStart(str(body.scene, 40)));
			case "turn": {
				const via = body.via === "voice" ? "voice" : "typed";
				return Response.json(
					await speakTurn({
						id: str(body.id, 80),
						text: str(body.text),
						via,
						ms: num(body.ms),
						audio,
						pron: pronOf(body.pron),
					}),
				);
			}
			case "end":
				return Response.json(
					await speakEnd({
						id: str(body.id, 80),
						ms: num(body.ms),
						activeMs: num(body.activeMs),
						tz: tz !== undefined && Math.abs(tz) <= 840 ? tz : undefined,
					}),
				);
			case "drop":
				speakDrop(str(body.id, 80));
				return Response.json({ ok: true });
			default:
				return Response.json({ message: "action must be start, turn, end or drop" }, { status: 400 });
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const status = /unknown|over|nothing|something/i.test(message)
			? 400
			: /No model|configured/i.test(message)
				? 503
				: 500;
		return Response.json({ message }, { status });
	}
}
