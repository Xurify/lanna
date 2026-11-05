/**
 * Adding a language from the app (2026-11-05): one background task
 * (server/tasks.ts, so it shows in the sidebar's Background section and
 * ends in a ready notice) downloads open data and writes
 * <data>/languages/<id>/: lexicon.json, prompt.md, seed.json when a model
 * is set, and language.json last, which is what makes the language appear.
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
import { PATHS, curriculumFile } from "../../config.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { catalogLanguage, LANGUAGE_CATALOG, type CatalogLanguage } from "../core/language.ts";
import {
	ExampleCollector,
	frequencyFromSentences,
	languagePrompt,
	lineMayMatter,
	mergeFormOf,
	mergeHomographs,
	parseFrequency,
	parseSeedDraft,
	rankWords,
	readKaikkiEntry,
	seedDraftPrompt,
	sentenceUsable,
	specialLettersOf,
	toLexiconEntries,
	type BuildWord,
	type FormOf,
	type TatoebaSentence,
} from "../core/language-build.ts";
import type { StoryUsage } from "../core/reading.ts";
import { aiStatus } from "./ai-status.ts";
import { storyEngine } from "./reading.ts";
import { failTask, finishTask, listTasks, startTask, updateTask } from "./tasks.ts";

/** Words kept per language, commonest first. */
const WORD_LIMIT = 3000;
/** Frequency rows a Wiktionary entry has to appear in to be read at all. */
const WANTED = 30_000;
const UA = "LangHarness/1.0 (language-learning app; adds a language from open data)";
const TATOEBA = "https://downloads.tatoeba.org/exports/per_language";

export const taskIdOf = (id: string) => `language:${id}`;

const dirOf = (id: string) => path.join(PATHS.languages, id);
const buildDir = (id: string) => path.join(dirOf(id), "build");

/** Whether a catalog language can be learned now: an added one has its
 *  language.json, the built-in Russian needs only its words. */
export function languageReady(id: string): boolean {
	if (id === "slovak") return true;
	if (id === "russian") return fs.existsSync(curriculumFile(id, "lexicon.json"));
	return fs.existsSync(path.join(dirOf(id), "language.json"));
}

export interface CatalogRow {
	id: string;
	english: string;
	endonym: string;
	tag: string;
	ready: boolean;
	adding: boolean;
}

export function languageCatalog(): CatalogRow[] {
	const running = new Set(listTasks().filter((t) => t.kind === "language" && t.status === "running").map((t) => t.id));
	return LANGUAGE_CATALOG.map((l) => ({ id: l.id, english: l.english, endonym: l.endonym, tag: l.tag, ready: languageReady(l.id), adding: running.has(taskIdOf(l.id)) }));
}

export interface AddDeps {
	fetch?: typeof fetch;
	/** The model call for the grammar map; null skips it. Defaults to the Cheap slot when one is set. */
	draftSeed?: ((system: string, prompt: string, signal: AbortSignal) => Promise<{ text: string; usage: StoryUsage }>) | null;
}

/** Start adding a catalog language in the background. Starting one that is
 *  already being added returns the running task. */
