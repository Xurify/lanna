import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-self-talk-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

import {
	SELF_TALK_PROMPTS,
	SELF_TALK_CATEGORIES,
	getSelfTalkPrompts,
	getSelfTalkPromptById,
	getRandomSelfTalkPrompt,
	calculateSelfTalkXp,
	findUsedSuggestedWords,
	SELF_TALK_BASE_XP,
	SELF_TALK_BONUS_XP,
} from "../src/core/self-talk.ts";

const { completeSelfTalk } = await import("../src/server/self-talk.ts");
const { progressStore } = await import("../src/store/progress.ts");

test("self-talk: prompt bank contains valid CEFR levels, categories, and starters", () => {
	assert.ok(SELF_TALK_PROMPTS.length >= 5, "Should have at least 5 guided prompts");
	assert.ok(SELF_TALK_CATEGORIES.length >= 4, "Should have multiple categories");

	for (const prompt of SELF_TALK_PROMPTS) {
		assert.ok(prompt.id.length > 0, `Prompt ${prompt.id} must have an id`);
		assert.ok(prompt.title.length > 0, `Prompt ${prompt.id} must have a title`);
		assert.ok(prompt.prompt.length > 0, `Prompt ${prompt.id} must have Slovak instructions`);
		assert.ok(prompt.promptEn.length > 0, `Prompt ${prompt.id} must have English instructions`);
		assert.ok(prompt.targetSec >= 30, `Prompt ${prompt.id} targetSec should be at least 30s`);
		assert.ok(prompt.starters.length >= 2, `Prompt ${prompt.id} should have at least 2 starters`);
		assert.ok(prompt.suggestedWords.length >= 4, `Prompt ${prompt.id} should have at least 4 suggested words`);
	}
});

test("self-talk: filtering prompts by level and category works accurately", () => {
	const a1Prompts = getSelfTalkPrompts({ level: "A1" });
	assert.ok(a1Prompts.length > 0, "Should have A1 prompts");
	assert.ok(
		a1Prompts.every((p) => p.level === "A1"),
		"All filtered prompts must be A1",
	);

	const routinePrompts = getSelfTalkPrompts({ category: "routine" });
	assert.ok(routinePrompts.length > 0, "Should have routine prompts");
	assert.ok(
		routinePrompts.every((p) => p.category === "routine"),
		"All filtered prompts must be routine",
	);

	const specific = getSelfTalkPromptById("around-room");
	assert.ok(specific !== undefined, "Should find prompt by id");
	assert.equal(specific?.titleEn, "What I see around me");

	const randomPrompt = getRandomSelfTalkPrompt("A1", 42);
	assert.ok(randomPrompt !== undefined);
	assert.equal(randomPrompt.level, "A1");
});

test("self-talk: XP calculation rewards honest effort and meeting target time", () => {
	// Under 10 seconds: noise / no practice
	const underNoise = calculateSelfTalkXp(5, 60);
	assert.equal(underNoise.xp, 0);
	assert.equal(underNoise.metTarget, false);

	// Partial effort (30s of 60s)
	const partial = calculateSelfTalkXp(30, 60);
	assert.ok(partial.xp >= 5 && partial.xp <= SELF_TALK_BASE_XP);
	assert.equal(partial.metTarget, false);

	// Met target exactly
	const met = calculateSelfTalkXp(60, 60);
	assert.equal(met.xp, SELF_TALK_BASE_XP + SELF_TALK_BONUS_XP);
	assert.equal(met.metTarget, true);

	// Exceeded target
	const exceeded = calculateSelfTalkXp(90, 60);
	assert.equal(exceeded.xp, SELF_TALK_BASE_XP + SELF_TALK_BONUS_XP);
	assert.equal(exceeded.metTarget, true);
});

test("self-talk: finds used suggested vocabulary in transcript", () => {
	const prompt = getSelfTalkPromptById("around-room")!;
	const transcript = "Okolo seba vidím veľký stôl a stolička je pri okne.";
	const recognized = findUsedSuggestedWords(transcript, prompt.suggestedWords);

	const recognizedSlovak = recognized.map((w) => w.sk);
	assert.ok(recognizedSlovak.includes("stôl"), "Should match stôl");
	assert.ok(recognizedSlovak.includes("stolička"), "Should match stolička");
	assert.ok(recognizedSlovak.includes("veľký"), "Should match veľký");
	assert.ok(recognizedSlovak.includes("okno"), "Should match okno stem in okne");
	assert.ok(!recognizedSlovak.includes("dvere"), "Should not match dvere");
});

test("self-talk: server completion records active minutes and XP into day ledger", () => {
	const prompt = getSelfTalkPromptById("morning-ritual")!;
	const outcome = completeSelfTalk({
		promptId: prompt.id,
		activeSec: 65,
		transcript: "Ráno zvyčajne vstávam a varím kávu v kuchyni.",
		tz: 0,
	});

	assert.equal(outcome.promptId, "morning-ritual");
	assert.equal(outcome.metTarget, true);
	assert.equal(outcome.xp, SELF_TALK_BASE_XP + SELF_TALK_BONUS_XP);
	assert.ok(outcome.usedWords.some((w) => w.sk === "káva"));

	const progress = progressStore.read();
	assert.ok(progress.xp >= outcome.xp);

	const todayKey = Object.keys(progress.days)[0];
	assert.ok(todayKey !== undefined);
	const day = progress.days[todayKey];
	assert.equal(day?.speaks, 1);
	assert.ok((day?.minutesBy?.speak ?? 0) > 1.0, "Should add over 1 minute of active speaking time");
});
