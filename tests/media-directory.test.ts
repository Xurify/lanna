import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { mediaDirectory, migrateMediaLibraries } from "../src/store/media-directory.ts";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-media-"));
process.env.LANNA_DATA_DIR = scratch;
process.env.LANNA_PROFILE = "slovak";

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function write(root: string, relative: string, content: string): void {
	const file = path.join(root, relative);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}

test("a new library uses media without creating an empty folder", () => {
	const root = path.join(scratch, "fresh");
	assert.equal(mediaDirectory(root), path.join(root, "media"));
	assert.equal(fs.existsSync(root), false);
});

test("the entire legacy library moves intact and repeated access does nothing", () => {
	const root = path.join(scratch, "legacy");
	const files = {
		"audio/sp_0rgXffrQ2Fj9kCDotdURKQ.mp3": "audio bytes",
		"audio/sp_0rgXffrQ2Fj9kCDotdURKQ.jpg": "cover bytes",
		"index.jsonl": '{"id":"sp_0rgXffrQ2Fj9kCDotdURKQ"}\n',
		"captions/track.sk.json": '{"events":[]}',
		"discover/lines/track.json": '{"lines":[]}',
		"sections/track.json": '{"sections":[]}',
		"prep/track.json": '{"summary":[]}',
		"chosen.json": '{"videoId":"track"}',
		"watches.jsonl": '{"gotFirst":3}\n',
		"sentences.jsonl": '{"ok":true}\n',
	};
	for (const [file, content] of Object.entries(files)) write(root, `videos/${file}`, content);
	const target = mediaDirectory(root);
	assert.equal(target, path.join(root, "media"));
	assert.equal(fs.existsSync(path.join(root, "videos")), false);
	for (const [file, content] of Object.entries(files))
		assert.equal(fs.readFileSync(path.join(target, file), "utf-8"), content);
	assert.equal(mediaDirectory(root), target);
});

test("a partial migration merges distinct files and identical duplicates", () => {
	const root = path.join(scratch, "partial");
	write(root, "videos/audio/old.mp3", "old audio");
	write(root, "media/audio/new.mp3", "new audio");
	write(root, "videos/index.jsonl", "same index\n");
	write(root, "media/index.jsonl", "same index\n");
	mediaDirectory(root);
	assert.equal(fs.readFileSync(path.join(root, "media/audio/old.mp3"), "utf-8"), "old audio");
	assert.equal(fs.readFileSync(path.join(root, "media/audio/new.mp3"), "utf-8"), "new audio");
	assert.equal(fs.readFileSync(path.join(root, "media/index.jsonl"), "utf-8"), "same index\n");
	assert.equal(fs.existsSync(path.join(root, "videos")), false);
});

test("conflicting files stop the migration before any file is moved", () => {
	const root = path.join(scratch, "conflict");
	write(root, "videos/a-only-legacy.json", "keep me");
	write(root, "videos/index.jsonl", "old index\n");
	write(root, "media/index.jsonl", "new index\n");
	assert.throws(() => mediaDirectory(root), /Cannot migrate media library: resolve conflicting paths/);
	assert.equal(fs.readFileSync(path.join(root, "videos/a-only-legacy.json"), "utf-8"), "keep me");
	assert.equal(fs.existsSync(path.join(root, "media/a-only-legacy.json")), false);
	assert.equal(fs.readFileSync(path.join(root, "videos/index.jsonl"), "utf-8"), "old index\n");
	assert.equal(fs.readFileSync(path.join(root, "media/index.jsonl"), "utf-8"), "new index\n");
});

test("file and directory collisions preserve both libraries", () => {
	const root = path.join(scratch, "type-conflict");
	write(root, "videos/audio/track.mp3", "audio");
	write(root, "media/audio", "not a directory");
	assert.throws(() => mediaDirectory(root), /Cannot migrate media library/);
	assert.equal(fs.readFileSync(path.join(root, "videos/audio/track.mp3"), "utf-8"), "audio");
	assert.equal(fs.readFileSync(path.join(root, "media/audio"), "utf-8"), "not a directory");
});

test("Next starts migrate every profile without changing data during a build", async () => {
	const { default: configure } = await import("../next.config.ts");
	for (const phase of ["phase-development-server", "phase-production-server"]) {
		const root = path.join(scratch, "profiles", phase);
		write(root, "videos/flag.json", phase);
		configure("phase-production-build");
		assert.equal(fs.existsSync(path.join(root, "videos")), true);
		configure(phase);
		assert.equal(fs.existsSync(path.join(root, "videos")), false);
		assert.equal(fs.readFileSync(path.join(root, "media/flag.json"), "utf-8"), phase);
	}
});

