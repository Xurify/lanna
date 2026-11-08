/**
 * Adding a language from the app (2026-11-05): one background task
 * (server/tasks.ts, so it shows in the sidebar's Background section and
 * ends in a ready notice) downloads open data, has a model write the course
 * and the story bible, and writes <data>/languages/<id>/: lexicon.json,
 * course.json, world.json, prompt.md, and language.json last,
 * which is what makes the language appear. Without a model there is no
 * course, so the add does not start.
 *
 * Every step keeps its result under build/, so a failed or stopped add
 * resumes where it ended. The large files are streamed and filtered on the
 * fly; nothing but the filtered rows is kept. The word rules are pure, in
 * src/core/language-build.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { PassThrough, Readable } from "node:stream";
import type { Usage } from "@earendil-works/pi-ai";
import unbzip2 from "unbzip2-stream";
import { activeProfile, LANGUAGE_PROFILES, PATHS, ROOT, addedLanguageIds, readProfileChoice, saveProfileChoice } from "../../config.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { catalogLanguage, LANGUAGE_CATALOG, LANGUAGE_ID_RE, languageById, type CatalogLanguage } from "../core/language.ts";
import {
	ExampleCollector,
	frequencyFromSentences,
	languagePrompt,
	lineMayMatter,
	mergeFormOf,
	mergeHomographs,
	namesIn,
	parseFrequency,
	rankWords,
	readKaikkiEntry,
	sentenceUsable,
	specialLettersOf,
	toLexiconEntries,
	type BuildWord,
	type FormOf,
	type TatoebaSentence,
} from "../core/language-build.ts";
import type { StoryUsage } from "../core/reading.ts";
import { checkCourse, checkWorld, courseDraftPrompt, worldDraftPrompt, type Course } from "../core/course.ts";
import { proceduralCourse } from "../core/course-procedural.ts";
import { PURPOSES } from "../core/onboarding.ts";
import { SPEAK_SCENES } from "../core/speak.ts";
import { countryOf } from "../core/language.ts";
import { piEngineForSpec } from "../agent/models.ts";
import { aiSlot, aiStatus } from "./ai-status.ts";
import { callCost } from "./pricing.ts";
import { piModels } from "../agent/models.ts";
import { isSubscriptionModel } from "../core/prices.ts";
import { failTask, finishTask, listTasks, removeTask, startTask, updateTask } from "./tasks.ts";

/** Words kept per language, commonest first. */
const WORD_LIMIT = 3000;
/** Frequency rows a Wiktionary entry has to appear in to be read at all. */
const WANTED = 30_000;
const UA = "LangHarness/1.0 (language-learning app; adds a language from open data)";
const TATOEBA = "https://downloads.tatoeba.org/exports/per_language";

const taskIdOf = (id: string) => `language:${id}`;

const dirOf = (id: string) => path.join(PATHS.languages, id);
const buildDir = (id: string) => path.join(dirOf(id), "build");

/** Whether a catalog language is added: its words, course and language.json
 *  are all written (config.ts addedLanguageIds). */
const languageAdded = (id: string) => addedLanguageIds().includes(id);

/** What the course writer is told the dictionary holds. */
function courseInventory(entries: ReadonlyArray<{ cat: string; lemma?: string; formTags?: Record<string, string[]> }>, tag: string, scenes: readonly string[]) {
	const tags = new Map<string, number>();
	const cats = new Map<string, number>();
	for (const e of entries) {
		cats.set(e.cat, (cats.get(e.cat) ?? 0) + 1);
		for (const cells of Object.values(e.formTags ?? {})) for (const cell of cells) for (const t of cell.split(" ")) tags.set(t, (tags.get(t) ?? 0) + 1);
	}
	const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
	return { tags: top(tags).slice(0, 60), cats: top(cats), words: entries.slice(0, 400).map((e) => (e.lemma ?? "").toLocaleLowerCase(tag)), scenes };
}

interface CatalogRow {
	id: string;
	english: string;
	endonym: string;
	tag: string;
	ready: boolean;
	adding: boolean;
	/** A built-in language the learner removed from their list: adding it
	 *  puts it back at once, with no download. */
	restoreOnly?: boolean;
	writtenCourse?: boolean;
}

