/**
 * Speaking analysis (2026-11-17) — behind /api/speak/live/end.
 * A live talk ends with counts the microphone and the transcripts can
 * prove (src/core/speech-metrics.ts), the fillers that were said instead of
 * the target language's (src/core/fillers.ts), and — when a model is
 * configured — one review of the transcript for the slips worth repairing,
 * what was good, what to say better, how far the grammar reached, and the
 * phrases worth keeping. Every slip is located on the grammar atlas before
 * it is recorded, so a case slip counts toward its drill and cell exactly
 * as a scene's does. Nothing is claimed when no model is set: `judged`
 * stays false and only the counts are shown.
 */

import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { addMinutes } from "../core/active-time.ts";
import { fillerKit } from "./fillers.ts";
import { findFillers, pickFillers, type FillerFinding } from "../core/fillers.ts";
import { recordSpokenSlip, spokenSlip } from "../core/first-try.ts";
import { atlasCellOf } from "../core/grammar.ts";
import { bridges, islandReadiness, usedChunkIds, type Island } from "../core/islands.ts";
import { liveXp, parseLiveReview, type LiveCallInput, type LiveReview } from "../core/live.ts";
import { dayKey } from "../core/review.ts";
import { speakId, type SlipKind, type SpeakSession, type SpeakTurn } from "../core/speak.ts";
import { speechMetrics } from "../core/speech-metrics.ts";
import { speakingIndexEntry, type SpeakingReport, type SpeakingSlip } from "../core/speaking-trends.ts";
import { appendLessonLog } from "../store/corpus.ts";
import { islandStore } from "../store/islands.ts";
import { progressStore } from "../store/progress.ts";
import { speakStore } from "../store/speak.ts";
import { speakingStore } from "../store/speaking.ts";
import { activeLanguage } from "./active-language.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { storyEngine } from "./reading.ts";
import { enqueueWords } from "./review.ts";

const TAG = () => activeLanguage().tag;

function reviewSystem(english: string): string {
	return `You review one live spoken conversation between a learner of ${english} and their tutor. The learner's lines are verbatim transcripts of their own speech; the tutor's lines are what was said to them. You answer with ONE JSON object and nothing else: no prose, no code fences.

{"slips":[{"turn":0,"yours":"<the learner's words with the slip, quoted>","right":"<the learner's own line put right>","kind":"case"|"verb"|"aspect"|"word"|"order"|"other","lemma":"<dictionary form of the word the slip was on>","rule":"<the rule in at most twelve words>"}],"strengths":["<something the learner did well, from the talk>"],"improve":[{"turn":0,"yours":"<what they said>","right":"<a more natural ${english} way to say the same thing>","why":"<why, in one line>"}],"complexity":{"past":true|false,"future":true|false,"clauses":["<a connector they used>"],"aspectPairs":0,"note":"<one line on the grammar they reached for>"},"newChunks":[{"sk":"<a useful ${english} phrase from the talk>","en":"<its meaning>"}]}

Rules:
- "turn" is the index of the learner turn the line is in, exactly as numbered.
- At most FOUR slips, the most useful first: case, verb and aspect before word choice. Never a diacritic alone, never a transcription wobble, never a slip in the tutor's own line.
- "right" puts the learner's own line right; it is not a different sentence.
- "strengths" is what they actually did, not encouragement. At most four.
- "improve" is at most three lines, each one you would say differently, and why in one line.
- "complexity" describes what the talk reached: past or future reference, the connectors used, aspect pairs attempted. "note" is one line.
- "newChunks" is at most four phrases from the talk worth keeping, with their meaning.
- If there were no real slips, "slips" is [].`;
}

function numbered(input: LiveCallInput): string {
	return input.turns
		.map((t, i) => (t.role === "learner" ? `[${i}] Learner: ${t.text}` : `[${i}] Tutor: ${t.text}`))
		.join("\n");
}

type LexEntry = NonNullable<ReturnType<Lexicon["bySlug"]["get"]>>;

interface LocatedSlip {
	entry: LexEntry;
	hit: NonNullable<ReturnType<typeof spokenSlip>>;
}

function lexiconWord(review: LiveReview, lexicon: Lexicon | null): Map<number, LocatedSlip> {
	const out = new Map<number, LocatedSlip>();
	if (!lexicon) return out;
	review.slips.forEach((slip, i) => {
		const lower = slip.lemma.toLocaleLowerCase(TAG());
		const entry = slip.lemma ? (lexicon.byForm.get(lower)?.[0] ?? lexicon.byFolded.get(lower)?.[0]) : undefined;
		if (!entry) return;
		const hit = spokenSlip(entry, slip.yours, slip.right, TAG());
		if (hit) out.set(i, { entry, hit });
	});
	return out;
}

