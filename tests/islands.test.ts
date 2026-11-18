import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-islands-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

import {
	COMMON_TOPICS,
	FLUENT_FADE_DAYS,
	BRIDGE_MIN_SHARED,
	bridges,
	chunkId,
	confirmedChunks,
	fadingIslands,
	islandPageData,
	islandPrompt,
	islandReadiness,
	islandStep,
	parseVaultChunks,
	rehearsalXp,
	suggestedTopics,
	usedChunkIds,
	VAULT_MIN_CHUNKS,
	type Island,
	type VaultChunk,
} from "../src/core/islands.ts";

const { islandStore } = await import("../src/store/islands.ts");

const DAY = 86_400_000;
const T0 = Date.parse("2026-11-01T09:00:00.000Z");

function at(day: number): string {
	return new Date(T0 + day * DAY).toISOString();
}

function chunk(sk: string, en: string, extra: Partial<VaultChunk> = {}): VaultChunk {
	return {
		id: chunkId(sk),
		sk,
		en,
		kind: sk.includes(" ") ? "phrase" : "word",
		addedAt: at(0),
		...extra,
	};
}

function islandOf(id: string, chunks: VaultChunk[], extra: Partial<Island> = {}): Island {
	return {
		id,
		topic: id,
		level: "B1",
		chunks,
		rehearsals: [],
		talks: [],
		createdAt: at(0),
		...extra,
	};
}

function vaultOf(n: number): VaultChunk[] {
	return Array.from({ length: n }, (_, i) => chunk(`slovo${i + 1}`, `word ${i + 1}`, { reviewedAt: at(0) }));
}

const goodTalk = (day: number, sec = 300) => ({
	at: at(day),
	sec,
	learnerShare: 0.5,
	medianReplyMs: 1_400,
	englishShare: 0.01,
	bridgeUsed: true,
});

test("islands: the common topic list is fixed, unique and has a prompt each", () => {
	const ids = new Set(COMMON_TOPICS.map((t) => t.id));
	assert.equal(ids.size, COMMON_TOPICS.length);
	for (const topic of COMMON_TOPICS) {
		assert.ok(topic.title.length > 2, topic.id);
		assert.ok(topic.prompt.length > 10, topic.id);
	}
});

test("islands: bridges need three shared content words", () => {
	const cooking = islandOf("cooking", [
		chunk("varím polievku", "I cook soup"),
		chunk("mám rád kávu", "I like coffee"),
		chunk("raňajky", "breakfast"),
		chunk("kuchyňa", "kitchen"),
	]);
	const family = islandOf("family", [
		chunk("varím večeru", "I cook dinner"),
		chunk("mám rád čaj", "I like tea"),
		chunk("raňajky", "breakfast"),
		chunk("kuchyňa", "kitchen"),
	]);
	const work = islandOf("work", [chunk("raňajky", "breakfast")]);
	const found = bridges([cooking, family, work]);
	assert.equal(found.length, 1);
	assert.equal(found[0]?.a, "cooking");
	assert.equal(found[0]?.b, "family");
	assert.ok((found[0]?.shared.length ?? 0) >= BRIDGE_MIN_SHARED);
	assert.ok(found[0]?.shared.includes("raňajky"));
	assert.ok(!found[0]?.shared.includes("a"));
});

