"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { useActivity, type FeedTask } from "@/components/activity-dock";
import { retryTask, taskAction } from "@/components/task-actions";
import { addLanguage, switchLanguage } from "@/components/switch-language";

/**
 * The ready notice for background tasks (src/server/tasks.ts): one card per
 * finished task, anywhere in the app, until the learner closes it, so a
 * video that finished while they were on another page is not missed. A
 * failure says why and, when the server offers one, a one-step retry (a video
 * with no captions can be transcribed from its audio). Closing a card keeps
 * the task on the Tasks page (app/tasks). Running tasks live in the sidebar's
 * Background section, not here. A language that finished adding offers the
 * switch to it; one that failed offers to try again, which continues where
 * it stopped.
 */

const TASK_HEADLINE: Record<FeedTask["kind"], Record<"done" | "error", string>> = {
	video: { done: "Video ready", error: "Video not prepared" },
	language: { done: "Language added", error: "Language not added" },
};

export function TaskNotice({ tasks }: { tasks?: FeedTask[] } = {}) {
	const { feed, refresh } = useActivity();
	const [busy, setBusy] = useState<string | null>(null);
	const [lines, setLines] = useState<Record<string, string>>({});
	const finished = (tasks ?? feed.tasks).filter((t) => t.status !== "running" && !t.dismissed);
	if (finished.length === 0) return null;

	const dismiss = async (id: string) => {
		setBusy(id);
		await taskAction({ action: "dismiss", id });
		setBusy(null);
		refresh();
	};

	const say = (id: string, err: unknown) => setLines((l) => ({ ...l, [id]: err instanceof Error ? err.message : String(err) }));

	const switchTo = async (task: FeedTask) => {
		if (!task.language) return;
		setBusy(task.id);
		try {
			const { restartNote } = await switchLanguage(task.language.id, task.language.english);
			if (restartNote) setLines((l) => ({ ...l, [task.id]: restartNote }));
		} catch (err) {
			say(task.id, err);
		}
		setBusy(null);
	};

	const addAgain = async (task: FeedTask) => {
		if (!task.language) return;
		setBusy(task.id);
		try {
			await taskAction({ action: "remove", id: task.id });
			await addLanguage(task.language.id);
		} catch (err) {
			say(task.id, err);
		}
		setBusy(null);
		refresh();
	};

	const retry = async (task: FeedTask) => {
		setBusy(task.id);
		if (await retryTask(task)) await taskAction({ action: "dismiss", id: task.id });
		setBusy(null);
		refresh();
	};

	return (
		<div data-testid="task-notice" className="fixed right-4 bottom-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
			{finished.map((task) => (
				<div key={task.id} data-testid={`task-notice-${task.status}`} className="relative rounded-lg bg-card py-3 pr-9 pl-4 shadow-raise-hi">
					<p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
						{task.status === "done" && <CheckIcon className="size-3.5" />}
						{TASK_HEADLINE[task.kind]?.[task.status === "done" ? "done" : "error"] ?? task.title}
					</p>
					<p className="mt-0.5 truncate text-sm font-medium text-card-foreground" title={task.title}>
						{task.title}
					</p>
					{task.status === "error" && <p className="mt-0.5 text-xs text-muted-foreground">{task.error}</p>}
					{task.status === "done" && task.note && <p className="mt-0.5 text-xs text-muted-foreground">{task.note}</p>}
					{lines[task.id] && <p className="mt-0.5 text-xs text-muted-foreground">{lines[task.id]}</p>}
					<div className="mt-2 flex gap-2 text-sm">
						{task.status === "done" && task.href && (
							<Link href={task.href} onClick={() => void dismiss(task.id)} className="font-medium text-primary hover:underline" data-testid="task-notice-open">
								Open
							</Link>
						)}
						{task.status === "done" && task.language && (
							<button type="button" disabled={busy === task.id} onClick={() => void switchTo(task)} className="font-medium text-primary hover:underline disabled:opacity-50" data-testid="task-notice-switch">
								Switch to {task.language.english}
							</button>
						)}
						{task.status === "error" && task.language && (
							<button type="button" disabled={busy === task.id} onClick={() => void addAgain(task)} className="font-medium text-primary hover:underline disabled:opacity-50" data-testid="task-notice-retry">
								Try again
							</button>
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