const isBuiltIn = (id: string) => (LANGUAGE_PROFILES as readonly string[]).includes(id);
const isHidden = (id: string) => readProfileChoice().hidden.includes(id);

export function languageCatalog(): CatalogRow[] {
	const running = new Set(listTasks().filter((t) => t.kind === "language" && t.status === "running").map((t) => t.id));
	const hidden = readProfileChoice().hidden;
	const rows: CatalogRow[] = LANGUAGE_CATALOG.map((l) => ({
		id: l.id,
		english: l.english,
		endonym: l.endonym,
		tag: l.tag,
		ready: languageAdded(l.id),
		adding: running.has(taskIdOf(l.id)),
		...(fs.existsSync(path.join(ROOT, "curriculum", l.id, "course.json")) ? { writtenCourse: true } : {}),
	}));
	// A built-in language ships whole and is not in the catalog: once removed, it is listed here so it can come back.
	for (const id of hidden) {
		const info = languageById(id);
		if (!info) continue;
		rows.unshift({ id, english: info.english, endonym: info.endonym, tag: info.tag, ready: false, adding: false, restoreOnly: true });
	}
	return rows;
}

/** Put a removed built-in language back in the list. True when it was removed. */
export function restoreLanguage(id: string): boolean {
	const { hidden } = readProfileChoice();
	if (!hidden.includes(id)) return false;
	saveProfileChoice({ hidden: hidden.filter((h) => h !== id) });
	return true;
}

interface AddDeps {
	fetch?: typeof fetch;
	/** The model call that writes the course and the story bible. Defaults
	 *  to the Strong slot, else the Cheap one. */
	ask?: Ask;
	/** Sentences a grammar unit needs (tests run on a few words). */
	minUnitSentences?: number;
	/** Who builds the course (the add dialog's choice). */
	slot?: CourseWriter;
}

/** One model call: the answer, what it used, the thinking level it ran at,
 *  and whether it stopped at `cap` (the most output tokens it may write)
 *  rather than finishing. */
type Ask = (system: string, prompt: string, signal: AbortSignal, cap: number) => Promise<{ text: string; usage: StoryUsage; level?: string; cut?: boolean }>;

type DraftKind = "course" | "world";

/** A call's tokens before any course has been written on this model: the
 *  prompts are about 3,500 and 1,500 tokens, the answers as above, plus the
 *  thinking the level allows. Replaced by measured calls as soon as there
 *  are some (see addEstimate). */
const FIRST_GUESS: Record<DraftKind, { input: number; output: number }> = { course: { input: 3_500, output: 8_000 }, world: { input: 1_500, output: 3_000 } };
const THINKING_GUESS: Record<string, number> = { off: 0, minimal: 1_000, low: 3_000, medium: 8_000, high: 14_000, xhigh: 20_000 };

interface AddEstimate {
	/** The slot that would write it, or the dictionary alone. */
	slot: CourseWriter;
	/** "provider:id" and the model's display name. */
	model: string;
	name: string;
	/** The thinking level the course would be written at. */
	level: string;
	/** USD, or null when the catalog has no price (a subscription model). */
	typicalUsd: number | null;
	/** The most it can cost: each call cut at its cap, then answered to the doubled cap. */
	mostUsd: number | null;
	/** Earlier calls on this model and level the typical figure comes from; 0 = a first guess. */
	measured: number;
	subscription: boolean;
}

interface DraftCall {
	model: string;
	level?: string;
	usage: StoryUsage;
	/** Stopped at its cap. */
	cut?: boolean;
}

/** Every course or story-bible call made so far, on any language. */
function pastCalls(kind: DraftKind): DraftCall[] {
	let names: string[];
	try {
		names = fs.readdirSync(PATHS.languages);
	} catch {
		return [];
	}
	return names.flatMap((n) => readJson<{ calls?: DraftCall[] }>(path.join(PATHS.languages, n, "build", `${kind}-draft.json`))?.calls ?? []);
}

const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const sum = (usage: StoryUsage, key: "inputTokens" | "outputTokens") => usage.steps.reduce((n, st) => n + (st[key] ?? 0), 0);

/**
 * The output caps for one draft (thinking included). The provider stops a
 * call at its cap, so the most a language can cost is known before it
 * starts; but a cap that is too low cuts a good answer short, and a cut
 * JSON answer is worth nothing. So the cap is generous: room for the answer
 * plus twice the thinking the level allows, and at least twice the longest
 * answer this model at this level has given. A call that still stops at the
 * cap is tried once more with twice the room. Never past the model's own
 * limit.
 */