test("islands: the ladder climbs from built to fluent and fades after thirty days", () => {
	const base = islandOf("food", vaultOf(VAULT_MIN_CHUNKS));
	const now = new Date(at(2));
	assert.equal(islandReadiness(base, { now }).step, "built");
	assert.match(islandReadiness(base, { now }).needs[0] ?? "", /second monologue|90-second/i);

	const rehearsed = islandOf("food", vaultOf(VAULT_MIN_CHUNKS), {
		rehearsals: [
			{
				at: at(3),
				sec: 95,
				used: vaultOf(VAULT_MIN_CHUNKS)
					.slice(0, 9)
					.map((c) => c.id),
				longestPauseMs: 2_000,
			},
		],
	});
	assert.equal(islandReadiness(rehearsed, { now: new Date(at(3)) }).step, "rehearsed");

	const holding = islandOf("food", vaultOf(VAULT_MIN_CHUNKS), {
		rehearsals: rehearsed.rehearsals,
		talks: [goodTalk(4)],
	});
	assert.equal(islandReadiness(holding, { now: new Date(at(4)) }).step, "holding");

	const fluent = islandOf("food", vaultOf(VAULT_MIN_CHUNKS), {
		rehearsals: rehearsed.rehearsals,
		talks: [goodTalk(4), goodTalk(6)],
	});
	const onDaySix = islandReadiness(fluent, { now: new Date(at(6)) });
	assert.equal(onDaySix.step, "fluent");
	assert.equal(onDaySix.next, null);
	assert.equal(onDaySix.everFluent, true);

	const faded = islandReadiness(fluent, { now: new Date(at(6 + FLUENT_FADE_DAYS + 1)) });
	assert.equal(faded.step, "holding");
	assert.equal(faded.faded, true);
	assert.match(faded.needs[0] ?? "", /bring it back/i);

	const restored = islandOf("food", vaultOf(VAULT_MIN_CHUNKS), {
		rehearsals: rehearsed.rehearsals,
		talks: [goodTalk(4), goodTalk(6), goodTalk(6 + FLUENT_FADE_DAYS + 2)],
	});
	assert.equal(islandStep(restored, new Date(at(6 + FLUENT_FADE_DAYS + 3))), "fluent");
});

test("islands: a rehearsal that coasts or stalls does not pass", () => {
	const island = islandOf("food", vaultOf(VAULT_MIN_CHUNKS), {
		rehearsals: [
			{
				at: at(3),
				sec: 95,
				used: vaultOf(VAULT_MIN_CHUNKS)
					.slice(0, 3)
					.map((c) => c.id),
				longestPauseMs: 1_000,
			},
			{
				at: at(3),
				sec: 40,
				used: vaultOf(VAULT_MIN_CHUNKS)
					.slice(0, 12)
					.map((c) => c.id),
				longestPauseMs: 400,
			},
			{
				at: at(3),
				sec: 95,
				used: vaultOf(VAULT_MIN_CHUNKS)
					.slice(0, 12)
					.map((c) => c.id),
				longestPauseMs: 5_000,
			},
		],
	});
	assert.equal(islandReadiness(island, { now: new Date(at(3)) }).step, "built");
});

test("islands: only chunks the dictionary confirms are kept", () => {
	const known: Record<string, { slug: string; lemma: string }> = {
		pijem: { slug: "pit", lemma: "piť" },
		vodu: { slug: "voda", lemma: "voda" },
		voda: { slug: "voda", lemma: "voda" },
		"v obchode": { slug: "obchod", lemma: "obchod" },
	};
	const lookup = (form: string) => known[form.toLocaleLowerCase()];
	const { chunks, dropped } = confirmedChunks(
		[
			{ sk: "pijem vodu", en: "I drink water" },
			{ sk: "voda", en: "water" },
			{ sk: "pijem vodku", en: "I drink vodka" },
			{ sk: "2 eurá", en: "two euros" },
			{ sk: "pijem vodu", en: "I drink water" },
		],
		lookup,
		{ at: at(0) },
	);
	assert.deepEqual(
		chunks.map((c) => c.sk),
		["pijem vodu", "voda"],
	);
	assert.equal(chunks[0]?.kind, "phrase");
	assert.equal(chunks[1]?.slug, "voda");
	assert.deepEqual(dropped, ["pijem vodku", "2 eurá"]);
});

