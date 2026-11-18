/**
 * Story audio made ahead of time: the plan asks for exactly the clips the
 * reader would ask /api/tts for (narrator and cast voices), skips the ones
 * ElevenLabs already made, and a batch fills the cache the reader reads.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-story-audio-"));
process.env.LANNA_DATA_DIR = dir;
process.env.LANNA_PROFILE = "slovak";
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const { PATHS } = await import("../config.ts");
const corpus = await import("../src/store/corpus.ts");
const { storyStore } = await import("../src/store/stories.ts");
const { storyAudioPlan, startStoryAudio, storyAudioStatus } = await import("../src/server/story-audio.ts");

const NARRATOR = "YJsJ2Mt3VRr0gCiTY6DA";
const ZUZANA = "abcdefgh12345678";
const line = (sk: string, who?: string) => ({ sk, en: "", tokens: [], ...(who ? { who } : {}) });

storyStore.put({
	id: "ep-001-martin",
	lang: "sk",
	series: "robo",
	episode: 1,
	title: "Martin",
	level: "A1",
	chapter: "a1",
	theme: "daily",
	cast: [{ name: "Zuzana", gender: "f", age: "adult", voice: ZUZANA }],
	narratorVoice: NARRATOR,
	createdAt: "2026-11-17T10:00:00.000Z",
	sentences: [
		line("Martin je doma."),
		line("Ahoj, Martin!", "Zuzana"),
		line("Má novú prácu."),
		line("Martin je doma."),
	],
	questions: [],
	newWords: [],
	recap: "",
	coverage: 1,
	wordCount: 9,
	usage: { model: "faux:story", steps: [] },
	drafts: 1,
});

const put = (voice: string, text: string, tier: string) =>
	corpus.storeAudioClip({
		key: corpus.audioKey("sk", voice, text),
		lang: "sk",
		voice,
		tier,
		text,
		ext: "mp3",
		data: Buffer.from(`old ${text}`),
	});

describe("story audio", () => {
	it("plans each missing sentence once, in the voice and style the reader uses", () => {
		put(NARRATOR, "Martin je doma.", "elevenlabs");
		put(NARRATOR, "Má novú prácu.", "edge");
		const plan = storyAudioPlan();
		assert.equal(plan.stories, 1);
		assert.equal(plan.storiesReady, 0);
		const byText = new Map(plan.items.map((i) => [i.entry.text, i]));
		assert.deepEqual([...byText.keys()].sort(), ["Ahoj, Martin!", "Má novú prácu."]);
		assert.equal(byText.get("Ahoj, Martin!")!.entry.voice, ZUZANA);
		assert.equal(byText.get("Ahoj, Martin!")!.style, "dialogue");
		assert.equal(byText.get("Ahoj, Martin!")!.reason, "not made yet");
		assert.equal(byText.get("Má novú prácu.")!.style, "narration");
		assert.equal(byText.get("Má novú prácu.")!.reason, "made without ElevenLabs");
	});

	it("refuses to start with no key, then fills the cache and leaves the audio folder in place", async () => {
		const hadKey = process.env.ELEVENLABS_API_KEY;
		delete process.env.ELEVENLABS_API_KEY;
		assert.throws(() => startStoryAudio(), /ElevenLabs key/);

		process.env.ELEVENLABS_API_KEY = "test-key";
		const realFetch = globalThis.fetch;
		globalThis.fetch = (async () => new Response(new Uint8Array([9, 9]), { status: 200 })) as typeof fetch;
		try {
			const job = await startStoryAudio({ concurrency: 1 });
			assert.equal(job.done, 2);
			assert.equal(job.failed, 0);
			assert.ok(fs.statSync(PATHS.audio).isDirectory());
			const hello = corpus.findAudioClip(corpus.audioKey("sk", ZUZANA, "Ahoj, Martin!"))!;
			assert.equal(hello.tier, "elevenlabs");
			const status = storyAudioStatus();
			assert.equal(status.sentences, 0);
			assert.equal(status.storiesReady, 1);
		} finally {
			globalThis.fetch = realFetch;
			if (hadKey === undefined) delete process.env.ELEVENLABS_API_KEY;
			else process.env.ELEVENLABS_API_KEY = hadKey;
		}
	});
});