export function capPlan(kind: DraftKind, writer: WriterSlot = "strong"): { first: number; second: number } {
	const resolved = courseEngine(writer);
	const level = resolved?.engine.level ?? "off";
	const limit = resolved?.engine.model.maxTokens || Infinity;
	const past = resolved ? pastCalls(kind).filter((c) => c.model === resolved.model && (c.level ?? "off") === level) : [];
	const room = 1.5 * FIRST_GUESS[kind].output + 2 * (THINKING_GUESS[level] ?? 0);
	const seen = Math.max(0, ...past.map((c) => sum(c.usage, "outputTokens")));
	const first = Math.round(Math.min(limit, Math.max(room, 2 * seen)));
	return { first, second: Math.round(Math.min(limit, 2 * first)) };
}

/** What writing a course will cost on the model and thinking level that
 *  would write it: the median of earlier calls on that same model and
 *  level when there are any (models differ in tokenizer, length and
 *  thinking), else a first guess; the most is fixed by the caps. */
export function addEstimate(writer: WriterSlot = "strong"): AddEstimate | null {
	const resolved = courseEngine(writer);
	if (!resolved) return null;
	const { model, engine } = resolved;
	const level = engine.level ?? "off";
	const colon = model.indexOf(":");
	const name = piModels().getModel(model.slice(0, colon), model.slice(colon + 1))?.name ?? model.slice(colon + 1);
	let measured = 0;
	let typical: number | null = 0;
	let most: number | null = 0;
	for (const kind of ["course", "world"] as const) {
		const same = pastCalls(kind).filter((c) => c.model === model && (c.level ?? "off") === level);
		measured = Math.max(measured, same.length);
		const input = same.length ? median(same.map((c) => sum(c.usage, "inputTokens"))) : FIRST_GUESS[kind].input;
		const output = same.length ? median(same.map((c) => sum(c.usage, "outputTokens"))) : FIRST_GUESS[kind].output + (THINKING_GUESS[level] ?? 0);
		const caps = capPlan(kind, writer);
		const t = callCost({ inputTokens: input, outputTokens: Math.min(output, caps.first) }, model);
		const m = callCost({ inputTokens: 2 * input, outputTokens: caps.first + caps.second }, model);
		typical = t === null || typical === null ? null : typical + t;
		most = m === null || most === null ? null : most + m;
	}
	return { slot: writer, model, name, level, typicalUsd: typical, mostUsd: most, measured, subscription: isSubscriptionModel(model) };
}

/** The choices the add dialog offers: the Strong slot's model and the
 *  Cheap slot's, each priced; one entry when both are the same model and
 *  thinking level. */
export function addEstimates(): AddEstimate[] {
	const strong = aiSlot("strong")?.model ? addEstimate("strong") : null;
	const cheap = aiSlot("cheap")?.model ? addEstimate("cheap") : null;
	const models = strong && cheap && strong.model === cheap.model && strong.level === cheap.level ? [strong] : [strong, cheap].filter((e): e is AddEstimate => e !== null);
	return [...models, DICTIONARY_ESTIMATE];
}

/** The free choice: the course is built from the dictionary alone. */
const DICTIONARY_ESTIMATE: AddEstimate = { slot: "dictionary", model: "", name: "From the dictionary only", level: "none", typicalUsd: 0, mostUsd: 0, measured: 0, subscription: false };

/** Why a language cannot be added with `writer` now, or null. */
function addBlocker(writer: CourseWriter = "strong"): string | null {
	if (writer === "dictionary") return null;
	return aiStatus("strong").ready || aiStatus().ready ? null : "Writing the course with a model needs one in Settings → AI models. Pick \"From the dictionary only\" to build it without one.";
}

/** Start adding a catalog language in the background. Starting one that is
 *  already being added returns the running task. */
