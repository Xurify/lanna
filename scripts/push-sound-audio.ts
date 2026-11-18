/**
 * npm run audio:sounds:push                       — list the Sound guide clips that would be uploaded; uploads nothing
 * npm run audio:sounds:push -- --yes              — upload them to the public `lanna-public` R2 bucket and write the manifests
 *   --base https://pub-….r2.dev                   the bucket's public address (kept in the manifest after the first run)
 *
 * Reads the real data folder. Only words the Sound guide ships are uploaded,
 * and only clips ElevenLabs made (`npm run audio:sounds -- --yes` makes them).
 * Uploading needs `wrangler login` (developers.cloudflare.com/workers/wrangler/commands/#r2-object-put).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { languageById } from "../src/core/language.ts";
import { soundGuideWords } from "../src/core/sound-notes.ts";
import { sharedAudioFile, type SharedAudioManifest } from "../src/server/shared-audio.ts";
import { keptByElevenLabs } from "../src/server/tts.ts";
import { audioKey, findAudioClip } from "../src/store/corpus.ts";

const BUCKET = "lanna-public";
const VOICE = "female";
const PROFILES = ["slovak", "russian", "estonian"];

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const baseArg = args.includes("--base") ? args[args.indexOf("--base") + 1] : undefined;

function readManifest(profile: string): SharedAudioManifest | null {
	try {
		return JSON.parse(fs.readFileSync(sharedAudioFile(profile), "utf-8")) as SharedAudioManifest;
	} catch {
		return null;
	}
}

function upload(object: string, file: string): boolean {
	const put = spawnSync(
		"npx",
		[
			"-y",
			"wrangler@4",
			"r2",
			"object",
			"put",
			`${BUCKET}/${object}`,
			"--file",
			`"${file}"`,
			"--remote",
			"--content-type",
			"audio/mpeg",
			"--cache-control",
			'"public, max-age=31536000, immutable"',
		],
		{ shell: true, encoding: "utf-8" },
	);
	if (put.status !== 0) console.error(`  FAILED ${object}: ${(put.stderr || put.stdout).trim().slice(-200)}`);
	return put.status === 0;
}

let failed = 0;
for (const profile of PROFILES) {
	const lang = languageById(profile);
	if (!lang) continue;
	const before = readManifest(profile);
	const base = (baseArg ?? before?.base ?? "").replace(/\/$/, "");
	const moved = before !== null && before.base !== base;
	const clips: SharedAudioManifest["clips"] = moved ? {} : { ...before?.clips };
	const toUpload: Array<{ text: string; object: string; model: string; file: string }> = [];
	let notMade = 0;
	for (const text of soundGuideWords(profile)) {
		const key = audioKey(lang.code, VOICE, text);
		const clip = keptByElevenLabs(key, lang.code) ? findAudioClip(key) : null;
		if (!clip?.model) {
			notMade++;
			continue;
		}
		// The model is in the name, so a word made again by a newer model never overwrites an object browsers cache forever.
		const object = `sound-guide/${lang.code}/${clip.model}/${key.slice(0, 16)}.mp3`;
		if (clips[text]?.object !== object) toUpload.push({ text, object, model: clip.model, file: clip.absolute });
	}
	console.log(
		`${lang.english}: ${toUpload.length} to upload, ${Object.keys(clips).length} already shared, ${notMade} not made by ElevenLabs`,
	);
	if (!yes || toUpload.length === 0) continue;
	if (!base) {
		console.error("  No public address: pass --base https://pub-….r2.dev once.");
		process.exit(1);
	}
	for (const item of toUpload) {
		if (upload(item.object, item.file)) clips[item.text] = { object: item.object, model: item.model };
		else failed++;
	}
	const sorted = Object.fromEntries(Object.entries(clips).sort(([a], [b]) => a.localeCompare(b)));
	fs.writeFileSync(sharedAudioFile(profile), `${JSON.stringify({ base, voice: VOICE, clips: sorted }, null, "\t")}\n`);
	console.log(`  wrote ${sharedAudioFile(profile)}`);
}
if (!yes) console.log("\nNothing was uploaded. Run `npm run audio:sounds:push -- --yes` to upload.");
process.exit(failed > 0 ? 1 : 0);
