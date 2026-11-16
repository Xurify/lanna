import type { FeedTask } from "@/components/activity-dock";

const JSON_POST = { method: "POST", headers: { "content-type": "application/json" } } as const;

/** Close a notice, take a task off the Tasks page, or clear the finished ones. */
export async function taskAction(
	body: { action: "dismiss" | "remove"; id: string } | { action: "clear" },
): Promise<boolean> {
	try {
		return (await fetch("/api/tasks", { ...JSON_POST, body: JSON.stringify(body) })).ok;
	} catch {
		return false;
	}
}

/** Ask a running task to stop (409 means it already ended). */
export async function stopTask(id: string): Promise<void> {
	try {
		await fetch("/api/activity/abort", { ...JSON_POST, body: JSON.stringify({ kind: "task", id }) });
	} catch {
		// the next feed says whether it stopped
	}
}

/** Start a failed task again in the one step it offers. */
export async function retryTask(task: FeedTask): Promise<boolean> {
	if (!task.retry) return false;
	try {
		const res = await fetch("/api/watch", {
			...JSON_POST,
			body: JSON.stringify({ action: "add", url: task.retry.url, transcribe: task.retry.transcribe, background: true }),
		});
		return res.ok;
	} catch {
		return false;
	}
}
