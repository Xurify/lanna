/**
 * slovak.wiki's own clips: a dictionary sentence is fetched once from the
 * wiki's audio host, kept in the library under the slovak-wiki voice, found
 * again without a request, and found even when the text lost its accents.
 * Text the wiki has no clip for makes no request at all.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-wiki-audio-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { wikiClip } = await import("../src/server/wiki-audio.ts");
const { synthesize } = await import("../src/server/tts.ts");
const { listAudioClips } = await import("../src/store/corpus.ts");

const realFetch = globalThis.fetch;
const urls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
	urls.push(String(input));
	return new Response(Buffer.from("wiki-mp3"), { status: 200 });
}) as typeof fetch;

after(() => {
	globalThis.fetch = realFetch;
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

describe("wiki audio", () => {
	it("downloads a wiki sentence once and keeps it", async () => {
		const first = await wikiClip("slovak", "sk", "Je to dobrý človek.");
		assert.ok(first && fs.readFileSync(first.file, "utf-8") === "wiki-mp3");
		assert.match(urls[0]!, /^https:\/\/audio\.slovak\.wiki\/audio\/example\/[0-9a-f]{20}\.mp3$/);
		const again = await wikiClip("slovak", "sk", "Je to dobrý človek.");
		assert.equal(again?.file, first.file);
		assert.equal(urls.length, 1);
		const kept = listAudioClips().filter((c) => c.voice === "slovak-wiki");
		assert.equal(kept.length, 1);
		assert.equal(kept[0]!.tier, "slovak-wiki");
	});

	it("finds the clip when the text lost its accents", async () => {
		const before = urls.length;
		const clip = await wikiClip("slovak", "sk", "Je to dobry clovek.");
		assert.ok(clip);
		assert.equal(urls.length, before + 1, "its own key, so one download");
		assert.match(urls[before]!, new RegExp(urls[0]!.split("/").pop()!));
	});

	it("makes no request for text the wiki does not have", async () => {
		const before = urls.length;
		assert.equal(await wikiClip("slovak", "sk", "Táto veta nie je vo wiki zo zásady."), null);
		assert.equal(urls.length, before);
	});

	it("synthesize serves the wiki clip for the default voice", async () => {
		const clip = await synthesize({ text: "Je to dobrý človek.", lang: "sk", voice: "female" });
		assert.equal(clip?.tier, "wiki");
	});
});
