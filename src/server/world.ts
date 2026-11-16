/**
 * The story bible (reading, chapter-arc phase 2, 2026-10-30):
 * the series' cast, places and one plot beat per chapter, bundled under
 * curriculum/<profile>/world.json. It seeds the series episodes the Read
 * shelf writes for the chapter the learner is in, so every chapter opens
 * with its own episode and the series keeps its people and places. Read
 * only — no generation writes the bible; the picker and the brief read it.
 */

import fs from "node:fs";
import { processWide } from "../core/process-wide.ts";
import { activeProfile, curriculumFile } from "../../config.ts";

export interface WorldPerson {
	id: string;
	name: string;
	gender: "f" | "m";
	age: "child" | "young" | "adult" | "old";
	/** One line on who they are in the series. */
	role: string;
}

export interface WorldPlace {
	id: string;
	/** The place as it appears in texts ("the Miletičova market"). */
	name: string;
	note: string;
}

export interface World {
	series: string;
	language?: string;
	version?: number;
	/** Where the series is set ("Bratislava"). */
	city?: string;
	/** The lead in one line, as the writer is told it. */
	logline?: string;
	/** Episode settings per purpose (src/core/onboarding.ts PURPOSES). */
	settings?: Partial<Record<string, string[]>>;
	/** The Speak scenes set in the series' places, by scene id (src/core/speak.ts). */
	scenes?: Partial<Record<string, { title?: string; blurb?: string; brief?: string; task?: string }>>;
	cast: WorldPerson[];
	places: WorldPlace[];
	/** One English sentence per chapter id (src/core/curriculum.ts allChapters()). */
	beats: Record<string, string>;
}

const cache = processWide("world", () => new Map<string, World | null>());

function worldPath(profile: string = activeProfile()): string {
	return curriculumFile(profile, "world.json");
}

/** The active profile's story bible, or null when the language has none. */
export function loadWorld(profile: string = activeProfile()): World | null {
	if (cache.has(profile)) return cache.get(profile)!;
	let world: World | null = null;
	try {
		world = JSON.parse(fs.readFileSync(worldPath(profile), "utf-8")) as World;
	} catch {
		world = null;
	}
	cache.set(profile, world);
	return world;
}
