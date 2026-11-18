/**
 * npm run audio:stories              — count the story sentences with no ElevenLabs clip and what they cost; spends nothing
 * npm run audio:stories -- --yes     — make them
 *   --max-chars 50000                stop before this many characters are spent
 *   --concurrency 3                  clips at a time
 *
 * The Library's "Make audio" button does the same (src/server/story-audio.ts).
 * Safe to stop and run again: a sentence that has its clip is skipped.
 */

import { regenCost, USD_PER_1K_CHARS } from "../src/server/audio-regen.ts";
import { keyValue } from "../src/server/keys.ts";
import { revoiceStories, startStoryAudio, storyAudioPlan } from "../src/server/story-audio.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const yes = args.includes("--yes");
const maxChars = flag("--max-chars") ? Number(flag("--max-chars")) : undefined;
const concurrency = flag("--concurrency") ? Number(flag("--concurrency")) : 3;

if (yes && keyValue("ELEVENLABS_API_KEY")) {
	const revoiced = await revoiceStories();
	if (revoiced)
		console.log(`New voices for the cast of ${revoiced} stories (their old voices are gone from ElevenLabs)`);
}
const plan = storyAudioPlan();
const money = (n: number) => `$${n.toFixed(2)}`;
const cost = regenCost(plan.chars);
console.log(`Model: ${plan.model}`);
console.log(`Stories: ${plan.stories}, ${plan.storiesReady} already with audio for every sentence`);
console.log(`To make: ${plan.items.length} sentences, ${plan.chars.toLocaleString("en")} characters`);
console.log(
	`Cost: ${cost.credits.toLocaleString("en")} credits on a plan, or ${money(cost.usdLow)} to ${money(cost.usdHigh)} on the API ($${USD_PER_1K_CHARS.low} to $${USD_PER_1K_CHARS.high} per 1,000 characters)`,
);
for (const [why, n] of Object.entries(plan.kept)) console.log(`  left out, ${why}: ${n}`);

if (!yes || plan.items.length === 0) {
	if (plan.items.length) console.log("\nNothing was spent. Run `npm run audio:stories -- --yes` to make them.");
	process.exit(0);
}
if (!keyValue("ELEVENLABS_API_KEY")) {
	console.error("No ELEVENLABS_API_KEY: add it in Settings → API keys first.");
	process.exit(1);
}
let n = 0;
const result = await startStoryAudio({
	maxChars,
	concurrency,
	onClip: (item, ok) => {
		n++;
		if (n % 25 === 0 || !ok)
			console.log(`${n}/${plan.items.length} ${ok ? "" : "FAILED "}${item.entry.text.slice(0, 60)}`);
	},
});
console.log(`\nMade: ${result.done} clips, ${result.chars.toLocaleString("en")} characters. Failed: ${result.failed}.`);
if (result.error) console.log(`First failure: ${result.error}`);
