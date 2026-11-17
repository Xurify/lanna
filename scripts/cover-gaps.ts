/**
 * Which stories in a profile have a cover that fits them, and which got a
 * general scene because no scene matches their topic (the ink-drawing
 * skill, "Story covers"):
 *
 *   LANNA_DATA_DIR=<profile folder> npx tsx scripts/cover-gaps.ts
 *
 * Each story is listed with the cover it shows and where that came from:
 * "writer" (the story writer named it), "words" (its title or theme
 * matched a scene) or "general" (nothing matched; a general scene by
 * seed). The "general" stories, with their topics, are the scenes worth
 * drawing next.
 */

import { coverMotif, coverSeed, matchedCoverMotif, type CoverMotif } from "../src/core/cover.ts";
import { storyStore } from "../src/store/stories";

type Origin = "writer" | "words" | "general";

const rows = storyStore.list().map((story) => {
	const text = `${story.title} ${[story.theme, story.topic].filter(Boolean).join(" ")}`;
	const matched = matchedCoverMotif(text);
	const origin: Origin = story.cover ? "writer" : matched ? "words" : "general";
	const cover: CoverMotif = story.cover ?? coverMotif(text, coverSeed(story.id));
	return { title: story.title, topic: story.topic ?? story.theme, cover, origin };
});

const counts = new Map<CoverMotif, number>();
for (const row of rows) counts.set(row.cover, (counts.get(row.cover) ?? 0) + 1);

console.log(`${rows.length} stories\n`);
for (const row of rows)
	console.log(`${row.origin.padEnd(8)} ${row.cover.padEnd(10)} ${row.title}${row.topic ? `  (${row.topic})` : ""}`);
console.log("\nStories per scene:");
for (const [cover, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${cover.padEnd(10)} ${n}`);
const general = rows.filter((row) => row.origin === "general");
console.log(
	general.length
		? `\n${general.length} with no fitting scene; their topics are the next scenes to draw:\n${general.map((row) => `  ${row.topic || row.title}`).join("\n")}`
		: "\nEvery story has a fitting scene.",
);
