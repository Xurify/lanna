/**
 * LIVE TALK CORE (2026-11-17): availability (Estonian has no Phonic voice
 * yet), the XP, the counts the microphone and transcripts can prove, filler
 * detection and the picks that follow, the review parser's leniency, and
 * the trend windows (a cell that slips in three talks; a cell that was right
 * for three talks after its last slip). Pure: no model, no disk, no socket.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findFillers, pickFillers, type FillerKit } from "../src/core/fillers.ts";
import { liveAvailability, liveXp, parseLiveReview, pcmChunks, type LiveTurn } from "../src/core/live.ts";
import { cellKey, speakingTrends, type SpeakingReport } from "../src/core/speaking-trends.ts";
import { speechMetrics } from "../src/core/speech-metrics.ts";

const KIT: FillerKit = {
	language: "slovak",
	source: "test",
	entries: [
		{ sk: "no", en: "well", job: "time", level: "A1", register: "colloquial" },
		{ sk: "tak", en: "so", job: "time", level: "A1", register: "colloquial" },
		{ sk: "proste", en: "simply", job: "rephrase", level: "A2", register: "colloquial" },
		{ sk: "jasné", en: "sure", job: "agree", level: "A1", register: "colloquial" },
		{ sk: "fakt?", en: "really?", job: "react", level: "A2", register: "casual" },
	],
};

describe("pcmChunks", () => {
	it("cuts a 128 ms capture frame into 20 ms chunks and carries the rest", () => {
		const frame = new Int16Array(2048).fill(7);
		const first = pcmChunks(null, frame, 320);
		assert.equal(first.chunks.length, 6);
		assert.ok(first.chunks.every((c) => c.length === 320));
		assert.equal(first.carry?.length, 128);
		const second = pcmChunks(first.carry, new Int16Array(2048).fill(9), 320);
		assert.equal(second.chunks.length, 6);
		assert.equal(second.carry?.length, 256);
	});

	it("sends nothing until a full chunk is there", () => {
		const short = pcmChunks(null, new Int16Array(100), 320);
		assert.equal(short.chunks.length, 0);
		assert.equal(short.carry?.length, 100);
		assert.equal(pcmChunks(short.carry, new Int16Array(220), 320).chunks.length, 1);
	});
});

describe("liveAvailability", () => {
	it("offers both engines that speak Slovak, and starts on the one with a key", () => {
		const both = liveAvailability({ code: "sk", english: "Slovak" }, { phonic: true, openai: true });
		assert.equal(both.enabled, true);
		assert.equal(both.provider, "phonic");
		assert.deepEqual(
			both.options.map((o) => o.id),
			["phonic", "openai"],
		);
		assert.equal(both.options[0]!.lang, "sk");
		const openaiOnly = liveAvailability({ code: "sk", english: "Slovak" }, { openai: true });
		assert.equal(openaiOnly.provider, "openai");
		assert.equal(openaiOnly.options[0]!.enabled, false);
	});

	it("offers Estonian only through OpenAI, because Phonic does not speak it", () => {
		const noKey = liveAvailability({ code: "et", english: "Estonian" }, { phonic: true });
		assert.deepEqual(
			noKey.options.map((o) => o.id),
			["openai"],
		);
		assert.equal(noKey.enabled, false);
		assert.equal(noKey.missing, "key");
		assert.match(noKey.reason ?? "", /OpenAI/);
		const withKey = liveAvailability({ code: "et", english: "Estonian" }, { phonic: true, openai: true });
		assert.equal(withKey.enabled, true);
		assert.equal(withKey.provider, "openai");
	});

	it("says so when no engine speaks the language", () => {
		const none = liveAvailability({ code: "ja", english: "Japanese" }, { phonic: true, openai: true });
		assert.equal(none.enabled, false);
		assert.equal(none.missing, "language");
		assert.match(none.reason ?? "", /Japanese/);
	});

	it("names the keys to add and the screen to add them on", () => {
		const sk = liveAvailability({ code: "sk", english: "Slovak" }, {});
		assert.equal(sk.enabled, false);
		assert.equal(sk.missing, "key");
		assert.match(sk.reason ?? "", /Settings/);
		assert.match(sk.options[0]!.reason ?? "", /PHONIC_API_KEY/);
		assert.match(sk.options[1]!.reason ?? "", /OPENAI_API_KEY/);
	});
});

describe("liveXp", () => {
	it("pays nothing for a talk with no learner turn", () => {
		assert.equal(liveXp(120, 0), 0);
	});

	it("pays more for a longer talk with more turns, and caps the minutes", () => {
		const short = liveXp(60, 4);
		const long = liveXp(300, 12);
		assert.ok(short > 0);
		assert.ok(long > short);
		assert.equal(liveXp(60_000, 12), liveXp(900, 12));
	});
});

describe("speechMetrics", () => {
	const turns: LiveTurn[] = [
		{ role: "tutor", text: "Dobrý deň, čo si dáte?", start: 0, end: 3000 },
		{ role: "learner", text: "I like the coffee", start: 3500, end: 6000 },
		{ role: "tutor", text: "A niečo sladké?", start: 6500, end: 8000 },
		{ role: "learner", text: "nie, ďakujem", start: 9500, end: 12_000 },
	];

	it("counts the talk, the learner's share and the English in it", () => {
		const m = speechMetrics(turns, [1500, 400, 1100]);
		assert.equal(m.talkSec, 12);
		assert.equal(m.learnerSec, 5);
		assert.ok(Math.abs(m.learnerShare - 5 / 12) < 0.001);
		assert.equal(m.pausesOver1s, 2, "two pauses over one second");
		assert.equal(m.englishWords, 2, 'like and the; "i" is also a target-language word, so it is not counted');
		assert.equal(m.learnerTurns, 2);
	});

	it("times each reply from the tutor's end to the learner's start", () => {
		const m = speechMetrics(turns);
		assert.equal(m.medianReplyMs, 1000);
		assert.equal(m.replyTurns, 2);
		assert.equal(m.fastReplies, 2);
	});
});

describe("fillers", () => {
	it("hears the target filler through punctuation and counts the English ones", () => {
		const finding = findFillers(["No, I like it", "proste neviem"], KIT);
		assert.deepEqual(
			finding.used.map((u) => u.sk),
			["no", "proste"],
		);
		assert.deepEqual(
			finding.english.map((e) => e.word),
			["like"],
		);
		assert.equal(finding.variety, 2);
	});

	it("picks the jobs the talk was missing, at the level and not already used", () => {
		const finding = findFillers(["no, I like it"], KIT);
		const picks = pickFillers(KIT, finding, "A2");
		assert.ok(picks.length >= 2 && picks.length <= 3);
		assert.ok(!picks.some((p) => p.sk === "no"));
		assert.ok(picks.some((p) => p.job === "rephrase"));
		assert.equal(new Set(picks.map((p) => p.sk)).size, picks.length);
	});

	it("keeps casual fillers out of a formal scene", () => {
		const finding = findFillers(["jasné"], KIT, { formal: true });
		assert.deepEqual(
			finding.register.map((r) => r.sk),
			[],
			"jasné is colloquial, not casual",
		);
		const casual = pickFillers(KIT, finding, "A2", { formal: true });
		assert.ok(!casual.some((p) => p.sk === "fakt?"));
	});
});

describe("parseLiveReview", () => {
	it("reads the object out of prose and keeps only what the shape allows", () => {
		const raw = `Here is the review:\n${JSON.stringify({
			slips: [
				{
					turn: 3,
					yours: "idem do obchod",
					right: "idem do obchodu",
					kind: "case",
					rule: "do + genitive",
					lemma: "obchod",
				},
				{ turn: 5, yours: "som išiel", right: "išiel som" },
				{ turn: 6, yours: "", right: "x" },
				{ turn: 7, yours: "a", right: "b" },
				{ turn: 8, yours: "c", right: "d" },
			],
			strengths: ["asked a question back", ""],
			improve: [{ turn: 2, yours: "chcem káva", right: "chcem kávu", why: "accusative after chcem" }],
			complexity: { past: true, future: false, clauses: ["lebo", "keď"], aspectPairs: 2, note: "reached for past" },
			newChunks: [{ sk: "môžem dostať", en: "can I get" }],
		})}\nDone.`;
		const review = parseLiveReview(raw);
		assert.ok(review);
		assert.equal(review.slips.length, 4, "capped at four, the empty one dropped");
		assert.equal(review.slips[1]!.kind, "other", "a missing kind is not invented");
		assert.deepEqual(review.strengths, ["asked a question back"]);
		assert.equal(review.improve[0]!.why, "accusative after chcem");
		assert.equal(review.complexity?.past, true);
		assert.deepEqual(review.complexity?.clauses, ["lebo", "keď"]);
		assert.equal(review.newChunks[0]!.sk, "môžem dostať");
	});

	it("answers null when there is no object at all", () => {
		assert.equal(parseLiveReview("I could not review that."), null);
	});
});

function report(day: number, slips: SpeakingReport["slips"]): SpeakingReport {
	const date = new Date(Date.UTC(2026, 10, day, 12)).toISOString();
	return {
		id: `lv-${day}`,
		kind: "scene",
		ref: "cafe",
		title: "V kaviarni",
		lang: "sk",
		level: "A2",
		at: date,
		startedAt: date,
		endedAt: date,
		metrics: speechMetrics(
			[
				{ role: "tutor", text: "Dobrý deň.", start: 0, end: 2000 },
				{ role: "learner", text: "dobrý deň, chcem kávu", start: 2500, end: 6000 },
			],
			[],
		),
		approximate: false,
		judged: true,
		slips,
		strengths: [],
		improve: [],
		newChunks: [],
		fillers: { used: [], english: [], variety: 0, overused: [], register: [] },
		recommended: [],
		xp: 20,
	};
}

describe("speakingTrends", () => {
	const accFem = { row: "A", col: "fem" } as const;
	const genMasc = { row: "G", col: "masc" } as const;
	const reports = [
		report(1, [
			{ turn: 1, yours: "kávu", right: "káva", kind: "case", cell: genMasc },
			{ turn: 1, yours: "voda", right: "vodu", kind: "case", cell: accFem },
		]),
		report(2, [{ turn: 1, yours: "voda", right: "vodu", kind: "case", cell: accFem }]),
		report(3, [{ turn: 1, yours: "voda", right: "vodu", kind: "case", cell: accFem }]),
		report(4, []),
		report(5, []),
	];
	const trends = speakingTrends(reports, new Date(Date.UTC(2026, 10, 20)));

	it("flags a cell that slipped in three talks, with its label", () => {
		const weak = trends.weakCells.find((c) => c.cell === "A:fem");
		assert.ok(weak);
		assert.equal(weak.sessions, 3);
		assert.equal(weak.label, "Accusative feminine");
	});

	it("shows a cell as right again after three clean talks", () => {
		assert.ok(trends.fixedCells.some((c) => c.cell === "G:masc"));
		assert.ok(!trends.fixedCells.some((c) => c.cell === "A:fem"));
	});

	it("keeps the session count and the latest numbers", () => {
		assert.equal(trends.sessions, 5);
		assert.match(trends.metrics[0]!.now, /% in the last talk/);
		assert.equal(trends.metrics[0]!.trend, "new", "the window needs six tries before it compares");
	});

	it("names no cell for a slip with no cell", () => {
		assert.equal(cellKey(undefined), "");
	});
});
