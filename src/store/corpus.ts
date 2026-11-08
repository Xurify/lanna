/**
 * The corpus store (LangHarness, Xurify 2026-10-27: "will all of this be
 * saved? … I could use it to build a language learning app and save money
 * by not regenerating everything") — everything the app pays a provider
 * for, or the learner produces, is kept on disk in open formats, indexed,
 * and found again before anything is generated twice.
 *
 *   <data>/audio/                      every spoken clip (shared by profiles)
 *     index.jsonl                      one line per clip: AudioClipEntry
 *     <lang>/<voice>/<slug>-<key>.mp3  the clip, named after its text
 *   <data>/profiles/<language>/lessons/
 *     <day>.jsonl                      one line per finished lesson/blitz:
 *                                      the whole plan and every answer
 *     why-index.json                   (sentence, answer) → the Why? chat,
 *                                      so a repeat question reopens it
 *   README.md files                    written next to the data so the
 *                                      layout explains itself on disk
 *
 * Chats (data/profiles/<language>/chats/), the review deck (review/) and
 * the graph ledgers (graph/) already persisted before this store; it only
 * adds the pieces that were regenerated every time and the index that
 * makes the whole tree reusable. Sync fs, small files, atomic renames —
 * the same idioms as the other stores.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { FirstAnswer } from "../core/first-try.ts";
import type { FormSlip } from "../core/form-slip.ts";
import { DATA_READMES } from "./corpus-readme.ts";

// ─── Audio ───────────────────────────────────────────────────────────────────

/** "female" | "male" (the language's default voice of that gender), or a
 *  TTS voice id (a story character's voice, src/server/voices.ts). The
 *  folder under data/audio/<lang>/ is named after it. */
export type AudioVoice = string;

export interface AudioClipEntry {
	/** sha256 of (lang, voice, text) — the cache key; file names carry its first 12 chars. */
	key: string;
	lang: string;
	voice: AudioVoice;
	/** Which engine spoke it ("elevenlabs" | "edge" | "piper"); "unknown" for clips migrated without a record. */
	tier: string;
	/** ElevenLabs only: the model that spoke it. Absent on clips from before 2026-11-07. */
	model?: string;
	/** The exact text spoken; null only for migrated clips whose text could not be recovered. */
	text: string | null;
	/** Path relative to <data>/audio, forward slashes. */
	file: string;
	bytes: number;
	createdAt: string;
}

const AUDIO_INDEX = () => path.join(PATHS.audio, "index.jsonl");

/** The cache key: one clip per (language, voice, exact text). Playback
 *  speed is the client's job and never splits the key. */
export function audioKey(lang: string, voice: AudioVoice, text: string): string {
	const t = text.normalize("NFC").trim();
	return crypto.createHash("sha256").update(`${lang}\u0000${voice}\u0000${t}`).digest("hex");
}

/** "Dobrý deň, ako sa máte?" → "dobry-den-ako-sa-mate" (ASCII, ≤48 chars). */
export function slugify(text: string, max = 48): string {
	const ascii = text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const cut = ascii.slice(0, max);
	return cut.replace(/-+$/g, "") || "clip";
}

function clipRelativePath(entry: Pick<AudioClipEntry, "lang" | "voice" | "key" | "text">, ext: string): string {
	const name = entry.text ? slugify(entry.text) : "unknown";
	return `${entry.lang}/${entry.voice}/${name}-${entry.key.slice(0, 12)}.${ext}`;
}

let audioCache: { mtime: number; size: number; map: Map<string, AudioClipEntry> } | null = null;

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

/** The clip index as a map, re-read when the file changes on disk. */
export function readAudioIndex(): Map<string, AudioClipEntry> {
	const file = AUDIO_INDEX();
	let stat: fs.Stats | null = null;
	try {
		stat = fs.statSync(file);
	} catch {
		audioCache = { mtime: 0, size: 0, map: new Map() };
		return audioCache.map;
	}
	if (audioCache && audioCache.mtime === stat.mtimeMs && audioCache.size === stat.size) return audioCache.map;
	const map = new Map<string, AudioClipEntry>();
	for (const e of readJsonl<AudioClipEntry>(file)) if (e && typeof e.key === "string") map.set(e.key, e);
	audioCache = { mtime: stat.mtimeMs, size: stat.size, map };
	return map;
}

