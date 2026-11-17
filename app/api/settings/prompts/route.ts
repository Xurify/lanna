/**
 * GET /api/settings/prompts — the effective prompt segments of the tutor
 * agent, derived from source at runtime (src/agent/prompts), each
 * with its source text, override text (if a file exists) and switch state.
 *
 *   GET → 200 {chat: SegmentInfo[]}
 *   SegmentInfo = {path, sourceText, overrideText, enabled, shared}
 *
 * Writes: the switches go through PUT /api/settings/agent; the TEXT goes
 * through PUT/DELETE /api/settings/prompts/[...segment].
 */

import { effectivePromptSegments, readSettingsRecord } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	const switches = readSettingsRecord()?.agent?.prompts ?? {};
	return Response.json({
		chat: effectivePromptSegments("chat", switches),
	});
}
