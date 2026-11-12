import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";
import type { StoryRecord } from "../src/core/reading.ts";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-read-import-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

const core = await import("../src/core/reading.ts");
const { readingSourceStore } = await import("../src/store/reading-sources.ts");
const { storyStore } = await import("../src/store/stories.ts");
const readImport = await import("../src/server/read-import.ts");
const reading = await import("../src/server/reading.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

function fauxEngine(steps: FauxResponseStep[]) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

function makeWords(count: number, prefix = "slovo"): string {
	const words: string[] = [];
	for (let i = 0; i < count; i++) {
		words.push(`${prefix}${i}`);
	}
	return words.join(" ");
}

function makeParagraphs(paragraphCount: number, wordsPerParagraph: number): string {
	const paras: string[] = [];
	for (let i = 0; i < paragraphCount; i++) {
		paras.push(makeWords(wordsPerParagraph, `para${i}w`));
	}
	return paras.join("\n\n");
}

const RETOLD_DRAFT = {
	title: "Prerozprávaný článok",
	sentences: [
		{ sk: "Toto je prvá veta prvého odseku.", en: "This is the first sentence of paragraph 1.", p: true },
		{ sk: "Toto je druhá veta prvého odseku.", en: "This is the second sentence of paragraph 1." },
		{ sk: "Toto je prvá veta druhého odseku.", en: "This is the first sentence of paragraph 2.", p: true },
	],
	newWords: [{ sk: "odsek", en: "paragraph" }],
	questions: [
		{ q: "O čom hovorí článok?", options: ["O odsekoch", "O mestách", "O káve"], answer: 0 },
		{ q: "Koľko odsekov tu je?", options: ["Jeden", "Dva", "Tri"], answer: 1 },
		{ q: "Aká je prvá veta?", options: ["Prvá", "Druhá", "Tretia"], answer: 0 },
	],
	recap: "Článok hovorí o dvoch odsekoch v texte.",
};

const PART_TWO_DRAFT = {
	...RETOLD_DRAFT,
	title: "Druhá časť článku",
	recap: "V druhej časti všetko dobre dopadlo.",
};

const ARTICLE_PAGE = `<!DOCTYPE html>
<html>
<head><title>Nová cyklotrasa | Mestské noviny</title></head>
<body>
	<header><nav><a href="/">Domov</a> <a href="/sport">Šport</a></nav></header>
	<article>
		<h1>Nová cyklotrasa</h1>
		<p>Bratislava   otvorila novú cyklotrasu cez celé mesto. Trasa spája centrum s okrajom mesta a vedie popri rieke.</p>
		<p>Primátor povedal, že projekt stál menej, ako sa pôvodne čakalo, a že ďalšia trasa príde budúci rok.</p>
		<ul><li><p>Dĺžka trasy je dvanásť kilometrov.</p></li><li>Otvorená je každý deň.</li></ul>
		<p>Ľudia z okolia hovoria, že do práce teraz chodia na bicykli a cesta im trvá kratšie ako autom.</p>
	</article>
	<footer>Copyright 2026 Mestské noviny</footer>
</body>
</html>`;

const htmlPage = (html: string) => async (url: string) => ({ html, contentType: "text/html; charset=utf-8", finalUrl: url });

async function importError(run: () => Promise<unknown>): Promise<string> {
	try {
		await run();
	} catch (err) {
		assert.ok(err instanceof readImport.ReadImportError, `expected a ReadImportError, got ${String(err)}`);
		return err.message;
	}
	return assert.fail("expected the import to be refused");
}

describe("cleanPastedText", () => {
	it("drops invisible characters that mail clients add", () => {
		assert.equal(readImport.cleanPastedText("Slovo​ s﻿ neviditeľným­ znakom."), "Slovo s neviditeľným znakom.");
	});

	it("joins hard-wrapped lines into paragraphs when blank lines separate them", () => {
		assert.equal(readImport.cleanPastedText("Prvý riadok\r\npokračuje tu.\r\n\r\n\r\nDruhý   odsek."), "Prvý riadok pokračuje tu.\n\nDruhý odsek.");
	});

	it("reads each line as a paragraph when the text has no blank line", () => {
		assert.equal(readImport.cleanPastedText("Prvý odsek.\nDruhý odsek."), "Prvý odsek.\n\nDruhý odsek.");
	});

	it("drops lines that are only a link", () => {
		assert.equal(readImport.cleanPastedText("Text.\n\nhttps://example.com/unsubscribe\n\nĎalší text."), "Text.\n\nĎalší text.");
	});
});

describe("extractArticle", () => {
	it("keeps the article's paragraphs and list items once each, without the page around them", () => {
		const article = readImport.extractArticle(ARTICLE_PAGE);
		assert.ok(article);
		assert.match(article.title, /cyklotrasa/);
		const paragraphs = article.text.split("\n\n");
		assert.ok(paragraphs.includes("Bratislava otvorila novú cyklotrasu cez celé mesto. Trasa spája centrum s okrajom mesta a vedie popri rieke."));
		assert.equal(paragraphs.filter((p) => p === "Dĺžka trasy je dvanásť kilometrov.").length, 1);
		assert.ok(paragraphs.includes("Otvorená je každý deň."));
		assert.doesNotMatch(article.text, /Domov|Copyright/);
	});

	it("is null for a page with no article in it", () => {
		assert.equal(readImport.extractArticle("<html><body><nav><a href='/'>Home</a></nav></body></html>"), null);
	});
});

describe("splitIntoSections", () => {
	it("keeps a short text as one section", () => {
		const text = makeParagraphs(2, 50);
		assert.deepEqual(core.splitIntoSections(text, "A1"), [text]);
	});

	it("cuts at paragraph ends and keeps every paragraph in order", () => {
		const paragraphs = [makeWords(100, "a"), makeWords(100, "b"), makeWords(100, "c"), makeWords(100, "d")];
		const sections = core.splitIntoSections(paragraphs.join("\n\n"), "A1");
		assert.deepEqual(sections, [`${paragraphs[0]}\n\n${paragraphs[1]}`, `${paragraphs[2]}\n\n${paragraphs[3]}`]);
	});

	it("joins a short last section to the one before it", () => {
		const paragraphs = [makeWords(240, "a"), makeWords(240, "b"), makeWords(60, "c")];
		const sections = core.splitIntoSections(paragraphs.join("\n\n"), "A1");
		assert.equal(sections.length, 2);
		assert.ok(sections[1]!.endsWith(paragraphs[2]!));
	});

	it("makes at most eight parts of a long text and drops nothing", () => {
		const text = makeParagraphs(15, 350);
		const sections = core.splitIntoSections(text, "A1");
		assert.equal(sections.length, core.MAX_SOURCE_PARTS);
		assert.equal(sections.join("\n\n"), text);
	});

	it("cuts one very long paragraph at sentence ends", () => {
		const sentence = (i: number) => `${makeWords(49, `s${i}w`)} koniec.`;
		const paragraph = Array.from({ length: 12 }, (_, i) => sentence(i)).join(" ");
		const sections = core.splitIntoSections(paragraph, "A1");
		assert.ok(sections.length > 1);
		for (const section of sections) assert.match(section, /koniec\.$/);
		assert.equal(sections.join(" ").replace(/\n\n/g, " "), paragraph);
	});

	it("cuts smaller parts for a text that is not simplified, and larger ones a level up", () => {
		const text = makeParagraphs(24, 50);
		assert.ok(core.splitIntoSections(text, "A1", "full").length > core.splitIntoSections(text, "A1").length);
		assert.ok(core.splitIntoSections(text, "A1", "harder").length <= core.splitIntoSections(text, "A1").length);
	});
});

describe("a part's place and size", () => {
	it("names a part's story after its text and number", () => {
		assert.equal(core.ownStoryId("src-clanok-1a2b3c4d", 4), "src-clanok-1a2b3c4d-p04");
	});

	it("calls a version shorter when its parts hold much more than a part's worth", () => {
		assert.equal(core.sourceIsShortened(1000, 4, "A1"), false);
		assert.equal(core.sourceIsShortened(4000, 8, "A1"), true);
		assert.equal(core.sourceIsShortened(4000, 8, "A1", "full"), false);
	});
});

describe("adding a text", () => {
	it("refuses too little text, a link it cannot open, a page with no article, and nothing at all, in the learner's words", async () => {
		assert.equal(await importError(() => readImport.addSource({ text: "Príliš krátky text." })), `There is too little text here: at least ${core.MIN_SOURCE_WORDS} words are needed.`);
		assert.equal(await importError(() => readImport.addSource({ url: "ftp://example.com/file" })), "That is not a link the app can open.");
		assert.equal(await importError(() => readImport.addSource({ url: "https://example.com/empty" }, { fetchPage: htmlPage("<html><body></body></html>") })), "That page could not be read. Paste its text instead.");
		assert.equal(
			await importError(() =>
				readImport.addSource(
					{ url: "https://example.com/down" },
					{
						fetchPage: async () => {
							throw new Error("ECONNRESET");
						},
					},
				),
			),
			"That page could not be read. Paste its text instead.",
		);
		assert.equal(await importError(() => readImport.addSource({ text: "   " })), "Paste a link or some text.");
	});

	it("reads a link's article, names the site, and does not fetch the same link twice", async () => {
		let fetches = 0;
		const fetchPage = async (url: string) => {
			fetches++;
			return htmlPage(ARTICLE_PAGE)(url);
		};
		const first = await readImport.addSource({ url: "https://www.example.com/cyklotrasa" }, { fetchPage });
		assert.equal(first.site, "example.com");
		assert.equal(first.url, "https://www.example.com/cyklotrasa");
		assert.match(first.title, /cyklotrasa/);
		assert.doesNotMatch(first.text, /Copyright/);
		const again = await readImport.addSource({ url: "https://www.example.com/cyklotrasa" }, { fetchPage });
		assert.equal(again.id, first.id);
		assert.equal(fetches, 1);
	});

	it("opens a link without the ids that say who clicked it", async () => {
		const opened: string[] = [];
		const fetchPage = async (url: string) => {
			opened.push(url);
			return htmlPage(ARTICLE_PAGE.replace("Bratislava", opened.length === 1 ? "Trnava" : "Nitra"))(url);
		};
		const source = await readImport.addSource({ url: "https://us2.campaign-archive.com/?e=538bc35af8&u=abc&id=f18194e006&utm_source=newsletter&mc_eid=123" }, { fetchPage });
		assert.deepEqual(opened, ["https://us2.campaign-archive.com/?u=abc&id=f18194e006"]);
		assert.equal(source.url, "https://us2.campaign-archive.com/?u=abc&id=f18194e006");
		const other = await readImport.addSource({ url: "https://example.com/post?e=keep&page=2" }, { fetchPage });
		assert.equal(other.url, "https://example.com/post?e=keep&page=2");
	});

	it("keeps one text for the same pasted words, and another for a different difficulty", async () => {
		const text = makeParagraphs(3, 40);
		const first = await readImport.addSource({ text, title: "Rovnaký text" });
		const second = await readImport.addSource({ text, title: "Rovnaký text" });
		const harder = await readImport.addSource({ text, title: "Rovnaký text", difficulty: "full" });
		assert.equal(second.id, first.id);
		assert.notEqual(harder.id, first.id);
		assert.match(first.id, /^src-rovnaky-text-[0-9a-f]{8}$/);
	});

	it("titles an untitled text with its first line, or its first words when that line is long", async () => {
		const short = await readImport.addSource({ text: `Krátky nadpis\n\n${makeParagraphs(2, 40)}` });
		assert.equal(short.title, "Krátky nadpis");
		const long = await readImport.addSource({ text: makeParagraphs(2, 60) });
		assert.equal(long.title, `${makeWords(8, "para0w")}…`);
	});

	it("cuts a text over the word limit at a paragraph end and says so", async () => {
		const source = await readImport.addSource({ text: makeParagraphs(70, 100), title: "Dlhý text" });
		assert.equal(source.truncated, true);
		assert.equal(source.wordCount, core.MAX_SOURCE_WORDS);
		assert.ok(source.sections.length <= core.MAX_SOURCE_PARTS);
	});
});

describe("reading a text of your own", () => {
	const text = makeParagraphs(8, 100);

	it("writes part one from its section, and writes nothing the second time", async () => {
		const engine = fauxEngine([fauxAssistantMessage(JSON.stringify(RETOLD_DRAFT))]);
		const { source, story } = await readImport.importReading({ text, title: "Môj článok", url: "https://example.com/moj-clanok" }, { engine, model: "faux:retell" });

		assert.equal(story.id, core.ownStoryId(source.id, 1));
		assert.equal(story.genre, "own");
		assert.equal(story.chapter, "own");
		assert.deepEqual(story.source, { id: source.id, title: "Môj článok", url: "https://example.com/moj-clanok", site: "example.com", part: 1, parts: source.sections.length, difficulty: "level" });
		assert.equal(story.original, source.sections[0]);
		assert.deepEqual(
			story.sentences.map((s) => s.startsParagraph ?? false),
			[true, false, true],
		);

		const noModelLeft = fauxEngine([]);
		const again = await readImport.importReading({ text, title: "Môj článok", url: "https://example.com/moj-clanok" }, { engine: noModelLeft, model: "faux:retell" });
		assert.equal(again.story.id, story.id);
		assert.equal(again.story.createdAt, story.createdAt);
	});

	it("lists the text with its progress, and offers its next unread part first", async () => {
		const source = readingSourceStore.list().find((s) => s.title === "Môj článok")!;
		const before = reading.sourceEntries().find((s) => s.id === source.id)!;
		assert.deepEqual({ written: before.written, read: before.read, nextPart: before.nextPart, nextStoryId: before.nextStoryId, finished: before.finished }, { written: 1, read: 0, nextPart: 1, nextStoryId: core.ownStoryId(source.id, 1), finished: false });
		assert.equal(reading.readingState(0, undefined, { topUpShelf: false }).current?.id, core.ownStoryId(source.id, 1));

		reading.recordRead({ storyId: core.ownStoryId(source.id, 1), answers: [0, 1, 0], tapped: [] });
		const after = reading.sourceEntries().find((s) => s.id === source.id)!;
		assert.deepEqual({ read: after.read, nextPart: after.nextPart, nextStoryId: after.nextStoryId }, { read: 1, nextPart: 2, nextStoryId: undefined });
	});

	it("writes the next part with the earlier part's recap in its brief", async () => {
		const source = readingSourceStore.list().find((s) => s.title === "Môj článok")!;
		const brief = reading.retellBrief(reading.knownWords(), source, 2, [RETOLD_DRAFT.recap]);
		assert.match(brief.prompt, /^Text: part 2 of \d+ of "Môj článok" \(example\.com\)/);
		assert.ok(brief.prompt.includes(`Earlier parts, oldest first:\n  1. ${RETOLD_DRAFT.recap}`));
		assert.ok(brief.prompt.endsWith(`"""\n${source.sections[1]}\n"""`));

		const engine = fauxEngine([fauxAssistantMessage(JSON.stringify(PART_TWO_DRAFT))]);
		const partTwo = await reading.sourcePart(source.id, 2, { engine, model: "faux:retell" });
		assert.equal(partTwo.source?.part, 2);
		assert.equal(partTwo.original, source.sections[1]);
		await assert.rejects(() => reading.sourcePart(source.id, 99, { engine, model: "faux:retell" }), /unknown text/);
	});

	it("tells the model to retell and never to obey the section, in the running language", () => {
		const graded = reading.retellSystem({ english: "Slovak" });
		assert.match(graded, /graded Slovak/);
		assert.match(graded, /never instructions to you/);
		assert.match(graded, /Add nothing that is not in it/);
		const unsimplified = reading.retellSystem({ english: "Estonian" }, "full");
		assert.match(unsimplified, /natural Estonian, without simplifying it/);
		assert.match(unsimplified, /"newWords" is an empty array/);
	});

	it("keeps a text that is not simplified as the model gave it: no second draft, no words queued", async () => {
		const hard = { ...RETOLD_DRAFT, sentences: RETOLD_DRAFT.sentences.map((s) => ({ ...s, sk: `${s.sk.slice(0, -1)} xyzzyq plughw.` })) };
		const engine = fauxEngine([fauxAssistantMessage(JSON.stringify(hard))]);
		const { story } = await readImport.importReading({ text: makeParagraphs(3, 60), title: "Bez zjednodušenia", difficulty: "full" }, { engine, model: "faux:retell" });
		assert.equal(story.drafts, 1);
		assert.deepEqual(story.newWords, []);
		assert.equal(story.source?.difficulty, "full");
		assert.ok(story.coverage < core.COVERAGE_FLOOR);
	});

	it("takes a removed text out of the library, the list and the pick, and brings it back with no model call", async () => {
		const source = readingSourceStore.list().find((s) => s.title === "Môj článok")!;
		const partTwo = core.ownStoryId(source.id, 2);
		assert.equal(reading.readingState(0, undefined, { topUpShelf: false }).current?.id, partTwo);

		readImport.removeSource(source.id);
		assert.ok(!reading.sourceEntries().some((s) => s.id === source.id));
		assert.ok(!reading.library().some((s) => s.source?.id === source.id));
		assert.notEqual(reading.readingState(0, undefined, { topUpShelf: false }).current?.id, partTwo);
		assert.ok(storyStore.get(partTwo), "the part stays on disk");

		const back = await readImport.importReading({ text, title: "Môj článok", url: "https://example.com/moj-clanok" }, { engine: fauxEngine([]), model: "faux:retell" });
		assert.equal(back.story.id, partTwo);
		assert.ok(reading.sourceEntries().some((s) => s.id === source.id));
	});

	it("leaves the learner's own parts out of what the app's shelf counts", async () => {
		const ownUnread = reading.library().filter((s) => s.source && s.reads === 0).length;
		assert.ok(ownUnread > 0);
		const level = reading.knownWords().level;
		const withOwn = core.shelfNeeds(level, reading.library().filter((s) => s.reads === 0), []);
		const withoutOwn = core.shelfNeeds(level, reading.library().filter((s) => s.reads === 0 && !s.source), []);
		assert.ok(withoutOwn.length >= withOwn.length);
		assert.ok(withoutOwn.every((need) => need.genre !== "own"));
	});
});

describe("adding several links at once", () => {
	const pageFor = (url: string) => ARTICLE_PAGE.replace("Bratislava", `Mesto ${new URL(url).pathname.slice(1)}`);

	it("keeps every link it can read, names the ones it cannot, and writes each first part afterwards", async () => {
		const fetchPage = async (url: string) => (url.includes("broken") ? htmlPage("<html><body></body></html>")(url) : htmlPage(pageFor(url))(url));
		const draftAndRedraftForEach = Array.from({ length: 4 }, () => fauxAssistantMessage(JSON.stringify(RETOLD_DRAFT)));
		const engine = fauxEngine(draftAndRedraftForEach);
		const links =["https://example.org/kosice", "https://example.org/broken", "https://example.org/zilina", "https://example.org/kosice"];
		const result = await readImport.importLinks(links, "level", { engine, model: "faux:retell", fetchPage });

		assert.equal(result.added.length, 2);
		assert.deepEqual(result.failed, [{ url: "https://example.org/broken", message: "That page could not be read. Paste its text instead." }]);
		const beforeWriting = reading.sourceEntries().filter((s) => result.added.includes(s.id));
		assert.deepEqual(
			beforeWriting.map((s) => ({ written: s.written, preparing: s.preparing })),
			[
				{ written: 0, preparing: true },
				{ written: 0, preparing: true },
			],
		);

		await result.firstParts;
		for (const id of result.added) assert.equal(storyStore.get(core.ownStoryId(id, 1))?.source?.part, 1);
		assert.ok(reading.sourceEntries().filter((s) => result.added.includes(s.id)).every((s) => s.written === 1 && !s.preparing));
	});

	it("does not try a first part again in the same run once the model failed on it", async () => {
		const fetchPage = async (url: string) => htmlPage(pageFor(url))(url);
		const failing = await readImport.importLinks(["https://example.org/nitra"], "level", { engine: fauxEngine([]), model: "faux:retell", fetchPage });
		await failing.firstParts;
		const [id] = failing.added;
		assert.equal(storyStore.get(core.ownStoryId(id!, 1)), null);

		const working = fauxEngine([fauxAssistantMessage(JSON.stringify(RETOLD_DRAFT))]);
		await reading.writeFirstParts([id!], { engine: working, model: "faux:retell" });
		assert.equal(storyStore.get(core.ownStoryId(id!, 1)), null, "left for the learner to open, which writes it on demand");
		const opened = await reading.sourcePart(id!, 1, { engine: working, model: "faux:retell" });
		assert.equal(opened.source?.part, 1);
	});
});

describe("parseStoryDraft", () => {
	it("keeps the paragraph marks", () => {
		const draft = core.parseStoryDraft(JSON.stringify(RETOLD_DRAFT));
		assert.deepEqual(
			draft.sentences.map((s) => s.p ?? false),
			[true, false, true],
		);
	});
});

describe("picker prioritization for own texts", () => {
	it("prioritizes own story over standard shelf stories", () => {
		const ownStory: StoryRecord = {
			id: "own-source-1",
			lang: "sk",
			series: "own",
			episode: 1,
			title: "Vlastný článok",
			level: "B1",
			theme: "own",
			chapter: "own",
			genre: "own",
			createdAt: "2026-11-01T10:00:00Z",
			wordCount: 200,
			coverage: 0.95,
			newWords: [],
			sentences: [],
			questions: [],
			recap: "",
			drafts: 1,
			usage: { model: "faux", steps: [] },
			source: { id: "own-source", title: "Vlastný článok", part: 1, parts: 2 },
		};

		const standardStory: StoryRecord = {
			id: "standard-1",
			lang: "sk",
			series: "robo",
			episode: 1,
			title: "Bežný príbeh",
			level: "B1",
			theme: "t",
			chapter: "ch1",
			createdAt: "2026-10-01T10:00:00Z",
			wordCount: 200,
			coverage: 0.95,
			newWords: [],
			sentences: [],
			questions: [],
			recap: "",
			drafts: 1,
			usage: { model: "faux", steps: [] },
		};

		const pick = core.pickStory([standardStory, ownStory], {
			level: "B1",
			known: new Set(),
			recentGenres: [],
			recentTopics: [],
		});

		assert.equal(pick?.story.id, "own-source-1");
	});

	it("prioritizes in-progress Part 2+ over Part 1 of a new source", () => {
		const partOne: StoryRecord = {
			id: "source-a-1",
			lang: "sk",
			series: "own",
			episode: 1,
			title: "Nový zdroj",
			level: "B1",
			theme: "own",
			chapter: "own",
			genre: "own",
			createdAt: "2026-11-02T10:00:00Z",
			wordCount: 200,
			coverage: 0.95,
			newWords: [],
			sentences: [],
			questions: [],
			recap: "",
			drafts: 1,
			usage: { model: "faux", steps: [] },
			source: { id: "source-a", title: "Nový zdroj", part: 1, parts: 3 },
		};

		const partTwo: StoryRecord = {
			id: "source-b-2",
			lang: "sk",
			series: "own",
			episode: 2,
			title: "Rozčítaný zdroj",
			level: "B1",
			theme: "own",
			chapter: "own",
			genre: "own",
			createdAt: "2026-11-01T10:00:00Z",
			wordCount: 200,
			coverage: 0.95,
			newWords: [],
			sentences: [],
			questions: [],
			recap: "",
			drafts: 1,
			usage: { model: "faux", steps: [] },
			source: { id: "source-b", title: "Rozčítaný zdroj", part: 2, parts: 3 },
		};

		const pick = core.pickStory([partOne, partTwo], {
			level: "B1",
			known: new Set(),
			recentGenres: [],
			recentTopics: [],
		});

		assert.equal(pick?.story.id, "source-b-2");
	});
});