export interface TalkOutcome {
	report: SpeakingReport;
	xp: number;
	queued: string[];
	summary: ProgressSummary;
	island: Island | null;
}

export interface TalkOptions {
	now?: Date;
	tz?: number;
	/** Test seam: skip the model even when one is configured. */
	judge?: boolean;
}

export function talkLevel(): SpeakingReport["level"] {
	return progressStore.read().goal?.level ?? "A2";
}

function formalScene(title: string): boolean {
	return /interview|office|doctor|bank|official|meeting/i.test(title);
}

export async function analyseTalk(input: LiveCallInput, opts: TalkOptions = {}): Promise<TalkOutcome> {
	const now = opts.now ?? new Date();
	const lang = activeLanguage();
	const learnerTurns = input.turns.filter((t) => t.role === "learner" && t.text.trim());
	if (!learnerTurns.length) throw new Error("Nothing was said, so there is nothing to read.");
	const island = input.kind === "island" ? islandStore.get(input.ref) : null;
	if (input.kind === "island" && !island) throw new Error("No such island.");
	const sceneTitle = island?.topic ?? input.title ?? input.ref;
	const metrics = speechMetrics(input.turns, input.pausesMs);
	const kit = fillerKit();
	const finding: FillerFinding = kit
		? findFillers(
				learnerTurns.map((t) => t.text),
				kit,
				{ formal: formalScene(sceneTitle) },
			)
		: { used: [], english: [], variety: 0, overused: [], register: [] };
	const level = talkLevel();
	const recommended = kit ? pickFillers(kit, finding, level) : [];

	const wantsJudge = opts.judge !== false;
	const engine = wantsJudge ? storyEngine() : null;
	let review: LiveReview | null = null;
	let model: string | undefined;
	if (engine) {
		try {
			const { text } = await runSubagent([], {
				role: "researcher",
				engine: engine.engine,
				systemPrompt: reviewSystem(lang.english),
				prompt: `The talk (${metrics.talkSec} seconds, learner level ${level}):\n${numbered(input)}\n\nReview it.`,
				maxTurns: 1,
			});
			review = parseLiveReview(text);
			model = engine.model;
		} catch (err) {
			console.warn("[speaking] the review model failed:", err instanceof Error ? err.message : err);
		}
	}

	const lexicon = loadLexicon();
	const hits = review ? lexiconWord(review, lexicon) : new Map<number, LocatedSlip>();
	const slips: SpeakingSlip[] = [];
	const slugs: string[] = [];
	(review?.slips ?? []).forEach((slip, i) => {
		const located = hits.get(i);
		const kinds: readonly SlipKind[] = ["case", "verb", "aspect", "word", "order", "other"];
		const kind: SlipKind = kinds.includes(slip.kind as SlipKind) ? (slip.kind as SlipKind) : "other";
		slips.push({
			turn: slip.turn,
			yours: slip.yours,
			right: slip.right,
			kind,
			...(slip.rule ? { rule: slip.rule } : {}),
			...(located ? { drill: located.hit.drill, cell: atlasCellOf(located.hit.drill, located.entry.gender) } : {}),
		});
		if (located) slugs.push(located.entry.slug);
	});

	const xp = liveXp(metrics.talkSec, metrics.learnerTurns);
	const id = `lv-${now.toISOString().slice(0, 10)}-${input.kind === "island" ? "island" : input.ref}-${now
		.getTime()
		.toString(36)
		.slice(-4)}`;
	const report: SpeakingReport = {
		id,
		kind: input.kind,
		ref: input.ref,
		title: sceneTitle,
		lang: lang.id,
		level,
		at: now.toISOString(),
		startedAt: input.startedAt,
		endedAt: input.endedAt,
		metrics,
		approximate: input.approximate,
		judged: !!review,
		slips,
		strengths: review?.strengths ?? [],
		improve: (review?.improve ?? []).map((i) => ({ turn: i.turn, yours: i.yours, right: i.right, why: i.why })),
		...(review?.complexity ? { complexity: review.complexity } : {}),
		newChunks: review?.newChunks ?? [],
		fillers: finding,
		recommended,
		xp,
		...(model ? { model } : {}),
	};
	const queued = [...new Set(slugs)].length ? enqueueWords([...new Set(slugs)], now) : [];

	// The talk lands where it happened: an island keeps its talk, a scene
	// keeps a session (so Rehearse, the strand and Recent all see it).
	let savedIsland: Island | null = null;
	if (island) {
		const learnerText = learnerTurns.map((t) => t.text).join(" ");
		const said = usedChunkIds(learnerText, island.chunks);
		const at = now.toISOString();
		for (const chunk of island.chunks) if (said.includes(chunk.id)) chunk.saidAt = at;
		const all = islandStore.list();
		const shared = new Set(
			bridges(all)
				.filter((b) => b.a === island.id || b.b === island.id)
				.flatMap((b) => b.shared),
		);
		const own = new Set(
			island.chunks.flatMap((c) => c.sk.toLocaleLowerCase(TAG()).split(/[^\p{L}]+/u)).filter((w) => w.length >= 3),
		);
		const learnerFolded = ` ${learnerText.toLocaleLowerCase(TAG())} `;
		const borrowed = [...shared].filter((w) => !own.has(w) && learnerFolded.includes(` ${w} `));
		island.talks.push({
			at,
			sec: metrics.talkSec,
			learnerShare: metrics.learnerShare,
			medianReplyMs: metrics.medianReplyMs ?? Number.MAX_SAFE_INTEGER,
			englishShare: metrics.englishShare,
			bridgeUsed: borrowed.length >= 3,
		});
		islandStore.put(island);
		savedIsland = island;
	} else {
		const session = liveSession(input, report, now);
		speakStore.put(session);
		speakStore.index(session);
	}

	// The ledger: one speaking task, the XP, the minutes.
	const p = progressStore.read();
	const key = dayKey(now, opts.tz);
	const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	day.speaks = (day.speaks ?? 0) + 1;
	day.xp += xp;
	addMinutes(day, "speak", metrics.talkSec * 1000);
	p.xp += xp;
	(review?.slips ?? []).forEach((_, i) => {
		const slip = slips[i];
		const located = hits.get(i);
		if (!slip?.drill || !slip.cell || !located) return;
		p.units[slip.drill] = recordSpokenSlip(
			p.units[slip.drill] ?? { lessons: 0, reps: 0, correct: 0 },
			slip.cell,
			located.hit.slip,
		);
	});
	progressStore.write(p);

	speakingStore.put(report);
	speakingStore.addIndex(speakingIndexEntry(report));
	try {
		appendLessonLog({
			id: report.id,
			at: now.toISOString(),
			day: key,
			unit: input.kind === "island" ? `island:${input.ref}` : input.ref,
			mode: "speak",
			ms: metrics.talkSec * 1000,
			xp,
			correct: Math.max(0, learnerTurns.length - slips.length),
			total: learnerTurns.length,
			perfect: slips.length === 0,
			queued,
			reps: [],
		});
	} catch (err) {
		console.warn("[speaking] could not append the lesson log:", err instanceof Error ? err.message : err);
	}
	return { report, xp, queued, summary: progressSummary(opts.tz, now), island: savedIsland };
}

