/**
 * THE CORPUS (LangHarness, 2026-10-27): everything generated is kept,
 * indexed, and found again before it is regenerated. Pins: the audio
 * library (named files + index, legacy migration with text recovery), the
 * lesson log (every answer on disk), the Why? index (a repeat question
 * reopens its chat), chat deletion as a move to trash, READMEs next to the
 * data, and the export's shape. Runs under an isolated LH_DATA_DIR, so
 * every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-corpus-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const corpus = await import("../src/store/corpus.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { recordLesson } = await import("../src/server/lesson.ts");
const { openWhy } = await import("../src/server/why.ts");
const { exportCorpus, exportDialogue, sentencesFrom } = await import("../src/server/corpus-export.ts");
const { ttsCacheKey } = await import("../src/server/tts.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

describe("audio library", () => {
	it("stores a clip under a readable name and indexes it; the key matches the TTS key", () => {
		const key = corpus.audioKey("sk", "female", "  Dobrý deň, ako sa máte? ");
		assert.equal(key, ttsCacheKey({ text: "Dobrý deň, ako sa máte?", lang: "sk", voice: "female" }));
		assert.equal(corpus.findAudioClip(key), null);
		const stored = corpus.storeAudioClip({ key, lang: "sk", voice: "female", tier: "edge", text: "Dobrý deň, ako sa máte?", ext: "mp3", data: Buffer.from("mp3bytes") });
		assert.equal(stored.file, `sk/female/dobry-den-ako-sa-mate-${key.slice(0, 12)}.mp3`);
		assert.ok(fs.existsSync(path.join(PATHS.audio, stored.file)));
		const hit = corpus.findAudioClip(key);
		assert.ok(hit);
		assert.equal(hit.text, "Dobrý deň, ako sa máte?");
		assert.equal(hit.tier, "edge");
		assert.equal(hit.bytes, 8);
		const lines = fs.readFileSync(path.join(PATHS.audio, "index.jsonl"), "utf-8").trim().split("\n");
		assert.equal(lines.length, 1);
		assert.equal((JSON.parse(lines[0]!) as { key: string }).key, key);
	});

	it("migrates the old hash-only cache, recovering texts by hashing known phrases", () => {
		fs.mkdirSync(PATHS.audioLegacy, { recursive: true });
		const known = corpus.audioKey("sk", "female", "Ahoj svet");
		const unknown = "f".repeat(64);
		fs.writeFileSync(path.join(PATHS.audioLegacy, `${known}.mp3`), "known");
		fs.writeFileSync(path.join(PATHS.audioLegacy, `${unknown}.mp3`), "mystery");
		const result = corpus.migrateLegacyAudio(() => [{ lang: "sk", voice: "female", text: "Ahoj svet" }]);
		assert.deepEqual(result, { moved: 2, matched: 1 });
		assert.equal(fs.existsSync(PATHS.audioLegacy), false, "the old folder is gone");
		const a = corpus.findAudioClip(known);
		assert.ok(a);
		assert.equal(a.text, "Ahoj svet");
		assert.equal(a.file, `sk/female/ahoj-svet-${known.slice(0, 12)}.mp3`);
		assert.equal(a.tier, "unknown");
		const b = corpus.findAudioClip(unknown);
		assert.ok(b);
		assert.equal(b.text, null);
		assert.equal(b.file, `sk/female/unknown-${unknown.slice(0, 12)}.mp3`);
		assert.equal(corpus.listAudioClips().length, 3);
	});

	it("slugifies Slovak text to plain ASCII", () => {
		assert.equal(corpus.slugify("Ľúbim ťa, žaba!"), "lubim-ta-zaba");
		assert.equal(corpus.slugify("   "), "clip");
		assert.equal(corpus.slugify("a".repeat(100)).length, 48);
	});
});

const rep = (over: Partial<Parameters<typeof recordLesson>[0]["reps"][number]> = {}) => ({
	itemId: "dom#0",
	slug: "dom",
	kind: "type" as const,
	verdict: "exact" as const,
	detail: { unit: "loc", lemma: "dom", gloss: "house", sentence: "Bývam v dome.", translation: "I live in a house.", answer: "dome", given: "dome", trigger: "v", hint: "dom" },
	...over,
});

describe("lesson log", () => {
	it("recordLesson appends the whole lesson with every answer to lessons/<day>.jsonl", () => {
		const now = new Date("2026-10-27T22:30:00Z");
		recordLesson({ unit: "loc", mode: "lesson", reps: [rep(), rep({ itemId: "mesto#1", slug: "mesto", verdict: "wrong", detail: { ...rep().detail, sentence: "Som v meste.", answer: "meste", given: "mesto", mixed: true } })], ms: 61_000, tz: -60 }, now);
		const file = path.join(PATHS.lessons, "2026-10-27.jsonl");
		assert.ok(fs.existsSync(file), "the day file exists (local day with tz)");
		const entries = corpus.readLessonLog();
		assert.equal(entries.length, 1);
		const e = entries[0]!;
		assert.equal(e.unit, "loc");
		assert.equal(e.mode, "lesson");
		assert.equal(e.total, 2);
		assert.equal(e.correct, 1);
		assert.equal(e.ms, 61_000);
		assert.deepEqual(e.queued, ["mesto"]);
		assert.equal(e.reps[0]!.sentence, "Bývam v dome.");
		assert.equal(e.reps[0]!.given, "dome");
		assert.equal(e.reps[0]!.trigger, "v");
		assert.equal(e.reps[0]!.hint, "dom");
		assert.equal(e.reps[1]!.verdict, "wrong");
		assert.equal(e.reps[1]!.mixed, true);
		assert.ok(fs.existsSync(path.join(PATHS.lessons, "README.md")), "a README sits next to the log");
	});

	it("a rep without detail still logs (old clients)", () => {
		recordLesson({ unit: "loc", mode: "blitz", reps: [{ itemId: "x#0", slug: "x", kind: "choose", verdict: "exact" }], tz: 0 }, new Date("2026-10-28T10:00:00Z"));
		const entries = corpus.readLessonLog();
		assert.equal(entries.length, 2);
		assert.equal(entries[1]!.mode, "blitz");
		assert.equal(entries[1]!.reps[0]!.sentence, "");
	});
});

describe("Why? reuse", () => {
	it("the first question creates a practice chat and records it; the same sentence reopens it", () => {
		const first = openWhy({ title: "Why dome?", sentence: "Bývam v dome.", answer: "dome", lemma: "dom", given: "dom" });
		assert.equal(first.reused, false);
		const chat = chatStore.getChat(first.id);
		assert.ok(chat);
		assert.equal(chat.kind, "practice");
		assert.equal(chat.title, "Why dome?");
		const again = openWhy({ title: "Why dome?", sentence: "Bývam v dome.", answer: "dome", lemma: "dom", given: "domu" });
		assert.equal(again.reused, true);
		assert.equal(again.id, first.id);
		const entry = corpus.findWhy(corpus.whyKey("sk", "Bývam v dome.", "dome"));
		assert.ok(entry);
		assert.equal(entry.reused, 1);
		assert.equal(entry.given, "dom", "the first answer is what the index keeps");
		const other = openWhy({ title: "Why meste?", sentence: "Som v meste.", answer: "meste", lemma: "mesto", given: "mesto" });
		assert.equal(other.reused, false);
		assert.notEqual(other.id, first.id);
	});

	it("a deleted Why? chat is asked again, and the deleted file lands in chats/trash", () => {
		const first = openWhy({ title: "Why rieke?", sentence: "Plávam v rieke.", answer: "rieke", lemma: "rieka", given: "rieka" });
		assert.equal(chatStore.deleteChat(first.id), true);
		assert.equal(chatStore.getChat(first.id), null);
		assert.ok(fs.existsSync(path.join(PATHS.chats, "trash", `${first.id}.json`)), "deleted = moved to trash");
		assert.ok(!chatStore.listChats().some((c) => c.id === first.id), "trash is not in the list");
		const next = openWhy({ title: "Why rieke?", sentence: "Plávam v rieke.", answer: "rieke", lemma: "rieka", given: "rieka" });
		assert.equal(next.reused, false);
		assert.notEqual(next.id, first.id);
	});
});

describe("export", () => {
	it("exportDialogue keeps learner-facing text, spoken phrases and usage", () => {
		const d = exportDialogue({
			id: "chat_x",
			title: "Why dome?",
			createdAt: "2026-10-27T00:00:00.000Z",
			updatedAt: "2026-10-27T00:01:00.000Z",
			kind: "practice",
			messages: [
				{ id: "u1", role: "user", content: "Why? In the sentence …", timestamp: 1 },
				{
					id: "a1",
					role: "assistant",
					content: [
						{ type: "thinking", thinking: "secret" },
						{ type: "text", text: "The preposition v takes the locative: `say: v dome`, `say: v meste`." },
					],
					timestamp: 2,
				} as never,
			],
			turns: [{ id: "t1", messageId: "a1", at: "2026-10-27T00:00:30.000Z", model: "anthropic:claude-sonnet-4", steps: [{ inputTokens: 100, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 0, reasoningTokens: 0 }] }],
		});
		assert.equal(d.practiceMode, "why");
		assert.equal(d.messages.length, 2);
		assert.equal(d.messages[1]!.role, "assistant");
		assert.ok(!d.messages[1]!.text.includes("secret"), "thinking stays out");
		assert.deepEqual(d.messages[1]!.spoken, ["v dome", "v meste"]);
		assert.equal(d.usage.inputTokens, 100);
		assert.equal(d.usage.outputTokens, 20);
		assert.deepEqual(d.usage.models, ["anthropic:claude-sonnet-4"]);
	});

	it("sentencesFrom folds repeated sentences with every answer", () => {
		const lessons = corpus.readLessonLog();
		const sentences = sentencesFrom(lessons);
		const dome = sentences.find((s) => s.sentence === "Bývam v dome.");
		assert.ok(dome);
		assert.equal(dome.timesSeen, 1);
		assert.equal(dome.answers[0]!.given, "dome");
	});

	it("exportCorpus writes one file per kind plus a README and a summary", () => {
		const { dir, summary } = exportCorpus({ stamp: "test" });
		for (const f of ["README.md", "summary.json", "audio.json", "sentences.json", "lessons.json", "dialogues.json", "explanations.json", "review.json"]) {
			assert.ok(fs.existsSync(path.join(dir, f)), `${f} exists`);
		}
		assert.equal(summary.counts.audioClips, 3);
		assert.equal(summary.counts.lessons, 2);
		assert.equal(summary.counts.reps, 3);
		assert.ok(summary.counts.dialogues >= 4, "live and trashed chats both count");
		const dialogues = JSON.parse(fs.readFileSync(path.join(dir, "dialogues.json"), "utf-8")) as Array<{ deleted: boolean }>;
		assert.ok(dialogues.some((d) => d.deleted), "the trashed chat is exported, marked deleted");
		const explanations = JSON.parse(fs.readFileSync(path.join(dir, "explanations.json"), "utf-8")) as Array<{ sentence: string }>;
		assert.ok(explanations.some((e) => e.sentence === "Bývam v dome."));
		assert.ok(fs.existsSync(path.join(PATHS.base, "README.md")), "the data root README exists");
		assert.ok(fs.existsSync(path.join(PATHS.audio, "README.md")));
		assert.ok(fs.existsSync(path.join(PATHS.chats, "README.md")));
	});
});

describe("spending report", () => {
	it("folds every session, live and trashed, by kind, with the audio library", async () => {
		const { usageReport, sessionMode } = await import("../src/server/usage-report.ts");
		const report = usageReport(new Date("2026-10-28T00:00:00Z"));
		assert.ok(report.sessions.length >= 4, "live and trashed sessions both count");
		assert.ok(report.sessions.some((s) => s.deleted), "the trashed one is marked");
		assert.ok(report.sessions.every((s) => s.mode === "why"), "every fixture session is a Why? chat");
		assert.equal(report.byMode[0]?.mode, "why");
		assert.equal(report.audio.clips, 3);
		assert.equal(report.totalUsd, 0, "no priced turns in the fixtures");
		assert.equal(report.unpricedTurns, 0);
		assert.equal(sessionMode({ kind: "practice", title: "Talk: Kaviareň", messages: [] }), "talk");
		assert.equal(sessionMode({ kind: "practice", title: "x", messages: [{ id: "u", role: "user", content: "Story: tell me", timestamp: 1 } as never] }), "story");
		assert.equal(sessionMode({ kind: undefined, title: "Cases", messages: [] }), "learn");
		assert.equal(sessionMode({ kind: "practice", title: "Household items", messages: [] }), "practice");
	});
});

describe("ElevenLabs reads Estonian with a model that knows it", () => {
	it("reads every language with v4 first, and falls back only to models that read it", async () => {
		const { elevenLabsReads, elevenLabsModelsFor } = await import("../src/server/tts.ts");
		assert.equal(elevenLabsReads("sk", "eleven_multilingual_v2"), true);
		assert.equal(elevenLabsReads("et", "eleven_multilingual_v2"), false);
		assert.equal(elevenLabsReads("et", "eleven_flash_v2_5"), false);
		assert.equal(elevenLabsReads("hu", "eleven_flash_v2_5"), true);
		assert.equal(elevenLabsReads("et", "eleven_v3"), true);
		assert.equal(elevenLabsReads("et", "eleven_v4"), true);
		assert.deepEqual(elevenLabsModelsFor("sk"), ["eleven_v4", "eleven_v3", "eleven_multilingual_v2"]);
		assert.deepEqual(elevenLabsModelsFor("et"), ["eleven_v4", "eleven_v3"], "multilingual v2 cannot read Estonian");
	});

	it("speaks an Estonian story line with v4 and its language code, and remakes an old multilingual v2 clip", async () => {
		const { LANGUAGE_CATALOG, registerLanguage } = await import("../src/core/language.ts");
		registerLanguage({ ...LANGUAGE_CATALOG.find((l) => l.id === "estonian")!, specialLetters: ["õ", "ä", "ö", "ü"] });
		const { synthesize, ttsCacheKey } = await import("../src/server/tts.ts");
		const req = { text: "Mart on Tartus.", lang: "et", voice: "YJsJ2Mt3VRr0gCiTY6DA", gender: "female" as const, style: "narration" as const };
		// An Estonian clip multilingual v2 made before the model was recorded.
		corpus.storeAudioClip({ key: ttsCacheKey(req), lang: "et", voice: req.voice, tier: "elevenlabs", text: req.text, ext: "mp3", data: Buffer.from("old") });
		const sent: Array<Record<string, unknown>> = [];
		const realFetch = globalThis.fetch;
		const hadKey = process.env.ELEVENLABS_API_KEY;
		process.env.ELEVENLABS_API_KEY = "test-key";
		globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
			sent.push(JSON.parse(String(init?.body)));
			return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
		}) as typeof fetch;
		try {
			const clip = await synthesize(req);
			assert.equal(clip?.tier, "elevenlabs", "the old clip is not served");
			assert.equal(sent.length, 1);
			assert.equal(sent[0]!.model_id, "eleven_v4");
			assert.equal(sent[0]!.language_code, "et");
			assert.equal(corpus.findAudioClip(ttsCacheKey(req))?.model, "eleven_v4");
			const again = await synthesize(req);
			assert.equal(again?.tier, "cache", "a v4 clip is kept");

			// A Slovak clip from before the model was recorded is still good: multilingual v2 reads Slovak.
			const sk = { text: "Dobrý deň.", lang: "sk", voice: "YJsJ2Mt3VRr0gCiTY6DA", gender: "female" as const, style: "narration" as const };
			corpus.storeAudioClip({ key: ttsCacheKey(sk), lang: "sk", voice: sk.voice, tier: "elevenlabs", text: sk.text, ext: "mp3", data: Buffer.from("old") });
			assert.equal((await synthesize(sk))?.tier, "cache");

			// An account without v4: the refusal moves the line to v3, and v4 is not asked again within the hour.
			sent.length = 0;
			globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
				const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
				sent.push(body);
				return body.model_id === "eleven_v4" ? new Response("model not available", { status: 403 }) : new Response(new Uint8Array([4, 5]), { status: 200 });
			}) as typeof fetch;
			await synthesize({ ...req, text: "Täna on laupäev." });
			await synthesize({ ...req, text: "Mart tuleb bussiga." });
			assert.deepEqual(sent.map((b) => b.model_id), ["eleven_v4", "eleven_v3", "eleven_v3"]);
		} finally {
			globalThis.fetch = realFetch;
			if (hadKey === undefined) delete process.env.ELEVENLABS_API_KEY;
			else process.env.ELEVENLABS_API_KEY = hadKey;
		}
	});
});