export function startLanguageAdd(id: string, deps: AddDeps = {}): { taskId: string; done: Promise<void> } {
	const lang = catalogLanguage(id);
	if (!lang) throw new Error(`"${id}" is not a language the app can add`);
	if (languageAdded(id)) throw new Error(`${lang.english} is already added.`);
	const other = listTasks().find((t) => t.kind === "language" && t.status === "running" && t.id !== taskIdOf(id));
	if (other) throw new Error(`Wait for "${other.title}" to finish first.`);
	const blocked = deps.ask ? null : addBlocker(deps.slot);
	if (blocked) throw new Error(blocked);
	const { signal, fresh } = startTask({ id: taskIdOf(id), kind: "language", title: `Adding ${lang.english}`, step: "Starting", language: { id, english: lang.english } });
	if (!fresh) return { taskId: taskIdOf(id), done: Promise.resolve() };
	const done = addLanguage(lang, signal, deps).then(
		(note) => finishTask(taskIdOf(id), { title: `${lang.english} is ready`, ...(note ? { note } : {}) }),
		(err: unknown) => failTask(taskIdOf(id), signal.aborted ? "Stopped. Start it again to continue where it stopped." : friendly(err)),
	);
	return { taskId: taskIdOf(id), done };
}

/** Whether a language can be removed from the list now: it is not the one
 *  running, it is not being added, and it is listed (built-in) or has
 *  downloaded data (added). */
export function languageRemovable(id: string): boolean {
	if (id === activeProfile()) return false;
	if (isBuiltIn(id) ? isHidden(id) : !fs.existsSync(dirOf(id))) return false;
	return !listTasks().some((t) => t.id === taskIdOf(id) && t.status === "running");
}

/**
 * Remove a language from the list. An added one loses its words, sentences
 * and grammar map under <data>/languages/<id>/. A built-in one is hidden
 * (profile.json "hidden"). The learner's progress (<data>/profiles/<id>/) stays, so adding it again picks
 * up where they were. A switch to it that waits for a restart is undone.
 */
export function removeLanguage(id: string): void {
	const name = languageById(id)?.english ?? catalogLanguage(id)?.english ?? id;
	if (id === activeProfile()) throw new Error(`${name} is the language running now. Switch to another one first.`);
	const builtIn = isBuiltIn(id);
	if (!LANGUAGE_ID_RE.test(id) || (builtIn ? isHidden(id) : !fs.existsSync(dirOf(id)))) throw new Error(`${name} has nothing to remove`);
	if (!languageRemovable(id)) throw new Error(`${name} is being added. Stop that first.`);
	if (!builtIn) fs.rmSync(dirOf(id), { recursive: true, force: true });
	const choice = readProfileChoice();
	saveProfileChoice({
		...(choice.active === id ? { active: activeProfile() } : {}),
		...(builtIn ? { hidden: [...choice.hidden, id] } : {}),
	});
	// A task card offering the switch to it would now point at nothing.
	removeTask(taskIdOf(id));
}

class SourceError extends Error {}

function friendly(err: unknown): string {
	if (err instanceof SourceError) return err.message;
	const msg = err instanceof Error ? err.message : String(err);
	if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(msg)) return "The download failed. Check the internet connection and try again; it continues where it stopped.";
	return msg;
}

function readJson<T>(file: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return null;
	}
}

function writeJson(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value), "utf-8");
	fs.renameSync(tmp, file);
}

/** A step that runs once: its result is kept in build/<name>.json. */
async function cached<T>(id: string, name: string, run: () => Promise<T>): Promise<T> {
	const file = path.join(buildDir(id), `${name}.json`);
	const kept = readJson<{ value: T }>(file);
	if (kept) return kept.value;
	const value = await run();
	writeJson(file, { value });
	return value;
}

const yieldNow = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Parsed lines yield to the event loop every this many bytes, so a request
 *  waits at most one slice between its steps. 8 KB is about 80 Tatoeba lines,
 *  a fraction of a millisecond of parsing. */
const PARSE_SLICE_BYTES = 8 * 1024;

/** The lines of a download, decompressed as they arrive. `onBytes` hears
 *  the decompressed total, for the progress line. Lines are split here, not
 *  by readline: readline keeps reading while its lines wait, and a 1 GB
 *  Wiktionary file then sits in memory whole. */
