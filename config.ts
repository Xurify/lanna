import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root (this file is at <root>/config.ts). */
export const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * THE data-location seam (the Electron contract, 2026-09-17): LANNA_DATA_DIR
 * relocates every MUTABLE record — chat sessions, the
 * embedding model cache — when set. The desktop shell points it at
 * userData so nothing is written inside the read-only .app bundle
 * (macOS translocation guarantees the bundle is read-only anyway).
 * Unset (plain web dev / repo work) it resolves to the repo's data/,
 * byte-for-byte as before. Read-only assets (prompts) stay ROOT-anchored
 * on purpose: they ship inside the app bundle by design.
 */
const BASE_DATA_ROOT = process.env.LANNA_DATA_DIR
	? path.resolve(process.env.LANNA_DATA_DIR)
	: underTestRunner()
		? testDataRoot()
		: path.join(ROOT, "data");

/**
 * THE TEST FENCE (2026-10-28): a test run that does not set
 * LANNA_DATA_DIR itself gets a throwaway folder under the OS temp dir, never
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
	const dir = path.join(os.tmpdir(), `lanna-test-data-${process.pid}`);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

// ─── Language profiles (spec D7 / WF-01) ──────────────────────
// Each target language keeps its own learning records under
// <data>/profiles/<language>/ — chats, jobs, review cards,
// debug — so two languages never mix. Settings, prompt overrides, keys
// and the audio cache stay at the data root: they are about the learner and
// their providers, not about one language. The active profile is read ONCE
// at boot (LANNA_PROFILE env wins, else <data>/profile.json, else slovak) and
// switched in place after that (POST /api/profile).

/** The profiles that ship with the app. Every other language is added from
 *  the app with its generated course. */
export const LANGUAGE_PROFILES = ["slovak"] as const;
/** A built-in profile or one the learner added (<data>/languages/<id>/). */
export type LanguageProfile = string;

/** Where the active profile choice is stored (a tiny {active} JSON). */
const PROFILE_FILE = path.join(BASE_DATA_ROOT, "profile.json");

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
		.filter(
			(id) =>
				PROFILE_ID_RE.test(id) &&
				!(LANGUAGE_PROFILES as readonly string[]).includes(id) &&
				["language.json", "course.json"].every((f) => fs.existsSync(path.join(LANGUAGES_DIR, id, f))),
		)
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
function languageProfiles(): string[] {
	return [...LANGUAGE_PROFILES, ...addedLanguageIds()];
}

export function isLanguageProfile(v: unknown): v is LanguageProfile {
	return typeof v === "string" && languageProfiles().includes(v);
}

/** profile.json: the language chosen for the next start, and the built-in
 *  languages the learner removed from their list (other ids are dropped on
 *  read, so a language that stops being built in is not hidden by mistake). */
interface ProfileChoice {
	active?: string;
	hidden: string[];
}

