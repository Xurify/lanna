import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	ActivitySection,
	formatElapsed,
	toBlobs,
	type ActivityFeed,
	type FeedTask,
} from "../components/activity-dock.tsx";
import { TaskNotice } from "../components/task-notice.tsx";
import { TasksPage } from "../components/tasks-page.tsx";
import { formatTokens, formatUsd } from "../components/usage-format.ts";

// The section's pure layer: the running tasks as rows, the elapsed format —
// then the SSR render (rows, the abort affordance, the always-present header).

const NOW = Date.parse("2026-09-09T12:00:00Z");

const feedOf = (tasks: FeedTask[]): ActivityFeed => ({ tasks });

describe("activity dock pure layer", () => {
	it("formatElapsed ticks compactly", () => {
		assert.equal(formatElapsed(45_000), "45s");
		assert.equal(formatElapsed(184_000), "3m 04s");
		assert.equal(formatElapsed(4_320_000), "1h 12m");
	});

	it("formatUsd keeps four decimals under $1, two above", () => {
		assert.equal(formatUsd(0.0014), "$0.0014");
		assert.equal(formatUsd(1.5), "$1.50");
	});

	it("formatTokens trims (never 38.0k)", () => {
		assert.equal(formatTokens(38_000), "38k");
		assert.equal(formatTokens(1_234_567), "1.2M");
		assert.equal(formatTokens(950), "950");
	});
});

describe("activity section render", () => {
	const task = (over: Partial<FeedTask> = {}): FeedTask => ({
		id: "video:aaaaaaaaaaa",
		kind: "video",
		title: "Bratislava za jeden deň",
		step: "Translating",
		status: "running",
		startedAt: NOW - 20_000,
		...over,
	});

	it("renders the ALWAYS-PRESENT header when idle — empty means empty, nothing hides", () => {
		const html = renderToStaticMarkup(<ActivitySection feed={feedOf([])} />);
		assert.match(html, /data-testid="activity-section"/);
		assert.match(html, /Background/);
		assert.doesNotMatch(html, /activity-blob-task/, "no rows while idle");
		assert.doesNotMatch(html, /\/tasks/, "no Tasks link while nothing is listed");
	});

	it("a background task's row opens the Tasks page instead of a detail that repeats it", () => {
		const html = renderToStaticMarkup(
			<ActivitySection
				feed={feedOf([
					task({
						id: "language:estonian",
						kind: "language",
						title: "Adding Estonian",
						step: "Downloading English translations · 3 MB",
						startedAt: NOW - 7_000,
						language: { id: "estonian", english: "Estonian" },
					}),
				])}
			/>,
		);
		assert.match(html, /data-testid="activity-task-link"[^>]*>|href="\/tasks"[^>]*data-testid="activity-task-link"/);
		assert.equal(html.match(/>Adding Estonian</g)?.length, 1, "the title shows once");
		assert.doesNotMatch(html, /aria-expanded/);
		assert.match(html, /data-testid="activity-abort"/, "a running task can still be stopped");
	});

	it("names the running task's step on its row, with elapsed time and the end control", () => {
		const html = renderToStaticMarkup(<ActivitySection feed={feedOf([task()])} />);
		assert.match(html, /data-testid="activity-blob-task"/);
		assert.match(html, /Bratislava za jeden deň/);
		assert.match(html, /Translating/);
		assert.match(html, /data-testid="activity-blob-elapsed"/);
		assert.match(html, /data-testid="activity-abort"/);
		assert.match(html, /aria-label="End Video preparation in Bratislava za jeden deň"/);
		assert.doesNotMatch(html, /activity-blob-cost|activity-total-cost|activity-blob-detail/);
	});

	it("the sidebar section links to the Tasks page while any task is listed", () => {
		const finishedOnly = renderToStaticMarkup(<ActivitySection feed={feedOf([task({ status: "done" })])} />);
		assert.match(finishedOnly, /href="\/tasks"/);
		assert.doesNotMatch(renderToStaticMarkup(<ActivitySection feed={feedOf([])} />), /\/tasks/);
	});
});

describe("background tasks in the dock and the notice", () => {
	const task = (over: Partial<FeedTask> = {}): FeedTask => ({
		id: "video:aaaaaaaaaaa",
		kind: "video",
		title: "Bratislava za jeden deň",
		step: "Translating",
		status: "running",
		startedAt: NOW - 20_000,
		...over,
	});

	it("only running tasks are rows, oldest first; a finished one is not", () => {
		const blobs = toBlobs(
			feedOf([
				task({ id: "video:ccccccccccc", startedAt: NOW - 5_000 }),
				task(),
				task({ id: "video:bbbbbbbbbbb", status: "done" }),
			]),
		);
		assert.deepEqual(
			blobs.map((b) => b.id),
			["video:aaaaaaaaaaa", "video:ccccccccccc"],
			"oldest first, the done task left out",
		);
		assert.equal(blobs[0]!.activity, "Translating");
	});

	it("the notice shows a finished video with Open, a failure with its reason and retry, and nothing for a running task", () => {
		assert.equal(renderToStaticMarkup(<TaskNotice tasks={[task()]} />), "");
		const done = renderToStaticMarkup(
			<TaskNotice tasks={[task({ status: "done", href: "/watch?id=aaaaaaaaaaa", step: "Ready" })]} />,
		);
		assert.match(done, /Video ready/);
		assert.match(done, /href="\/watch\?id=aaaaaaaaaaa"/);
		const failed = renderToStaticMarkup(
			<TaskNotice
				tasks={[
					task({
						status: "error",
						error: "No captions.",
						retry: { label: "Transcribe the audio", url: "u", transcribe: true },
					}),
				]}
			/>,
		);
		assert.match(failed, /No captions\./);
		assert.match(failed, /Transcribe the audio/);
		assert.doesNotMatch(failed, /task-notice-open/);
	});

	it("a closed notice stays off the screen but on the Tasks page, which lists running first and finished with their actions", () => {
		const closed = task({
			id: "video:ccccccccccc",
			status: "done",
			href: "/watch?id=ccccccccccc",
			dismissed: true,
			finishedAt: NOW - 1000,
		});
		assert.equal(renderToStaticMarkup(<TaskNotice tasks={[closed]} />), "");
		const failed = task({
			id: "video:ddddddddddd",
			status: "error",
			error: "No captions.",
			finishedAt: NOW - 500,
			retry: { label: "Transcribe the audio", url: "u", transcribe: true },
		});
		const html = renderToStaticMarkup(<TasksPage tasks={[closed, task(), failed]} />);
		assert.ok(html.indexOf("tasks-running") < html.indexOf("tasks-finished"), "running first");
		assert.match(html, /data-testid="task-stop"/);
		assert.match(html, /data-testid="task-open"/);
		assert.match(html, /data-testid="task-retry"/);
		assert.match(html, /data-testid="tasks-clear"/);
		assert.match(html, /No captions\./);
		assert.match(renderToStaticMarkup(<TasksPage tasks={[]} />), /No tasks yet/);
	});
});
