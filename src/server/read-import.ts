import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { safeFetch } from "../agent/safe-fetch.ts";
import { MAX_LINKS_PER_ADD, MAX_SOURCE_WORDS, MIN_SOURCE_WORDS, ownStoryId, splitIntoSections, storyId, type ReadingDifficulty, type StoryRecord } from "../core/reading.ts";
import { readingSourceStore, type ReadingSource } from "../store/reading-sources.ts";
import { storyStore } from "../store/stories.ts";
import { kickSourceParts, knownWords, sourcePart, storyEngine, writeFirstParts, type GenerateOptions } from "./reading.ts";

export class ReadImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ReadImportError";
	}
}

const UNREADABLE_PAGE = "That page could not be read. Paste its text instead.";
const NOT_A_LINK = "That is not a link the app can open.";
const NOTHING_GIVEN = "Paste a link or some text.";
const TOO_SHORT = `There is too little text here: at least ${MIN_SOURCE_WORDS} words are needed.`;

const ARTICLE_BLOCKS = "p, h1, h2, h3, h4, li, blockquote, pre";
const PAGE_TIMEOUT_MS = 30_000;
const PAGE_MAX_BYTES = 5 * 1024 * 1024;
const TITLE_MAX_CHARS = 90;
const TITLE_FALLBACK_WORDS = 8;
const SINGLE_LINK = /^https?:\/\/\S+$/i;
// Zero-width space, non-joiner, joiner, byte order mark and soft hyphen: mail clients and web pages put them inside words.
const INVISIBLE_CHARACTERS = /[​-‍﻿­]/g;

export interface FetchedPage {
	html: string;
	contentType: string;
	finalUrl: string;
}

export type FetchPage = (url: string) => Promise<FetchedPage>;

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean);

export function extractArticle(html: string): { title: string; text: string } | null {
	const { document } = parseHTML(html);
	const article = new Readability(document as unknown as Document).parse();
	if (!article?.content) return null;
	const content = parseHTML(`<div>${article.content}</div>`).document;
	const blocks = [...content.querySelectorAll(ARTICLE_BLOCKS)]
		.filter((el) => !el.querySelector(ARTICLE_BLOCKS))
		.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
		.filter((block) => /\p{L}/u.test(block));
	if (blocks.length === 0) return null;
	return { title: (article.title ?? "").trim(), text: blocks.join("\n\n") };
}

export function cleanPastedText(raw: string): string {
	const lines = raw
		.replace(INVISIBLE_CHARACTERS, "")
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.filter((line) => !SINGLE_LINK.test(line));
	const hasBlankLine = lines.some((line, i) => line === "" && i > 0 && i < lines.length - 1);
	if (!hasBlankLine) return lines.filter(Boolean).join("\n\n");
	const paragraphs: string[] = [];
	let current: string[] = [];
	for (const line of [...lines, ""]) {
		if (line) current.push(line);
		else if (current.length) {
			paragraphs.push(current.join(" "));
			current = [];
		}
	}
	return paragraphs.join("\n\n");
}

function titleFromText(text: string): string {
	const firstParagraph = text.split("\n\n")[0] ?? "";
	if (firstParagraph.length <= TITLE_MAX_CHARS) return firstParagraph;
	return `${wordsOf(firstParagraph).slice(0, TITLE_FALLBACK_WORDS).join(" ")}…`;
}

function withinWordLimit(text: string): { text: string; truncated: boolean } {
	if (wordsOf(text).length <= MAX_SOURCE_WORDS) return { text, truncated: false };
	const kept: string[] = [];
	let count = 0;
	for (const paragraph of text.split("\n\n")) {
		const size = wordsOf(paragraph).length;
		if (count + size > MAX_SOURCE_WORDS && kept.length > 0) break;
		kept.push(paragraph);
		count += size;
	}
	return { text: kept.join("\n\n"), truncated: true };
}

async function fetchWithGuard(url: string): Promise<FetchedPage> {
	const res = await safeFetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		},
		timeoutMs: PAGE_TIMEOUT_MS,
		maxBytes: PAGE_MAX_BYTES,
	});
	if (!res.ok) throw new ReadImportError(UNREADABLE_PAGE);
	return { html: await res.text(), contentType: res.headers.get("content-type") ?? "", finalUrl: res.url || url };
}

async function readPage(url: string, fetchPage: FetchPage): Promise<{ title: string; text: string; site: string; url: string }> {
	let page: FetchedPage;
	try {
		page = await fetchPage(url);
	} catch {
		throw new ReadImportError(UNREADABLE_PAGE);
	}
	const article = page.contentType.includes("html") ? extractArticle(page.html) : null;
	if (!article) throw new ReadImportError(UNREADABLE_PAGE);
	return { ...article, site: siteOf(page.finalUrl) ?? siteOf(url)!, url };
}

function siteOf(url: string): string | undefined {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return undefined;
	}
}

// Mailchimp's archive links carry the reader's own id as "e"; the others are the usual campaign and click ids. None change what the page says.
const TRACKING_PARAMS = /^(utm_\w+|mc_cid|mc_eid|fbclid|gclid)$/i;
const MAILCHIMP_ARCHIVE = /(^|\.)campaign-archive\.com$/i;

