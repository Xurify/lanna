/**
 * PRONUNCIATION PINS (LangHarness, 2026-10-28): clarity as well as speed.
 * The two engines land in one shape (Azure's detailed result read into
 * it; intelligibility from a transcript), a fast pass counts only in the
 * window AND clear, the report names the sounds and words that stay low,
 * and the report reads the fluency log and the scenes on disk.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-pron-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";
// A speech key in this machine's environment would make the engine the test expects to be none.
for (const id of ["ELEVENLABS_API_KEY", "GROQ_API_KEY", "DEEPGRAM_API_KEY", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"])
	delete process.env[id];

const { isPronScore, matchScore, parseAzure, passMade, PRON_CLEAR, pronLabel, pronReport } =
	await import("../src/core/pronounce.ts");
type PronScore = import("../src/core/pronounce.ts").PronScore;
const { speakXp, speakCounts, SPEAK_CLEAR_XP } = await import("../src/core/speak.ts");
const { pronunciationReport, pronounceEngine } = await import("../src/server/pronounce.ts");
const { fluencyStore, speakStore } = await import("../src/store/speak.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

test("matchScore: intelligibility from a transcript — each expected word heard scores, each missing one is an omission", () => {
	const s = matchScore("Dobrý deň, ako sa máte?", "dobrý deň ako sa máte");
	assert.equal(s.engine, "match");
	assert.equal(s.overall, 100);
	assert.ok(s.words.every((w) => w.score === 100));
	const half = matchScore("Mám novú prácu.", "mám prácu");
	assert.equal(half.accuracy, 67);
	assert.deepEqual(
		half.words.find((w) => w.word === "novú"),
		{ word: "novú", score: 0, error: "omission" },
	);
	assert.equal(half.heard, "mám prácu");
	assert.ok(isPronScore(half));
	assert.ok(!isPronScore({ engine: "azure", words: "no" }));
});

test("parseAzure reads the detailed result: the four scores, words with error types, phonemes", () => {
	const score = parseAzure({
		RecognitionStatus: "Success",
		DisplayText: "Mám novú prácu.",
		NBest: [
			{
				Display: "Mám novú prácu.",
				PronunciationAssessment: {
					AccuracyScore: 78,
					FluencyScore: 90,
					CompletenessScore: 100,
					ProsodyScore: 70.4,
					PronScore: 80.2,
				},
				Words: [
					{
						Word: "Mám",
						PronunciationAssessment: { AccuracyScore: 95, ErrorType: "None" },
						Phonemes: [
							{ Phoneme: "m", PronunciationAssessment: { AccuracyScore: 99 } },
							{ Phoneme: "aa", PronunciationAssessment: { AccuracyScore: 92 } },
						],
					},
					{
						Word: "novú",
						PronunciationAssessment: { AccuracyScore: 40, ErrorType: "Mispronunciation" },
						Phonemes: [
							{ Phoneme: "n", PronunciationAssessment: { AccuracyScore: 80 } },
							{ Phoneme: "uu", PronunciationAssessment: { AccuracyScore: 20 } },
						],
					},
					{ Word: "prácu", PronunciationAssessment: { AccuracyScore: 0, ErrorType: "Omission" } },
				],
			},
		],
	});
	assert.ok(score);
	assert.equal(score.engine, "azure");
	assert.equal(score.accuracy, 78);
	assert.equal(score.overall, 80);
	assert.equal(score.fluency, 90);
	assert.equal(score.prosody, 70);
	assert.equal(score.words[1]!.error, "mispronunciation");
	assert.equal(score.words[1]!.phonemes![1]!.p, "uu");
	assert.equal(score.words[2]!.error, "omission");
	assert.equal(score.words[2]!.score, 0);
	assert.equal(parseAzure({ RecognitionStatus: "NoMatch" }), null);
	assert.equal(parseAzure({}), null);
});

test("a fast pass counts only in the window AND clear; labels; the Speak XP for clear lines", () => {
	assert.equal(passMade(true, null), true, "no score: time alone decides");
	assert.equal(passMade(true, { overall: PRON_CLEAR }), true);
	assert.equal(passMade(true, { overall: PRON_CLEAR - 1 }), false, "fast but not clear does not count");
	assert.equal(passMade(false, { overall: 100 }), false);
	assert.equal(pronLabel(90), "Clear");
	assert.equal(pronLabel(72), "Mostly clear");
	assert.equal(pronLabel(55), "Rough");
	assert.equal(pronLabel(10), "Hard to follow");
	assert.equal(speakXp(4, 1, 2) - speakXp(4, 1), 2 * SPEAK_CLEAR_XP);
	const clear: PronScore = { engine: "azure", accuracy: 90, overall: 90, words: [] };
	const rough: PronScore = { engine: "azure", accuracy: 50, overall: 50, words: [] };
	const counts = speakCounts([
		{ role: "tutor", text: "Dobrý deň.", at: "" },
		{ role: "learner", text: "Dobrý deň.", at: "", pron: clear },
		{ role: "tutor", text: "Čo si dáte?", at: "" },
		{ role: "learner", text: "Kávu, prosím.", at: "", pron: rough },
		{ role: "tutor", text: "Hneď.", at: "" },
		{ role: "learner", text: "Ďakujem.", at: "", via: "typed" },
	]);
	assert.equal(counts.learner, 3);
	assert.equal(counts.spoken, 2);
	assert.equal(counts.clear, 1);
});

test("the report: sounds heard at least twice that stay low, words that keep coming out wrong, worst first", () => {
	const line = (words: Array<[string, number, Array<[string, number]>]>, overall = 80): PronScore => ({
		engine: "azure",
		accuracy: overall,
		overall,
		words: words.map(([word, score, ph]) => ({
			word,
			score,
			...(score < 60 ? { error: "mispronunciation" as const } : {}),
			phonemes: ph.map(([p, s]) => ({ p, score: s })),
		})),
	});
	const report = pronReport([
		line(
			[
				[
					"žena",
					40,
					[
						["zh", 30],
						["e", 90],
						["n", 95],
						["a", 92],
					],
				],
				[
					"chlieb",
					50,
					[
						["x", 35],
						["l", 90],
						["ie", 88],
						["b", 90],
					],
				],
			],
			60,
		),
		line(
			[
				[
					"život",
					45,
					[
						["zh", 25],
						["i", 90],
						["v", 90],
						["o", 90],
						["t", 90],
					],
				],
				[
					"dom",
					95,
					[
						["d", 95],
						["o", 95],
						["m", 95],
					],
				],
			],
			85,
		),
		line(
			[
				[
					"ryba",
					92,
					[
						["r", 60],
						["i", 90],
						["b", 95],
						["a", 95],
					],
				],
			],
			95,
		),
	]);
	assert.equal(report.lines, 3);
	assert.equal(report.average, 80);
	assert.equal(report.sounds[0]!.p, "zh", "the sound that stays low comes first");
	assert.deepEqual(report.sounds[0]!.in, ["žena", "život"]);
	assert.ok(!report.sounds.some((s) => s.p === "x"), "heard once only: not reported yet");
	assert.ok(!report.sounds.some((s) => s.p === "r"), "60 is not weak");
	assert.deepEqual(
		report.words.map((w) => w.word),
		["žena", "život", "chlieb"],
	);
	assert.equal(pronReport([]).average, null);
});

test("the report on disk: scored passes in the fluency log and scored turns in the scenes", () => {
	assert.equal(pronounceEngine(), null, "no keys in the test environment");
	const weak: PronScore = {
		engine: "azure",
		accuracy: 40,
		overall: 40,
		words: [
			{
				word: "ľahko",
				score: 30,
				error: "mispronunciation",
				phonemes: [
					{ p: "lj", score: 20 },
					{ p: "a", score: 90 },
				],
			},
		],
	};
	fluencyStore.append({
		mode: "fast",
		at: "2026-10-28T10:00:00.000Z",
		day: "2026-10-28",
		reps: [
			{
				itemId: "x#0",
				slug: "x",
				sentence: "Ľahko.",
				translation: "Easily.",
				passes: [{ ms: 900, window: 2000, made: false, inWindow: true, pron: weak }],
			},
		],
		passesMade: 0,
		sentencesMade: 0,
		xp: 8,
	});
	const session = {
		id: "sp-2026-10-28-cafe-abc",
		lang: "sk",
		scene: "cafe",
		sceneTitle: "At the café",
		level: "A1" as const,
		chapter: "a1",
		startedAt: "2026-10-28T10:00:00.000Z",
		endedAt: "2026-10-28T10:05:00.000Z",
		turns: [
			{ role: "tutor" as const, text: "Dobrý deň.", at: "2026-10-28T10:00:00.000Z" },
			{
				role: "learner" as const,
				text: "Ľahko, ďakujem.",
				at: "2026-10-28T10:00:10.000Z",
				via: "voice" as const,
				pron: { ...weak, words: [...weak.words, { word: "ďakujem", score: 95, phonemes: [{ p: "lj", score: 25 }] }] },
			},
		],
		usage: { model: "faux", steps: [] },
		xp: 15,
	};
	speakStore.put(session);
	speakStore.index(session);
	const report = pronunciationReport();
	assert.equal(report.lines, 2);
	assert.equal(report.sounds[0]!.p, "lj");
	assert.equal(report.sounds[0]!.n, 3, "once in the round, twice in the scene");
	assert.equal(report.words[0]!.word, "ľahko");
});
