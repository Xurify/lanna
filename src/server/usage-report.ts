/**
 * The spending report (Xurify, 2026-10-28: "are you keeping track of how
 * much everything has cost? Where can I view that myself?") — behind
 * GET /api/usage and Settings → Spending. Every number is folded at read
 * time from what is already on disk: each chat's `turns` log (one entry
 * per model turn, with the model), the sub-agent jobs, the story episodes written for the
 * Read task (each carries its own usage), and the audio library's index.
 * Nothing is estimated from elsewhere; a turn whose model has no price in
 * the catalog counts as unpriced and is shown as such.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { ChatRecord, TurnUsage } from "../core/contracts.ts";
import type { SessionMode, SessionSpend, UsageReport } from "../core/usage-report.ts";
import { userFacingTextOf } from "../core/native-messages.ts";
import { chatStore } from "../store/chats.ts";
import { listAudioClips } from "../store/corpus.ts";
import { storyStore } from "../store/stories.ts";
import { speakStore } from "../store/speak.ts";
import { placementStore } from "../store/placement.ts";
import { videoStore } from "../store/videos.ts";
import { jobCost, turnCost } from "./pricing.ts";
import { stores } from "./stores.ts";

function monthOf(iso: string): string {
	return iso.slice(0, 7);
}

/** Why?, Talk, Story or Practice, read off the first user message; a course is "learn". */
export function sessionMode(chat: Pick<ChatRecord, "kind" | "messages" | "title">): SessionMode {
	if (chat.kind !== "practice") return "learn";
	const first = chat.messages.find((m) => m.role === "user");
	const text = first ? userFacingTextOf(first.content).join(" ") : "";
	const head = (text || chat.title).trim();
	if (/^why\b/i.test(head)) return "why";
	if (/^talk\b/i.test(head)) return "talk";
	if (/^story\b/i.test(head)) return "story";
	return "practice";
}

function readTrash(): ChatRecord[] {
	const dir = path.join(PATHS.chats, "trash");
	try {
		return fs
			.readdirSync(dir)
			.filter((f) => f.endsWith(".json"))
			.flatMap((f) => {
				try {
					return [JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as ChatRecord];
				} catch {
					return [];
				}
			});
	} catch {
		return [];
	}
}

