import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root (this file is at <root>/config.ts). */
export const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * THE data-location seam (the Electron contract, 2026-09-17): LH_DATA_DIR
 * relocates every MUTABLE record — chat sessions, graph ledgers, the
 * embedding model cache — when set. The desktop shell points it at
 * userData so nothing is written inside the read-only .app bundle
 * (macOS translocation guarantees the bundle is read-only anyway).
 * Unset (plain web dev / repo work) it resolves to the repo's data/,
 * byte-for-byte as before. Read-only assets (prompts) stay ROOT-anchored
 * on purpose: they ship inside the app bundle by design.
 */
const BASE_DATA_ROOT = process.env.LH_DATA_DIR
	? path.resolve(process.env.LH_DATA_DIR)
	: underTestRunner()
		? testDataRoot()
		: path.join(ROOT, "data");

/**
 * THE TEST FENCE (LangHarness, 2026-10-28): a test run that does not set
 * LH_DATA_DIR itself gets a throwaway folder under the OS temp dir, never
 * the real data/. Upstream tests create chats ("feed chat A", "getApiKey
 * pin") and jobs through the real stores and clean up with unlink; run on
 * Xurify's PC from a shell where deletes are blocked, those fixtures
 * landed in the learner's own session list, and opening one started a
 * paid placement turn. Tests that set the seam before importing config
 * (the chat-store-events pattern) keep their own folder.
 *
 * WIDENED 2026-10-29: the fence used to key on NODE_ENV=test alone, which
 * `npm test` sets with POSIX syntax that Windows cmd.exe rejects, so people
 * ran `tsx --test` bare and the suite wrote its fixtures, goal, units and
 * test log entries into the learner's real data again and again (checked:
 * fixtures from 10-27 and from several runs on 10-29). Node's own test
 * runner marks every test process with NODE_TEST_CONTEXT (verified for both
 * `node --test` and `tsx --test` with NODE_ENV unset), so the fence now
 * holds however the suite is launched.
 */
function underTestRunner(): boolean {
	return process.env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT !== undefined;
}

