/**
 * NOTES (2026-11-17): time stamps in a note's text, the heading, links and
 * their preview cards, and the server round trip under an isolated
 * LANNA_DATA_DIR.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-notes-"));
process.env.LANNA_DATA_DIR = TMP;
process.env.LANNA_PROFILE = "slovak";

const {
	noteMoments,
	noteHeading,
	noteVideo,
	normalizeLink,
	pastedLink,
	parseNoteLinks,
	parseNoteBody,
	parseNoteTitle,
	pageMeta,
	stampFor,
	MAX_NOTE_CHARS,
	MAX_NOTE_TITLE,
	MAX_NOTE_LINKS,
} = await import("../src/core/notes.ts");
const { createNote, updateNote, removeNote, listNotes } = await import("../src/server/notes.ts");
const { PATHS } = await import("../config.ts");
type NoteLink = import("../src/core/notes.ts").NoteLink;
type Wanted = Pick<NoteLink, "url" | "videoId">;

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const VIDEO = "https://www.youtube.com/watch?v=VO0JvXEA5m4";
const carded = async (l: Wanted): Promise<NoteLink> => ({ ...l, title: `Card for ${l.url}` });

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

test("the heading is the title, else the first line with words, else the first link's title", () => {
	assert.equal(noteHeading({ body: "\n# [0:10]  Phrases from the vlog\nmore" }), "Phrases from the vlog");
	assert.equal(noteHeading({ body: " \n", links: [{ url: VIDEO, title: "A vlog" }] }), "A vlog");
	assert.equal(noteHeading({ body: "" }), "Untitled note");
	assert.equal(noteHeading({ title: "  Grammar  ", body: "first line" }), "Grammar");
	assert.equal(noteHeading({ title: " ", body: "first line" }), "first line");
});

test("a link is any http(s) address; a YouTube one keeps its watch form and video id", () => {
	assert.deepEqual(normalizeLink("https://youtu.be/VO0JvXEA5m4?si=x"), { url: VIDEO, videoId: "VO0JvXEA5m4" });
	assert.deepEqual(normalizeLink("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"), {
		url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
	});
	assert.deepEqual(normalizeLink("sme.sk/clanok"), { url: "https://sme.sk/clanok" });
	assert.equal(normalizeLink("not a link"), null);
	assert.equal(normalizeLink("javascript:alert(1)"), null);
	assert.equal(normalizeLink("ftp://example.com/x"), null);
	assert.equal(normalizeLink("https://user:pw@example.com"), null);
	assert.equal(normalizeLink("VO0JvXEA5m4"), null);
});

test("a paste is a link only when it is one link and nothing else", () => {
	assert.equal(pastedLink("  https://dennikn.sk/123/  "), "https://dennikn.sk/123/");
	assert.equal(pastedLink("see https://dennikn.sk/123/"), null);
	assert.equal(pastedLink("dennikn.sk"), null);
});

test("a note's links are a list without repeats, with a limit", () => {
	assert.deepEqual(parseNoteLinks(["https://youtu.be/VO0JvXEA5m4", VIDEO, "https://sme.sk/"]), {
		ok: true,
		links: [{ url: VIDEO, videoId: "VO0JvXEA5m4" }, { url: "https://sme.sk/" }],
	});
	assert.equal(parseNoteLinks(["nope"]).ok, false);
	assert.equal(parseNoteLinks("https://sme.sk").ok, false);
	const many = Array.from({ length: MAX_NOTE_LINKS + 1 }, (_, i) => `https://e.com/${i}`);
	assert.equal(parseNoteLinks(many).ok, false);
});

test("the video beside a note is its first YouTube link", () => {
	const links = [{ url: "https://sme.sk/" }, { url: VIDEO, videoId: "VO0JvXEA5m4" }];
	assert.equal(noteVideo({ links })?.videoId, "VO0JvXEA5m4");
	assert.equal(noteVideo({ links: [{ url: "https://sme.sk/" }] }), undefined);
});

test("a page's card comes from Open Graph, then Twitter tags, then plain HTML", () => {
	const og = `<html><head><title>Plain</title>
		<meta property="og:title" content="Ako sa učiť &amp; nezabudnúť">
		<meta content='Krátky opis.' property='og:description'>
		<meta property="og:image" content="/img/cover.jpg">
		<meta property="og:site_name" content="Denník N"></head>`;
	assert.deepEqual(pageMeta(og, "https://dennikn.sk/a/b"), {
		title: "Ako sa učiť & nezabudnúť",
		site: "Denník N",
		description: "Krátky opis.",
		image: "https://dennikn.sk/img/cover.jpg",
	});
	assert.deepEqual(
		pageMeta(`<title> Only   a title </title><meta name="description" content="Desc">`, "https://www.example.com/x"),
		{ title: "Only a title", site: "example.com", description: "Desc", image: undefined },
	);
	assert.equal(pageMeta(`<meta property="og:image" content="javascript:alert(1)">`, "https://e.com").image, undefined);
});

test("a note's text keeps its own line breaks and has a length limit", () => {
	assert.deepEqual(parseNoteBody("a\r\nb"), { ok: true, body: "a\nb" });
	assert.equal(parseNoteBody("x".repeat(MAX_NOTE_CHARS + 1)).ok, false);
	assert.equal(parseNoteBody(42).ok, false);
});

test("a title is one line with a limit", () => {
	assert.deepEqual(parseNoteTitle("  Two\n lines  "), { ok: true, title: "Two lines" });
	assert.equal(parseNoteTitle("x".repeat(MAX_NOTE_TITLE + 1)).ok, false);
});

test("notes are created, changed, listed newest first and deleted to a trash file", async () => {
	const a = await createNote({ title: "Verbs of motion", body: "first" }, new Date("2026-11-17T10:00:00Z"), carded);
	assert.ok(a.ok);
	assert.equal(a.note.title, "Verbs of motion");
	assert.equal(a.note.links, undefined);

	const b = await createNote(
		{ body: "[0:42] ahoj", links: ["https://youtu.be/VO0JvXEA5m4"] },
		new Date("2026-11-17T11:00:00Z"),
		carded,
	);
	assert.ok(b.ok);
	assert.deepEqual(b.note.links, [{ url: VIDEO, videoId: "VO0JvXEA5m4", title: `Card for ${VIDEO}` }]);
	assert.deepEqual(
		listNotes().map((n) => n.id),
		[b.note.id, a.note.id],
	);

	const edited = await updateNote(a.note.id, { body: "first, edited", title: "" }, new Date("2026-11-17T12:00:00Z"));
	assert.ok(edited.ok);
	assert.equal(edited.note.body, "first, edited");
	assert.equal(edited.note.title, undefined);
	assert.equal(edited.note.createdAt, "2026-11-17T10:00:00.000Z");
	assert.equal(listNotes()[0]!.id, a.note.id);

	const linked = await updateNote(a.note.id, { links: ["https://sme.sk/", VIDEO] }, new Date(), carded);
	assert.ok(linked.ok);
	assert.deepEqual(
		linked.note.links?.map((l) => l.url),
		["https://sme.sk/", VIDEO],
	);
	const unlinked = await updateNote(a.note.id, { links: [] }, new Date(), carded);
	assert.ok(unlinked.ok);
	assert.equal(unlinked.note.links, undefined);

	const bad = await updateNote(a.note.id, { links: ["nope"] }, new Date(), carded);
	assert.deepEqual(bad, { ok: false, status: 400, message: "That is not a link." });
	assert.equal((await updateNote("missing", { body: "x" }, new Date(), carded)).ok, false);

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

test("a link already on the note is not looked up again", async () => {
	let calls = 0;
	const counting = async (l: Wanted): Promise<NoteLink> => (calls++, { ...l, title: "Title" });
	const n = await createNote({ links: ["https://sme.sk/"] }, new Date(), counting);
	assert.ok(n.ok);
	await updateNote(n.note.id, { links: ["https://sme.sk/", VIDEO] }, new Date(), counting);
	assert.equal(calls, 2);
});

test("text saved while a link is looked up is not overwritten when the link lands", async () => {
	const n = await createNote({ body: "before" }, new Date(), carded);
	assert.ok(n.ok);
	let release = () => {};
	const slow = (l: Wanted) =>
		new Promise<NoteLink>((resolve) => {
			release = () => resolve({ ...l, title: "Slow" });
		});
	const linking = updateNote(n.note.id, { links: ["https://sme.sk/"] }, new Date(), slow);
	await new Promise((r) => setTimeout(r, 5));
	await updateNote(n.note.id, { body: "typed meanwhile" }, new Date(), carded);
	release();
	const done = await linking;
	assert.ok(done.ok);
	assert.equal(done.note.body, "typed meanwhile");
	assert.equal(done.note.links?.[0]?.title, "Slow");
});