export async function* lines(get: typeof fetch, url: string, signal: AbortSignal, opts: { bz2?: boolean; what: string; onBytes?: (n: number) => void }): AsyncGenerator<string> {
	const res = await get(url, { signal, headers: { "user-agent": UA, "accept-encoding": "gzip" } });
	if (!res.ok || !res.body) throw new SourceError(`Could not download ${opts.what} (HTTP ${res.status}). Try again later; it continues where it stopped.`);
	const raw = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
	// unbzip2-stream is a classic `through` stream, which cannot be iterated; a PassThrough can.
	const stream = opts.bz2 ? raw.pipe(unbzip2()).pipe(new PassThrough()) : raw;
	raw.on("error", (err) => stream.destroy(err));
	const decoder = new StringDecoder("utf8");
	let carry = "";
	let bytes = 0;
	let sliceBytes = 0;
	try {
		for await (const chunk of stream as AsyncIterable<Buffer>) {
			if (signal.aborted) throw new Error("aborted");
			bytes += chunk.length;
			opts.onBytes?.(bytes);
			carry += decoder.write(chunk);
			let start = 0;
			for (let nl = carry.indexOf("\n"); nl !== -1; nl = carry.indexOf("\n", start)) {
				const line = carry.charCodeAt(nl - 1) === 13 ? carry.slice(start, nl - 1) : carry.slice(start, nl);
				start = nl + 1;
				yield line;
				sliceBytes += line.length;
				if (sliceBytes >= PARSE_SLICE_BYTES) {
					sliceBytes = 0;
					await yieldNow();
				}
			}
			carry = carry.slice(start);
			await yieldNow();
		}
		carry += decoder.end();
		if (carry) yield carry;
	} finally {
		stream.destroy();
		raw.destroy();
	}
}

/** Report a step at most every two seconds: a download fires thousands of chunks. */
function stepper(taskId: string) {
	let last = 0;
	return (step: string, force = false) => {
		const now = Date.now();
		if (!force && now - last < 2000) return;
		last = now;
		updateTask(taskId, { step });
	};
}

const mb = (n: number) => `${Math.round(n / 1_000_000)} MB`;

async function tatoebaSentences(get: typeof fetch, lang: CatalogLanguage, signal: AbortSignal, step: (s: string, force?: boolean) => void): Promise<TatoebaSentence[]> {
	const iso = lang.tatoeba;
	step("Downloading example sentences from Tatoeba", true);
	const link = new Map<number, number>();
	for await (const line of lines(get, `${TATOEBA}/${iso}/${iso}-eng_links.tsv.bz2`, signal, { bz2: true, what: "the Tatoeba links" })) {
		const [a, b] = line.split("\t");
		const from = Number(a);
		if (from && !link.has(from)) link.set(from, Number(b));
	}
	const target = new Map<number, string>();
	for await (const line of lines(get, `${TATOEBA}/${iso}/${iso}_sentences.tsv.bz2`, signal, { bz2: true, what: `the ${lang.english} sentences` })) {
		const [a, , text] = line.split("\t");
		const sid = Number(a);
		if (text && link.has(sid) && sentenceUsable(text)) target.set(sid, text.normalize("NFC"));
	}
	const needed = new Set<number>();
	for (const sid of target.keys()) needed.add(link.get(sid)!);
	const english = new Map<number, string>();
	for await (const line of lines(get, `${TATOEBA}/eng/eng_sentences.tsv.bz2`, signal, { bz2: true, what: "the English translations", onBytes: (n) => step(`Downloading English translations · ${mb(n)}`) })) {
		const tab = line.indexOf("\t");
		const sid = Number(line.slice(0, tab));
		if (needed.has(sid)) english.set(sid, line.slice(line.indexOf("\t", tab + 1) + 1));
	}
	const out: TatoebaSentence[] = [];
	for (const [sid, text] of target) {
		const en = english.get(link.get(sid)!);
		if (en) out.push({ id: sid, text, en });
	}
	// Shortest first: the collector keeps the first sentences that fit a word.
	return out.sort((a, b) => a.text.length - b.text.length || a.id - b.id);
}