function withoutTracking(url: URL): URL {
	for (const name of [...url.searchParams.keys()]) {
		if (TRACKING_PARAMS.test(name) || (name === "e" && MAILCHIMP_ARCHIVE.test(url.hostname))) url.searchParams.delete(name);
	}
	return url;
}

function httpLink(raw: string): string {
	let parsed: URL;
	try {
		parsed = new URL(raw.trim());
	} catch {
		throw new ReadImportError(NOT_A_LINK);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new ReadImportError(NOT_A_LINK);
	return withoutTracking(parsed).toString();
}

function sourceIdOf(title: string, text: string, difficulty: ReadingDifficulty): string {
	const slug = storyId(0, title).replace(/^ep-000-/, "").slice(0, 32).replace(/-+$/, "");
	const hash = createHash("sha256").update(`${difficulty}\n${text}`).digest("hex").slice(0, 8);
	return `src-${slug || "text"}-${hash}`;
}

function restored(source: ReadingSource): ReadingSource {
	if (!source.removedAt) return source;
	readingSourceStore.setRemoved(source.id, null);
	return readingSourceStore.get(source.id)!;
}

export interface AddSourceInput {
	url?: string;
	text?: string;
	title?: string;
	difficulty?: ReadingDifficulty;
}

export async function addSource(input: AddSourceInput, opts: { now?: Date; fetchPage?: FetchPage } = {}): Promise<ReadingSource> {
	const difficulty = input.difficulty ?? "level";
	const pasted = cleanPastedText(input.text ?? "");
	const link = input.url?.trim() ? httpLink(input.url) : undefined;
	if (!pasted && !link) throw new ReadImportError(NOTHING_GIVEN);

	let title = input.title?.trim() ?? "";
	let text = pasted;
	let site = link ? siteOf(link) : undefined;
	if (!pasted && link) {
		const known = readingSourceStore.findByUrl(link, difficulty);
		if (known) return restored(known);
		const page = await readPage(link, opts.fetchPage ?? fetchWithGuard);
		text = page.text;
		site = page.site;
		title ||= page.title;
	}
	if (wordsOf(text).length < MIN_SOURCE_WORDS) throw new ReadImportError(TOO_SHORT);
	const limited = withinWordLimit(text);
	title ||= titleFromText(limited.text);

	const id = sourceIdOf(title, limited.text, difficulty);
	const existing = readingSourceStore.get(id);
	if (existing) return restored(existing);

	const level = knownWords().level;
	const source: ReadingSource = {
		id,
		title,
		...(link ? { url: link } : {}),
		...(site ? { site } : {}),
		text: limited.text,
		wordCount: wordsOf(limited.text).length,
		sections: splitIntoSections(limited.text, level, difficulty),
		level,
		difficulty,
		addedAt: (opts.now ?? new Date()).toISOString(),
		...(limited.truncated ? { truncated: true } : {}),
	};
	readingSourceStore.put(source);
	return source;
}

function firstUnreadPart(source: ReadingSource): number {
	const read = new Set(storyStore.reads().map((r) => r.storyId));
	const unread = source.sections.findIndex((_, i) => !read.has(ownStoryId(source.id, i + 1)));
	return unread < 0 ? 1 : unread + 1;
}

export async function importReading(input: AddSourceInput, opts: GenerateOptions & { fetchPage?: FetchPage } = {}): Promise<{ source: ReadingSource; story: StoryRecord }> {
	if (!opts.engine && !storyEngine()) throw new Error("No model is configured. Pick one in Settings → AI models.");
	const { fetchPage, ...generate } = opts;
	const source = await addSource(input, { now: opts.now, fetchPage });
	const part = firstUnreadPart(source);
	const story = await sourcePart(source.id, part, generate);
	if (!opts.engine) kickSourceParts(source.id, part + 1);
	return { source, story };
}

const LINKS_READ_AT_ONCE = 3;

export interface LinksImport {
	added: string[];
	failed: Array<{ url: string; message: string }>;
	firstParts: Promise<void>;
}

export async function importLinks(urls: readonly string[], difficulty: ReadingDifficulty = "level", opts: GenerateOptions & { fetchPage?: FetchPage } = {}): Promise<LinksImport> {
	if (!opts.engine && !storyEngine()) throw new Error("No model is configured. Pick one in Settings → AI models.");
	const { fetchPage, ...generate } = opts;
	const links = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, MAX_LINKS_PER_ADD);
	const added: string[] = [];
	const failed: LinksImport["failed"] = [];
	const waiting = [...links];
	const readNext = async (): Promise<void> => {
		for (let url = waiting.shift(); url !== undefined; url = waiting.shift()) {
			try {
				added.push((await addSource({ url, difficulty }, { now: opts.now, fetchPage })).id);
			} catch (err) {
				if (!(err instanceof ReadImportError)) throw err;
				failed.push({ url, message: err.message });
			}
		}
	};
	await Promise.all(Array.from({ length: LINKS_READ_AT_ONCE }, readNext));
	const inOrder = (a: { url: string }, b: { url: string }) => links.indexOf(a.url) - links.indexOf(b.url);
	return { added: [...new Set(added)], failed: failed.sort(inOrder), firstParts: writeFirstParts([...new Set(added)], generate) };
}

export function removeSource(id: string, now = new Date()): void {
	readingSourceStore.setRemoved(id, now.toISOString());
}
