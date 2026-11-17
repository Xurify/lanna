/**
 * Activity-feed test — the dock's composition (server/observability.ts): the
 * feed carries the app's background tasks, running and finished, and nothing else.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { activityFeed } from "../src/server/observability.ts";
import { finishTask, resetTasks, startTask } from "../src/server/tasks.ts";

test("activityFeed: the background tasks, running and finished, and no other key", () => {
	resetTasks();
	try {
		startTask({ id: "video:aaaaaaaaaaa", kind: "video", title: "Running video", step: "Translating" });
		startTask({ id: "language:estonian", kind: "language", title: "Adding Estonian", step: "Downloading" });
		finishTask("language:estonian");

		const feed = activityFeed();
		assert.deepEqual(Object.keys(feed), ["tasks"]);
		assert.deepEqual(
			feed.tasks.map((task) => [task.id, task.status]),
			[
				["video:aaaaaaaaaaa", "running"],
				["language:estonian", "done"],
			],
		);
	} finally {
		resetTasks();
	}
});

test("activityFeed: no task while none runs or is kept", () => {
	resetTasks();
	assert.deepEqual(activityFeed(), { tasks: [] });
});
