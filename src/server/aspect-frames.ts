/**
 * Authored cue frames for the aspect probes (curriculum/slovak/aspect-frames.json).
 *
 * Mechanism only. The file holds no rows until the owner approves them (D4),
 * and a row is read only with a verifier's approval recorded in `approved`
 * and src "frame". Deleting the file, or switching ASPECT_FRAMES_ON off, turns
 * the layer off and the app keeps working: the family's verified-pool rows
 * are then the only probes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS } from "../../config.ts";
import type { MixupProbe } from "../core/mixups.ts";

/** The switch. False: no frame row is read, whatever the file holds. */
export const ASPECT_FRAMES_ON = true;

const FILE = path.join(PATHS.curriculum, "slovak", "aspect-frames.json");

/** One shared empty list: mixupLexicon caches on the list's identity. */
const NONE: readonly MixupProbe[] = [];

let cache: readonly MixupProbe[] | null = null;

function isApprovedFrame(x: unknown): x is MixupProbe {
	const r = x as Partial<MixupProbe> | null;
	return (
		!!r &&
		typeof r.slug === "string" &&
		typeof r.sk === "string" &&
		typeof r.type === "string" &&
		typeof r.phrase === "string" &&
		r.src === "frame" &&
		typeof r.approved === "string" &&
		r.approved.trim().length > 0
	);
}

/** The rows a parsed frame file holds: only frames with a recorded approval. */
export function parseFrameRows(raw: unknown): MixupProbe[] {
	const rows = (raw as { rows?: unknown } | null)?.rows;
	return Array.isArray(rows) ? rows.filter(isApprovedFrame) : [];
}

/** The approved authored frames. A missing or unreadable file gives none. */
export function aspectFrames(): readonly MixupProbe[] {
	if (!ASPECT_FRAMES_ON) return NONE;
	if (cache) return cache;
	let rows: MixupProbe[] = [];
	try {
		rows = parseFrameRows(JSON.parse(fs.readFileSync(FILE, "utf-8")));
	} catch {
		rows = [];
	}
	cache = rows.length ? rows : NONE;
	return cache;
}
