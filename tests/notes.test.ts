/**
 * NOTES (2026-11-17): time stamps in a note's text, the heading, the video
 * link, and the server round trip under an isolated LANNA_DATA_DIR.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-notes-"));
process.env.LANNA_DATA_DIR = TMP;
process.env.LANNA_PROFILE = "slovak";

const { noteMoments, noteHeading, parseNoteVideo, parseNoteBody, stampFor, MAX_NOTE_CHARS } =
	await import("../src/core/notes.ts");
const { createNote, updateNote, removeNote, listNotes } = await import("../src/server/notes.ts");
const { PATHS } = await import("../config.ts");

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const titled = async () => "Slovak for beginners";
const untitled = async () => undefined;

test("a stamp is the video clock in brackets", () => {
	assert.equal(stampFor(83.9), "[1:23]");
	assert.equal(stampFor(3725), "[1:02:05]");
});

test("every stamp in the text is a moment with the rest of its line", () => {
	const body = "Intro\n[0:42] dobrý deň — hello\n- [1:02:05] na zdravie\n[3:07][3:10] two at once";
	assert.deepEqual(noteMoments(body), [
		{ sec: 42, text: "dobrý deň — hello" },
		{ sec: 3725, text: "na zdravie" },
		{ sec: 187, text: "two at once" },
		{ sec: 190, text: "two at once" },
	]);
});

test("a stamp with impossible seconds or minutes is plain text", () => {
	assert.deepEqual(noteMoments("[1:75] no\n[1:75:00] no\n(1:23) no"), []);
});

test("the heading is the first line with words, else the video title", () => {
	assert.equal(noteHeading({ body: "\n# [0:10]  Phrases from the vlog\nmore" }), "Phrases from the vlog");
	assert.equal(noteHeading({ body: " \n", video: { id: "VO0JvXEA5m4", url: "u", title: "A vlog" } }), "A vlog");
	assert.equal(noteHeading({ body: "" }), "Untitled note");
});

test("a note links a YouTube video, never a Spotify track or other text", () => {
	assert.deepEqual(parseNoteVideo("https://youtu.be/VO0JvXEA5m4?si=x"), {
		ok: true,
		video: { id: "VO0JvXEA5m4", url: "https://www.youtube.com/watch?v=VO0JvXEA5m4" },
	});
	assert.deepEqual(parseNoteVideo(""), { ok: true, video: null });
	assert.equal(parseNoteVideo("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC").ok, false);
	assert.equal(parseNoteVideo("not a link").ok, false);
});

test("a note's text keeps its own line breaks and has a length limit", () => {
	assert.deepEqual(parseNoteBody("a\r\nb"), { ok: true, body: "a\nb" });
	assert.equal(parseNoteBody("x".repeat(MAX_NOTE_CHARS + 1)).ok, false);
	assert.equal(parseNoteBody(42).ok, false);
});

test("notes are created, changed, listed newest first and deleted to a trash file", async () => {
	const a = await createNote({ body: "first" }, new Date("2026-11-17T10:00:00Z"), titled);
	assert.ok(a.ok);
	assert.equal(a.note.video, undefined);

	const b = await createNote(
		{ body: "[0:42] ahoj", video: "https://youtu.be/VO0JvXEA5m4" },
		new Date("2026-11-17T11:00:00Z"),
		titled,
	);
	assert.ok(b.ok);
	assert.equal(b.note.video?.title, "Slovak for beginners");
	assert.deepEqual(
		listNotes().map((n) => n.id),
		[b.note.id, a.note.id],
	);

	const edited = await updateNote(a.note.id, { body: "first, edited" }, new Date("2026-11-17T12:00:00Z"), titled);
	assert.ok(edited.ok);
	assert.equal(edited.note.body, "first, edited");
	assert.equal(edited.note.createdAt, "2026-11-17T10:00:00.000Z");
	assert.equal(listNotes()[0]!.id, a.note.id);

	const linked = await updateNote(a.note.id, { video: "VO0JvXEA5m4" }, new Date(), untitled);
	assert.ok(linked.ok);
	assert.deepEqual(linked.note.video, { id: "VO0JvXEA5m4", url: "https://www.youtube.com/watch?v=VO0JvXEA5m4" });
	const unlinked = await updateNote(a.note.id, { video: "" }, new Date(), titled);
	assert.ok(unlinked.ok);
	assert.equal(unlinked.note.video, undefined);

	const bad = await updateNote(a.note.id, { video: "nope" }, new Date(), titled);
	assert.deepEqual(bad, { ok: false, status: 400, message: "That is not a YouTube link." });
	assert.equal((await updateNote("missing", { body: "x" }, new Date(), titled)).ok, false);

	assert.equal(removeNote(b.note.id, new Date("2026-11-17T13:00:00Z")), true);
	assert.equal(removeNote(b.note.id), false);
	assert.deepEqual(
		listNotes().map((n) => n.id),
		[a.note.id],
	);
	const trash = fs.readFileSync(path.join(PATHS.data, "notes-trash.jsonl"), "utf-8").trim().split("\n");
	assert.equal(trash.length, 1);
	assert.equal(JSON.parse(trash[0]!).body, "[0:42] ahoj");
});

test("keeping the same video does not look its title up again", async () => {
	let calls = 0;
	const counting = async () => (calls++, "Title");
	const n = await createNote({ video: "VO0JvXEA5m4" }, new Date(), counting);
	assert.ok(n.ok);
	await updateNote(n.note.id, { video: "https://www.youtube.com/watch?v=VO0JvXEA5m4" }, new Date(), counting);
	assert.equal(calls, 1);
});
