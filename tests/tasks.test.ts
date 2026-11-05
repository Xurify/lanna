/**
 * BACKGROUND TASKS (2026-11-05): the registry behind the sidebar's
 * Background section and the ready notice. No model is called here.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

const { abortTask, dismissTask, failTask, finishTask, listTasks, resetTasks, startTask, TASKS_KEPT, updateTask } = await import("../src/server/tasks.ts");
const { subscribe } = await import("../src/core/events.ts");

beforeEach(() => resetTasks());

const init = (id: string, now = 1) => ({ id, kind: "video" as const, title: id, step: "Fetching", now });

describe("task registry", () => {
	test("a task runs, reports its step, and ends done with where the result is", () => {
		const { task, fresh } = startTask(init("video:a"));
		assert.equal(fresh, true);
		assert.equal(task.status, "running");
		updateTask("video:a", { step: "Translating", title: "Real title" });
		finishTask("video:a", { href: "/watch?id=a" });
		const [t] = listTasks();
		assert.deepEqual({ status: t!.status, step: t!.step, title: t!.title, href: t!.href }, { status: "done", step: "Ready", title: "Real title", href: "/watch?id=a" });
		assert.ok(t!.finishedAt);
	});

	test("starting a running id shares the first task and its signal", () => {
		const a = startTask(init("video:a"));
		const b = startTask(init("video:a"));
		assert.equal(b.fresh, false);
		assert.equal(b.signal, a.signal);
		assert.equal(listTasks().length, 1);
	});

	test("a failed task keeps its error and an offered retry; a finished id can start again", () => {
		startTask(init("video:a"));
		failTask("video:a", "No captions.", { label: "Transcribe the audio", url: "u", transcribe: true });
		const [t] = listTasks();
		assert.equal(t!.status, "error");
		assert.equal(t!.error, "No captions.");
		assert.equal(t!.retry?.transcribe, true);
		updateTask("video:a", { step: "ignored" });
		assert.equal(listTasks()[0]!.step, "Failed", "an ended task is not updated");
		assert.equal(startTask(init("video:a", 5)).fresh, true);
		assert.equal(listTasks()[0]!.status, "running");
		assert.equal(listTasks()[0]!.retry, undefined);
	});

	test("abort fires the signal of a running task only", () => {
		const { signal } = startTask(init("video:a"));
		assert.equal(abortTask("video:a"), true);
		assert.equal(signal.aborted, true);
		assert.equal(abortTask("video:nope"), false);
		failTask("video:a", "Stopped.");
		assert.equal(abortTask("video:a"), false);
	});

	test("dismiss removes a finished task and leaves a running one", () => {
		startTask(init("video:a"));
		assert.equal(dismissTask("video:a"), false);
		finishTask("video:a");
		assert.equal(dismissTask("video:a"), true);
		assert.equal(listTasks().length, 0);
		assert.equal(dismissTask("video:a"), false);
	});

	test("only the newest finished tasks are kept, running ones never dropped", () => {
		startTask(init("video:running", 0));
		for (let i = 0; i < TASKS_KEPT + 3; i++) {
			startTask(init(`video:${i}`, i + 1));
			finishTask(`video:${i}`);
		}
		const ids = listTasks().map((t) => t.id);
		assert.equal(ids.length, TASKS_KEPT + 1);
		assert.ok(ids.includes("video:running"));
	});

	test("every change announces itself on the activity channel", () => {
		let n = 0;
		const off = subscribe((e) => {
			if (e.type === "activity-changed") n++;
		});
		startTask(init("video:a"));
		updateTask("video:a", { step: "x" });
		finishTask("video:a");
		dismissTask("video:a");
		off();
		assert.equal(n, 4);
	});
});
