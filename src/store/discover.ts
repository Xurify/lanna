/**
 * The picks for Watch on disk (LangHarness, 2026-11-05) — the active
 * profile's data/profiles/<language>/videos/discover/:
 *
 *   creators.json    the saved channels and the settings (keepReady).
 *   scans.json       every video checked for a pick (src/core/discover.ts
 *                    ScannedVideo), by id.
 *   text/<id>.<lang>.txt
 *                    a checked video's caption lines, one a line, so its
 *                    known-word share can be measured again without YouTube.
 *   youtube.json     what was read from the learner's YouTube account or a
 *                    Takeout export: history, recommendations, subscriptions.
 *                    Never a password, cookie or token.
 *   searches.json    the searches written from the learner's interests.
 *   lines/<id>.json  a video's caption lines with their times, for its fragments
 *                    (src/server/fragments.ts).
 *   avatars.json     channel pictures (Google image links), by channel id.
 *   dismissed-channels.json
 *                    suggested channels the learner said are not for them.
 *   dismissed.json   video ids the learner said are not for them.
 *
 * Same idioms as the other stores: sync fs, atomic renames.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { Creator, FoundChannel, FoundVideo, ScannedVideo } from "../core/discover.ts";
import type { StoryUsage } from "../core/reading.ts";

const dir = () => path.join(PATHS.videos, "discover");
const file = (name: string) => path.join(dir(), name);

function readJson<T>(name: string, fallback: T): T {
	try {
		return JSON.parse(fs.readFileSync(file(name), "utf-8")) as T;
	} catch {
		return fallback;
	}
}

function writeJson(name: string, value: unknown): void {
	const target = file(name);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	const tmp = `${target}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value, null, "\t"), "utf-8");
	fs.renameSync(tmp, target);
}

export interface CreatorsFile {
	creators: Creator[];
	/** Prepare the best pick in the background when no video is waiting. */
	keepReady: boolean;
	/** When the creators' feeds were last read. */
	refreshedAt?: string;
}

/** What was read from YouTube, per list, with when. */
export interface YouTubeSignals {
	history?: { at: string; via: "account" | "takeout"; videos: FoundVideo[] };
	recommended?: { at: string; via: "account"; videos: FoundVideo[] };
	subscriptions?: { at: string; via: "account" | "takeout"; channels: FoundChannel[] };
}

/** videos/discover/lines/<id>.json */
export interface CaptionLines {
	title: string;
	channel?: string;
	durationSec: number;
	/** The caption track's language, and whether people made it. */
	trackLang: string;
	kind: "captions" | "auto-captions" | "transcription";
	lines: Array<{ start: number; end: number; sk: string }>;
	at: string;
}

export interface SearchesFile {
	/** A hash of what the searches were written from. */
	key: string;
	at: string;
	queries: string[];
	model: string;
	usage?: StoryUsage;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const discoverStore = {
	creators(): CreatorsFile {
		const f = readJson<Partial<CreatorsFile>>("creators.json", {});
		return { creators: Array.isArray(f.creators) ? f.creators : [], keepReady: f.keepReady !== false, ...(f.refreshedAt ? { refreshedAt: f.refreshedAt } : {}) };
	},
	putCreators(f: CreatorsFile): void {
		writeJson("creators.json", f);
	},
	scans(): Record<string, ScannedVideo> {
		const s = readJson<Record<string, ScannedVideo>>("scans.json", {});
		return s && typeof s === "object" ? s : {};
	},
	putScans(scans: Record<string, ScannedVideo>): void {
		writeJson("scans.json", scans);
	},
	putText(id: string, lang: string, lines: readonly string[]): void {
		if (!VIDEO_ID.test(id)) return;
		const target = path.join(dir(), "text", `${id}.${lang.replace(/[^a-zA-Z-]/g, "")}.txt`);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, `${lines.join("\n")}\n`, "utf-8");
	},
	text(id: string, lang: string): string[] | null {
		if (!VIDEO_ID.test(id)) return null;
		try {
			return fs
				.readFileSync(path.join(dir(), "text", `${id}.${lang.replace(/[^a-zA-Z-]/g, "")}.txt`), "utf-8")
				.split("\n")
				.filter((l) => l.trim());
		} catch {
			return null;
		}
	},
	youtube(): YouTubeSignals {
		return readJson<YouTubeSignals>("youtube.json", {});
	},
	putYoutube(s: YouTubeSignals): void {
		writeJson("youtube.json", s);
	},
	/** Forget everything read from the account or an export. */
	clearYoutube(): void {
		fs.rmSync(file("youtube.json"), { force: true });
	},
	searches(): SearchesFile | null {
		const s = readJson<SearchesFile | null>("searches.json", null);
		return s && Array.isArray(s.queries) ? s : null;
	},
	putSearches(s: SearchesFile): void {
		writeJson("searches.json", s);
	},
	/** A video's caption lines with their times, kept so its fragments can be
	 *  found again, and measured again as the learner learns, without YouTube. */
	putLines(id: string, v: CaptionLines): void {
		if (!VIDEO_ID.test(id)) return;
		writeJson(`lines/${id}.json`, v);
	},
	lines(id: string): CaptionLines | null {
		if (!VIDEO_ID.test(id)) return null;
		const v = readJson<CaptionLines | null>(`lines/${id}.json`, null);
		return v && Array.isArray(v.lines) ? v : null;
	},
	/** Channel pictures by channel id. */
	avatars(): Record<string, string> {
		const a = readJson<Record<string, unknown>>("avatars.json", {});
		return Object.fromEntries(Object.entries(a && typeof a === "object" ? a : {}).filter((e): e is [string, string] => typeof e[1] === "string"));
	},
	putAvatars(a: Record<string, string>): void {
		writeJson("avatars.json", a);
	},
	/** Suggested channels the learner said are not for them. */
	dismissedChannels(): Set<string> {
		const d = readJson<string[]>("dismissed-channels.json", []);
		return new Set(Array.isArray(d) ? d.filter((x) => typeof x === "string") : []);
	},
	dismissChannel(id: string): void {
		if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) return;
		const d = this.dismissedChannels();
		d.add(id);
		writeJson("dismissed-channels.json", [...d]);
	},
	dismissed(): Set<string> {
		const d = readJson<string[]>("dismissed.json", []);
		return new Set(Array.isArray(d) ? d.filter((x) => typeof x === "string") : []);
	},
	dismiss(id: string): void {
		if (!VIDEO_ID.test(id)) return;
		const d = this.dismissed();
		d.add(id);
		writeJson("dismissed.json", [...d]);
	},
};