export function startLanguageAdd(id: string, deps: AddDeps = {}): { taskId: string; done: Promise<void> } {
	const lang = catalogLanguage(id);
	if (!lang) throw new Error(`"${id}" is not a language the app can add`);
	if (languageReady(id)) throw new Error(`${lang.english} is already added`);
	const other = listTasks().find((t) => t.kind === "language" && t.status === "running" && t.id !== taskIdOf(id));
	if (other) throw new Error(`Wait for "${other.title}" to finish first`);
	const { signal, fresh } = startTask({ id: taskIdOf(id), kind: "language", title: `Adding ${lang.english}`, step: "Starting", language: { id, english: lang.english } });
	if (!fresh) return { taskId: taskIdOf(id), done: Promise.resolve() };
	const done = addLanguage(lang, signal, deps).then(
		(note) => finishTask(taskIdOf(id), { title: `${lang.english} is ready`, ...(note ? { note } : {}) }),
		(err: unknown) => failTask(taskIdOf(id), signal.aborted ? "Stopped. Start it again to continue where it stopped." : friendly(err)),
	);
	return { taskId: taskIdOf(id), done };
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

/** The lines of a download, decompressed as they arrive. `onBytes` hears
 *  the decompressed total, for the progress line. Lines are split here, not
 *  by readline: readline keeps reading while its lines wait, and a 1 GB
 *  Wiktionary file then sits in memory whole. */
async function* lines(get: typeof fetch, url: string, signal: AbortSignal, opts: { bz2?: boolean; what: string; onBytes?: (n: number) => void }): AsyncGenerator<string> {
	const res = await get(url, { signal, headers: { "user-agent": UA, "accept-encoding": "gzip" } });
	if (!res.ok || !res.body) throw new SourceError(`Could not download ${opts.what} (HTTP ${res.status}). Try again later; it continues where it stopped.`);
	const raw = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
	// unbzip2-stream is a classic `through` stream, which cannot be iterated; a PassThrough can.
	const stream = opts.bz2 ? raw.pipe(unbzip2()).pipe(new PassThrough()) : raw;
	raw.on("error", (err) => stream.destroy(err));
	const decoder = new StringDecoder("utf8");
	let carry = "";
	let bytes = 0;
	try {
		for await (const chunk of stream as AsyncIterable<Buffer>) {
			if (signal.aborted) throw new Error("aborted");
			bytes += chunk.length;
			opts.onBytes?.(bytes);
			carry += decoder.write(chunk);
			let start = 0;
			for (let nl = carry.indexOf("\n"); nl !== -1; nl = carry.indexOf("\n", start)) {
				yield carry.charCodeAt(nl - 1) === 13 ? carry.slice(start, nl - 1) : carry.slice(start, nl);
				start = nl + 1;
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

async function defaultDraftSeed(system: string, prompt: string, signal: AbortSignal): Promise<{ text: string; usage: StoryUsage }> {
	const resolved = storyEngine();
	if (!resolved) throw new Error("no model");
	const usage: StoryUsage = { model: resolved.model, steps: [] };
	const { text } = await runSubagent([], {
		role: "researcher",
		engine: resolved.engine,
		systemPrompt: system,
		prompt,
		maxTurns: 1,
		shouldStop: () => signal.aborted,
		onUsage: (u: Usage) =>
			usage.steps.push({ inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning }),
	});
	return { text, usage };
}

/** Runs every step; resolves with a note for the ready notice, if any. */
async function addLanguage(lang: CatalogLanguage, signal: AbortSignal, deps: AddDeps): Promise<string | undefined> {
	const get = deps.fetch ?? fetch;
	const taskId = taskIdOf(lang.id);
	const step = stepper(taskId);
	const id = lang.id;

	const sentences = await cached(id, "sentences", () => tatoebaSentences(get, lang, signal, step));
	step("Downloading the word frequency list", true);
	const freqWords = await cached(id, "frequency", () => frequency(get, lang, sentences, signal));
	const freq = new Map(freqWords.map((w, i) => [w, i + 1]));
	const words = await cached(id, "words", () => wiktionary(get, lang, new Set(freqWords), signal, step));

	step("Matching sentences to words", true);
	const ranked = rankWords(mergeHomographs(words, lang.tag), freq, lang.tag, WORD_LIMIT);
	const collector = new ExampleCollector(ranked, lang.tag);
	for (let i = 0; i < sentences.length; i++) {
		collector.add(sentences[i]!);
		if (i % 5000 === 4999) {
			if (signal.aborted) throw new Error("aborted");
			await yieldNow();
		}
	}
	const entries = toLexiconEntries(ranked, collector.examples, lang.tag);
	writeJson(path.join(dirOf(id), "lexicon.json"), {
		source: "Wiktionary (kaikki.org), Tatoeba, FrequencyWords (OpenSubtitles 2018)",
		license: "Words and glosses: Wiktionary, CC BY-SA 4.0. Example sentences: Tatoeba, CC BY 2.0 FR. Frequency: FrequencyWords, CC BY-SA 4.0.",
		exportedAt: new Date().toISOString(),
		words: entries,
	});
	fs.writeFileSync(path.join(dirOf(id), "prompt.md"), languagePrompt(lang), "utf-8");

	let note: string | undefined;
	const seedFile = path.join(dirOf(id), "seed.json");
	const draftSeed = deps.draftSeed === undefined ? (aiStatus().ready ? defaultDraftSeed : null) : deps.draftSeed;
	if (fs.existsSync(seedFile)) {
		// kept from an earlier run
	} else if (!draftSeed) {
		note = "No grammar map, because no model is set in Settings; the words work without it.";
	} else {
		step("Drafting the grammar map", true);
		const { system, prompt } = seedDraftPrompt(lang);
		try {
			const { text, usage } = await draftSeed(system, prompt, signal);
			const seed = parseSeedDraft(text, id);
			writeJson(path.join(buildDir(id), "seed-draft.json"), { model: usage.model, usage, createdAt: new Date().toISOString(), accepted: !!seed });
			if (seed) writeJson(seedFile, seed);
			else note = "The grammar map draft did not come back in a usable shape; the words are ready without it.";
		} catch (err) {
			if (signal.aborted) throw err;
			note = "The grammar map could not be drafted; the words are ready without it.";
		}
	}

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
		addedAt: new Date().toISOString(),
		words: entries.length,
		wordsWithSentences: withExamples,
	});
	const summary = `${entries.length.toLocaleString("en-US")} words, ${withExamples.toLocaleString("en-US")} with example sentences.`;
	return note ? `${summary} ${note}` : summary;
}

