/**
 * Sub-agent job contracts — the async ack-and-steer protocol
 *
 * Part of the domain-split contracts (src/core/contracts/): each domain file
 * is owned outright by its stream — cross-domain schema changes go through
 * master. Pure types + protocol docs + tiny pure helpers; type-only imports
 * of "ai" (safe everywhere: server, client, tests).
 */
import type { CallUsage } from "./chat.ts";

// ─── Async sub-agent jobs (vision §2.5; plan.md Wave 0 protocol) ────────────

export type JobKind = "research" | "visual" | "pdf";
export type JobStatus = "running" | "done" | "error";

export interface JobRecord {
	id: string;
	kind: JobKind;
	chatId: string;
	/** The tool part this job fulfills. */
	toolCallId: string;
	/** Dispatch-time arguments, saved before spawn. Older jobs resolve from history. */
	input?: unknown;
	/** Session-owned delivery, independent of the worker's terminal outcome.
	 * Absent on legacy records: old terminal jobs must never be replayed. */
	delivery?: { kind: "result" | "abort"; status: "pending" | "delivered" };
	/** Worker computation only; a pending delivery does not keep it running. */
	status: JobStatus;
	/** Latest human-readable activity line, e.g. `web_search: "sigma.js v3"`. */
	activity: string;
	createdAt: string;
	updatedAt: string;
	/** The sub-agent's result (steer-artifact payload). */
	result?: unknown;
	error?: string;
	/** Money channel (observability, 2026-09): accumulated token usage of
	 * the sub-agent's run, written by the runner as steps complete. Cost is
	 * inferred at read time (core/prices.ts). Absent on pre-2026-09 jobs and
	 * until the runner's capture lands — renderers show "—", never zero. */
	usage?: JobUsage;
}

/** A sub-agent run's accumulated usage — the same accounting shape as a
 * chat turn (contracts/chat.ts CallUsage), flattened to one running total
 * plus a step count. Token fields are optional exactly like CallUsage: a
 * field NO model call reported stays undefined — absent is not zero (the
 * money-channel doctrine; cost renders "—", never $0). */
export interface JobUsage {
	/** The model that ran the sub-agent, provider-qualified ("provider:id" —
	 *  model slots wave, 2026-09-20; matches Pi catalog lookup keys). */
	model: string;
	/** Running totals summed over the run's model calls so far. */
	inputTokens: number | undefined;
	outputTokens: number | undefined;
	cacheReadTokens: number | undefined;
	cacheWriteTokens: number | undefined;
	reasoningTokens: number | undefined;
	cacheWrite1hTokens?: number;
	/** Individual calls for current-catalog per-call tier pricing. Absent on
	 * older jobs; never backfill them from cumulative totals. */
	calls?: CallUsage[];
	/** How many model calls the run has made (each bills separately). */
	steps: number;
	/** The MOST RECENT model call's accounting (2026-09 dock contract): the
	 *  per-blob context line reads last-step input+output against the
	 *  model's LIVE catalog limit (server-joined onto the activity feed —
	 *  never the cumulative totals, never a client-side table). Absent
	 *  until the first call completes; absent provider fields stay absent
	 *  (never zero). */
	lastStep?: CallUsage;
}

/** The per-model-call usage shape we fold into JobUsage — the SDK's
 * LanguageModelUsage narrowed structurally (no runtime "ai" import: any
 * object with these fields folds, including the real thing and test fakes). */
export interface UsageStepLike {
	inputTokens?: number | undefined;
	inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number; cacheWrite1hTokens?: number } | undefined;
	outputTokens?: number | undefined;
	outputTokenDetails?: { reasoningTokens?: number } | undefined;
}

/** pi-ai's Usage shape (input/output/cacheRead/cacheWrite/reasoning?) →
 * UsageStepLike. Structural — no pi import here; the engine band maps at
 * its boundaries. */
export function piUsageToStep(usage: {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cacheWrite1h?: number;
	reasoning?: number;
}): UsageStepLike {
	return {
		inputTokens: usage.input,
		outputTokens: usage.output,
		inputTokenDetails: {
			cacheReadTokens: usage.cacheRead,
			cacheWriteTokens: usage.cacheWrite,
			cacheWrite1hTokens: usage.cacheWrite1h ?? 0,
		},
		outputTokenDetails: usage.reasoning !== undefined ? { reasoningTokens: usage.reasoning } : undefined,
	};
}

/** Fold one model call's usage into the run's running total (pure). A
 * field neither the total nor the step reported stays undefined; once
 * reported, later unreported calls contribute 0. The `steps` counter is
 * the billing count: one per model call, reported or not. */
