import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import { parseWritingFeedback, writingKey, WRITING_MAX_CHARS } from "../src/core/writing.ts";
import type { ReviewCard } from "../src/core/review.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-writing-"));
process.env.LANNA_DATA_DIR = dir;
process.env.LANNA_PROFILE = "slovak";
const { PATHS } = await import("../config.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { checkWriting, writingTargets } = await import("../src/server/writing.ts");
const { readWriting } = await import("../src/store/writing.ts");
const card: ReviewCard = {
	id: "claim#0",
	slug: "claim",
	lemma: "claim",
	gloss: "assert",
	sentence: "They claim it works.",
	answer: "claim",
	at: 5,
	translation: "They assert it works.",
	state: "learning",
	due: "2026-11-01T10:00:00Z",
	reps: 2,
	lapses: 2,
	createdAt: "2026-11-01T10:00:00Z",
};
const input = { slugs: ["claim"], text: "They claim the story is true. I am not sure." };
const good = JSON.stringify({
	ok: true,
	feedback: "The passage connects your ideas and uses the target meaningfully.",
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
	fs.rmSync(PATHS.writing, { force: true });
	reviewStore.writeCards({ [card.id]: card });
});

test("strictly parses feedback without treating malformed or empty replies as success", () => {
	assert.equal(parseWritingFeedback('{"ok":"yes","feedback":"fine"}'), null);
	for (const reply of ["null", "{}", "[]", "", '{"ok":true,"feedback":"  "}'])
		assert.equal(parseWritingFeedback(reply), null);
	assert.equal(parseWritingFeedback("```json\n" + good + "\n```")?.ok, true);
	assert.equal(parseWritingFeedback(JSON.stringify({ ok: false, feedback: "x".repeat(1800) }))?.feedback.length, 1200);
	assert.equal(writingKey(["b", "a"], " e\u0301 "), writingKey(["a", "b"], "é"));
});

test("rejects empty, oversized and invalid target input without a model call", async () => {
	let calls = 0;
	const ask = async () => {
		calls++;
		return good;
	};
	for (const value of [
		{ ...input, text: "" },
		{ ...input, text: "x".repeat(WRITING_MAX_CHARS + 1) },
		{ ...input, slugs: [] },
		{ ...input, slugs: ["absent"] },
		{ ...input, slugs: ["a", "b", "c", "d"] },
	])
		await assert.rejects(() => checkWriting(value, { ask }));
	reviewStore.writeCards({ [card.id]: { ...card, suspended: true } });
	await assert.rejects(() => checkWriting(input, { ask }), /no longer/);
	assert.equal(calls, 0);
});

test("one passage makes one call, concurrent repeats coalesce, and cached feedback works without AI", async () => {
	let calls = 0;
	let release!: (text: string) => void;
	const deferred = new Promise<string>((resolve) => {
		release = resolve;
	});
	const ask = async ({ prompt, system }: { prompt: string; system: string }) => {
		calls++;
		assert.equal(JSON.parse(prompt).targets.length, 1);
		assert.match(system, /inflected form/);
		assert.match(system, /untrusted/);
		return deferred;
	};
	const before = JSON.stringify(reviewStore.readCards());
	const first = checkWriting(input, { ask });
	const second = checkWriting(input, { ask });
	release(good);
	assert.equal((await first).ok, true);
	assert.equal((await second).ok, true);
	assert.equal(calls, 1);
	assert.equal((await checkWriting({ ...input, text: " " + input.text + " " })).cached, true);
	const records = readWriting();
	assert.equal(records.length, 1);
	assert.equal(records[0]!.raw, good);
	assert.equal(records[0]!.text, input.text);
	assert.equal(JSON.stringify(reviewStore.readCards()), before);
	assert.equal(fs.existsSync(path.join(PATHS.data, "progress.json")), false);
});

test("a revision gets new feedback; invalid model output is preserved and never repeatedly charged", async () => {
	await checkWriting(input, { ask: async () => good });
	const revision = { ...input, text: input.text + " I will ask tomorrow." };
	const feedback = await checkWriting(revision, {
		ask: async () => '{"ok":false,"feedback":"Clarify who you will ask."}',
	});
	assert.equal(feedback.ok, false);
	const broken = { ...input, text: input.text + " A different ending." };
	await assert.rejects(() => checkWriting(broken, { ask: async () => "not JSON" }), /usable feedback/);
	assert.equal(readWriting().at(-1)!.raw, "not JSON");
	await assert.rejects(
		() =>
			checkWriting(broken, {
				ask: async () => {
					throw new Error("must not call");
				},
			}),
		/saved check/,
	);
	assert.equal(readWriting().length, 3);
});

test("provider failure releases in-flight state and preserves a successful retry", async () => {
	await assert.rejects(
		() =>
			checkWriting(input, {
				ask: async () => {
					throw new Error("offline");
				},
			}),
		/offline/,
	);
	assert.equal(readWriting().length, 0);
	assert.equal((await checkWriting(input, { ask: async () => good })).ok, true);
});

test("the route validates requests and serves cached checks through the real entry point", async () => {
	const { POST } = await import("../app/api/writing/route.ts");
	const request = (body: unknown) =>
		new Request("http://localhost/api/writing", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
	assert.equal((await POST(request({ text: [], slugs: ["claim"] }))).status, 400);
	assert.equal((await POST(request({ text: "text", slugs: [null] }))).status, 400);
	assert.equal(
		(
			await POST(
				new Request("http://localhost/api/writing", {
					method: "POST",
					headers: { "content-length": "9999999" },
					body: "{}",
				}),
			)
		).status,
		413,
	);
	await checkWriting(input, { ask: async () => good });
	const response = await POST(request(input));
	assert.equal(response.status, 200);
	assert.equal((await response.json()).cached, true);
	assert.equal(readWriting().length, 1);
});

test("accepts the character limit and batches three words in one check", async () => {
	const cards = ["claim", "other", "third"].map((slug) => ({ ...card, slug, id: slug + "#0" }));
	reviewStore.writeCards(Object.fromEntries(cards.map((value) => [value.id, value])));
	const full = "a b c " + "x".repeat(WRITING_MAX_CHARS - 6);
	let calls = 0;
	const value = { slugs: cards.map((value) => value.slug), text: full };
	await checkWriting(value, {
		ask: async ({ prompt }) => {
			calls++;
			assert.equal(JSON.parse(prompt).targets.length, 3);
			return good;
		},
	});
	assert.equal((await checkWriting({ ...value, slugs: [...value.slugs].reverse() })).cached, true);
	assert.equal(calls, 1);
});

test("writing records only measured output time, never XP", async () => {
	const { recordActiveTime } = await import("../src/server/lesson.ts");
	const { progressStore } = await import("../src/store/progress.ts");
	const { strandParts } = await import("../src/core/strands.ts");
	const before = progressStore.read();
	const xp = before.xp;
	assert.equal(recordActiveTime("writing", 120000, 0, new Date("2026-11-18T10:00:00Z")), 2);
	const progress = progressStore.read();
	assert.equal(progress.xp, xp);
	const day = progress.days["2026-11-18"]!;
	assert.equal(day.minutesBy?.writing, 2);
	assert.equal(strandParts(day).minutes.output, 2);
	assert.equal(strandParts({}).minutes.output, 0);
});

test("targets are unique and capped, and checked passages are included in corpus exports and spending", async () => {
	reviewStore.writeCards(
		Object.fromEntries(
			Array.from({ length: 5 }, (_, i) => {
				const copy = { ...card, id: `word${i}#0`, slug: `word${i}`, lapses: i + 2 };
				return [copy.id, copy];
			}),
		),
	);
	assert.equal(writingTargets().length, 3);
	reviewStore.writeCards({ [card.id]: card });
	await checkWriting(input, { ask: async () => good });
	const { exportCorpus } = await import("../src/server/corpus-export.ts");
	const { usageReport } = await import("../src/server/usage-report.ts");
	const result = exportCorpus({ stamp: "writing-test" });
	assert.equal(result.summary.counts.writingChecks, 1);
	assert.equal(JSON.parse(fs.readFileSync(path.join(result.dir, "writing.json"), "utf8"))[0].text, input.text);
	assert.match(fs.readFileSync(path.join(result.dir, "README.md"), "utf8"), /writing.json/);
	assert.equal(usageReport().writing?.count, 1);
});
