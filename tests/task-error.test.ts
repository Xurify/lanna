/**
 * TASK ERRORS: a failed task shows one short line, not the helper's whole
 * output (terminal colors, progress bars, a traceback).
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { briefError } = await import("../src/server/tasks.ts");

describe("briefError", () => {
	test("keeps the last line and drops the command and traceback above it", () => {
		const message = 'Command failed: C:\\Python313\\python.exe spotify_helper.py download https://open.spotify.com/track/x\nTraceback (most recent call last):\n  File "spotify_helper.py", line 158\nerror: spotdl wrote no MP3 (exit 0): Done 100%';
		assert.equal(briefError(message), "error: spotdl wrote no MP3 (exit 0): Done 100%");
	});

	test("removes terminal color codes", () => {
		assert.equal(briefError("\u001b[31m\u001b[1mRuntimeError\u001b[0m: no file\u001b[0m"), "RuntimeError: no file");
	});

	test("caps a long line at 240 characters, ending in an ellipsis", () => {
		const shown = briefError(`error: ${"x".repeat(500)}`);
		assert.equal(shown.length, 240);
		assert.ok(shown.endsWith("..."));
	});

	test("a message with no text gets a plain fallback", () => {
		assert.equal(briefError("\n  \n"), "Something went wrong");
	});
});