export function accumulateJobUsage(total: JobUsage | undefined, model: string, step: UsageStepLike): JobUsage {
	const add = (a: number | undefined, b: number | undefined): number | undefined =>
		a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);
	const call: CallUsage = {
		inputTokens: step.inputTokens,
		outputTokens: step.outputTokens,
		cacheReadTokens: step.inputTokenDetails?.cacheReadTokens,
		cacheWriteTokens: step.inputTokenDetails?.cacheWriteTokens,
		cacheWrite1hTokens: step.inputTokenDetails?.cacheWrite1hTokens,
		reasoningTokens: step.outputTokenDetails?.reasoningTokens,
	};
	return {
		model,
		inputTokens: add(total?.inputTokens, step.inputTokens),
		outputTokens: add(total?.outputTokens, step.outputTokens),
		cacheReadTokens: add(total?.cacheReadTokens, step.inputTokenDetails?.cacheReadTokens),
		cacheWriteTokens: add(total?.cacheWriteTokens, step.inputTokenDetails?.cacheWriteTokens),
		reasoningTokens: add(total?.reasoningTokens, step.outputTokenDetails?.reasoningTokens),
		cacheWrite1hTokens:
			((total?.cacheWriteTokens ?? 0) > 0 && total?.cacheWrite1hTokens === undefined) ||
			((call.cacheWriteTokens ?? 0) > 0 && call.cacheWrite1hTokens === undefined)
				? undefined
				: add(total?.cacheWrite1hTokens, call.cacheWrite1hTokens),
		steps: (total?.steps ?? 0) + 1,
		...(!total || total.calls ? { calls: [...(total?.calls ?? []), call] } : {}),
		lastStep: call,
	};
}

/**
 * THE ASYNC PROTOCOL — "ack now, steer later" (the pi sub-agents model,
 * vision §2.5):
 *
 *  1. Job tools (research / visual / pdf) are SERVER-EXECUTED. The model
 *     calls one MID-TURN; execute creates the job record, fires the
 *     background runner, and resolves IMMEDIATELY with an acknowledgement
 *     ("dispatched — continue your turn"). The teacher's turn does NOT end
 *     at the call: it keeps teaching, may dispatch other independent jobs
 *     (full parallelism), and ends whenever it ends. The tool part's output
 *     is the ack, forever.
 *
 *  2. The background runner (src/agent/subagents/runner.ts) runs the kind's
 *     sub-agent loop — isolated context, modelFor(role), the
 *     verify-never-one-shot doctrine (looked-at SVGs,
 *     sourced briefs) — tracking a live activity line in the job record.
 *     ONE central client poll of GET /api/jobs?chatId=… (in Chat) drives every
 *     job surface: the transcript dispatch cards (live activity by
 *     toolCallId, quiet one-liner after worker completion), the sub-agents sidebar
 *     panel, and the single re-sync when a job settles.
 *
 *  3. Dispatch saves input on the job before spawn. On completion the
 *     runner saves result + terminal worker status + pending delivery in
 *     one job update, then queues buildSubagentSteer WITHOUT waiting for
 *     delivery. The native custom marker's content is model-facing text;
 *     details carry the full artifact payload for the UI. Worker resources
 *     are released even if a question keeps the result pending indefinitely.
 *     Only computing workers appear in Background agents or accept abort.
 *
 *  4. Session delivery owns one registry entry per deterministic steer ID,
 *     including while a wake is in flight or a 409/403 returns its cargo.
 *     A live agent takes it via pi steering; registration restores saved
 *     pending jobs before the answer run's first poll. Otherwise the idle
 *     wake uses the normal turn composition and respects pending questions,
 *     dismissal, and background consent. A saved transcript marker completes
 *     delivery; HTTP 200 or streamed visibility alone does not.
 *
 *     Failed starts remain quietly pending until a learner run or restart
 *     recovery, without new timers, visible delivery errors, or worker-status
 *     changes. Existing 409 backoff and consent deferral remain. Accepted
 *     turns are never automatically replayed. Legacy running records with a
 *     result become finished/pending; legacy terminal records with no
 *     delivery metadata remain untouched. Session deletion discards pending
 *     deliveries rather than treating them as running work.
 *
 *  5. No pending job parts ever exist, so the composer never gates on jobs
 *     (the learner can interject mid-job; the steer queues behind their
 *     turn) and job tool outputs never trigger the client-side
 *     sendAutomatically continuation — that mechanism stays quiz/ask-only.
 */

export interface ResearchToolInput {
	question: string;
	/** What the teacher needs it for — focuses the research brief. */
	context?: string;
}

export interface ResearchResult {
	brief: string;
	sources: { title: string; url: string }[];
}

export interface PdfToolInput {
	/** Path to the learner's PDF (relative or absolute). */
	path: string;
	/** What the teacher needs from the document — focuses the brief. */
	question: string;
}

export interface PdfResult {
	path: string;
	question: string;
	/** The distilled brief. Page citations inside the text point at
	 *  pagesConsulted. Failure shape: /^PDF failed:/i (mirrors research). */
	brief: string;
	/** Pages the reader actually READ — extract or render output entered the
	 *  loop (the honest count for the UI badge; search-hit snippets don't
	 *  count — sources v1 split, 2026-09-19, after the "78 pages consulted"
	 *  overstatement on a long-book search-first read). */
	pagesRead: number[];
	/** Every page whose content entered the loop, search-hit context lines
	 *  included — the full audit set (the brief's citations may point here). */
	pagesConsulted: number[];
}
