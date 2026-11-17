import fs from "node:fs";
import { curriculumFile } from "../../config.ts";
import type { FillerKit } from "../core/fillers.ts";
import { activeLanguage } from "./active-language.ts";

const cache = new Map<string, FillerKit | null>();

/** The language's filler kit (curriculum/<language>/fillers.json), or null
 *  when the language has none yet. Read once per process per language. */
export function fillerKit(profile = activeLanguage().id): FillerKit | null {
	const hit = cache.get(profile);
	if (hit !== undefined) return hit;
	let kit: FillerKit | null = null;
	try {
		const raw = JSON.parse(fs.readFileSync(curriculumFile(profile, "fillers.json"), "utf-8")) as FillerKit;
		if (Array.isArray(raw.entries) && raw.entries.length > 0) kit = raw;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT")
			console.warn("[fillers] could not read the kit:", err instanceof Error ? err.message : err);
	}
	cache.set(profile, kit);
	return kit;
}