export function readProfileChoice(): ProfileChoice {
	try {
		const parsed: unknown = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf-8"));
		const r = parsed && typeof parsed === "object" ? (parsed as { active?: unknown; hidden?: unknown }) : {};
		const hidden = Array.isArray(r.hidden)
			? r.hidden.filter(
					(h): h is string => typeof h === "string" && (LANGUAGE_PROFILES as readonly string[]).includes(h),
				)
			: [];
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

/** Cheatsheets kept in the repo (E50): curriculum/<language>/cheatsheets/*.txt,
 *  committed like the rest of the curriculum. A test run never writes there:
 *  under the test fence they live in the throwaway data folder. */
export function repoCheatsheetsDir(profile: string = activeProfile()): string {
	if (process.env.LANNA_REPO_CHEATSHEETS_DIR)
		return path.join(path.resolve(process.env.LANNA_REPO_CHEATSHEETS_DIR), profile);
	if (underTestRunner()) return path.join(BASE_DATA_ROOT, "repo-cheatsheets", profile);
	return path.join(ROOT, "curriculum", profile, "cheatsheets");
}

// `next dev` evaluates this module again for each route it compiles and after
// HMR, all in one process, so shared state lives on globalThis, per data folder.
interface Running {
	profile: LanguageProfile;
	borrowed?: LanguageProfile;
	pinnedCourse?: unknown;
}
const RUNNING = ((globalThis as { __lhRunning?: Record<string, Running> }).__lhRunning ??= {});

const COURSE_KEY = "__lhCourse";
const COURSE_RECHECK_MS = 1000;
const COURSES = ((
	globalThis as { __lhCourses?: Map<string, { file: string; mtimeMs: number; checkedAt: number; course: unknown }> }
).__lhCourses ??= new Map());

function courseFile(profile: LanguageProfile): string {
	const checkedFile = path.join(LANGUAGES_DIR, profile, "course.json");
	const shippedFile = path.join(ROOT, "curriculum", profile, "course.json");
	return fs.existsSync(checkedFile) ? checkedFile : fs.existsSync(shippedFile) ? shippedFile : checkedFile;
}

function readCourse(profile: LanguageProfile): unknown {
	if ((LANGUAGE_PROFILES as readonly string[]).includes(profile)) return undefined;
	const key = `${LANGUAGES_DIR}\0${profile}`;
	const kept = COURSES.get(key);
	const now = Date.now();
	if (kept && now - kept.checkedAt < COURSE_RECHECK_MS) return kept.course;
	const file = courseFile(profile);
	let mtimeMs: number;
	try {
		mtimeMs = fs.statSync(file).mtimeMs;
	} catch {
		COURSES.set(key, { file, mtimeMs: -1, checkedAt: now, course: undefined });
		return undefined;
	}
	if (kept?.file === file && kept.mtimeMs === mtimeMs) {
		kept.checkedAt = now;
		return kept.course;
	}
	try {
		const course: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
		COURSES.set(key, { file, mtimeMs, checkedAt: now, course });
		return course;
	} catch {
		return undefined;
	}
}

function bootProfile(): LanguageProfile {
	if (isLanguageProfile(process.env.LANNA_PROFILE)) return process.env.LANNA_PROFILE;
	const { active } = readProfileChoice();
	return isLanguageProfile(active) ? active : "slovak";
}

function running(): Running {
	let r = RUNNING[PROFILE_FILE];
	if (!r) r = RUNNING[PROFILE_FILE] = { profile: bootProfile() };
	return r;
}

type RequestProfile = () => LanguageProfile | undefined;
const REQUEST_PROFILE_KEY = "__lhRequestProfile";

export function setRequestProfile(resolve: RequestProfile): void {
	(globalThis as Record<string, unknown>)[REQUEST_PROFILE_KEY] = resolve;
}

function requestProfile(): LanguageProfile | undefined {
	return ((globalThis as Record<string, unknown>)[REQUEST_PROFILE_KEY] as RequestProfile | undefined)?.();
}

export function defaultProfile(): LanguageProfile {
	return running().profile;
}

export function activeProfile(): LanguageProfile {
	const r = running();
	return r.borrowed ?? requestProfile() ?? r.profile;
}

function installCourse(): void {
	const g = globalThis as Record<string, unknown>;
	const found = Object.getOwnPropertyDescriptor(g, COURSE_KEY);
	if (found?.get) return;
	if (found && found.value !== undefined) running().pinnedCourse = found.value;
	Object.defineProperty(g, COURSE_KEY, {
		configurable: true,
		get: () => running().pinnedCourse ?? readCourse(activeProfile()),
		set: (course: unknown) => {
			running().pinnedCourse = course;
		},
	});
}

export function switchProfile(profile: LanguageProfile): void {
	if (!isLanguageProfile(profile)) throw new Error(`"${profile}" is not one of your languages`);
	const r = running();
	r.profile = profile;
	r.pinnedCourse = undefined;
	saveProfileChoice({ active: profile });
}

export function withProfile<T>(profile: LanguageProfile, fn: () => T): T {
	if (profile === activeProfile()) return fn();
	const r = running();
	const before = r.borrowed;
	r.borrowed = profile;
	try {
		return fn();
	} finally {
		r.borrowed = before;
	}
}

installCourse();
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
	/** The read-only curriculum assets (seed data, lexicon) per language. */
	curriculum: path.join(ROOT, "curriculum"),
	/** Languages added from the app, shared by every profile. */
	languages: LANGUAGES_DIR,
	/** Every spoken clip, paid for once and kept for good (Lanna
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
	/** Graded stories for the Read task (reading, 2026-10-28):
	 *  stories/<id>.json (the text with glossed tokens, questions, cost),
	 *  stories/index.jsonl (one line per story) and stories/reads.jsonl
	 *  (one line per reading) — src/store/stories.ts. */
	get stories() {
		return path.join(dataRoot(), "stories");
	},
	/** Spoken scenes for the Speak task (2026-10-28):
	 *  speak/<id>.json (every line, the prompts, the summary, cost),
	 *  speak/<id>/<n>.wav (the learner's own recordings), speak/index.jsonl
	 *  — src/store/speak.ts. */
	get speak() {
		return path.join(dataRoot(), "speak");
	},
	/** Placement checks (2026-10-28): placement/<id>.json —
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
	/** YouTube videos prepared for the Watch task (watch,
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
	/** Debug artifacts (env-gated): data/debug/provider-events/<chatId>.jsonl
	 * raw provider stream recordings (src/agent/provider-events.ts). */
	get debug() {
		return path.join(dataRoot(), "debug");
	},
} as const;
/** Every agent role in the app. The conversation pair (prober/teacher)
 *  resolves chat.model → strong slot; background roles resolve their own
 *  override → tier slot (core/settings-resolution.ts ROLE_SLOT). */
export type ModelRole = "prober" | "teacher" | "researcher" | "pdfReader";

/**
 * THE USER SETTINGS RECORD (settings-storage wave, 2026-09-19): one
 * versioned, DELTA-shaped JSON blob at the data-dir seam holding every
 * non-secret product preference — general, agent (background
 * model/thinking overrides + tool toggles + prompt-override switches),
 * appearance. Explicit user choices only: ABSENT keys resolve to the
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
 * passes LANNA_AUTH_FILE pointing at userData/auth.json (mode 0600); in dev
 * (no Electron) the default is the repo-root auth.json (gitignored, same
 * pattern as .env.local — a worktree may symlink it to the master copy).
 * The SERVER reads/writes this file directly at call time (no restart to
 * change a key); it reflects the values into process.env at boot with
 * FILL-GAP precedence — real environment variables (incl. .env.local in
 * dev) always win (src/server/keys.ts). Hand-edits still work: the file is
 * re-read from disk on every API access. Secrets NEVER go in settings.json
 * — this file keeps that role, alongside .env.local.
 *
 * Under the test fence (2026-11-06) a run that does not set LANNA_AUTH_FILE
 * gets auth.json inside the throwaway data folder, never the repo-root
 * file: a fixture var ("B": "2" from tests/auth-store.test.ts) had reached
 * a real key file, and tests/speak.test.ts deleted and restored the real
 * speech keys in it.
 */
export const AUTH_FILE = process.env.LANNA_AUTH_FILE
	? path.resolve(process.env.LANNA_AUTH_FILE)
	: underTestRunner()
		? path.join(BASE_DATA_ROOT, "auth.json")
		: path.join(ROOT, "auth.json");