async function frequency(get: typeof fetch, lang: CatalogLanguage, sentences: TatoebaSentence[], signal: AbortSignal): Promise<string[]> {
	if (!lang.frequency) return [...frequencyFromSentences(sentences, lang.tag, WANTED).keys()];
	const url = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang.frequency}/${lang.frequency}_50k.txt`;
	const res = await get(url, { signal, headers: { "user-agent": UA } });
	if (!res.ok) throw new SourceError(`Could not download the word frequency list (HTTP ${res.status}). Try again later; it continues where it stopped.`);
	return [...parseFrequency(await res.text(), lang.tag, WANTED).keys()];
}

async function wiktionary(get: typeof fetch, lang: CatalogLanguage, wanted: Set<string>, signal: AbortSignal, step: (s: string, force?: boolean) => void): Promise<BuildWord[]> {
	const name = lang.wiktionary;
	const url = `https://kaikki.org/dictionary/${encodeURIComponent(name)}/kaikki.org-dictionary-${encodeURIComponent(name.replace(/[\s-]/g, ""))}.jsonl`;
	step("Reading Wiktionary", true);
	const words = new Map<string, BuildWord>();
	const formOf: FormOf[] = [];
	for await (const line of lines(get, url, signal, { what: "the Wiktionary word list", onBytes: (n) => step(`Reading Wiktionary · ${mb(n)}`) })) {
		if (!lineMayMatter(line, wanted, lang.tag)) continue;
		let raw: unknown;
		try {
			raw = JSON.parse(line);
		} catch {
			continue;
		}
		const read = readKaikkiEntry(raw);
		formOf.push(...read.formOf);
		const w = read.word;
		if (!w) continue;
		const seen = words.get(w.key);
		if (!seen) words.set(w.key, w);
		else {
			for (const g of w.glosses) if (seen.glosses.length < 3 && !seen.glosses.includes(g)) seen.glosses.push(g);
			for (const f of w.forms) if (!seen.forms.includes(f)) seen.forms.push(f);
			seen.gender ??= w.gender;
		}
	}
	const list = [...words.values()];
	mergeFormOf(list, formOf);
	if (list.length === 0) throw new SourceError(`Wiktionary had no ${lang.english} words the app could use.`);
	return list;
}

/** Which model writes a course: the learner picks it when adding the
 *  language (it happens once per language, so it is not a setting). The
 *  Strong slot by default: it is teaching content. */
type WriterSlot = "strong" | "cheap";
/** Who builds the course: a model slot, or the dictionary alone (free). */
type CourseWriter = WriterSlot | "dictionary";

/** The picked slot's model, or the other slot's when that one is empty. */
function courseEngine(writer: WriterSlot = "strong") {
	const other: WriterSlot = writer === "strong" ? "cheap" : "strong";
	const slot = aiSlot(writer)?.model ? aiSlot(writer) : aiSlot(other);
	if (!slot?.model) return null;
	const spec = { provider: slot.model.provider, id: slot.model.id, ...(slot.thinkingLevel ? { thinkingLevel: slot.thinkingLevel } : {}) };
	return { engine: piEngineForSpec(spec, true), model: `${spec.provider}:${spec.id}` };
}

const askOn = (writer: WriterSlot): Ask => async (system, prompt, signal, cap) => {
	const resolved = courseEngine(writer);
	if (!resolved) throw new SourceError('No model is set. Pick one in Settings → AI models, or add the language again with "From the dictionary only".');
	const usage: StoryUsage = { model: resolved.model, steps: [] };
	const { engine } = resolved;
	// The cap rides every request, so the provider ends the answer there.
	const capped = { ...engine, streamFn: ((m, c, o) => engine.streamFn(m, c, { ...o, maxTokens: cap })) as typeof engine.streamFn };
	const { text, newMessages } = await runSubagent([], {
		role: "researcher",
		engine: capped,
		systemPrompt: system,
		prompt,
		maxTurns: 1,
		shouldStop: () => signal.aborted,
		onUsage: (u: Usage) =>
			usage.steps.push({ inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning }),
	});
	const last = [...newMessages].reverse().find((m) => m.role === "assistant") as { stopReason?: string } | undefined;
	return { text, usage, level: engine.level ?? "off", cut: last?.stopReason === "length" };
};

function jsonOf(text: string): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
}

/** One model draft, kept in build/<name>-draft.json with its cost (it shows
 *  in Settings → Spending), checked, and asked once more with what was
 *  wrong when the check fails. */
