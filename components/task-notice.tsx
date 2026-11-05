"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { useActivity, type FeedTask } from "@/components/activity-dock";

/**
 * The ready notice for background tasks (src/server/tasks.ts): one card per
 * finished task, anywhere in the app, until the learner dismisses it, so a
 * video that finished while they were on another page is not missed. A
 * failure says why and, when the server offers one, a one-step retry (a video
 * with no captions can be transcribed from its audio). Running tasks live in
 * the sidebar's Background section, not here.
 */
export function TaskNotice({ tasks }: { tasks?: FeedTask[] } = {}) {
	const { feed, refresh } = useActivity();
	const [busy, setBusy] = useState<string | null>(null);
	const finished = (tasks ?? feed.tasks).filter((t) => t.status !== "running");
	if (finished.length === 0) return null;

	const dismiss = async (id: string) => {
		setBusy(id);
		try {
			await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "dismiss", id }) });
		} catch {
			// the card stays; the next feed says what is left
		}
		setBusy(null);
		refresh();
	};

	const retry = async (task: FeedTask) => {
		if (!task.retry) return;
		setBusy(task.id);
		try {
			const res = await fetch("/api/watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", url: task.retry.url, transcribe: task.retry.transcribe, background: true }) });
			if (res.ok) await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "dismiss", id: task.id }) });
		} catch {
			// the card stays, so the learner can try again
		}
		setBusy(null);
		refresh();
	};

	return (
		<div data-testid="task-notice" className="fixed right-4 bottom-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
			{finished.map((task) => (
				<div key={task.id} data-testid={`task-notice-${task.status}`} className="relative rounded-lg bg-card py-3 pr-9 pl-4 shadow-raise-hi">
					<p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
						{task.status === "done" && <CheckIcon className="size-3.5" />}
						{task.status === "done" ? "Video ready" : "Video not prepared"}
					</p>
					<p className="mt-0.5 truncate text-sm font-medium text-card-foreground" title={task.title}>
						{task.title}
					</p>
					{task.status === "error" && <p className="mt-0.5 text-xs text-muted-foreground">{task.error}</p>}
					<div className="mt-2 flex gap-2 text-sm">
						{task.status === "done" && task.href && (
							<Link href={task.href} onClick={() => void dismiss(task.id)} className="font-medium text-primary hover:underline" data-testid="task-notice-open">
								Open
							</Link>
						)}
						{task.status === "error" && task.retry && (
							<button type="button" disabled={busy === task.id} onClick={() => void retry(task)} className="font-medium text-primary hover:underline disabled:opacity-50" data-testid="task-notice-retry">
								{task.retry.label}
							</button>
						)}
					</div>
					<button
						type="button"
						onClick={() => void dismiss(task.id)}
						disabled={busy === task.id}
						aria-label={`Dismiss ${task.title}`}
						data-testid="task-notice-dismiss"
						className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
					>
						<XIcon className="size-3.5" />
					</button>
				</div>
			))}
		</div>
	);
}
