/**
 * Background tasks (2026-11-05): a model call that takes a while (preparing
 * a video, later a story or a lesson) runs here instead of holding a page.
 * The caller starts a task and returns; the task reports its step, ends
 * done or in error, and the sidebar's Background section, a ready notice and
 * the Tasks page read it from the activity feed (server/observability.ts). Nothing here
 * calls a model: a task is the bookkeeping around work some module already
 * does.
 *
 * In memory, on globalThis (Next dev gives each route its own module
 * instances). A finished task stays until the learner removes it (the notice
 * can be closed without removing it), so a "ready" notice is not lost to a
 * reload and the Tasks page has a history; a restart drops them, and the
 * work they point to (a saved video) is still in its own library.
 */

import { emit } from "../core/events.ts";

export type TaskKind = "video";
export type TaskStatus = "running" | "done" | "error";

export interface TaskRecord {
	id: string;
	kind: TaskKind;
	title: string;
	/** What it is doing now, one human line. */
	step: string;
	status: TaskStatus;
	startedAt: number;
	finishedAt?: number;
	/** Where the result is, once done. */
	href?: string;
	error?: string;
	/** The learner closed its "ready" notice; it stays in the Tasks list. */
	dismissed?: boolean;
	/** A failed task the learner can start again in one step (a video with no
	 *  captions, whose audio can be transcribed instead). */
	retry?: { label: string; url: string; transcribe: boolean };
}

interface TaskState {
	tasks: Map<string, TaskRecord>;
	aborts: Map<string, AbortController>;
}

const KEY = "__lhTasks";
function state(): TaskState {
	const g = globalThis as unknown as Record<string, TaskState | undefined>;
	return (g[KEY] ??= { tasks: new Map(), aborts: new Map() });
}

/** Finished tasks kept for the notice; the oldest go first. */
export const TASKS_KEPT = 20;

const changed = () => emit("activity-changed", {});

/** Start a task. One task per id: starting a running id returns it with
 *  its abort signal unchanged, so a second request shares the first. */
export function startTask(init: { id: string; kind: TaskKind; title: string; step: string; now?: number }): { task: TaskRecord; signal: AbortSignal; fresh: boolean } {
	const s = state();
	const running = s.tasks.get(init.id);
	if (running?.status === "running") return { task: running, signal: s.aborts.get(init.id)!.signal, fresh: false };
	const controller = new AbortController();
	const task: TaskRecord = { id: init.id, kind: init.kind, title: init.title, step: init.step, status: "running", startedAt: init.now ?? Date.now() };
	s.tasks.set(init.id, task);
	s.aborts.set(init.id, controller);
	changed();
	return { task, signal: controller.signal, fresh: true };
}

export function updateTask(id: string, patch: Partial<Pick<TaskRecord, "title" | "step">>): void {
	const task = state().tasks.get(id);
	if (!task || task.status !== "running") return;
	if (patch.title !== undefined) task.title = patch.title;
	if (patch.step !== undefined) task.step = patch.step;
	changed();
}

function end(id: string, patch: Partial<TaskRecord> & { status: "done" | "error" }): void {
	const s = state();
	const task = s.tasks.get(id);
	if (!task || task.status !== "running") return;
	Object.assign(task, patch, { finishedAt: Date.now() });
	s.aborts.delete(id);
	const finished = [...s.tasks.values()].filter((t) => t.status !== "running").sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
	for (const old of finished.slice(0, Math.max(0, finished.length - TASKS_KEPT))) s.tasks.delete(old.id);
	changed();
}

export function finishTask(id: string, patch: { title?: string; href?: string } = {}): void {
	end(id, { status: "done", step: "Ready", ...patch });
}

export function failTask(id: string, error: string, retry?: TaskRecord["retry"]): void {
	end(id, { status: "error", step: "Failed", error, ...(retry ? { retry } : {}) });
}

/** Ask a running task to stop: its signal fires, and the work ends it.
 *  False when nothing runs under the id. */
export function abortTask(id: string): boolean {
	const controller = state().aborts.get(id);
	if (!controller || state().tasks.get(id)?.status !== "running") return false;
	controller.abort();
	return true;
}

/** Close a finished task's notice. It stays in the Tasks list (removeTask
 *  takes it out). A running one is left alone. */
export function dismissTask(id: string): boolean {
	const task = state().tasks.get(id);
	if (!task || task.status === "running" || task.dismissed) return false;
	task.dismissed = true;
	changed();
	return true;
}

/** Take a finished task out of the Tasks list. A running one is left alone. */
export function removeTask(id: string): boolean {
	const s = state();
	const task = s.tasks.get(id);
	if (!task || task.status === "running") return false;
	s.tasks.delete(id);
	changed();
	return true;
}

/** Take every finished task out of the list; how many went. */
export function clearFinishedTasks(): number {
	const s = state();
	const done = [...s.tasks.values()].filter((t) => t.status !== "running");
	for (const t of done) s.tasks.delete(t.id);
	if (done.length) changed();
	return done.length;
}

/** Every task, oldest first. */
export function listTasks(): TaskRecord[] {
	return [...state().tasks.values()].sort((a, b) => a.startedAt - b.startedAt).map((t) => ({ ...t }));
}

/** Test seam: forget every task. */
export function resetTasks(): void {
	const s = state();
	s.tasks.clear();
	s.aborts.clear();
}
