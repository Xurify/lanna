/**
 * Export slovak.wiki's clip manifest into curriculum/slovak/wiki-audio.json:
 * exact text → { kind, hash } for the dictionary narrator's lemma and
 * example clips (audio.slovak.wiki/audio/<kind>/<hash>.mp3). Lesson clips
 * (the cast voices) are left out. When one text has several clips the
 * newest wins.
 *
 *   node scripts/export-slovakwiki-audio.mjs <path-to-slovak.wiki> [out]
 */
import fs from "node:fs";
import path from "node:path";

const wiki = path.resolve(process.argv[2] ?? "../slovak.wiki");
const out = path.resolve(process.argv[3] ?? "curriculum/slovak/wiki-audio.json");
const manifest = JSON.parse(fs.readFileSync(path.join(wiki, "content/audio/manifest.json"), "utf-8"));
const config = JSON.parse(fs.readFileSync(path.join(wiki, "content/audio/config.json"), "utf-8"));
const voiceId = config.voiceId;

const clips = {};
const stamp = {};
for (const [hash, m] of Object.entries(manifest)) {
	if ((m.kind !== "lemma" && m.kind !== "example") || m.voiceId !== voiceId || !m.uploadedAt || !m.text) continue;
	const text = m.text.normalize("NFC").trim();
	if (stamp[text] && stamp[text] >= m.generatedAt) continue;
	stamp[text] = m.generatedAt;
	clips[text] = { kind: m.kind, hash };
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
	out,
	JSON.stringify({
		source: "slovak.wiki",
		base: "https://audio.slovak.wiki/audio",
		voiceId,
		exportedAt: new Date().toISOString(),
		clips,
	}),
);
console.log(`${Object.keys(clips).length} clips → ${out}`);