function testDataRoot(): string {
	const dir = path.join(os.tmpdir(), `lh-test-data-${process.pid}`);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

// ─── Language profiles (LangHarness, spec D7 / WF-01) ──────────────────────
// Each target language keeps its own learning records under
// <data>/profiles/<language>/ — chats, graph ledgers, jobs, review cards,
// debug — so two languages never mix. Settings, prompt overrides, keys
// and the audio cache stay at the data root: they are about the learner and
// their providers, not about one language. The active profile is read ONCE
// at boot (LH_PROFILE env wins, else <data>/profile.json, else slovak) and
// switched in place after that (POST /api/profile).

/** The profiles that ship with the app. Every other language is added from
 *  the app with its generated course. */
export const LANGUAGE_PROFILES = ["slovak"] as const;
/** A built-in profile or one the learner added (<data>/languages/<id>/). */
export type LanguageProfile = string;

/** Where the active profile choice is stored (a tiny {active} JSON). */
export const PROFILE_FILE = path.join(BASE_DATA_ROOT, "profile.json");

/** Languages added from the app: <data>/languages/<id>/ holds the words,
 *  the course, the grammar map and language.json. language.json is written
 *  last, so a folder without it is an addition still running or one that
 *  failed. One without course.json predates generated courses: adding the
 *  language again finishes it from the kept downloads. */
const LANGUAGES_DIR = path.join(BASE_DATA_ROOT, "languages");
const PROFILE_ID_RE = /^[a-z][a-z-]{1,31}$/;

/** The ids of the added languages that finished. Read from disk each call:
 *  a language added while the app runs is listed without a restart. */
export function addedLanguageIds(): string[] {
	let names: string[];
	try {
		names = fs.readdirSync(LANGUAGES_DIR);
	} catch {
		return [];
	}
	return names
		.filter((id) => PROFILE_ID_RE.test(id) && !(LANGUAGE_PROFILES as readonly string[]).includes(id) && ["language.json", "course.json"].every((f) => fs.existsSync(path.join(LANGUAGES_DIR, id, f))))
		.sort();
}

/** An added language's language.json as written, or null. */
export function readAddedLanguage(id: string): unknown {
	if (!PROFILE_ID_RE.test(id)) return null;
	try {
		return JSON.parse(fs.readFileSync(path.join(LANGUAGES_DIR, id, "language.json"), "utf-8"));
	} catch {
		return null;
	}
}

/** Every profile the learner can switch to: built-in first, then added. */
export function languageProfiles(): string[] {
	return [...LANGUAGE_PROFILES, ...addedLanguageIds()];
}

export function isLanguageProfile(v: unknown): v is LanguageProfile {
	return typeof v === "string" && languageProfiles().includes(v);
}

/** profile.json: the language chosen for the next start, and the built-in
 *  languages the learner removed from their list (other ids are dropped on
 *  read, so a language that stops being built in is not hidden by mistake). */
export interface ProfileChoice {
	active?: string;
	hidden: string[];
}

export function readProfileChoice(): ProfileChoice {
	try {
		const parsed: unknown = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf-8"));
		const r = parsed && typeof parsed === "object" ? (parsed as { active?: unknown; hidden?: unknown }) : {};
		const hidden = Array.isArray(r.hidden) ? r.hidden.filter((h): h is string => typeof h === "string" && (LANGUAGE_PROFILES as readonly string[]).includes(h)) : [];
		return { ...(typeof r.active === "string" ? { active: r.active } : {}), hidden: [...new Set(hidden)] };
	} catch {
		return { hidden: [] };
	}
}

/** Change part of profile.json and keep the rest. */
export function saveProfileChoice(patch: Partial<ProfileChoice>): ProfileChoice {
	const next = { ...readProfileChoice(), ...patch };
	const out: Record<string, unknown> = {};
	if (next.active) out.active = next.active;
	if (next.hidden.length) out.hidden = [...new Set(next.hidden)];
	fs.mkdirSync(path.dirname(PROFILE_FILE), { recursive: true });
	fs.writeFileSync(PROFILE_FILE, JSON.stringify(out), "utf-8");
	return next;
}

/** The languages the learner's list shows: every profile but the built-in
 *  ones they removed. The running one always shows. */
export function shownProfiles(): string[] {
	const hidden = new Set(readProfileChoice().hidden);
	const active = activeProfile();
	return languageProfiles().filter((id) => id === active || !hidden.has(id));
}

/** A language's data file: the copy the app ships (curriculum/<id>/) when
 *  there is one, else the one built when the learner added it. */
export function curriculumFile(profile: string, name: string): string {
	const shipped = path.join(ROOT, "curriculum", profile, name);
	if (fs.existsSync(shipped)) return shipped;
	const added = path.join(LANGUAGES_DIR, profile, name);
	return fs.existsSync(added) ? added : shipped;
}

// The running language is process state, switched in place (POST
// /api/profile) with no restart. `next dev` evaluates this module again for
// each route it compiles and after HMR, all in one process (2026-11-01: one
// server read one language on Today while lessons went into another), so the
// state lives on globalThis, per data folder: every copy of this module reads
// and switches the same one.
interface Running {
	profile: LanguageProfile;
}
const RUNNING = ((globalThis as { __lhRunning?: Record<string, Running> }).__lhRunning ??= {});

// A language added from the app runs its own generated course;
// src/core/course.ts reads it from globalThis under this key (config may not
// import the core). Absent runs the Slovak course.
const COURSE_KEY = "__lhCourse";
const COURSES = ((globalThis as { __lhCourses?: Map<string, { mtimeMs: number; course: unknown }> }).__lhCourses ??= new Map());

/** An added language's course.json, kept while the file is unchanged so the
 *  core's tables, cached per course object, are built once. */
function readCourse(profile: LanguageProfile): unknown {
	const file = path.join(LANGUAGES_DIR, profile, "course.json");
	let mtimeMs: number;
	try {
		mtimeMs = fs.statSync(file).mtimeMs;
	} catch {
		return undefined;
	}
	const kept = COURSES.get(file);
	if (kept?.mtimeMs === mtimeMs) return kept.course;
	try {
		const course: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
		COURSES.set(file, { mtimeMs, course });
		return course;
	} catch {
		return undefined;
	}
}

function bootProfile(): LanguageProfile {
	if (isLanguageProfile(process.env.LH_PROFILE)) return process.env.LH_PROFILE;
	const { active } = readProfileChoice();
	return isLanguageProfile(active) ? active : "slovak";
}

function running(): Running {
	let r = RUNNING[PROFILE_FILE];
	if (!r) {
		r = RUNNING[PROFILE_FILE] = { profile: bootProfile() };
		// A test may have put a course in place before this module loaded.
		const g = globalThis as Record<string, unknown>;
		if (g[COURSE_KEY] === undefined) g[COURSE_KEY] = readCourse(r.profile);
	}
	return r;
}

function enter(profile: LanguageProfile): void {
	running().profile = profile;
	(globalThis as Record<string, unknown>)[COURSE_KEY] = readCourse(profile);
}

/** The language the server runs now. Read it when it is used: a switch
 *  changes it in place. */
export function activeProfile(): LanguageProfile {
	return running().profile;
}

/** Run another language from now on: its data folder, its course, and the
 *  choice saved for the next start. */
export function switchProfile(profile: LanguageProfile): void {
	if (!isLanguageProfile(profile)) throw new Error(`"${profile}" is not one of your languages`);
	enter(profile);
	saveProfileChoice({ active: profile });
}

/** Read another language's records without switching to it (the daily plan
 *  across languages). `fn` must be synchronous: nothing else runs in the
 *  process until it returns, so no request ever sees the borrowed language. */
export function withProfile<T>(profile: LanguageProfile, fn: () => T): T {
	const r = running();
	if (profile === r.profile) return fn();
	const g = globalThis as Record<string, unknown>;
	const before = { profile: r.profile, course: g[COURSE_KEY] };
	enter(profile);
	try {
		return fn();
	} finally {
		r.profile = before.profile;
		g[COURSE_KEY] = before.course;
	}
}

running();

const dataRoot = () => path.join(BASE_DATA_ROOT, "profiles", activeProfile());

// The per-language paths are getters, so they follow a switch.
export const PATHS = {
	root: ROOT,
	/** Teacher system prompt — the agent's instructions (src/agent/). */
	teacherPrompt: path.join(ROOT, "src", "agent", "system-prompt.md"),
	/** The data root shared by every language profile. */
	base: BASE_DATA_ROOT,
	/** The running profile's root (data/profiles/<language>). */
	get data() {
		return dataRoot();
	},
	/** The read-only curriculum assets (seed graph, lexicon) per language. */
	curriculum: path.join(ROOT, "curriculum"),
	/** Languages added from the app, shared by every profile. */
	languages: LANGUAGES_DIR,
	/** Every spoken clip, paid for once and kept for good (LangHarness
	 *  corpus, 2026-10-27): <data>/audio/<lang>/<voice>/<slug>-<key>.mp3
	 *  plus audio/index.jsonl (text, voice, tier, date per clip). Shared
	 *  across profiles — a Slovak clip is a Slovak clip. */
	audio: path.join(BASE_DATA_ROOT, "audio"),
	/** Where clips lived before 2026-10-27 (<data>/cache/audio/<sha256>.mp3,
	 *  no index). Migrated into `audio` on first use (src/store/corpus.ts). */
	audioLegacy: path.join(BASE_DATA_ROOT, "cache", "audio"),
	/** Every finished lesson and blitz with every sentence and answer
	 *  (lessons/<day>.jsonl) and the Why? index (lessons/why-index.json),
	 *  so a repeat Why? reopens its chat instead of paying for a new one. */
	get lessons() {
		return path.join(dataRoot(), "lessons");
	},
	/** Graded stories for the Read task (LangHarness reading, 2026-10-28):
	 *  stories/<id>.json (the text with glossed tokens, questions, cost),
	 *  stories/index.jsonl (one line per story) and stories/reads.jsonl
	 *  (one line per reading) — src/store/stories.ts. */
	get stories() {
		return path.join(dataRoot(), "stories");
	},
	/** Spoken scenes for the Speak task (LangHarness, 2026-10-28):
	 *  speak/<id>.json (every line, the prompts, the summary, cost),
	 *  speak/<id>/<n>.wav (the learner's own recordings), speak/index.jsonl
	 *  — src/store/speak.ts. */
	get speak() {
		return path.join(dataRoot(), "speak");
	},
	/** Placement checks (LangHarness, 2026-10-28): placement/<id>.json —
	 *  every item and answer of the adaptive ladder, the model's judgements,
	 *  the Socratic turns, the vocabulary ticks, the outcome and the cost —
	 *  and placement/index.jsonl, one line per finished check. */
	get placement() {
		return path.join(dataRoot(), "placement");
	},
	/** The fluency strand's log (timed re-reads, say-it-faster rounds):
	 *  fluency/log.jsonl — src/store/speak.ts. */
	get fluency() {
		return path.join(dataRoot(), "fluency");
	},
	/** Today's line (src/store/line.ts): line/log.jsonl, one line per
	 *  morning or evening hearing. */
	get line() {
		return path.join(dataRoot(), "line");
	},
	/** YouTube videos prepared for the Watch task (LangHarness watch,
	 *  2026-10-28): videos/<id>.json (the segmented transcript with glossed
	 *  tokens, translations, questions, cost), videos/captions/<id>.<lang>.json
	 *  (the raw caption track as fetched), videos/index.jsonl and
	 *  videos/watches.jsonl (one line per watching) — src/store/videos.ts. */
	get videos() {
		return path.join(dataRoot(), "videos");
	},
	/** Normalized, app-independent exports (npm run corpus:export). */
	exports: path.join(BASE_DATA_ROOT, "export"),
	/** Near-miss wrong answers for meaning questions, written once by the cheap model (src/store/distractors.ts). */
	get distractors() {
		return path.join(dataRoot(), "distractors");
	},
	/** Spaced-review cards and their log (src/store/review.ts). */
	get review() {
		return path.join(dataRoot(), "review");
	},
	/** Saved phrases, bookmarks, and starred items (src/store/saved-phrases.ts). */
	get saved() {
		return path.join(dataRoot(), "saved");
	},
	/** Imported cheatsheets (Words → Cheatsheets): cheatsheets/<id>.json
	 *  (the parsed sheet), cheatsheets/<id>.md (the text as imported),
	 *  cheatsheets/trash/ (removed ones) — src/store/cheatsheets.ts. */
	get cheatsheets() {
		return path.join(dataRoot(), "cheatsheets");
	},
	/** Chat sessions (AI SDK UIMessage transcripts, one JSON file per chat). */
	get chats() {
		return path.join(dataRoot(), "chats");
	},
	get graph() {
		return path.join(dataRoot(), "graph");
	},
	/** Debug artifacts (env-gated): data/debug/provider-events/<chatId>.jsonl
	 * raw provider stream recordings (src/agent/provider-events.ts). */
	get debug() {
		return path.join(dataRoot(), "debug");
	},
} as const;

// ─── Models ────────────────────────────────────────────────────────────────
// BYOK ALL THE WAY DOWN (owner, 2026-09-22): there are NO factory default
// models. Every engine resolves from the user's model slots (settings.json
// models section: strong/cheap/vision) over per-role/ChatSettings overrides,
// and a chain that ends empty REFUSES honestly (503 models_not_configured).
// .env stays for secrets (API keys) only. What remains here are ENGINE
// CONSTRUCTION FACTS: the thinking-level scale and the default order.

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** Every agent role in the app. The conversation pair (prober/teacher)
 *  resolves chat.model → strong slot; background roles resolve their own
 *  override → tier slot (core/settings-resolution.ts ROLE_SLOT). */
export type ModelRole =
	| "prober"
	| "teacher"
	| "researcher"
	| "demoBuilder"
	| "visualMaker"
	| "pdfReader"
	| "extractor"
	| "auditor";

/**
 * The LIVE graph store (src/store/graph.ts) — owned by the app's extraction
 * pipeline. Line shapes: src/core/contracts.ts. CHAINS ARE THE STORED
 * TRUTH (owner, 2026-09-30): edges are a derived view, never stored.
 */
export const LEDGER_FILES = {
	get nodes() {
		return path.join(PATHS.graph, "nodes.jsonl");
	},
	get chains() {
		return path.join(PATHS.graph, "chains.jsonl");
	},
	get sessions() {
		return path.join(PATHS.graph, "sessions.jsonl");
	},
	/** Per-message extraction coverage (contracts/graph.ts CoverageEntry;
	 *  the checkpoint's replacement for chat extractions — notes keep
	 *  sessions.jsonl, whole-file as they are). */
	get coverage() {
		return path.join(PATHS.graph, "coverage.jsonl");
	},
} as const;

/**
 * Notes-import bookkeeping (NOT a ledger): one JSON map, src-id → NotesSource
 * record (contracts/graph.ts) — the file path + import time + the run's usage
 * log. Read-modify-write like a chat file, not append-only like the ledgers.
 */
export const sourcesFile = () => path.join(PATHS.graph, "sources.json");
/** The layout ledger (read-modify-write like sources.json): nodeId →
 *  {x,y} resting positions from the incremental settle (core/layout.ts).
 *  Carries an updatedAt stamp for future live-physics conflict handling. */
export const positionsFile = () => path.join(PATHS.graph, "positions.json");

/**
 * Graph render settings (the settings-panel controls): one small JSON blob,
 * read-modify-write. Shared shape/sanitizer: src/core/render-settings.ts.
 */
export const renderSettingsFile = () => path.join(PATHS.graph, "render-settings.json");

/** The graph-family FORMAT STAMP sidecar (schema-versioning wave,
 *  2026-10-10): one version for the whole family — the four JSONL ledgers,
 *  sources.json, render-settings.json. LAZY v1: absent = v1; the first
 *  graph-family write creates it. positions.json is REBUILDABLE and rides
 *  along unversioned by design (owner ruling). */
export const graphFormatFile = () => path.join(PATHS.graph, "format.json");

/**
 * THE USER SETTINGS RECORD (settings-storage wave, 2026-09-19): one
 * versioned, DELTA-shaped JSON blob at the data-dir seam holding every
 * non-secret product preference — general, agent (background
 * model/thinking overrides + tool toggles + prompt-override switches),
 * appearance, graph. Explicit user choices only: ABSENT keys resolve to the
 * factory defaults compiled into src/core/settings.ts (FACTORY_SETTINGS), so
 * a software update that adds a knob (new tool, new role, new appearance
 * field) needs no migration — old records simply lack the new keys. The
 * version field is a PRIVATE schema counter for breaking shape changes
 * only (field renamed/meaning changed), unrelated to the app release
 * version. Secrets (API keys, login tokens) NEVER live here — auth.json /
 * .env.local keep that role. (The `chat` default-settings section died
 * with per-session models, owner 2026-09-28 — sessions own their model
 * from birth, stamped from the strong slot.)
 */
export const SETTINGS_FILE = path.join(BASE_DATA_ROOT, "settings.json");

/**
 * User prompt-override files (settings-storage wave, 2026-09-19): the
 * per-segment system-prompt overrides mirroring the SOURCE layout
 * (src/agent/prompts/) — the shared base as prompts/system-prompt.md,
 * fragments as prompts/teacher/<file> / prompts/prober/<file>. File
 * PRESENCE alone is not the override: settings.json's agent.prompts map
 * (segmentPath → boolean) is the explicit switch, so a user can keep a
 * customized file on disk but run the source default to compare. The
 * segment list itself is ALWAYS derived from source at runtime (the
 * loader in src/store/prompt-overrides.ts) — code updates that add,
 * remove, or reorder fragments adapt automatically; an override keyed to
 * a vanished segment stops composing but stays on disk.
 */
export const PROMPTS_OVERRIDE_DIR = path.join(BASE_DATA_ROOT, "prompts");

/**
 * THE AUTH/KEY STORE (auth-keys wave, 2026-09-19): BYOK provider keys in a
 * flat {VAR: value} JSON map — the SAME file the Electron app has always
 * hand-edited (owner decision: option A, zero migration). Desktop main.cjs
 * passes LH_AUTH_FILE pointing at userData/auth.json (mode 0600); in dev
 * (no Electron) the default is the repo-root auth.json (gitignored, same
 * pattern as .env.local — a worktree may symlink it to the master copy).
 * The SERVER reads/writes this file directly at call time (no restart to
 * change a key); it reflects the values into process.env at boot with
 * FILL-GAP precedence — real environment variables (incl. .env.local in
 * dev) always win (src/server/keys.ts). Hand-edits still work: the file is
 * re-read from disk on every API access. Secrets NEVER go in settings.json
 * — this file keeps that role, alongside .env.local.
 */
export const AUTH_FILE = process.env.LH_AUTH_FILE
	? path.resolve(process.env.LH_AUTH_FILE)
	: path.join(ROOT, "auth.json");
