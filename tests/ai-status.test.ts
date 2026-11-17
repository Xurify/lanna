/**
 * AI STATUS (2026-11-01): a slot with no key looks set in
 * Settings and fails at the first call, so the status checks the provider's
 * key first and says what to fix; a provider's "not configured" error is
 * turned into the same plain message. Runs under an isolated LANNA_DATA_DIR.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-ai-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";
delete process.env.ANTHROPIC_API_KEY;

const { aiMissing, aiStatus, friendlyAiError } = await import("../src/server/ai-status.ts");
const { writeGuide, analyzeNow } = await import("../src/server/mistakes.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

describe("ai status", () => {
	it("no model set: not ready, and the message names Settings → AI models and API keys", () => {
		const s = aiStatus();
		assert.deepEqual(s, { ready: false, reason: "no-model" });
		assert.match(aiMissing(s), /Settings → AI models/);
		assert.match(aiMissing(s), /Settings → API keys/);
	});

	it("a provider's own error becomes a plain message that says which key", () => {
		assert.match(
			friendlyAiError(new Error("Provider is not configured: anthropic")),
			/The anthropic key is missing\. Add it in Settings → API keys/,
		);
		assert.match(friendlyAiError(new Error("HTTP 401 Unauthorized")), /refused the key/);
		assert.equal(friendlyAiError(new Error("socket hang up")), "socket hang up");
	});

	it("a guide asked for with no model says what is missing, not a provider error", async () => {
		analyzeNow(new Date("2026-11-01T08:00:00Z"));
		const rep = (ok: boolean) => ({
			itemId: "dom#0",
			slug: "dom",
			kind: "type" as const,
			verdict: ok ? ("exact" as const) : ("wrong" as const),
			first: { given: ok ? "dome" : "dom", verdict: ok ? ("exact" as const) : ("wrong" as const) },
			detail: {
				unit: "loc",
				lemma: "dom",
				gloss: "house",
				sentence: "Bývam v dome.",
				translation: "x",
				answer: "dome",
				given: ok ? "dome" : "dom",
			},
		});
		const { recordLesson } = await import("../src/server/lesson.ts");
		// Enough evidence for a guide (30 first tries, 5 wrong), so the model check is what stops it.
		recordLesson(
			{ unit: "loc", mode: "lesson", reps: Array.from({ length: 30 }, (_, i) => rep(i >= 5)), tz: 0 },
			new Date("2026-11-01T09:00:00Z"),
		);
		analyzeNow(new Date("2026-11-01T09:30:00Z"));
		await assert.rejects(
			() => writeGuide({ now: new Date("2026-11-01T10:00:00Z") }),
			/No model is set\. Pick one in Settings → AI models/,
		);
	});
});
