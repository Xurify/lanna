/**
 * Regenerating kept audio with the newest ElevenLabs model: the plan picks
 * only clips ElevenLabs can now make better, counts their characters before
 * anything is spent, and a replaced file is moved, never deleted.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-audio-regen-"));
process.env.LANNA_DATA_DIR = dir;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const { PATHS } = await import("../config.ts");
const corpus = await import("../src/store/corpus.ts");
const { LANGUAGE_CATALOG, registerLanguage } = await import("../src/core/language.ts");
const { regenCost, regenPlan, regenerate } = await import("../src/server/audio-regen.ts");

registerLanguage({ ...LANGUAGE_CATALOG.find((l) => l.id === "estonian")!, specialLetters: ["õ", "ä", "ö", "ü"] });
const NARRATOR = "YJsJ2Mt3VRr0gCiTY6DA";
const put = (lang: string, voice: string, text: string, tier: string, model?: string) =>
	corpus.storeAudioClip({
		key: corpus.audioKey(lang, voice, text),
		lang,
		voice,
		tier,
		...(model ? { model } : {}),
		text,
		ext: "mp3",
		data: Buffer.from(`old ${text}`),
	});

describe("audio regeneration", () => {
	it("plans the older and the Edge-made clips ElevenLabs can make, and counts their characters", () => {
		put("sk", NARRATOR, "Dobrý deň.", "elevenlabs");
		put("sk", "female", "chlieb", "edge");
		put("et", NARRATOR, "Mart on Tartus.", "elevenlabs");
		put("et", "female", "leib", "edge");
		put("sk", NARRATOR, "Už nový.", "elevenlabs", "eleven_v4");
		const plan = regenPlan();
		const texts = plan.items.map((i) => i.entry.text).sort();
		assert.deepEqual(texts, ["Dobrý deň.", "Mart on Tartus.", "chlieb"]);
		assert.equal(plan.chars, [..."Dobrý deň."].length + [..."Mart on Tartus."].length + [..."chlieb"].length);
		assert.equal(plan.kept["already the newest model"], 1);
		assert.equal(
			plan.kept["no ElevenLabs voice for this language's words (Edge)"],
			1,
			"an Estonian word has no ElevenLabs voice",
		);
		assert.equal(regenCost(1000).credits, 1000);
	});

	it("replaces a clip only after new audio arrived, moves the old file, and stops at the character cap", async () => {
		const realFetch = globalThis.fetch;
		const hadKey = process.env.ELEVENLABS_API_KEY;
		process.env.ELEVENLABS_API_KEY = "test-key";
		const sent: string[] = [];
		globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { text: string; model_id: string };
			sent.push(body.text);
			return body.text === "chlieb"
				? new Response("boom", { status: 500 })
				: new Response(new Uint8Array([9, 9]), { status: 200 });
		}) as typeof fetch;
		try {
			const plan = regenPlan();
			const capped = await regenerate(plan, { maxChars: 1, concurrency: 1 });
			assert.equal(capped.done, 0);
			assert.ok(capped.stoppedAt, "nothing past the cap is spent");
			assert.equal(sent.length, 0);

			const now = new Date("2026-11-07T12:00:00Z");
			const result = await regenerate(plan, { concurrency: 1, now });
			assert.equal(result.done, 2);
			assert.equal(result.failed.length, 1, "a failed clip keeps its old audio");
			const et = corpus.findAudioClip(corpus.audioKey("et", NARRATOR, "Mart on Tartus."))!;
			assert.equal(et.model, "eleven_v4");
			assert.deepEqual([...fs.readFileSync(et.absolute)], [9, 9]);
			const moved = path.join(PATHS.audio, "replaced", now.toISOString().replace(/[:.]/g, "-"), et.file);
			assert.equal(fs.readFileSync(moved, "utf-8"), "old Mart on Tartus.");
			const word = corpus.findAudioClip(corpus.audioKey("sk", "female", "chlieb"))!;
			assert.equal(fs.readFileSync(word.absolute, "utf-8"), "old chlieb");
			assert.deepEqual(
				regenPlan().items.map((i) => i.entry.text),
				["chlieb"],
				"a second run picks up only what failed",
			);
		} finally {
			globalThis.fetch = realFetch;
			if (hadKey === undefined) delete process.env.ELEVENLABS_API_KEY;
			else process.env.ELEVENLABS_API_KEY = hadKey;
		}
	});
});
