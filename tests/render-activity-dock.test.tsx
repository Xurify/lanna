import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ActivitySection, formatElapsed, toBlobs, type ActivityFeed, type FeedExtraction, type FeedTask } from "../components/activity-dock.tsx";
import { TaskNotice } from "../components/task-notice.tsx";
import { TasksPage } from "../components/tasks-page.tsx";
import { formatTokens, formatUsd } from "../components/usage-format.ts";
import { jobCost } from "../src/server/pricing.ts";

// The section's pure layer: folds, formatting, and blob order — then the SSR
// render (blobs, "—" doctrine, the abort affordance, the always-present
// header — the sidebar's background-agents strip).

const NOW = Date.parse("2026-09-09T12:00:00Z");

/** A full CallUsage (its fields are undefined-valued, not optional). */
function step(inputTokens: number, outputTokens: number) {
	return { inputTokens, outputTokens, cacheReadTokens: undefined, cacheWriteTokens: undefined, reasoningTokens: undefined };
}

function job(over: Partial<ActivityFeed["jobs"][number]> = {}): ActivityFeed["jobs"][number] {
	return {
		id: "job-1",
		kind: "research",
		chatId: "c1",
		toolCallId: "t1",
		status: "running",
		activity: 'web_search: "sigma.js v3"',
		createdAt: new Date(NOW - 45_000).toISOString(),
		updatedAt: new Date(NOW - 1000).toISOString(),
		title: "Limits lesson",
		contextLimit: null,
		costUsd: jobCost({ usage: over.usage }),
		...over,
	};
}