export function usageReport(now = new Date()): UsageReport {
	const live = chatStore
		.listChats()
		.map((c) => chatStore.getChat(c.id))
		.filter((c): c is ChatRecord => c !== null)
		.map((c) => ({ chat: c, deleted: false }));
	const trashed = readTrash().map((c) => ({ chat: c, deleted: true }));
	const months = new Map<string, { usd: number; turns: number }>();
	const addMonth = (iso: string, usd: number, turns = 0) => {
		const m = months.get(monthOf(iso)) ?? { usd: 0, turns: 0 };
		m.usd += usd;
		m.turns += turns;
		months.set(monthOf(iso), m);
	};
	const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
	const sessions: SessionSpend[] = [];
	let turnsUsd = 0;
	let jobsUsd = 0;
	let unpricedTurns = 0;
	for (const { chat, deleted } of [...live, ...trashed]) {
		const s: SessionSpend = {
			id: chat.id,
			title: chat.title,
			mode: sessionMode(chat),
			deleted,
			createdAt: chat.createdAt,
			updatedAt: chat.updatedAt,
			turns: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			costUsd: null,
			unpricedTurns: 0,
			jobsUsd: 0,
			models: [],
		};
		const models = new Set<string>();
		let priced = 0;
		for (const turn of chat.turns ?? []) {
			s.turns++;
			models.add(turn.model);
			for (const step of turn.steps) {
				s.inputTokens += step.inputTokens ?? 0;
				s.outputTokens += step.outputTokens ?? 0;
				s.cacheReadTokens += step.cacheReadTokens ?? 0;
				s.cacheWriteTokens += step.cacheWriteTokens ?? 0;
			}
			const usd = safeTurnCost(turn);
			if (usd === null) s.unpricedTurns++;
			else {
				priced += usd;
				addMonth(turn.at, usd, 1);
			}
		}
		s.costUsd = s.turns > 0 && s.unpricedTurns === s.turns ? null : priced;
		for (const job of stores.jobStore.listJobs(chat.id)) {
			const usd = safeJobCost(job);
			if (usd !== null) {
				s.jobsUsd += usd;
				addMonth(job.updatedAt, usd);
			}
		}
		s.models = [...models];
		tokens.input += s.inputTokens;
		tokens.output += s.outputTokens;
		tokens.cacheRead += s.cacheReadTokens;
		tokens.cacheWrite += s.cacheWriteTokens;
		turnsUsd += priced;
		jobsUsd += s.jobsUsd;
		unpricedTurns += s.unpricedTurns;
		sessions.push(s);
	}
	sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	const byModeMap = new Map<SessionMode, { sessions: number; turns: number; usd: number }>();
	for (const s of sessions) {
		const m = byModeMap.get(s.mode) ?? { sessions: 0, turns: 0, usd: 0 };
		m.sessions++;
		m.turns += s.turns;
		m.usd += (s.costUsd ?? 0) + s.jobsUsd;
		byModeMap.set(s.mode, m);
	}
	// Story episodes (the Read task): one generation each, priced like a turn.
	let storiesUsd = 0;
	let storiesUnpriced = 0;
	const storyIndex = storyStore.list();
	for (const s of storyIndex) {
		const story = storyStore.get(s.id);
		const usd = story ? safeTurnCost(story.usage) : null;
		if (usd === null) storiesUnpriced++;
		else {
			storiesUsd += usd;
			addMonth(s.createdAt, usd);
		}
	}
	// Spoken scenes (the Speak task): a few short calls each, priced like turns.
	let speakUsd = 0;
	let speakUnpriced = 0;
	const speakIndex = speakStore.list();
	for (const e of speakIndex) {
		const s = speakStore.get(e.id);
		const usd = s ? safeTurnCost(s.usage) : null;
		if (usd === null) speakUnpriced++;
		else {
			speakUsd += usd;
			addMonth(e.startedAt, usd);
		}
	}
	// Videos prepared for the Watch task: the translation and the questions,
	// then what was asked of a video once kept: its study sections and its
	// briefing (Get ready).
	let videosUsd = 0;
	let videosUnpriced = 0;
	const videoIndex = videoStore.list();
	for (const e of videoIndex) {
		const v = videoStore.get(e.id);
		const usd = v ? safeTurnCost(v.usage) : null;
		if (usd === null) videosUnpriced++;
		else {
			videosUsd += usd;
			addMonth(e.createdAt, usd);
		}
	}
	for (const r of [...videoStore.allSections(), ...videoStore.allPreps()]) {
		const usd = safeTurnCost(r.usage);
		if (usd === null) videosUnpriced++;
		else {
			videosUsd += usd;
			addMonth(r.createdAt, usd);
		}
	}
	// Placement checks: the judged answers and the Socratic stage.
	let placementUsd = 0;
	let placementUnpriced = 0;
	const placementIndex = placementStore.list();
	for (const e of placementIndex) {
		const s = placementStore.get(e.id);
		if (!s || s.usage.steps.length === 0) continue;
		const usd = safeTurnCost(s.usage);
		if (usd === null) placementUnpriced++;
		else {
			placementUsd += usd;
			addMonth(e.startedAt, usd);
		}
	}
	// What adding a language paid a model for (the course and the story
	// bible, kept beside its build steps): one line per language.
	let languagesUsd = 0;
	let languagesUnpriced = 0;
	let languagesCount = 0;
	for (const name of safeReaddir(PATHS.languages)) {
		const build = path.join(PATHS.languages, name, "build");
		const drafts = safeReaddir(build).filter((f) => f.endsWith("-draft.json"));
		let counted = false;
		for (const file of drafts) {
			type Draft = { usage?: Pick<TurnUsage, "model" | "steps">; createdAt?: string } | null;
			let draft: Draft;
			try {
				draft = JSON.parse(fs.readFileSync(path.join(build, file), "utf-8")) as Draft;
			} catch {
				continue;
			}
			if (!draft?.usage) continue;
			counted = true;
			const usd = safeTurnCost(draft.usage);
			if (usd === null) languagesUnpriced++;
			else {
				languagesUsd += usd;
				if (draft.createdAt) addMonth(draft.createdAt, usd);
			}
		}
		if (counted) languagesCount++;
	}
	const clips = listAudioClips();
	const byTier: Record<string, number> = {};
	let bytes = 0;
	let elevenLabsCharacters = 0;
	for (const c of clips) {
		byTier[c.tier] = (byTier[c.tier] ?? 0) + 1;
		bytes += c.bytes;
		if (c.tier === "elevenlabs" && c.text) elevenLabsCharacters += c.text.length;
	}
	const round = (n: number) => Math.round(n * 10000) / 10000;
	return {
		generatedAt: now.toISOString(),
		totalUsd: round(turnsUsd + jobsUsd + storiesUsd + speakUsd + videosUsd + placementUsd + languagesUsd),
		turnsUsd: round(turnsUsd),
		jobsUsd: round(jobsUsd),
		storiesUsd: round(storiesUsd),
		stories: { count: storyIndex.length, unpriced: storiesUnpriced },
		speakUsd: round(speakUsd),
		speak: { count: speakIndex.length, unpriced: speakUnpriced },
		videosUsd: round(videosUsd),
		videos: { count: videoIndex.length, unpriced: videosUnpriced },
		placementUsd: round(placementUsd),
		placement: { count: placementIndex.length, unpriced: placementUnpriced },
		languagesUsd: round(languagesUsd),
		languages: { count: languagesCount, unpriced: languagesUnpriced },
		unpricedTurns,
		byMonth: [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, m]) => ({ month, usd: round(m.usd), turns: m.turns })),
		byMode: [...byModeMap.entries()].sort(([, a], [, b]) => b.usd - a.usd).map(([mode, m]) => ({ mode, ...m, usd: round(m.usd) })),
		sessions: sessions.map((s) => ({ ...s, costUsd: s.costUsd === null ? null : round(s.costUsd), jobsUsd: round(s.jobsUsd) })),
		audio: { clips: clips.length, bytes, byTier, elevenLabsCharacters },
		tokens,
	};
}

function safeReaddir(dir: string): string[] {
	try {
		return fs.readdirSync(dir);
	} catch {
		return [];
	}
}

function safeTurnCost(turn: Pick<TurnUsage, "model" | "steps">): number | null {
	try {
		return turnCost(turn as TurnUsage);
	} catch {
		return null;
	}
}

function safeJobCost(job: Parameters<typeof jobCost>[0]): number | null {
	try {
		return jobCost(job);
	} catch {
		return null;
	}
}
