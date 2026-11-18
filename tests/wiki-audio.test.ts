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

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-wiki-audio-"));
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

	it("never gives one word the recording of another that differs by an accent", async () => {
		const before = urls.length;
		assert.equal(await wikiClip("slovak", "sk", "sud"), null, "the wiki has súd, not sud");
		assert.equal(urls.length, before);
		assert.ok(await wikiClip("slovak", "sk", "súd"));
	});

	it("a sound contrast word is the shared ElevenLabs clip without a key, and ElevenLabs reads any other word with one", async () => {
		const hadKey = process.env.ELEVENLABS_API_KEY;
		delete process.env.ELEVENLABS_API_KEY;
		try {
			const before = urls.length;
			const shared = await synthesize({ text: "tam", lang: "sk", voice: "female", prefer: "elevenlabs" });
			assert.equal(shared?.tier, "elevenlabs");
			assert.match(urls[before]!, /^https:\/\/[^/]+\/sound-guide\/sk\/eleven_v\d\/[0-9a-f]{16}\.mp3$/);
			const again = await synthesize({ text: "tam", lang: "sk", voice: "female", prefer: "elevenlabs" });
			assert.equal(again?.file, shared.file);
			assert.equal(urls.length, before + 1, "downloaded once");
			const plain = await synthesize({ text: "tam", lang: "sk", voice: "female" });
			assert.equal(plain?.tier, "wiki", "a dictionary play still gets the wiki recording");

			const unshared = await synthesize({ text: "sused", lang: "sk", voice: "female", prefer: "elevenlabs" });
			assert.equal(unshared?.tier, "wiki", "no shared clip and no key: the usual order");

			process.env.ELEVENLABS_API_KEY = "test-key";
			const paid = urls.length;
			const made = await synthesize({ text: "sused", lang: "sk", voice: "female", prefer: "elevenlabs" });
			assert.equal(made?.tier, "elevenlabs");
			assert.match(urls[paid]!, /^https:\/\/api\.elevenlabs\.io\//);
			await synthesize({ text: "ťava", lang: "sk", voice: "female", prefer: "elevenlabs" });
			assert.doesNotMatch(urls.at(-1)!, /api\.elevenlabs\.io/, "a shared word is never paid for");
		} finally {
			if (hadKey === undefined) delete process.env.ELEVENLABS_API_KEY;
			else process.env.ELEVENLABS_API_KEY = hadKey;
		}
	});
});
