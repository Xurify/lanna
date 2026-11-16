"use client";

/**
 * Tasks (/tasks, 2026-11-05): every background task (src/server/tasks.ts),
 * running first, then the finished ones, newest first, until the learner
 * removes them. The sidebar's Background section shows what runs; the ready
 * card says what just finished; this page is where both stay. The list is
 * the activity feed, so it moves on its own. It is in memory: a server
 * restart empties it, and the videos it prepared stay in Watch, the
 * languages it added in the language menu.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, LoaderCircleIcon, SquareIcon, XIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { EmptyState } from "@/components/quiet/empty-state";
import { formatElapsed, useActivity, type FeedTask } from "@/components/activity-dock";
import { retryTask, stopTask, taskAction } from "@/components/task-actions";
import { addLanguage, switchLanguage } from "@/components/switch-language";
import { useActiveLanguage } from "@/components/speech";

const KIND_LABEL: Record<FeedTask["kind"], string> = { video: "Video preparation", language: "Adding a language" };

export function TasksPage({ tasks: tasksProp }: { tasks?: FeedTask[] } = {}) {
	const { feed, refresh } = useActivity();
	const [busy, setBusy] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const tasks = tasksProp ?? feed.tasks;
	const running = tasks.filter((t) => t.status === "running").sort((a, b) => a.startedAt - b.startedAt);
	const finished = tasks
		.filter((t) => t.status !== "running")
		.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

	const act = async (id: string, run: () => Promise<unknown>) => {
		setBusy(id);
		setNote(null);
		try {
			await run();
		} catch (err) {
			setNote(err instanceof Error ? err.message : String(err));
		}
		setBusy(null);
		refresh();
	};

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lanna-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="tasks">
				<Link href="/" className="inline-flex min-h-6 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="q-ico size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Tasks</h1>
				<p className="q-line dim mt-2 max-w-2xl">
					Work that runs in the background, so a page does not have to wait: preparing a video, adding a language. What
					runs shows here and in the sidebar; what finished stays until you remove it.
				</p>

				{tasks.length === 0 && (
					<EmptyState
						className="mt-8"
						testid="tasks-empty"
						title="No tasks yet"
						action={
							<Link href="/watch" className="q-btn primary pointer-coarse:min-h-11">
								Prepare a video
							</Link>
						}
					>
						<p>
							When you prepare a video or add a language, it runs here and you can leave the page. It stays on this list
							when it is done.
						</p>
					</EmptyState>
				)}

				{running.length > 0 && (
					<>
						<h2 className="q-sh mt-8">
							Running<small>{running.length}</small>
						</h2>
						<ul className="flex flex-col gap-2" data-testid="tasks-running">
							{running.map((t) => (
								<TaskRow key={t.id} task={t} line={t.step}>
									<button
										type="button"
										disabled={busy === t.id}
										onClick={() => void act(t.id, () => stopTask(t.id))}
										className="q-btn ghost pointer-coarse:min-h-11"
										data-testid="task-stop"
									>
										<SquareIcon className="q-ico size-3" />
										Stop
									</button>
								</TaskRow>
							))}
						</ul>
					</>
				)}

				{finished.length > 0 && (
					<>
						<h2 className="q-sh mt-8">
							Finished<small>{finished.length}</small>
						</h2>
						<ul className="flex flex-col gap-2" data-testid="tasks-finished">
							{finished.map((t) => (
								<TaskRow key={t.id} task={t} line={t.status === "done" ? (t.note ?? "Ready") : (t.error ?? "Failed")}>
									{t.status === "done" && t.href && (
										<Link href={t.href} className="q-btn sec pointer-coarse:min-h-11" data-testid="task-open">
											Open
										</Link>
									)}
									{t.status === "done" && t.language && (
										<button
											type="button"
											disabled={busy === t.id}
											onClick={() => void act(t.id, () => switchLanguage(t.language!.id, t.language!.english))}
											className="q-btn sec pointer-coarse:min-h-11"
											data-testid="task-switch"
										>
											Switch to {t.language.english}
										</button>
									)}
									{t.status === "error" && t.language && (
										<button
											type="button"
											disabled={busy === t.id}
											onClick={() =>
												void act(t.id, async () => {
													await taskAction({ action: "remove", id: t.id });
													await addLanguage(t.language!.id);
												})
											}
											className="q-btn sec pointer-coarse:min-h-11"
											data-testid="task-retry"
										>
											Try again
										</button>
									)}
									{t.status === "error" && t.retry && (
										<button
											type="button"
											disabled={busy === t.id}
											onClick={() =>
												void act(
													t.id,
													async () => (await retryTask(t)) && (await taskAction({ action: "remove", id: t.id })),
												)
											}
											className="q-btn sec pointer-coarse:min-h-11"
											data-testid="task-retry"
										>
											{t.retry.label}
										</button>
									)}
									<button
										type="button"
										disabled={busy === t.id}
										onClick={() => void act(t.id, () => taskAction({ action: "remove", id: t.id }))}
										aria-label={`Remove ${t.title}`}
										className="q-btn ghost pointer-coarse:min-h-11"
										data-testid="task-remove"
									>
										<XIcon className="q-ico size-3.5" />
									</button>
								</TaskRow>
							))}
						</ul>
						{note && (
							<p className="q-line dim mt-3" role="status">
								{note}
							</p>
						)}
						<button
							type="button"
							onClick={() => void act("clear", () => taskAction({ action: "clear" }))}
							className="q-btn ghost mt-3 pointer-coarse:min-h-11"
							data-testid="tasks-clear"
						>
							Clear finished
						</button>
					</>
				)}
			</main>
		</div>
	);
}

function TaskRow({ task, line, children }: { task: FeedTask; line: string; children: React.ReactNode }) {
	const lang = useActiveLanguage();
	const ms = (task.finishedAt ?? Date.now()) - task.startedAt;
	return (
		<li className="q-card flex items-center gap-3 px-4 py-3" data-testid={`task-${task.status}`}>
			{task.status === "running" ? (
				<LoaderCircleIcon className="size-4 shrink-0 animate-spin text-ink-3" />
			) : task.status === "done" ? (
				<CheckIcon className="size-4 shrink-0 text-teal-2" />
			) : (
				<XIcon className="size-4 shrink-0 text-miss" />
			)}
			<span className="min-w-0 flex-1">
				<span
					className="block truncate font-ui text-[15px] font-[600] text-foreground"
					lang={task.kind === "video" ? lang?.code : undefined}
					title={task.title}
				>
					{task.title}
				</span>
				<span className="block font-prose text-[13px] text-ink-3">
					{KIND_LABEL[task.kind]} · {line}
					{task.status !== "running" && <> · took {formatElapsed(ms)}</>}
				</span>
			</span>
			<span className="flex shrink-0 items-center gap-1">{children}</span>
		</li>
	);
}