test("startup migrates every profile before any media path is accessed", async () => {
	write(scratch, "profiles/slovak/videos/audio/startup.mp3", "active");
	write(scratch, "profiles/inactive/videos/index.jsonl", "inactive");
	const config = new URL("../config.ts?media-startup", import.meta.url);
	await import(config.href);
	assert.equal(fs.existsSync(path.join(scratch, "profiles/slovak/videos")), false);
	assert.equal(fs.existsSync(path.join(scratch, "profiles/inactive/videos")), false);
	assert.equal(fs.readFileSync(path.join(scratch, "profiles/slovak/media/audio/startup.mp3"), "utf-8"), "active");
	assert.equal(fs.readFileSync(path.join(scratch, "profiles/inactive/media/index.jsonl"), "utf-8"), "inactive");
	assert.deepEqual(migrateMediaLibraries(scratch), []);
});

test("PATHS.media follows the active profile and migrates restored legacy data on access", async () => {
	const { PATHS, withProfile } = await import("../config.ts");
	const first = path.join(scratch, "profiles/slovak");
	const second = path.join(scratch, "profiles/czech");
	write(first, "videos/audio/first.mp3", "first");
	write(second, "videos/audio/second.mp3", "second");
	assert.equal(PATHS.media, path.join(first, "media"));
	assert.equal(fs.existsSync(path.join(second, "videos")), true);
	assert.equal(
		withProfile("czech", () => PATHS.media),
		path.join(second, "media"),
	);
	assert.equal(fs.readFileSync(path.join(second, "media/audio/second.mp3"), "utf-8"), "second");
	assert.equal(PATHS.media, path.join(first, "media"));
	write(first, "videos/captions/restored.json", "restored");
	assert.equal(fs.readFileSync(path.join(PATHS.media, "captions/restored.json"), "utf-8"), "restored");
	assert.equal(fs.existsSync(path.join(first, "videos")), false);
});

test("legacy records, discovery data and listening history remain readable in media", async () => {
	const { PATHS } = await import("../config.ts");
	const { videoStore } = await import("../src/store/videos.ts");
	const { discoverStore } = await import("../src/store/discover.ts");
	const { learnerFacts } = await import("../src/server/milestones.ts");
	const { ensureReadmes } = await import("../src/store/corpus.ts");
	const id = "sp_0rgXffrQ2Fj9kCDotdURKQ";
	const record = { id, title: "Saved track", source: { trackLang: "sk" } };
	write(PATHS.data, `videos/${id}.json`, JSON.stringify(record));
	write(PATHS.data, "videos/index.jsonl", `${JSON.stringify({ ...record, trackLang: "sk" })}\n`);
	write(PATHS.data, "videos/discover/creators.json", '{"creators":[],"keepReady":false}');
	write(
		PATHS.data,
		"videos/watches.jsonl",
		`${JSON.stringify({ at: "2026-11-18T10:00:00Z", segments: 4, gotFirst: 3 })}\n`,
	);
	assert.deepEqual(videoStore.get(id), record);
	assert.equal(videoStore.list()[0]?.title, "Saved track");
	assert.equal(discoverStore.creators().keepReady, false);
	const facts = learnerFacts(null);
	assert.equal(facts.watch?.videos, 1);
	assert.equal(facts.watch?.segments, 4);
	assert.equal(facts.watch?.gotFirst, 3);
	ensureReadmes(true);
	const readme = fs.readFileSync(path.join(PATHS.media, "README.md"), "utf-8");
	assert.match(readme, /^# media\//);
	assert.match(readme, /Spotify/);
	assert.match(readme, /audio\/<id>\.mp3/);
	assert.equal(fs.existsSync(path.join(PATHS.data, "videos")), false);
});

test("the audio endpoint plays and seeks a legacy Spotify clip after migration", async () => {
	const { PATHS } = await import("../config.ts");
	const { GET } = await import("../app/api/watch/audio/route.ts");
	const id = "sp_0rgXffrQ2Fj9kCDotdURKQ";
	write(PATHS.data, `videos/audio/${id}.mp3`, "0123456789");
	write(PATHS.data, `videos/audio/${id}.jpg`, "cover");
	const url = `http://localhost/api/watch/audio?id=${id}`;
	const full = GET(new Request(url));
	assert.equal(full.status, 200);
	assert.equal(full.headers.get("content-type"), "audio/mpeg");
	assert.equal(await full.text(), "0123456789");
	const range = GET(new Request(url, { headers: { range: "bytes=2-5" } }));
	assert.equal(range.status, 206);
	assert.equal(range.headers.get("content-range"), "bytes 2-5/10");
	assert.equal(await range.text(), "2345");
	const cover = GET(new Request(`${url}&cover=1`));
	assert.equal(cover.headers.get("content-type"), "image/jpeg");
	assert.equal(await cover.text(), "cover");
	assert.equal(fs.existsSync(path.join(PATHS.data, "videos")), false);
	assert.equal(fs.readFileSync(path.join(PATHS.media, "audio", `${id}.mp3`), "utf-8"), "0123456789");
});
