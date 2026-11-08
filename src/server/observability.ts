/**
 * Server-side observability surface — the barrel-approved exports the
 * transport layer (app/api/*) reads for background-process status.
 *
 * THE ACTIVITY FEED (2026-09 observability design): the bottom-right dock is
 * visible in every view, so it needs the complete running-process picture —
 * sub-agent jobs across ALL chats (not just the open one) in one poll. The
 * dock is BACKGROUND PROCESSES ONLY (user decision, 2026-09-11): teaching sessions already have their own
 * observability, so in-flight teacher turns are deliberately NOT in the
 * feed. /api/jobs stays chat-scoped untouched: it is the transcript
 * machinery's poll and carries turnInFlight for the re-attach seam
 * (chat-transport); the dock is a different consumer with a different
 * shape, served here. Single source of truth is unchanged: the job
 * store — this file only composes it.
 */

import { chatStore } from "../store/chats.ts";
import { graphRevision } from "./graph.ts";
import { catalogContextLimits } from "./model-catalog.ts";
import { listJobs } from "./jobs.ts";
import { jobCost } from "./pricing.ts";
import { listTasks, type TaskRecord } from "./tasks.ts";
import type { JobRecord } from "../core/contracts.ts";

export { chatStore } from "../store/chats.ts";

/** A running sub-agent job, joined with its chat's title for the dock.
 *  contextLimit (context-meter amendment, owner 2026-09-23): the model's
 *  live catalog limit, resolved SERVER-SIDE from pi's catalog — the dock
 *  reads it off the feed instead of any client-side table. Null when the
 *  model is missing from the catalog (the blob then renders no context
 *  line — never a fake window). */
export interface ActivityJob extends JobRecord {
	costUsd: number | null;
	title: string;
	contextLimit: number | null;
}

/** The dock's whole world in one payload: every running process, every view.
 *  Jobs are RUNNING-ONLY — finished jobs belong to their chat's transcript;
 *  the blob disappears when the process ends. Costs are joined here through
 *  the server-side Pi pricing adapter; clients never reconstruct rates. */
/** The dock's whole world + the graph's version stamp (wave 6 session
 *  deletion): the payload carries graphRevision (max mtime across the
 *  graph data files — see server/graph.ts) so any view can detect "the
 *  graph changed underneath me" (a merge landed, a deletion purged) and
 *  refetch clusters/layout. Reads never move it; the DELETE response
 *  returns the same stamp. */
export function activityFeed(): {
	jobs: ActivityJob[];
	tasks: TaskRecord[];
	graphRevision: number;
} {
	const chats = chatStore.listChats();
	const limits = catalogContextLimits();
	const jobs: ActivityJob[] = [];
	for (const chat of chats) {
		for (const job of listJobs(chat.id)) {
			if (job.status === "running") {
				jobs.push({
					...job,
					costUsd: jobCost(job),
					title: chat.title ?? chat.id,
					contextLimit: job.usage ? (limits.get(job.usage.model) ?? null) : null,
				});
			}
		}
	}
	// oldest-first on last activity: the stable blob order (ISO strings sort chronologically)
	jobs.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
	return {
		jobs,
		tasks: listTasks(),
		graphRevision: graphRevision(),
	};
}