/** The live talk as a scene session, so the strand, Recent and the atlas
 *  see it without a second kind of record. */
function liveSession(input: LiveCallInput, report: SpeakingReport, now: Date): SpeakSession {
	const started = new Date(input.startedAt);
	const base = Number.isFinite(started.getTime()) ? started : now;
	const id = speakId(base, input.ref);
	const turns: SpeakTurn[] = input.turns.map((t) => ({
		role: t.role,
		text: t.text,
		...(t.role === "learner" ? { via: "voice" as const } : {}),
		at: new Date(base.getTime() + t.start).toISOString(),
	}));
	return {
		id,
		lang: activeLanguage().id,
		scene: input.ref,
		sceneTitle: report.title,
		level: report.level,
		chapter: report.title,
		startedAt: input.startedAt,
		endedAt: now.toISOString(),
		turns,
		summary: {
			corrections: report.slips.map((s) => ({
				yours: s.yours,
				right: s.right,
				rule: s.rule ?? "",
				kind: s.kind,
			})),
			keep: report.newChunks.map((c) => c.sk).slice(0, 2),
			note: report.strengths[0] ?? "",
		},
		usage: { model: report.model ?? "phonic:live", steps: [] },
		xp: report.xp,
		queued: [],
		ms: report.metrics.talkSec * 1000,
	};
}

/** Every report of this language, newest last. */
export function speakingReports(): SpeakingReport[] {
	return speakingStore.list();
}

/** The island a report belongs to, for the end screen's next step. */
export function islandOfReport(report: SpeakingReport): Island | null {
	return report.kind === "island" ? islandStore.get(report.ref) : null;
}

/** What the ladder's next step needs, after this talk. */
export function nextIslandStep(island: Island, now = new Date()): { step: string; needs: string[] } {
	const readiness = islandReadiness(island, { now });
	return { step: readiness.step, needs: readiness.needs };
}
