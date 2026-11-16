/**
 * Study sections for a prepared video (docs/research/watch-sections.md, E62).
 * The cheap slot picks up to three sections and the words in them, once per
 * video, kept with its cost in videos/sections/<id>.json (E1). The gaps are
 * built from the stored lines (src/core/watch-sections.ts). A finished
 * section earns XP like a lesson's typed reps; missed words go to Review and
 * their lines come back in Listen with the Watch lines (E56).
 */

import type { Usage } from "@earendil-works/pi-ai";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { addMinutes } from "../core/active-time.ts";
import { repXp } from "../core/lesson.ts";
import type { StoryUsage } from "../core/reading.ts";
import { dayKey } from "../core/review.ts";
import { foreignCaptions } from "../core/watch.ts";
import { missedWatchReps } from "../core/watch-reps.ts";
import {
	parseSections,
	sectionReps,
	sectionsPrompt,
	sectionsSystem,
	SECTION_PROMPT_LINES,
	type GapResult,
	type SectionsRecord,
} from "../core/watch-sections.ts";
import { progressStore } from "../store/progress.ts";
import { videoStore } from "../store/videos.ts";
import { watchRepStore } from "../store/watch-reps.ts";
import { activeLanguage } from "./active-language.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { storyEngine } from "./reading.ts";
import { enqueueWords } from "./review.ts";

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return {
		inputTokens: u.input,
		outputTokens: u.output,
		cacheReadTokens: u.cacheRead,
		cacheWriteTokens: u.cacheWrite,
		cacheWrite1hTokens: u.cacheWrite1h ?? 0,
		reasoningTokens: u.reasoning,
	};
}

function videoFor(id: string) {
	const video = videoStore.get(id);
	if (!video) throw new Error(`unknown video ${id}`);
	if (foreignCaptions({ lang: video.lang, trackLang: video.source.trackLang }))
		throw new Error("This video's captions are not in the language you learn, so it has no study sections.");
	return video;
}

/** The kept sections, or null when none were found yet. */
export function keptSections(id: string): SectionsRecord | null {
	return videoStore.sections(id);
}

/** Find the sections: from the kept answer, or one cheap-slot request when
 *  there is none or `force` asks for new ones. Throws when no model is set or
 *  the answer holds no usable section. */
export async function findSections(
	id: string,
	opts: { force?: boolean; engine?: PiEngine; model?: string; now?: Date } = {},
): Promise<SectionsRecord> {
	const video = videoFor(id);
	const kept = videoStore.sections(id);
	if (kept && !opts.force) return kept;
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "test" } : storyEngine();
	if (!resolved) throw new Error("No model is configured. Pick one in Settings → AI models.");
	const usage: StoryUsage = { model: resolved.model, steps: [] };
	const prompt = sectionsPrompt(video, video.level);
	const { text } = await runSubagent([], {
		role: "researcher",
		engine: resolved.engine,
		systemPrompt: sectionsSystem(activeLanguage().english),
		prompt,
		maxTurns: 1,
		onUsage: (u) => usage.steps.push(stepOf(u)),
	});
	const sections = parseSections(text, video);
	if (!sections.length)
		throw new Error("The model found no section it could back with the video's own lines. Try again.");
	const rec: SectionsRecord = {
		videoId: id,
		level: video.level,
		createdAt: (opts.now ?? new Date()).toISOString(),
		model: resolved.model,
		sections,
		linesShown: Math.min(video.segments.length, SECTION_PROMPT_LINES),
		usage,
	};
	videoStore.putSections(rec);
	return rec;
}

interface SectionOutcome {
	xp: number;
	right: number;
	total: number;
	/** Words put into the Review deck. */
	queued: string[];
	/** Lines that will come back in Listen. */
	lines: number;
	summary: ProgressSummary;
}

/** A finished section: XP per gap (a typed rep; half when accents only or
 *  helped), the day's reps and minutes, missed words to Review, missed lines
 *  to the Watch lines in Listen. Only gaps of that section count. */
export function recordSection(
	input: { videoId: string; section: number; results: readonly GapResult[]; activeMs?: number; tz?: number },
	now = new Date(),
): SectionOutcome {
	const video = videoFor(input.videoId);
	const kept = videoStore.sections(input.videoId);
	const section = kept?.sections[input.section];
	if (!section) throw new Error("No such section. Find the sections again.");
	const reps = new Map(sectionReps(video, section).map((r) => [r.id, r]));
	const seen = new Set<string>();
	const results = input.results.filter((r) => reps.has(r.id) && !seen.has(r.id) && seen.add(r.id));
	let combo = 0;
	let xp = 0;
	for (const r of results) {
		const clean = r.verdict === "exact" && !r.assisted;
		combo = clean ? combo + 1 : 0;
		xp += repXp("type", r.verdict, combo, r.assisted);
	}
	const missed = results.filter((r) => r.verdict === "wrong" || r.assisted).map((r) => reps.get(r.id)!);
	const slugs = [...new Set(missed.map((r) => r.slug).filter((s): s is string => !!s))];
	const queued = slugs.length ? enqueueWords(slugs, now) : [];
	const day = dayKey(now, input.tz);
	// As for a watching (recordWatch): automatic captions can misspell what was said, so their lines do not come back in Listen.
	const lines =
		video.source.kind === "auto-captions"
			? 0
			: watchRepStore.addNew(
					missedWatchReps(
						video,
						[...new Set(missed.map((r) => r.at))].map((i) => ({ i, got: "no" as const })),
						day,
					),
				).length;
	const p = progressStore.read();
	const d = (p.days[day] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	d.xp += xp;
	d.reps += results.length;
	if (input.activeMs !== undefined) addMinutes(d, "watch", Math.max(0, input.activeMs));
	p.xp += xp;
	progressStore.write(p);
	return {
		xp,
		right: results.filter((r) => r.verdict !== "wrong" && !r.assisted).length,
		total: results.length,
		queued,
		lines,
		summary: progressSummary(input.tz, now),
	};
}
