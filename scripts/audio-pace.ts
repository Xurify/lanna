/**
 * How fast is each voice? Reads <data>/audio/index.jsonl, measures every clip's
 * length with ffprobe, and prints the pace in syllables a second per engine and
 * voice, with the playback rate the app would use at 1x (src/core/pace.ts).
 *
 *   LH_DATA_DIR=/path/to/data npx tsx scripts/audio-pace.ts      (default: ./data)
 *
 * Needs ffprobe on the PATH. Run it on a real profile: the ElevenLabs and Edge
 * clips only exist there. Research: docs/research/voice-pace.md.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { countSyllables, NORMAL_SYLLABLES_PER_SECOND, paceRate } from "../src/core/pace.ts";

const root = path.join(process.env.LH_DATA_DIR ?? path.join(process.cwd(), "data"), "audio");
const index = path.join(root, "index.jsonl");
if (!fs.existsSync(index)) {
	console.error(`no audio index at ${index}`);
	process.exit(1);
}

interface Row { tier: string; voice: string; lang: string; text: string; seconds: number; syllables: number }
const seen = new Set<string>();
const rows: Row[] = [];
for (const line of fs.readFileSync(index, "utf8").split("\n")) {
	if (!line.trim()) continue;
	const e = JSON.parse(line) as { key: string; tier: string; voice: string; lang: string; text: string | null; file: string };
	const file = path.join(root, e.file);
	if (!e.text || seen.has(e.key) || !fs.existsSync(file)) continue;
	seen.add(e.key);
	const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
	if (Number.isFinite(seconds) && seconds > 0) rows.push({ tier: e.tier, voice: e.voice, lang: e.lang, text: e.text, seconds, syllables: countSyllables(e.text, e.lang) });
}

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
const groups = new Map<string, Row[]>();
for (const r of rows) groups.set(`${r.lang} ${r.tier}/${r.voice}`, [...(groups.get(`${r.lang} ${r.tier}/${r.voice}`) ?? []), r]);
console.log(`${rows.length} clips; the app plays at ${NORMAL_SYLLABLES_PER_SECOND} syllables a second at 1x\n`);
for (const [name, g] of groups) {
	const long = g.filter((r) => r.seconds >= 0.8 && r.syllables >= 3);
	const pace = long.map((r) => r.syllables / r.seconds);
	if (pace.length === 0) continue;
	const rates = long.map((r) => paceRate(r.syllables, r.seconds, 1));
	console.log(`${name}: ${g.length} clips (${long.length} measured)  pace median ${median(pace).toFixed(2)}, min ${Math.min(...pace).toFixed(2)}, max ${Math.max(...pace).toFixed(2)} syl/s  |  1x plays at ${Math.min(...rates).toFixed(2)}x to ${Math.max(...rates).toFixed(2)}x`);
}
