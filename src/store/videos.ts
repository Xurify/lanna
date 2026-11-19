import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { isVideoId, type VideoIndexEntry, type VideoRecord, type WatchLogEntry } from "../core/watch.ts";
import type { SentenceCheckEntry } from "../core/watch-sentences.ts";
import type { SectionsRecord } from "../core/watch-sections.ts";
import type { PrepRecord } from "../core/watch-prep.ts";

const INDEX = () => path.join(PATHS.media, "index.jsonl");
const WATCHES = () => path.join(PATHS.media, "watches.jsonl");
const SENTENCES = () => path.join(PATHS.media, "sentences.jsonl");
const CHOSEN = () => path.join(PATHS.media, "chosen.json");
const SECTIONS = (id: string) => path.join(PATHS.media, "sections", `${id}.json`);
const PREP = (id: string) => path.join(PATHS.media, "prep", `${id}.json`);

function videoFile(id: string): string {
	if (!isVideoId(id)) throw new Error(`bad video id ${id}`);
	return path.join(PATHS.media, `${id}.json`);
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

function writeJson(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
	fs.renameSync(tmp, file);
}

function readJson<T>(file: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return null;
	}
}

/** The video ids with a kept file in a folder of <id>.json. */
function idsIn(dir: string): string[] {
	try {
		return fs
			.readdirSync(dir)
			.filter((n) => n.endsWith(".json"))
			.map((n) => n.slice(0, -5))
			.filter(isVideoId);
	} catch {
		return [];
	}
}

function appendJsonl(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.appendFileSync(file, `${JSON.stringify(value)}\n`, "utf-8");
}

function videoIndexEntryOf(v: VideoRecord): VideoIndexEntry {
	return {
		id: v.id,
		title: v.title,
		...(v.channel ? { channel: v.channel } : {}),
		...(v.channelId ? { channelId: v.channelId } : {}),
		durationSec: v.durationSec,
		level: v.level,
		createdAt: v.createdAt,
		coverage: v.coverage,
		...(v.measure ? { measure: v.measure } : {}),
		wordCount: v.wordCount,
		segments: v.segments.length,
		preTeach: v.preTeach.map((w) => w.lemma),
		source: v.source.kind,
		model: v.usage.model,
		lang: v.lang,
		trackLang: v.source.trackLang,
		...(v.coverageEstimated ? { estimated: true } : {}),
		...(v.fragment ? { fragment: v.fragment } : {}),
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
		const dir = path.join(PATHS.media, "captions");
		try {
			for (const name of fs.readdirSync(dir))
				if (name.startsWith(`${id}.`)) fs.rmSync(path.join(dir, name), { force: true });
		} catch {
			// no captions folder
		}
		return existed;
	},
	/** Keep the caption track as fetched; returns the file. */
	putCaptions(id: string, lang: string, ext: "json" | "xml" | "vtt", text: string): string {
		if (!isVideoId(id)) throw new Error(`bad video id ${id}`);
		const file = path.join(PATHS.media, "captions", `${id}.${lang.replace(/[^a-zA-Z-]/g, "")}.${ext}`);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, text, "utf-8");
		return file;
	},
	/** A kept caption track, when one exists. */
	captions(id: string, lang: string): { ext: "json" | "xml" | "vtt"; text: string } | null {
		if (!isVideoId(id)) return null;
		for (const ext of ["json", "xml", "vtt"] as const) {
			const file = path.join(PATHS.media, "captions", `${id}.${lang}.${ext}`);
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
	/** The study sections a model found for a video (src/core/watch-sections.ts), with their cost. */
	sections(id: string): SectionsRecord | null {
		if (!isVideoId(id)) return null;
		try {
			return JSON.parse(fs.readFileSync(SECTIONS(id), "utf-8")) as SectionsRecord;
		} catch {
			return null;
		}
	},
	putSections(rec: SectionsRecord): void {
		if (!isVideoId(rec.videoId)) throw new Error(`not a video id: ${rec.videoId}`);
		writeJson(SECTIONS(rec.videoId), rec);
	},
	/** Every kept study-sections record. */
	allSections(): SectionsRecord[] {
		return idsIn(path.join(PATHS.media, "sections")).flatMap((id) => this.sections(id) ?? []);
	},
	/** The briefing made for a video before watching it (src/core/watch-prep.ts), with its cost. */
	prep(id: string): PrepRecord | null {
		if (!isVideoId(id)) return null;
		return readJson<PrepRecord>(PREP(id));
	},
	putPrep(rec: PrepRecord): void {
		if (!isVideoId(rec.videoId)) throw new Error(`not a video id: ${rec.videoId}`);
		writeJson(PREP(rec.videoId), rec);
	},
	/** Every kept briefing. */
	allPreps(): PrepRecord[] {
		return idsIn(path.join(PATHS.media, "prep")).flatMap((id) => this.prep(id) ?? []);
	},
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
	/** The video the learner picked for the plan on this day, if any. */
	chosenFor(day: string): string | null {
		const rec = readJson<{ day?: unknown; videoId?: unknown }>(CHOSEN());
		return rec?.day === day && typeof rec.videoId === "string" && isVideoId(rec.videoId) ? rec.videoId : null;
	},
	choose(day: string, videoId: string): void {
		if (!isVideoId(videoId)) throw new Error(`bad video id ${videoId}`);
		writeJson(CHOSEN(), { day, videoId });
	},
};
