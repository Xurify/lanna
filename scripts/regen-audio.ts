/**
 * npm run audio:regen                 — count what would be made again and what it costs; spends nothing
 * npm run audio:regen -- --yes        — make it again with the newest ElevenLabs model
 *   --max-chars 50000                 stop before this many characters are spent
 *   --concurrency 3                   clips at a time
 *
 * Reads the real data folder (src/server/audio-regen.ts). Replaced files move
 * to data/audio/replaced/<stamp>/; nothing is deleted. Safe to stop and run
 * again: a clip already made by the newest model is skipped.
 */

import { regenCost, regenPlan, regenerate, USD_PER_1K_CHARS } from "../src/server/audio-regen.ts";
import { keyValue } from "../src/server/keys.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const yes = args.includes("--yes");
const maxChars = flag("--max-chars") ? Number(flag("--max-chars")) : undefined;
const concurrency = flag("--concurrency") ? Number(flag("--concurrency")) : 3;

const plan = regenPlan();
const byGroup = new Map<string, { clips: number; chars: number }>();
for (const i of plan.items) {
	const k = `${i.lang.english} · ${i.reason}`;
	const g = byGroup.get(k) ?? { clips: 0, chars: 0 };
	g.clips++;
	g.chars += i.chars;
	byGroup.set(k, g);
}
const money = (n: number) => `$${n.toFixed(2)}`;
const clips = (count: number) => `${count} ${count === 1 ? "clip" : "clips"}`;
const cost = regenCost(plan.chars);
console.log(`Model: ${plan.model}`);
console.log(`To make again: ${clips(plan.items.length)}, ${plan.chars.toLocaleString("en")} characters`);
for (const [k, g] of [...byGroup].sort((a, b) => b[1].chars - a[1].chars))
	console.log(`  ${k}: ${clips(g.clips)}, ${g.chars.toLocaleString("en")} characters`);
console.log(
	`Cost: ${cost.credits.toLocaleString("en")} credits on a plan, or ${money(cost.usdLow)} to ${money(cost.usdHigh)} on the API ($${USD_PER_1K_CHARS.low} to $${USD_PER_1K_CHARS.high} per 1,000 characters; check elevenlabs.io/pricing/api)`,
);
if (Object.keys(plan.kept).length) {
	console.log("Left as they are:");
	for (const [why, n] of Object.entries(plan.kept)) console.log(`  ${why}: ${n}`);
}

if (!yes) {
	console.log("\nNothing was spent. Run `npm run audio:regen -- --yes` to make them again.");
	process.exit(0);
}
if (!keyValue("ELEVENLABS_API_KEY")) {
	console.error("No ELEVENLABS_API_KEY: add it in Settings → API keys first.");
	process.exit(1);
}
let n = 0;
const result = await regenerate(plan, {
	maxChars,
	concurrency,
	onClip: (item, ok) => {
		n++;
		if (n % 25 === 0 || !ok)
			console.log(`${n}/${plan.items.length} ${ok ? "" : "FAILED "}${item.entry.text.slice(0, 60)}`);
	},
});
console.log(
	`\nMade again: ${clips(result.done)}, ${result.chars.toLocaleString("en")} characters. Failed: ${result.failed.length}.`,
);
for (const f of result.failed.slice(0, 10)) console.log(`  ${f.text.slice(0, 60)}: ${f.error}`);
if (result.stoppedAt) console.log("Stopped at the --max-chars limit; run again to go on.");
