/**
 * The video library (LangHarness watch, 2026-10-28) — the active
 * profile's data/profiles/<language>/videos/:
 *
 *   <id>.json              one YouTube video as prepared: every line with
 *                          its times, translation and glossed tokens, the
 *                          pre-teach words, the questions, the caption
 *                          source and what the model calls cost
 *                          (src/core/watch.ts VideoRecord). Written once.
 *   captions/<id>.<lang>.<ext>
 *                          the caption track exactly as fetched (json3,
 *                          xml or vtt), so the lines can be cut again
 *                          without going back to YouTube.
 *   index.jsonl            one line per video (VideoIndexEntry).
 *   watches.jsonl          one line per watching (WatchLogEntry): mode,
 *                          lines got on the first listen, replays, the
 *                          check, the words tapped and queued, XP.
 *   sentences.jsonl        one line per model verdict on a sentence the
 *                          learner wrote for the end of a video
 *                          (SentenceCheckEntry, docs/plans/watch-sentences.md).
 *
 * Nothing of the video itself is stored — it plays in YouTube's player.
 * Same idioms as the other stores: sync fs, small files, atomic renames,
 * torn lines skipped.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { isVideoId, type VideoIndexEntry, type VideoRecord, type WatchLogEntry } from "../core/watch.ts";
import type { SentenceCheckEntry } from "../core/watch-sentences.ts";

const INDEX = () => path.join(PATHS.videos, "index.jsonl");
const WATCHES = () => path.join(PATHS.videos, "watches.jsonl");
const SENTENCES = () => path.join(PATHS.videos, "sentences.jsonl");

function videoFile(id: string): string {
	if (!isVideoId(id)) throw new Error(`bad video id ${id}`);
	return path.join(PATHS.videos, `${id}.json`);
}

function readJsonl<T>(file: string): T[] {
	let raw: string;
	try {
		raw = fs.readFileSync(file, "utf-8");
	} catch {
		return [];
	}
	const out: T[] = [];
	for (const line of raw.split("\n")) {
		const s = line.trim();
		if (!s) continue;
		try {
			out.push(JSON.parse(s) as T);
		} catch {
			// a torn line (crash mid-append) is skipped, never fatal
		}
	}
	return out;
}

function appendJsonl(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.appendFileSync(file, `${JSON.stringify(value)}\n`, "utf-8");
}

export function videoIndexEntryOf(v: VideoRecord): VideoIndexEntry {
	return {
		id: v.id,
		title: v.title,
		...(v.channel ? { channel: v.channel } : {}),
		durationSec: v.durationSec,
		level: v.level,
		createdAt: v.createdAt,
		coverage: v.coverage,
		wordCount: v.wordCount,
		segments: v.segments.length,
		preTeach: v.preTeach.map((w) => w.lemma),
		source: v.source.kind,
		model: v.usage.model,
		lang: v.lang,
		trackLang: v.source.trackLang,
	};
}

export const videoStore = {
	/** Every video's index line, newest last. */
	list(): VideoIndexEntry[] {
		const seen = new Map<string, VideoIndexEntry>();
		for (const e of readJsonl<VideoIndexEntry>(INDEX())) seen.set(e.id, e);
		// Lines written before the caption language was kept get it from the record, once.
		let filled = false;
		for (const [id, e] of seen) {
			if (e.trackLang) continue;
			const full = this.get(id);
			if (!full) continue;
			seen.set(id, { ...e, lang: full.lang, trackLang: full.source.trackLang });
			filled = true;
		}
		if (filled) {
			try {
				const tmp = `${INDEX()}.${process.pid}.tmp`;
				fs.writeFileSync(tmp, `${[...seen.values()].map((e) => JSON.stringify(e)).join("\n")}\n`, "utf-8");
				fs.renameSync(tmp, INDEX());
			} catch {
				// read-only data folder: the list is still right for this call
			}
		}
		return [...seen.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	},
	get(id: string): VideoRecord | null {
		try {
			return JSON.parse(fs.readFileSync(videoFile(id), "utf-8")) as VideoRecord;
		} catch {
			return null;
		}
	},
	/** Write the video and its index line. */
	put(v: VideoRecord): void {
		const file = videoFile(v.id);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(v, null, "\t"), "utf-8");
		fs.renameSync(tmp, file);
		appendJsonl(INDEX(), videoIndexEntryOf(v));
	},
	/** Take a video out of the library: its record, its index lines and its
	 *  kept caption track. The watchings stay, as the learner's own record
	 *  (XP, words sent to review). False when it was not there. */
	remove(id: string): boolean {
		const file = videoFile(id);
		const existed = fs.existsSync(file);
		fs.rmSync(file, { force: true });
		try {
			const kept = fs
				.readFileSync(INDEX(), "utf-8")
				.split("\n")
				.filter((line) => {
					if (!line.trim()) return false;
					try {
						return (JSON.parse(line) as VideoIndexEntry).id !== id;
					} catch {
						return true;
					}
				});
			const tmp = `${INDEX()}.${process.pid}.tmp`;
			fs.writeFileSync(tmp, kept.length ? `${kept.join("\n")}\n` : "", "utf-8");
			fs.renameSync(tmp, INDEX());
		} catch {
			// no index yet: nothing to take the video out of
		}
		const dir = path.join(PATHS.videos, "captions");
		try {
			for (const name of fs.readdirSync(dir)) if (name.startsWith(`${id}.`)) fs.rmSync(path.join(dir, name), { force: true });
		} catch {
			// no captions folder
		}
		return existed;
	},
	/** Keep the caption track as fetched; returns the file. */
	putCaptions(id: string, lang: string, ext: "json" | "xml" | "vtt", text: string): string {
		if (!isVideoId(id)) throw new Error(`bad video id ${id}`);
		const file = path.join(PATHS.videos, "captions", `${id}.${lang.replace(/[^a-zA-Z-]/g, "")}.${ext}`);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, text, "utf-8");
		return file;
	},
	/** A kept caption track, when one exists. */
	captions(id: string, lang: string): { ext: "json" | "xml" | "vtt"; text: string } | null {
		if (!isVideoId(id)) return null;
		for (const ext of ["json", "xml", "vtt"] as const) {
			const file = path.join(PATHS.videos, "captions", `${id}.${lang}.${ext}`);
			try {
				return { ext, text: fs.readFileSync(file, "utf-8") };
			} catch {
				// next
			}
		}
		return null;
	},
	appendWatch(entry: WatchLogEntry): void {
		appendJsonl(WATCHES(), entry);
	},
	/** One model verdict on a sentence written for a video's sentence step. */
	appendSentence(entry: SentenceCheckEntry): void {
		appendJsonl(SENTENCES(), entry);
	},
	/** Every sentence verdict, oldest first. */
	sentences(): SentenceCheckEntry[] {
		return readJsonl<SentenceCheckEntry>(SENTENCES());
	},
	/** Every watching, oldest first. */
	watches(): WatchLogEntry[] {
		return readJsonl<WatchLogEntry>(WATCHES());
	},
};