test("islands: the model's reply is read out of prose, capped and deduplicated", () => {
	const reply = `Here you go:
{"chunks":[{"sk":"mám rád kávu","en":"I like coffee"},{"sk":"mám rád kávu","en":"I like coffee"},{"sk":"","en":"empty"},{"sk":"čaj","en":"tea"}]}
Done.`;
	const chunks = parseVaultChunks(reply);
	assert.deepEqual(
		chunks.map((c) => c.sk),
		["mám rád kávu", "čaj"],
	);
	assert.equal(parseVaultChunks("no json here").length, 0);
});

test("islands: the transcript marks the vault chunks it heard", () => {
	const chunks = [chunk("raňajky", "breakfast"), chunk("varím polievku", "I cook soup"), chunk("kuchyňa", "kitchen")];
	const used = usedChunkIds("Ráno varím polievku v kuchyni a potom raňajkujem.", chunks);
	assert.ok(used.includes(chunkId("raňajky")));
	assert.ok(used.includes(chunkId("varím polievku")));
	assert.deepEqual(usedChunkIds("", chunks), []);
});

test("islands: topic suggestions start from what the islands share", () => {
	const islands = [islandOf("family", vaultOf(4), { topic: "Family", topicId: "family" })];
	const topics = suggestedTopics({ purposes: ["work"] }, islands, 4);
	assert.equal(topics[0]?.topicId, "home");
	assert.match(topics[0]?.reason ?? "", /Shares words with Family/);
	assert.ok(!topics.some((t) => t.topicId === "family"));
	assert.ok(topics.some((t) => t.reason.includes("work")));
});

test("islands: the page resolves bridge titles and lists what is fading", () => {
	const a = islandOf(
		"a",
		[chunk("varím polievku", "I cook soup"), chunk("raňajky", "breakfast"), chunk("kuchyňa", "kitchen")],
		{
			topic: "Cooking",
			topicId: "food",
		},
	);
	const b = islandOf(
		"b",
		[chunk("varím večeru", "I cook dinner"), chunk("raňajky", "breakfast"), chunk("kuchyňa", "kitchen")],
		{
			topic: "Family",
			topicId: "family",
		},
	);
	const page = islandPageData([a, b], { now: new Date(at(2)) });
	assert.equal(page.islands[0]?.bridges[0]?.topic, "Family");
	assert.equal(page.topics.length > 0, true);
	assert.equal(page.level, "A2");
	const due = fadingIslands(
		[islandOf("a", vaultOf(3), { topic: "Cooking", talks: [goodTalk(0), goodTalk(2)] })],
		new Date(at(2 + FLUENT_FADE_DAYS - 2)),
	);
	assert.equal(due.length, 1);
	assert.equal(due[0]?.daysLeft, 2);
});

test("islands: rehearsal XP matches the self-talk band and the prompt uses the vault", () => {
	assert.equal(rehearsalXp(5).xp, 0);
	assert.equal(rehearsalXp(90).metTarget, true);
	assert.equal(rehearsalXp(90).xp, 25);
	const island = islandOf("food", [chunk("varím polievku", "I cook soup"), chunk("raňajky", "breakfast")]);
	const prompt = islandPrompt(island);
	assert.equal(prompt.topic, "food");
	assert.match(prompt.prompt, /Tell me about food/);
	assert.deepEqual(
		prompt.starters.map((s) => s.sk),
		["varím polievku"],
	);
	assert.deepEqual(
		prompt.suggestedWords.map((s) => s.sk),
		["raňajky"],
	);
});

test("islands: the store keeps one file per island and lists them oldest first", () => {
	const early = islandOf("early", vaultOf(2), { createdAt: at(0) });
	const late = islandOf("late", vaultOf(3), { createdAt: at(1) });
	islandStore.put(late);
	islandStore.put(early);
	assert.deepEqual(
		islandStore.list().map((i) => i.id),
		["early", "late"],
	);
	assert.equal(islandStore.get("early")?.chunks.length, 2);
	assert.equal(islandStore.remove("early"), true);
	assert.equal(islandStore.get("early"), null);
	assert.equal(islandStore.remove("early"), false);
});