async function drafted<T>(id: string, name: DraftKind, writer: WriterSlot, ask: Ask, signal: AbortSignal, first: { system: string; prompt: string }, check: (raw: unknown) => { value: T; problems: string[] } | null): Promise<T> {
	const file = path.join(buildDir(id), `${name}-draft.json`);
	const kept = readJson<{ value?: T }>(file);
	if (kept?.value) return kept.value;
	const calls: Array<DraftCall & { createdAt: string }> = [];
	let prompt = first.prompt;
	const caps = capPlan(name, writer);
	let cap = caps.first;
	for (let attempt = 0; attempt < 2; attempt++) {
		const { text, usage, level, cut } = await ask(first.system, prompt, signal, cap);
		calls.push({ model: usage.model, ...(level ? { level } : {}), usage, ...(cut ? { cut } : {}), createdAt: new Date().toISOString() });
		if (cut) {
			// Cut short, not wrong: the same question with twice the room.
			cap = caps.second;
			continue;
		}
		const result = check(jsonOf(text));
		if (result) {
			writeJson(file, { value: result.value, problems: result.problems, calls, model: usage.model, usage: mergeUsage(calls), createdAt: calls[0]!.createdAt });
			return result.value;
		}
		prompt = `${first.prompt}\n\nYour last answer could not be used: it was not valid JSON in the shape above, or too little of it held up against the dictionary. Write it again, complete.`;
	}
	writeJson(file, { calls, model: calls[0]!.model, usage: mergeUsage(calls), createdAt: calls[0]!.createdAt });
	throw new SourceError(`The model's ${name === "world" ? "story world" : "course"} failed the dictionary check twice. Try again; the downloads are kept.`);
}

function mergeUsage(calls: ReadonlyArray<{ usage: StoryUsage }>): StoryUsage {
	return { model: calls[0]!.usage.model, steps: calls.flatMap((c) => c.usage.steps) };
}

function shippedJson<T>(id: string, name: string): T | null {
	return readJson<T>(path.join(ROOT, "curriculum", id, name));
}

async function writeLexicon(lang: CatalogLanguage, sentences: TatoebaSentence[], freq: ReadonlyMap<string, number>, words: readonly BuildWord[], signal: AbortSignal) {
	const written = shippedJson<Course>(lang.id, "course.json");
	const themeWords = new Set(written?.units.flatMap((u) => u.lemmas ?? []) ?? []);
	const bad = new Set((written?.badSentences ?? []).map((b) => b.id));
	sentences = sentences.filter((s) => !bad.has(s.id));
	const merged = mergeHomographs(words, lang.tag);
	const ranked = rankWords(merged, freq, lang.tag, WORD_LIMIT, themeWords);
	const collector = new ExampleCollector(ranked, lang.tag, undefined, { names: namesIn(sentences, lang.tag), outside: merged });
	// About 5 µs a sentence: 50 between yields is a quarter of a millisecond.
	for (let i = 0; i < sentences.length; i++) {
		collector.add(sentences[i]!);
		if (i % 50 === 49) {
			if (signal.aborted) throw new Error("aborted");
			await yieldNow();
		}
	}
	const entries = toLexiconEntries(ranked, collector.examples, lang.tag);
	writeJson(path.join(dirOf(lang.id), "lexicon.json"), {
		source: "Wiktionary (kaikki.org), Tatoeba, FrequencyWords (OpenSubtitles 2018)",
		license: "Words and glosses: Wiktionary, CC BY-SA 4.0. Example sentences: Tatoeba, CC BY 2.0 FR. Frequency: FrequencyWords, CC BY-SA 4.0.",
		exportedAt: new Date().toISOString(),
		words: entries,
	});
	return entries;
}

export async function rebuildLexicon(id: string): Promise<{ words: number; examples: number }> {
	const lang = catalogLanguage(id);
	if (!lang) throw new Error(`${id} is not in the language catalog`);
	const sentences = readJson<{ value: TatoebaSentence[] }>(path.join(buildDir(id), "sentences.json"))?.value;
	const freqWords = readJson<{ value: string[] }>(path.join(buildDir(id), "frequency.json"))?.value;
	const words = readJson<{ value: BuildWord[] }>(path.join(buildDir(id), "words-v2.json"))?.value;
	if (!sentences || !freqWords || !words) throw new Error(`${id} has no kept downloads under ${buildDir(id)}; add it from the app instead`);
	const entries = await writeLexicon(lang, sentences, new Map(freqWords.map((w, i) => [w, i + 1])), words, new AbortController().signal);
	return { words: entries.length, examples: entries.reduce((n, e) => n + e.examples.length, 0) };
}