export function listAudioClips(): AudioClipEntry[] {
	return [...readAudioIndex().values()];
}

/** An indexed clip whose file still exists, else null. */
export function findAudioClip(key: string): (AudioClipEntry & { absolute: string }) | null {
	const entry = readAudioIndex().get(key);
	if (!entry) return null;
	const absolute = path.join(PATHS.audio, entry.file);
	try {
		if (fs.statSync(absolute).size > 0) return { ...entry, absolute };
	} catch {
		// indexed but gone — treat as a miss; the next store() re-indexes it
	}
	return null;
}

/** Write a clip and its index line; returns the entry with its absolute path. */
export function storeAudioClip(input: { key: string; lang: string; voice: AudioVoice; tier: string; model?: string; text: string; ext: "mp3" | "wav"; data: Buffer; now?: Date }): AudioClipEntry & { absolute: string } {
	const entry: AudioClipEntry = {
		key: input.key,
		lang: input.lang,
		voice: input.voice,
		tier: input.tier,
		...(input.model ? { model: input.model } : {}),
		text: input.text.normalize("NFC").trim(),
		file: clipRelativePath({ lang: input.lang, voice: input.voice, key: input.key, text: input.text }, input.ext),
		bytes: input.data.length,
		createdAt: (input.now ?? new Date()).toISOString(),
	};
	const absolute = path.join(PATHS.audio, entry.file);
	fs.mkdirSync(path.dirname(absolute), { recursive: true });
	const tmp = `${absolute}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, input.data);
	fs.renameSync(tmp, absolute);
	appendJsonl(AUDIO_INDEX(), entry);
	audioCache = null;
	ensureReadmes();
	return { ...entry, absolute };
}

export interface MigrationCandidate {
	lang: string;
	voice: AudioVoice;
	text: string;
}

/**
 * Move clips from the pre-index location (<data>/cache/audio/<sha256>.mp3)
 * into the indexed tree. The old names carry only the hash, so the text is
 * recovered by hashing every phrase the app could have spoken (say: spans
 * in chats, lexicon sentences, review cards) and matching; a clip nothing
 * matches is kept as <lang>/<voice>/unknown-<key>.mp3 with text null —
 * never thrown away. Runs once: the old folder disappears when empty.
 */
export function migrateLegacyAudio(candidates: () => Iterable<MigrationCandidate>, fallbackLang = "sk"): { moved: number; matched: number } {
	const legacy = PATHS.audioLegacy;
	let files: string[];
	try {
		files = fs.readdirSync(legacy).filter((f) => /^[0-9a-f]{64}\.(mp3|wav)$/.test(f));
	} catch {
		return { moved: 0, matched: 0 };
	}
	if (files.length === 0) {
		try {
			fs.rmdirSync(legacy);
			fs.rmdirSync(path.dirname(legacy));
		} catch {
			// not empty or already gone — fine either way
		}
		return { moved: 0, matched: 0 };
	}
	const byKey = new Map<string, MigrationCandidate>();
	for (const c of candidates()) {
		const text = c.text.normalize("NFC").trim();
		if (!text) continue;
		byKey.set(audioKey(c.lang, c.voice, text), { ...c, text });
	}
	const index = readAudioIndex();
	let moved = 0;
	let matched = 0;
	for (const f of files) {
		const key = f.slice(0, 64);
		const ext = f.slice(65);
		const from = path.join(legacy, f);
		let stat: fs.Stats;
		try {
			stat = fs.statSync(from);
		} catch {
			continue;
		}
		if (index.has(key)) {
			fs.rmSync(from, { force: true });
			continue;
		}
		const hit = byKey.get(key);
		const entry: AudioClipEntry = {
			key,
			lang: hit?.lang ?? fallbackLang,
			voice: hit?.voice ?? "female",
			tier: "unknown",
			text: hit?.text ?? null,
			file: clipRelativePath({ lang: hit?.lang ?? fallbackLang, voice: hit?.voice ?? "female", key, text: hit?.text ?? null }, ext),
			bytes: stat.size,
			createdAt: stat.mtime.toISOString(),
		};
		const to = path.join(PATHS.audio, entry.file);
		fs.mkdirSync(path.dirname(to), { recursive: true });
		try {
			fs.renameSync(from, to);
		} catch {
			fs.copyFileSync(from, to);
			fs.rmSync(from, { force: true });
		}
		appendJsonl(AUDIO_INDEX(), entry);
		moved++;
		if (hit) matched++;
	}
	audioCache = null;
	try {
		fs.rmdirSync(legacy);
		fs.rmdirSync(path.dirname(legacy));
	} catch {
		// something else lives there — leave it
	}
	ensureReadmes();
	return { moved, matched };
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

/** One answered rep, with everything the learner saw. */
export interface LessonLogRep {
	itemId: string;
	kind: string;
	unit: string;
	slug: string;
	lemma: string;
	gloss: string;
	sentence: string;
	translation: string;
	answer: string;
	/** What the learner typed, picked, or built ("" when nothing). */
	given: string;
	verdict: "exact" | "accents" | "wrong";
	/** Right on the second try, after the hint. */
	assisted: boolean;
	/** The hint shown on a miss (gloss or dictionary form). */
	hint?: string;
	trigger?: string;
	options?: string[];
	mixed?: boolean;
	again?: boolean;
	/** Listen reps (2026-10-28, the milestones model): sentence shown →
	 *  meaning picked, the first playback's length, plays after it,
	 *  whether the text was shown before the pick, words in the sentence. */
	ms?: number;
	heardMs?: number;
	replays?: number;
	peeked?: boolean;
	words?: number;
	/** Listen reps (2026-11-03): the words the learner had not met, as they stand in the sentence, so a typed miss can be told from a gap in vocabulary (src/core/listen-analysis.ts). */
	stretch?: string[];
	/** Form reps (2026-10-31, first tries): the word's lexicon gender, the
	 *  first answer before any help (src/core/first-try.ts), and the slip a
	 *  counted wrong first try got (src/core/form-slip.ts). Speak reps carry
	 *  `drill`, the case drill the slip was on. */
	gender?: string;
	first?: FirstAnswer;
	slip?: FormSlip;
	drill?: string;
}

export interface LessonLogEntry {
	id: string;
	/** ISO time the lesson was recorded. */
	at: string;
	/** The learner's local day (YYYY-MM-DD) — also the file it lives in. */
	day: string;
	unit: string;
	/** placement: the setup's staircase drill (unit "placement");
	 *  listen: the Listen task (unit "listen"), where `answer` is the
	 *  translation picked and `given` the meaning chosen; speak: a spoken
	 *  scene (unit = the scene id), one rep per correction; fluency: a
	 *  "say it faster" round, one rep per sentence (unit "fast"); mixups:
	 *  a Mix-ups lesson (unit "mixups", src/core/mixups.ts); personal: the
 *  lesson built from the guide's targets (unit "personal", src/core/personal.ts). */
	mode: "lesson" | "blitz" | "mixups" | "personal" | "placement" | "listen" | "speak" | "fluency";
	ms?: number;
	xp: number;
	correct: number;
	total: number;
	perfect: boolean;
	/** Missed words queued in the review deck. */
	queued: string[];
	reps: LessonLogRep[];
}

const lessonFile = (day: string) => path.join(PATHS.lessons, `${day}.jsonl`);

export function appendLessonLog(entry: LessonLogEntry): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.day)) throw new Error(`bad day ${entry.day}`);
	appendJsonl(lessonFile(entry.day), entry);
	ensureReadmes();
}

/** Every logged lesson, oldest first. */
export function readLessonLog(): LessonLogEntry[] {
	let days: string[];
	try {
		days = fs
			.readdirSync(PATHS.lessons)
			.filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
			.sort();
	} catch {
		return [];
	}
	return days.flatMap((f) => readJsonl<LessonLogEntry>(path.join(PATHS.lessons, f)));
}

// ─── Why? ────────────────────────────────────────────────────────────────────

interface WhyEntry {
	key: string;
	lang: string;
	sentence: string;
	answer: string;
	lemma: string;
	/** The learner's answer the first time they asked. */
	given: string;
	chatId: string;
	createdAt: string;
	/** How many times the chat was reopened instead of regenerated. */
	reused: number;
}

const WHY_FILE = () => path.join(PATHS.lessons, "why-index.json");

export function whyKey(lang: string, sentence: string, answer: string): string {
	return crypto.createHash("sha256").update(`${lang}\u0000${sentence.normalize("NFC").trim()}\u0000${answer.normalize("NFC").trim()}`).digest("hex").slice(0, 24);
}

function readWhyIndex(): Record<string, WhyEntry> {
	try {
		const parsed = JSON.parse(fs.readFileSync(WHY_FILE(), "utf-8")) as { entries?: Record<string, WhyEntry> };
		return parsed.entries ?? {};
	} catch {
		return {};
	}
}

function writeWhyIndex(entries: Record<string, WhyEntry>): void {
	const file = WHY_FILE();
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify({ version: 1, entries }, null, "\t"), "utf-8");
	fs.renameSync(tmp, file);
}

export function findWhy(key: string): WhyEntry | null {
	return readWhyIndex()[key] ?? null;
}

export function listWhy(): WhyEntry[] {
	return Object.values(readWhyIndex());
}

export function rememberWhy(entry: Omit<WhyEntry, "createdAt" | "reused"> & { createdAt?: string }): WhyEntry {
	const entries = readWhyIndex();
	const full: WhyEntry = { ...entry, createdAt: entry.createdAt ?? new Date().toISOString(), reused: 0 };
	entries[entry.key] = full;
	writeWhyIndex(entries);
	ensureReadmes();
	return full;
}

export function countWhyReuse(key: string): void {
	const entries = readWhyIndex();
	const e = entries[key];
	if (!e) return;
	e.reused = (e.reused ?? 0) + 1;
	writeWhyIndex(entries);
}

export function forgetWhy(key: string): void {
	const entries = readWhyIndex();
	if (!(key in entries)) return;
	delete entries[key];
	writeWhyIndex(entries);
}

// ─── READMEs on disk ─────────────────────────────────────────────────────────

const readmesWritten = new Set<string>();

/**
 * Put a README next to every kind of data so the folder explains itself
 * (Xurify: "extremely organized, easy to find"). Each file is checked once
 * per process (again once its folder appears), rewritten only when the
 * text changed; nothing else is touched.
 */
export function ensureReadmes(force = false): void {
	const targets: Array<[string, string]> = [
		[path.join(PATHS.base, "README.md"), DATA_READMES.root],
		[path.join(PATHS.audio, "README.md"), DATA_READMES.audio],
		[path.join(PATHS.data, "README.md"), DATA_READMES.profile],
		[path.join(PATHS.lessons, "README.md"), DATA_READMES.lessons],
		[path.join(PATHS.chats, "README.md"), DATA_READMES.chats],
		[path.join(PATHS.stories, "README.md"), DATA_READMES.stories],
		[path.join(PATHS.speak, "README.md"), DATA_READMES.speak],
		[path.join(PATHS.fluency, "README.md"), DATA_READMES.fluency],
		[path.join(PATHS.videos, "README.md"), DATA_READMES.videos],
		[path.join(PATHS.distractors, "README.md"), DATA_READMES.distractors],
		[path.join(PATHS.cheatsheets, "README.md"), DATA_READMES.cheatsheets],
	];
	for (const [file, text] of targets) {
		if (readmesWritten.has(file) && !force) continue;
		try {
			// Only folders that exist get a README: an empty profile is not
			// sprinkled with files before it holds anything.
			if (!fs.existsSync(path.dirname(file))) continue;
			let current = "";
			try {
				current = fs.readFileSync(file, "utf-8");
			} catch {
				// absent
			}
			if (current !== text) fs.writeFileSync(file, text, "utf-8");
			readmesWritten.add(file);
		} catch {
			// a README is a courtesy, never a failure
		}
	}
}