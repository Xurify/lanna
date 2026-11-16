/**
 * CARRY-OVER PINS: unfinished plan tasks from earlier days come back until a
 * later day or today finishes them; nothing older than the snapshots counts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { carriedTasks } from "../src/core/carry-over.ts";

test("carriedTasks: an unfinished task carries; finishing it later drops it; today's finish drops it", () => {
	const days = [
		{
			day: "2026-10-27",
			tasks: [
				{ id: "review", title: "Review", done: false },
				{ id: "listen", title: "Listen", done: true },
			],
		},
		{
			day: "2026-10-28",
			tasks: [
				{ id: "review", title: "Review", done: true },
				{ id: "read", title: "Read", done: false },
			],
		},
	];
	assert.deepEqual(carriedTasks(days, "2026-10-29", new Set()), [{ id: "read", title: "Read", from: "2026-10-28" }]);
	assert.deepEqual(carriedTasks(days, "2026-10-29", new Set(["read"])), []);
});

test("carriedTasks: a task left on two days shows once, from its latest day; today's own days are not carried", () => {
	const days = [
		{ day: "2026-10-27", tasks: [{ id: "speak", title: "Speak", done: false }] },
		{ day: "2026-10-28", tasks: [{ id: "speak", title: "Speak", done: false }] },
		{ day: "2026-10-29", tasks: [{ id: "speak", title: "Speak", done: false }] },
	];
	assert.deepEqual(carriedTasks(days, "2026-10-29", new Set()), [{ id: "speak", title: "Speak", from: "2026-10-28" }]);
});
