import assert from "node:assert/strict";
import { test } from "node:test";
import { timeAgo } from "../src/core/time-ago.ts";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

test("shows older chat times as relative labels", () => {
	assert.equal(timeAgo(ago(6), NOW), "6d ago");
	assert.equal(timeAgo(ago(8), NOW), "8d ago");
	assert.equal(timeAgo(ago(29), NOW), "29d ago");
	assert.equal(timeAgo(ago(30), NOW), "30d ago");
	assert.equal(timeAgo(ago(364), NOW), "364d ago");
	assert.equal(timeAgo(ago(365), NOW), "365d ago");
});

test("keeps short chat times compact", () => {
	assert.equal(timeAgo(new Date(NOW.getTime() - 30_000).toISOString(), NOW), "just now");
	assert.equal(timeAgo(new Date(NOW.getTime() - 60_000).toISOString(), NOW), "1m ago");
	assert.equal(timeAgo(new Date(NOW.getTime() - 3_600_000).toISOString(), NOW), "1h ago");
});
