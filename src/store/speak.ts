/**
 * Spoken scenes and the fluency log (2026-10-28) — the
 * active profile's data/profiles/<language>/:
 *
 *   speak/<id>.json       one scene: every line (the tutor's Slovak with
 *                         its meaning, the learner's with how it arrived),
 *                         every repair prompt, the end summary, the model
 *                         and tokens it cost (src/core/speak.ts
 *                         SpeakSession). Rewritten after each turn.
 *   speak/<id>/<n>.wav    the learner's own recording of line n, a 16 kHz
 *                         mono PCM WAV — their voice in Slovak, kept for
 *                         whatever they build next.
 *   speak/index.jsonl     one line per scene (SpeakIndexEntry), written
 *                         when the scene ends.
 *   fluency/log.jsonl     one line per timed re-read or "say it faster"
 *                         round (src/core/fluency.ts FluencyLogEntry).
 *
 * Same idioms as the other stores: sync fs, small files, atomic renames,
 * torn lines skipped. The tutor's audio is not here: it goes through
 * the shared audio library (<data>/audio/) like every other spoken line.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { FluencyLogEntry } from "../core/fluency.ts";
import { speakCounts, type SpeakIndexEntry, type SpeakSession } from "../core/speak.ts";

const INDEX = () => path.join(PATHS.speak, "index.jsonl");
const FLUENCY_LOG = () => path.join(PATHS.fluency, "log.jsonl");

const ID = /^[a-z0-9][a-z0-9-]*$/;

function sessionFile(id: string): string {
	if (!ID.test(id)) throw new Error(`bad speak id ${id}`);
	return path.join(PATHS.speak, `${id}.json`);
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

function speakIndexEntry(s: SpeakSession): SpeakIndexEntry {
	const c = speakCounts(s.turns);
	return {
		id: s.id,
		scene: s.scene,
		sceneTitle: s.sceneTitle,
		level: s.level,
		startedAt: s.startedAt,
		...(s.endedAt ? { endedAt: s.endedAt } : {}),
		turns: c.learner,
		prompts: c.prompts,
		repaired: c.repaired,
		corrections: s.summary?.corrections.length ?? 0,
		model: s.usage.model,
		...(s.xp !== undefined ? { xp: s.xp } : {}),
	};
}

export const speakStore = {
	get(id: string): SpeakSession | null {
		try {
			return JSON.parse(fs.readFileSync(sessionFile(id), "utf-8")) as SpeakSession;
		} catch {
			return null;
		}
	},
	/** Write the whole session (after every turn, so a crash loses one line at most). */
	put(s: SpeakSession): void {
		const file = sessionFile(s.id);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(s, null, "\t"), "utf-8");
		fs.renameSync(tmp, file);
	},
	/** The scene is over: its index line. */
	index(s: SpeakSession): void {
		appendJsonl(INDEX(), speakIndexEntry(s));
	},
	/** Every finished scene's index line, oldest first. */
	list(): SpeakIndexEntry[] {
		return readJsonl<SpeakIndexEntry>(INDEX()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
	},
	/** Keep a recording of the learner's line `n`; returns the file name. */
	putRecording(id: string, n: number, data: Uint8Array): string {
		if (!ID.test(id)) throw new Error(`bad speak id ${id}`);
		const dir = path.join(PATHS.speak, id);
		fs.mkdirSync(dir, { recursive: true });
		const name = `${String(n).padStart(2, "0")}.wav`;
		const file = path.join(dir, name);
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, data);
		fs.renameSync(tmp, file);
		return name;
	},
	/** Scenes started but never ended (an abandoned tab), newest first. */
	unfinished(): SpeakSession[] {
		let files: string[];
		try {
			files = fs.readdirSync(PATHS.speak).filter((f) => f.endsWith(".json"));
		} catch {
			return [];
		}
		const ended = new Set(this.list().map((e) => e.id));
		return files
			.map((f) => f.slice(0, -5))
			.filter((id) => ID.test(id) && !ended.has(id))
			.map((id) => this.get(id))
			.filter((s): s is SpeakSession => !!s && !s.endedAt)
			.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	},
};

export const fluencyStore = {
	append(entry: FluencyLogEntry): void {
		appendJsonl(FLUENCY_LOG(), entry);
	},
	/** Every round, oldest first. */
	list(): FluencyLogEntry[] {
		return readJsonl<FluencyLogEntry>(FLUENCY_LOG());
	},
};
