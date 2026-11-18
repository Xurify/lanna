/**
 * LIVE TALK SERVER (2026-11-17): the session token is minted server-side with
 * the key from Settings and the config carries the app's five tools; the end
 * writes the report, the island's talk and the index without a model when
 * none is set. No network: fetch is stubbed for the token call only. Runs
 * under its own scratch LANNA_DATA_DIR, never the real profile.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { Island } from "../src/core/islands.ts";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-live-"));
process.env.LANNA_DATA_DIR = TMP;
process.env.LANNA_PROFILE = "slovak";
process.env.PHONIC_API_KEY = "phonic_test_key_1234567890";

const { liveAvailabilityNow, liveStart } = await import("../src/server/speak-live.ts");
const { analyseTalk } = await import("../src/server/speaking-analysis.ts");
const { islandStore } = await import("../src/store/islands.ts");
const { speakingStore } = await import("../src/store/speaking.ts");
const { SPEAK_SCENES } = await import("../src/core/speak.ts");

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

describe("liveStart", () => {
	it("mints a session token with the key and sends the app's config", async () => {
		const real = globalThis.fetch;
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ url: String(input), init });
			return new Response(JSON.stringify({ session_token: "tok-abc", expires_at: 1 }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch;
		try {
			assert.equal(liveAvailabilityNow().enabled, true);
			const scene = SPEAK_SCENES[0]!;
			const start = await liveStart("scene", scene.id);
			assert.equal(calls.length, 1);
			assert.match(calls[0]!.url, /api\.phonic\.ai\/v1\/auth\/session_token$/);
			const headers = calls[0]!.init?.headers as Record<string, string>;
			assert.match(headers.authorization ?? "", /^Bearer phonic_test_key/);
			assert.equal(start.provider, "phonic");
			if (start.provider !== "phonic") throw new Error("Phonic should be the engine with only a Phonic key");
			assert.match(start.url, /wss:\/\/api\.phonic\.ai\/v1\/sts\/ws\?session_token=tok-abc/);
			assert.equal(start.config.default_language, "sk");
			assert.equal(start.config.input_format, "pcm_16000");
			assert.equal(start.config.tools.length, 5);
			assert.match(start.config.system_prompt, /Slovak/);
			assert.equal(start.kind, "scene");
		} finally {
			globalThis.fetch = real;
		}
	});

	it("refuses with the reason when the key is gone", async () => {
		const key = process.env.PHONIC_API_KEY;
		delete process.env.PHONIC_API_KEY;
		try {
			const availability = liveAvailabilityNow();
			assert.equal(availability.enabled, false);
			await assert.rejects(() => liveStart("scene", SPEAK_SCENES[0]!.id), /Settings/);
		} finally {
			process.env.PHONIC_API_KEY = key;
		}
	});

	it("mints an OpenAI client secret with the same five tools when that engine is chosen", async () => {
		const real = globalThis.fetch;
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		process.env.OPENAI_API_KEY = "openai_test_key_1234567890";
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ url: String(input), init });
			return new Response(JSON.stringify({ value: "ek_test", expires_at: 1 }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch;
		try {
			const start = await liveStart("scene", SPEAK_SCENES[0]!.id, "openai");
			assert.equal(start.provider, "openai");
			if (start.provider !== "openai") throw new Error("OpenAI should be the chosen engine");
			assert.match(calls[0]!.url, /api\.openai\.com\/v1\/realtime\/client_secrets$/);
			const headers = (calls[0]!.init?.headers ?? {}) as Record<string, string>;
			assert.match(headers.authorization ?? "", /^Bearer openai_test_key/);
			const body = JSON.parse(String(calls[0]!.init?.body)) as {
				session: { instructions: string; audio: { input: { transcription: { language: string } } }; tools: unknown[] };
			};
			assert.equal(body.session.audio.input.transcription.language, "sk");
			assert.equal(body.session.tools.length, 5);
			assert.match(body.session.instructions, /Slovak/);
			assert.equal(start.token, "ek_test");
			assert.match(start.callUrl, /\/v1\/realtime\/calls$/);
		} finally {
			globalThis.fetch = real;
			delete process.env.OPENAI_API_KEY;
		}
	});

	it("has nothing to start for an unknown island", async () => {
		await assert.rejects(() => liveStart("island", "no-such-island"), /No such island/);
	});
});

describe("analyseTalk without a model", () => {
	it("keeps the counts, records the island's talk and writes the report", async () => {
		const island: Island = {
			id: "test-island",
			topic: "About yourself",
			topicId: "yourself",
			level: "A2",
			chunks: [
				{ id: "volam-sa", sk: "volám sa", en: "my name is", kind: "phrase", addedAt: new Date().toISOString() },
				{ id: "praca", sk: "práca", en: "work", kind: "word", addedAt: new Date().toISOString() },
			],
			rehearsals: [],
			talks: [],
			createdAt: new Date().toISOString(),
		};
		islandStore.put(island);
		const startedAt = new Date(Date.UTC(2026, 10, 17, 9)).toISOString();
		const endedAt = new Date(Date.UTC(2026, 10, 17, 9, 4)).toISOString();
		const outcome = await analyseTalk(
			{
				kind: "island",
				ref: island.id,
				title: island.topic,
				turns: [
					{ role: "tutor", text: "Ako sa voláte?", start: 0, end: 2000 },
					{ role: "learner", text: "volám sa Anna a pracujem v škole", start: 2400, end: 8000 },
					{ role: "tutor", text: "A kde bývate?", start: 8500, end: 10_000 },
					{ role: "learner", text: "bývam v Bratislave", start: 11_000, end: 13_000 },
				],
				pausesMs: [1400],
				approximate: false,
				startedAt,
				endedAt,
				tools: [],
			},
			{ judge: false },
		);
		assert.equal(outcome.report.judged, false, "no model, so no judged claims");
		assert.equal(outcome.report.slips.length, 0);
		assert.equal(outcome.report.metrics.learnerTurns, 2);
		assert.equal(outcome.report.metrics.pausesOver1s, 1);
		assert.equal(outcome.report.metrics.englishWords, 0);
		assert.ok(outcome.report.xp > 0);
		assert.equal(outcome.island?.talks.length, 1);
		assert.ok(outcome.island?.talks[0]!.learnerShare > 0);
		assert.equal(outcome.island?.chunks.find((c) => c.id === "volam-sa")?.saidAt !== undefined, true);
		assert.ok(speakingStore.get(outcome.report.id), "the report is on disk");
		assert.equal(speakingStore.index().at(-1)?.id, outcome.report.id);
	});

	it("refuses a talk with no learner turn", async () => {
		await assert.rejects(
			() =>
				analyseTalk(
					{
						kind: "scene",
						ref: SPEAK_SCENES[0]!.id,
						turns: [{ role: "tutor", text: "Dobrý deň.", start: 0, end: 1000 }],
						pausesMs: [],
						approximate: false,
						startedAt: new Date().toISOString(),
						endedAt: new Date().toISOString(),
						tools: [],
					},
					{ judge: false },
				),
			/Nothing was said/,
		);
	});
});
