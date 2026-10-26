/** GET /api/lexicon?q=… — dictionary lookup in the active profile's
 *  lexicon (exact form, then without diacritics, then English gloss). */

import { lookupWord } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const q = new URL(req.url).searchParams.get("q") ?? "";
	return Response.json(lookupWord(q));
}
