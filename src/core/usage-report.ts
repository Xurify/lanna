/**
 * The spending report's shape (Settings → Spending, GET /api/usage) —
 * pure types, shared by the server fold (src/server/usage-report.ts) and
 * the browser section (components/settings/usage-section.tsx).
 */

export type SessionMode = "learn" | "talk" | "story" | "why" | "practice";

export interface SessionSpend {
	id: string;
	title: string;
	mode: SessionMode;
	deleted: boolean;
	createdAt: string;
	updatedAt: string;
	turns: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	/** Model turns in USD; null when every turn was unpriced. */
	costUsd: number | null;
	unpricedTurns: number;
	/** Background graph extraction on this chat, USD. */
	extractionUsd: number;
	/** Sub-agent jobs (research, demos) started from this chat, USD. */
	jobsUsd: number;
	models: string[];
}

export interface UsageReport {
	generatedAt: string;
	/** Everything priced, USD: turns + extraction + jobs + stories + spoken scenes. */
	totalUsd: number;
	turnsUsd: number;
	extractionUsd: number;
	jobsUsd: number;
	/** Story episodes written for the Read task (src/server/reading.ts), USD. */
	storiesUsd: number;
	/** Episodes written, and how many had no catalog price. */
	stories: { count: number; unpriced: number };
	/** Spoken scenes (the Speak task, src/server/speak.ts), USD. */
	speakUsd: number;
	speak: { count: number; unpriced: number };
	/** Videos prepared for the Watch task (src/server/watch.ts): translation + questions, USD. */
	videosUsd: number;
	videos: { count: number; unpriced: number };
	unpricedTurns: number;
	/** YYYY-MM → USD (turns, extraction and jobs by their own dates). */
	byMonth: Array<{ month: string; usd: number; turns: number }>;
	byMode: Array<{ mode: SessionMode; sessions: number; turns: number; usd: number }>;
	sessions: SessionSpend[];
	audio: { clips: number; bytes: number; byTier: Record<string, number>; elevenLabsCharacters: number };
	tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