async function addLanguage(lang: CatalogLanguage, signal: AbortSignal, deps: AddDeps): Promise<string | undefined> {
	const get = deps.fetch ?? fetch;
	const taskId = taskIdOf(lang.id);
	const step = stepper(taskId);
	const id = lang.id;

	const sentences = await cached(id, "sentences", () => tatoebaSentences(get, lang, signal, step));
	step("Downloading the word frequency list", true);
	const freqWords = await cached(id, "frequency", () => frequency(get, lang, sentences, signal));
	const freq = new Map(freqWords.map((w, i) => [w, i + 1]));
	// v2 keeps each form's grammar tags; a words cache from before them is read again.
	const words = await cached(id, "words-v2", () => wiktionary(get, lang, new Set(freqWords), signal, step));

	step("Matching sentences to words", true);
	const entries = await writeLexicon(lang, sentences, freq, words, signal);
	fs.writeFileSync(path.join(dirOf(id), "prompt.md"), languagePrompt(lang), "utf-8");

	const sceneIds = SPEAK_SCENES.map((x) => x.id);
	const written = shippedJson<Course>(id, "course.json");
	const writer = deps.slot ?? "strong";
	let course: Course;
	if (written) {
		step("Checking the course written for this language", true);
		const built = checkCourse(written, id, entries, lang.tag, sceneIds, deps.minUnitSentences);
		if (!built) throw new SourceError(`The ${lang.english} course that ships with the app does not fit these downloads. Try again later.`);
		course = built.course;
	} else if (writer === "dictionary") {
		step("Building the course from the dictionary", true);
		const built = checkCourse(proceduralCourse(entries, id, lang.english, lang.tag), id, entries, lang.tag, sceneIds, deps.minUnitSentences);
		if (!built) throw new SourceError(`The dictionary has too few ${lang.english} sentences for a course. Try again with a model.`);
		course = built.course;
	} else {
		const ask = deps.ask ?? askOn(writer);
		step("Writing the course", true);
		const inventory = courseInventory(entries, lang.tag, sceneIds);
		course = await drafted<Course>(id, "course", writer, ask, signal, courseDraftPrompt(lang.english, inventory), (raw) => {
			const checked = checkCourse(raw, id, entries, lang.tag, sceneIds, deps.minUnitSentences);
			return checked ? { value: checked.course, problems: checked.dropped } : null;
		});
	}
	writeJson(path.join(dirOf(id), "course.json"), course);

	if (!written && writer !== "dictionary" && !shippedJson(id, "world.json")) {
		const ask = deps.ask ?? askOn(writer);
		step("Writing the story world", true);
		const world = await drafted(id, "world", writer, ask, signal, worldDraftPrompt(lang.english, countryOf(lang), course.chapters, PURPOSES.map((p) => p.id).filter((p) => p !== "other"), sceneIds), (raw) => {
			const w = checkWorld(raw, id, course.chapters, sceneIds);
			return w ? { value: w, problems: [] } : null;
		});
		writeJson(path.join(dirOf(id), "world.json"), world);
	}
	const note: string | undefined = !written && writer === "dictionary" ? "Built from the dictionary: plain rules, no word themes, no story world." : undefined;

	const withExamples = entries.filter((e) => e.examples.length > 0).length;
	step("Saving", true);
	writeJson(path.join(dirOf(id), "language.json"), {
		id,
		tag: lang.tag,
		code: lang.code,
		endonym: lang.endonym,
		english: lang.english,
		specialLetters: specialLettersOf(entries.map((e) => e.lemma ?? ""), lang.tag),
		edgeVoices: lang.edgeVoices,
		referenceSite: lang.referenceSite,
		...(lang.fsiCategory ? { fsiCategory: lang.fsiCategory } : {}),
		addedAt: new Date().toISOString(),
		words: entries.length,
		wordsWithSentences: withExamples,
	});
	const grammar = course.units.filter((u) => u.kind === "grammar").length;
	const summary = `${course.chapters.length} chapters, ${grammar} grammar lessons, ${course.units.length - grammar} word themes, ${course.tutors.length} tutor sessions; ${entries.length.toLocaleString("en-US")} words, ${withExamples.toLocaleString("en-US")} with example sentences.`;
	return note ? `${summary} ${note}` : summary;
}