describe("activity dock pure layer", () => {
	it("merges jobs + extractions oldest-first (the stable blob order)", () => {
		const feed: ActivityFeed = {
			jobs: [job({ id: "new", createdAt: new Date(NOW - 10_000).toISOString() })],
			extractions: [{ id: "cx", chatId: "cx", title: "Old lesson", phase: "auditing", startedAt: NOW - 100_000 }],
			tasks: [],
		};
		const blobs = toBlobs(feed);
		assert.equal(blobs.length, 2);
		const first = blobs[0]!;
		assert.equal(first.id, "cx"); // extraction started first
		assert.equal(first.process, "extraction");
		assert.equal(first.phase, "auditing");
		assert.equal(blobs[1]!.id, "new");
	});

	it("per-chunk jobs (owner, 2026-09-28): one source, N rows — unique ids (React keys), one chatId, part-suffixed titles", () => {
		const rows = [
			{ id: "src_a#1", chatId: "src_a", part: { i: 1, n: 2 }, title: "notes.md · 1/2", phase: "extracting", startedAt: NOW - 1000 },
			{ id: "src_a#2", chatId: "src_a", part: { i: 2, n: 2 }, title: "notes.md · 2/2", phase: "queued", startedAt: NOW - 500 },
		] as FeedExtraction[];
		const blobs = toBlobs({ jobs: [], extractions: rows, tasks: [] });
		assert.equal(blobs.length, 2, "one blob per chunk job");
		assert.deepEqual(blobs.map((b) => b.id), ["src_a#1", "src_a#2"], "unique row ids — no duplicate React keys");
		assert.ok(blobs.every((b) => b.chatId === "src_a"), "abort/link identity stays source-scoped");
	});

	it("uses the server's Pi price projection; absent pricing is null, never zero", () => {
		const priced = job({
			usage: {
				model: "openrouter:z-ai/glm-5.3-flash",
				inputTokens: 10_000,
				outputTokens: 1000,
				cacheReadTokens: 5000,
				cacheWriteTokens: 0,
				reasoningTokens: 0,
				steps: 2,
			},
		});
		const blob = toBlobs({ jobs: [priced], extractions: [], tasks: [] })[0]!;
		// Pi-normalized fresh input is priced directly, never reduced by reads.
		assert.equal(blob.cost, 0.00215);
		const missingProjection = toBlobs({ jobs: [{ ...priced, costUsd: undefined }], extractions: [], tasks: [] })[0]!;
		assert.equal(missingProjection.cost, null, "the browser must not invent a fallback price");
		const absent = toBlobs({ jobs: [job()], extractions: [], tasks: [] })[0]!;
		assert.equal(absent.cost, null);
	});

	it("a key-refused job reads as info — 'needs a provider key' (zero-keys wave, 66dbea9)", () => {
		const refused = job({
			status: "error",
			activity: "failed",
			// the runner composes the envelope's error verbatim (invariant tail)
			error: "No OpenRouter key is set — add one in Settings → API keys",
		});
		const blob = toBlobs({ jobs: [refused], extractions: [], tasks: [] })[0]!;
		assert.equal(blob.activity, "needs a provider key");
	});

	it("a models-refused job reads as info — 'needs model setup', not 'failed' (BYOK, 2026-09-22)", () => {
		const refused = job({
			status: "error",
			activity: "failed",
			error: "No model configured — set up your models first (missing: vision)",
		});
		const blob = toBlobs({ jobs: [refused], extractions: [], tasks: [] })[0]!;
		assert.equal(blob.activity, "needs model setup");
		// A real failure keeps the runner's honest wording.
		const crashed = job({ status: "error", activity: "failed", error: "FAILED: headless crashed" });
		const real = toBlobs({ jobs: [crashed], extractions: [], tasks: [] })[0]!;
		assert.equal(real.activity, "failed");
	});

	it("context line = LAST step's tokens vs the model limit, never a cumulative sum", () => {
		const base = {
			model: "openrouter:z-ai/glm-5.3-flash",
			inputTokens: 400_000, // running total (much bigger — must NOT feed the line)
			outputTokens: 8_000,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			reasoningTokens: 0,
			steps: 5,
		};
		const withLast = job({
			usage: { ...base, lastStep: step(90_000, 2_000) },
			// The amendment (owner 2026-09-23): the limit is the server's
			// live-catalog join riding the feed — the dock never resolves it.
			contextLimit: 131_072,
		});
		const blob = toBlobs({ jobs: [withLast], extractions: [], tasks: [] })[0]!;
		assert.equal(blob.context?.used, 92_000);
		assert.equal(blob.context?.limit, 131_072);
		// No lastStep yet (capture pending) → "—", even though usage exists.
		const stripped = toBlobs({ jobs: [job({ usage: { ...base } })], extractions: [], tasks: [] })[0]!;
		assert.equal(stripped.context, null);
		// Model missing from the live catalog (historical session,
		// package update) → the feed carries null → no context line.
		const uncatalogued = toBlobs({
			jobs: [job({ usage: { ...base, model: "nope/unknown", lastStep: step(5, 5), } })],
			extractions: [],
			tasks: [],
		})[0]!;
		assert.equal(uncatalogued.context, null);
		// The numerator is the same cache-inclusive fold the session meter
		// uses (context-meter audit, owner 2026-09-23): provider "input"
		// EXCLUDES cacheRead/cacheWrite, so input+output alone reads wildly
		// low on cache-heavy jobs — 10k+0.5k+120k+30k = 160.5k, not 10.5k.
		const cached = toBlobs({
			jobs: [
				job({
					usage: {
						...base,
						lastStep: {
							inputTokens: 10_000,
							outputTokens: 500,
							cacheReadTokens: 120_000,
							cacheWriteTokens: 30_000,
							reasoningTokens: undefined,
						},
					},
					contextLimit: 200_000,
				}),
			],
			extractions: [],
			tasks: [],
		})[0]!;
		assert.equal(cached.context?.used, 160_500);
		assert.equal(cached.context?.limit, 200_000);
	});

	it("extraction blobs carry no money/context (—, the doctrine)", () => {
		const blob = toBlobs({
			jobs: [],
			extractions: [{ id: "cx", chatId: "cx", title: "T", phase: "extracting", startedAt: NOW }],
			tasks: [],
		})[0]!;
		assert.equal(blob.cost, null);
		assert.equal(blob.context, null);
	});

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
	it("renders the ALWAYS-PRESENT header when idle — empty means empty, nothing hides", () => {
		const html = renderToStaticMarkup(<ActivitySection feed={{ jobs: [], extractions: [], tasks: [] }} />);
		assert.match(html, /data-testid="activity-section"/);
		assert.match(html, /Background/);
		assert.doesNotMatch(html, /activity-blob-(job|extraction)/, "no rows while idle");
		assert.doesNotMatch(html, /activity-total-cost/, "the cost span is population, not decoration");
	});

	it("renders one blob per running process with cost, elapsed, and the abort affordance", () => {
		const html = renderToStaticMarkup(
			<ActivitySection
				feed={{
					jobs: [job({ id: "j1", kind: "demo", activity: "building sandbox…", title: "Chain-rule demo" })],
					extractions: [{ id: "cx", chatId: "cx", title: "Old lesson", phase: "merging", startedAt: NOW - 60_000 }],
					tasks: [],
				}}
			/>,
		);
		assert.match(html, /data-testid="activity-section"/);
		assert.match(html, /data-testid="activity-blob-job"/);
		assert.match(html, /data-testid="activity-blob-extraction"/);
		assert.match(html, /Chain-rule demo/);
		assert.match(html, /building sandbox…/);
		assert.match(html, /Extraction — merging/);
		// Unpriced job → "—", never $0.0000 (doctrine); both blobs show it.
		assert.match(html, /activity-blob-cost[^>]*>—</);
		assert.match(html, /data-testid="activity-abort"/, "END on the blob face, popover-independent");
		assert.match(html, /\bEnd\b/, "the explicit END button");
		assert.match(html, /Background/);
		// Total cost: nothing priced → "—" in the header.
		assert.match(html, /activity-total-cost[^>]*>—</);
		// Truncation-reveals KEEP native title (tooltip wave mechanism rule):
		// the truncated activity + title spans carry title= — a styled
		// tooltip adds nothing over an ellipsis reveal.
		assert.match(html, /title="building sandbox…"/);
	});


	it("a background task's row opens the Tasks page instead of a detail that repeats it", () => {
		const html = renderToStaticMarkup(
			<ActivitySection
				feed={{
					jobs: [],
					extractions: [],
					tasks: [{ id: "language:estonian", kind: "language", title: "Adding Estonian", step: "Downloading English translations · 3 MB", status: "running", startedAt: NOW - 7_000, language: { id: "estonian", english: "Estonian" } }],
				}}
			/>,
		);
		assert.match(html, /data-testid="activity-task-link"[^>]*>|href="\/tasks"[^>]*data-testid="activity-task-link"/);
		assert.equal(html.match(/>Adding Estonian</g)?.length, 1, "the title shows once");
		assert.doesNotMatch(html, /aria-expanded/);
		assert.match(html, /data-testid="activity-abort"/, "a running task can still be stopped");
	});

	it("shows total running cost when jobs are priced", () => {
		const usage = {
			model: "openrouter:z-ai/glm-5.3-flash",
			inputTokens: 10_000,
			outputTokens: 1000,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			reasoningTokens: 0,
			steps: 1,
		};
		const html = renderToStaticMarkup(
			<ActivitySection
				feed={{
					jobs: [
						job({ id: "a", usage }),
						job({ id: "b", usage, createdAt: new Date(NOW - 20_000).toISOString() }),
					],
					extractions: [],
					tasks: [],
				}}
			/>,
		);
		// two identical priced jobs → 2 × $0.002 = $0.0040 total (pi prices,
		// glm-5.3-flash drifted in pi-ai 0.87.1)
		assert.match(html, /activity-total-cost[^>]*>\$0\.0040</);
	});
});
describe("background tasks in the dock and the notice", () => {
	const task = (over: Partial<FeedTask> = {}): FeedTask => ({ id: "video:aaaaaaaaaaa", kind: "video", title: "Bratislava za jeden deň", step: "Translating", status: "running", startedAt: NOW - 20_000, ...over });

	it("a running task is a blob with its step; a finished one is not", () => {
		const blobs = toBlobs({ jobs: [job()], extractions: [], tasks: [task(), task({ id: "video:bbbbbbbbbbb", status: "done" })] });
		assert.deepEqual(blobs.map((b) => b.process), ["job", "task"], "oldest first");
		assert.equal(blobs[1]!.activity, "Translating");
		assert.equal(blobs[1]!.cost, null);
	});

	it("the section lists the task with an end control and no session link or cost", () => {
		const html = renderToStaticMarkup(<ActivitySection feed={{ jobs: [], extractions: [], tasks: [task()] }} />);
		assert.match(html, /data-testid="activity-blob-task"/);
		assert.match(html, /Bratislava za jeden deň/);
		assert.match(html, /Translating/);
		assert.match(html, /data-testid="activity-abort"/);
		assert.doesNotMatch(html, /activity-blob-cost/);
	});

	it("the notice shows a finished video with Open, a failure with its reason and retry, and nothing for a running task", () => {
		assert.equal(renderToStaticMarkup(<TaskNotice tasks={[task()]} />), "");
		const done = renderToStaticMarkup(<TaskNotice tasks={[task({ status: "done", href: "/watch?id=aaaaaaaaaaa", step: "Ready" })]} />);
		assert.match(done, /Video ready/);
		assert.match(done, /href="\/watch\?id=aaaaaaaaaaa"/);
		const failed = renderToStaticMarkup(<TaskNotice tasks={[task({ status: "error", error: "No captions.", retry: { label: "Transcribe the audio", url: "u", transcribe: true } })]} />);
		assert.match(failed, /No captions\./);
		assert.match(failed, /Transcribe the audio/);
		assert.doesNotMatch(failed, /task-notice-open/);
	});

	it("a closed notice stays off the screen but on the Tasks page, which lists running first and finished with their actions", () => {
		const closed = task({ id: "video:ccccccccccc", status: "done", href: "/watch?id=ccccccccccc", dismissed: true, finishedAt: NOW - 1000 });
		assert.equal(renderToStaticMarkup(<TaskNotice tasks={[closed]} />), "");
		const failed = task({ id: "video:ddddddddddd", status: "error", error: "No captions.", finishedAt: NOW - 500, retry: { label: "Transcribe the audio", url: "u", transcribe: true } });
		const html = renderToStaticMarkup(<TasksPage tasks={[closed, task(), failed]} />);
		assert.ok(html.indexOf("tasks-running") < html.indexOf("tasks-finished"), "running first");
		assert.match(html, /data-testid="task-stop"/);
		assert.match(html, /data-testid="task-open"/);
		assert.match(html, /data-testid="task-retry"/);
		assert.match(html, /data-testid="tasks-clear"/);
		assert.match(html, /No captions\./);
		assert.match(renderToStaticMarkup(<TasksPage tasks={[]} />), /No tasks yet/);
	});

	it("the sidebar section links to the Tasks page while any task is listed", () => {
		const finishedOnly = renderToStaticMarkup(<ActivitySection feed={{ jobs: [], extractions: [], tasks: [task({ status: "done" })] }} />);
		assert.match(finishedOnly, /href="\/tasks"/);
		assert.doesNotMatch(renderToStaticMarkup(<ActivitySection feed={{ jobs: [], extractions: [], tasks: [] }} />), /\/tasks/);
	});
});
