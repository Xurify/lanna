/**
 * Cheatsheets: the Markdown import, the store on a throwaway data folder,
 * and the bridge to the Review deck.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-cheatsheets-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { CheatsheetParseError, cheatsheetOverlap, inlineList, isChatter, mergeCheatsheetMarkdown, phraseKey, cheatsheetId, cheatsheetRowCount, cheatsheetWords, isCheatsheetId, parseCheatsheet, plainText, tableColumns } = await import("../src/core/cheatsheets.ts");
const { cheatsheetStore } = await import("../src/store/cheatsheets.ts");
const { cheatsheetReviewState, cheatsheetToReview } = await import("../src/server/cheatsheets.ts");
const { PATHS } = await import("../config.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const GUIDE = fs.readFileSync(path.join(import.meta.dirname, "..", "docs", "cheatsheets", "animal-hospital-russian.md"), "utf-8");
// A guide as a chat assistant answered it, with its own lines to the reader.
const CHAT_GUIDE = fs.readFileSync(path.join(import.meta.dirname, "fixtures", "cheatsheet-chat-guide.md"), "utf-8");

describe("parseCheatsheet", () => {
	it("reads the shipped Russian guide: title, intro, sections and four columns", () => {
		const sheet = parseCheatsheet(GUIDE);
		assert.equal(sheet.title, "Night shift at the animal clinic (Russian, A1)");
		assert.equal(sheet.intro.length, 1);
		const titles = sheet.sections.map((s) => s.title);
		assert.equal(titles[0], "1. At the desk: who gets in");
		assert.ok(titles.includes("Numbers") && titles.includes("Animals") && titles.includes("Tips"));
		const first = sheet.sections[0]!.rows[0]!;
		assert.deepEqual(first, { text: "Пускаем?", pron: "poos-KA-yem?", meaning: "Do we let it in?" });
		const gendered = sheet.sections[0]!.rows.find((r) => r.text.startsWith("Я не уверен"));
		assert.equal(gendered?.note, "m / f");
		const tips = sheet.sections.find((s) => s.title === "Tips")!;
		assert.equal(tips.rows.length, 0, "tips without a dash separator stay notes");
		assert.equal(tips.notes.length, 4);
		assert.ok(cheatsheetRowCount(sheet) >= 140);
	});

	it("marks every suggested game term in the Note column", () => {
		const sheet = parseCheatsheet(GUIDE);
		const rows = sheet.sections.flatMap((s) => s.rows);
		for (const text of ["Это аномалия!", "Мало рассудка!", "Купи шокер.", "рентген"]) {
			assert.match(rows.find((r) => r.text === text)?.note ?? "", /suggestion/, text);
		}
	});

	it("finds the columns by header in any order, else by position", () => {
		assert.deepEqual(tableColumns(["English", "Russian"], 2), ["meaning", "text"]);
		assert.deepEqual(tableColumns(["Slovensky", "Výslovnosť", "Význam"], 3), ["text", "pron", "meaning"]);
		assert.deepEqual(tableColumns(["a", "b"], 2), ["text", "meaning"]);
		assert.deepEqual(tableColumns(null, 4), ["text", "pron", "meaning", "note"]);
	});

	it("reads a table with no header line", () => {
		const sheet = parseCheatsheet("| Ahoj | hi |\n| Ďakujem | thanks |");
		assert.deepEqual(sheet.sections[0]!.rows, [
			{ text: "Ahoj", meaning: "hi" },
			{ text: "Ďakujem", meaning: "thanks" },
		]);
		assert.equal(sheet.title, "Cheatsheet");
	});

	it("reads list rows with a dash and an optional pronunciation; a hyphen is not a separator", () => {
		const sheet = parseCheatsheet("## Words\n- пожар (pa-ZHAR) — fire\n- **кот** – cat\n- 1. ничего = it's OK\n- pa-ZHAR is said with a stress\n");
		const s = sheet.sections[0]!;
		assert.deepEqual(s.rows, [
			{ text: "пожар", pron: "pa-ZHAR", meaning: "fire" },
			{ text: "кот", meaning: "cat" },
			{ text: "1. ничего", meaning: "it's OK" },
		]);
		assert.deepEqual(s.notes, ["pa-ZHAR is said with a stress"]);
	});

	it("keeps escaped pipes inside a cell and strips Markdown emphasis", () => {
		const sheet = parseCheatsheet("| Phrase | Meaning |\n|---|---|\n| да \\| нет | yes \\| no |\n| *Стой!* | [Stop!](https://example.org) |");
		assert.deepEqual(sheet.sections[0]!.rows, [
			{ text: "да | нет", meaning: "yes | no" },
			{ text: "Стой!", meaning: "Stop!" },
		]);
		assert.equal(plainText("**bold** and _it_ and `code`"), "bold and it and code");
		assert.equal(plainText("snake_case_name"), "snake_case_name");
	});

	it("refuses text with no phrase, and text over the size limit", () => {
		assert.throws(() => parseCheatsheet("# Only a title\n\nSome prose."), CheatsheetParseError);
		assert.throws(() => parseCheatsheet("x".repeat(200_001)), CheatsheetParseError);
	});

	it("gives sections unique anchors", () => {
		const sheet = parseCheatsheet("## Words\n| a | b |\n## Words\n| c | d |");
		assert.deepEqual(
			sheet.sections.map((s) => s.id),
			["words", "words-2"],
		);
	});
});

describe("guides written by a chat assistant", () => {
	it("leaves out the assistant's lines to the reader and says which", () => {
		const sheet = parseCheatsheet(CHAT_GUIDE);
		assert.equal(sheet.intro.length, 0);
		assert.equal(sheet.skipped.length, 3);
		assert.match(sheet.skipped[2] ?? "", /^I can turn/);
		assert.ok(isChatter("Here are some phrases"));
		assert.ok(!isChatter("In Note, m / f is what a man / a woman says"));
		assert.ok(!isChatter("Ich bin müde")); // a phrase, not chatter
	});

	it("reads labelled inline lists as rows under their own section", () => {
		const sheet = parseCheatsheet(CHAT_GUIDE);
		const body = sheet.sections.find((s) => s.title === "Body words");
		assert.equal(body?.rows.length, 8);
		assert.deepEqual(body?.rows[1], { text: "лицо", meaning: "face" });
		const numbers = sheet.sections.find((s) => s.title === "Numbers");
		assert.deepEqual(numbers?.rows[5], { text: "шесть", meaning: "6" });
		const gender = sheet.sections.find((s) => s.title === "Three patterns that cover a lot");
		assert.match(gender?.notes.at(-1) ?? "", /^Gendered words/, "a colon line that is not a list stays a note");
		assert.equal(inlineList("Start with ten phrases: Пускаем, Не пускаем"), null);
		assert.equal(inlineList("Tip: say it twice"), null);
	});
});

describe("overlap and merging", () => {
	it("compares phrases without case, ё or punctuation, and by their / parts", () => {
		assert.equal(phraseKey("Пускаем!"), phraseKey("пускаем."));
		assert.equal(phraseKey("Ещё раз"), phraseKey("еще раз"));
		const ours = parseCheatsheet(GUIDE);
		const theirs = parseCheatsheet(CHAT_GUIDE);
		const o = cheatsheetOverlap(theirs, ours);
		assert.ok(o.shared >= 25, `shared ${o.shared}`);
		const fresh = o.fresh.map((f) => f.row.text);
		assert.ok(fresh.includes("Кто у окна?"));
		assert.ok(!fresh.includes("Пускаем!"));
		assert.ok(!fresh.includes("Ты где? / Я здесь."), "both parts are in the guide");
		assert.ok(!fresh.includes("глаза"), "глаз / глаза covers глаза");
	});

	it("adds only new phrases: into the matching numbered section's table, else as a new section", () => {
		const target = "# Mine\n\n## 1. At the desk\n| Russian | Say it | English | Note |\n|---|---|---|---|\n| Пускаем? | poos-KA-yem? | Do we let it in? | |\n\n## Tips\n- Say it twice.\n";
		const incoming = parseCheatsheet("## 1. Front desk\n| Russian | Sounds like | Meaning |\n|---|---|---|\n| Пускаем! | x | Admit |\n| Кто у окна? | kto oo ak-NA | Who's at the window? |\n\n## Fire\n- Пожар — fire");
		const { markdown, added } = mergeCheatsheetMarkdown(target, incoming);
		assert.equal(added, 2);
		const lines = markdown.split("\n");
		const at = lines.indexOf("| Кто у окна? | kto oo ak-NA | Who's at the window? |  |");
		assert.equal(at, lines.indexOf("| Пускаем? | poos-KA-yem? | Do we let it in? | |") + 1, "goes under the same section's table");
		assert.ok(markdown.trimEnd().endsWith("| Пожар |  | fire |  |"));
		assert.match(markdown, /## Fire\n\n\| Phrase \| Say it \| Meaning \| Note \|/);
		const again = mergeCheatsheetMarkdown(markdown, incoming);
		assert.deepEqual(again, { markdown, added: 0 });
	});
});

describe("cheatsheetWords and ids", () => {
	it("lists each word once, lowercased, in the order it first appears", () => {
		const sheet = parseCheatsheet("| Я не уверен. / Я не уверена. | I'm not sure |\n| Что-то есть? | Is there something? |");
		assert.deepEqual(cheatsheetWords(sheet, "ru-RU"), ["я", "не", "уверен", "уверена", "что-то", "есть"]);
	});

	it("makes file-safe ids and rejects unsafe ones", () => {
		const now = new Date("2026-11-06T12:00:00Z");
		const id = cheatsheetId("Night shift: Ночь!", now, () => false);
		assert.ok(isCheatsheetId(id), id);
		assert.ok(id.startsWith("night-shift-"));
		assert.equal(cheatsheetId("Ночь", now, () => false).startsWith("sheet-"), true);
		const taken = new Set([id]);
		assert.notEqual(cheatsheetId("Night shift: Ночь!", now, (c) => taken.has(c)), id);
		for (const bad of ["../progress", "a/b", "", "UPPER", ".hidden"]) assert.equal(isCheatsheetId(bad), false, bad);
	});
});

describe("cheatsheetStore", () => {
	it("keeps the source and the parsed sheet, lists, reads and moves a removed one to trash", () => {
		const sheet = cheatsheetStore.create(GUIDE, undefined, new Date("2026-11-06T10:00:00Z"));
		const dir = PATHS.cheatsheets;
		assert.equal(fs.readFileSync(path.join(dir, `${sheet.id}.md`), "utf-8"), GUIDE);
		assert.ok(fs.existsSync(path.join(dir, `${sheet.id}.json`)));
		assert.ok(fs.existsSync(path.join(dir, "README.md")));

		const second = cheatsheetStore.create("| Ahoj | hi |", "Greetings", new Date("2026-11-06T11:00:00Z"));
		assert.deepEqual(
			cheatsheetStore.list().map((s) => s.title),
			["Greetings", sheet.title],
		);
		assert.equal(cheatsheetStore.list()[0]!.rows, 1);
		assert.equal(cheatsheetStore.get(sheet.id)?.title, sheet.title);
		assert.equal(cheatsheetStore.get("../progress"), null);

		assert.equal(cheatsheetStore.remove(second.id), true);
		assert.equal(cheatsheetStore.get(second.id), null);
		assert.ok(fs.existsSync(path.join(dir, "trash", `${second.id}.md`)));
		assert.equal(cheatsheetStore.remove(second.id), false);
	});

	it("edits the text and title in place, keeping the id and the replaced version in trash", () => {
		const sheet = cheatsheetStore.create("| Ahoj | hi |", "Old name", new Date("2026-11-06T09:00:00Z"));
		const edited = cheatsheetStore.update(sheet.id, "## Words\n| Ahoj | hi |\n| Čau | bye |", "New name", new Date("2026-11-06T12:00:00Z"));
		assert.equal(edited?.id, sheet.id);
		assert.equal(edited?.title, "New name");
		assert.equal(edited?.importedAt, sheet.importedAt);
		assert.equal(edited?.updatedAt, "2026-11-06T12:00:00.000Z");
		assert.equal(cheatsheetStore.get(sheet.id)?.sections[0]?.rows.length, 2);
		assert.match(cheatsheetStore.source(sheet.id) ?? "", /Čau/);
		assert.equal(fs.readFileSync(path.join(PATHS.cheatsheets, "trash", `${sheet.id}.md`), "utf-8"), "| Ahoj | hi |");

		assert.throws(() => cheatsheetStore.update(sheet.id, "## No phrase"), CheatsheetParseError);
		assert.equal(cheatsheetStore.get(sheet.id)?.title, "New name", "a refused edit changes nothing");
		assert.equal(cheatsheetStore.update("no-such-sheet", "| a | b |"), null);
		cheatsheetStore.remove(sheet.id);
	});

	it("reports overlaps and merges into a kept sheet, keeping the version before", () => {
		const sheet = cheatsheetStore.create(GUIDE, "Night shift", new Date("2026-11-06T13:00:00Z"));
		const overlaps = cheatsheetStore.overlaps(CHAT_GUIDE);
		assert.equal(overlaps[0]?.id, sheet.id);
		const before = cheatsheetStore.get(sheet.id)!;
		const result = cheatsheetStore.merge(sheet.id, CHAT_GUIDE);
		assert.equal(result?.added, overlaps[0]?.fresh);
		assert.equal(result?.sheet.title, "Night shift", "a merge keeps the title");
		const rows = (s: typeof before) => s.sections.reduce((n, x) => n + x.rows.length, 0);
		assert.equal(rows(result!.sheet), rows(before) + result!.added);
		assert.ok(fs.existsSync(path.join(PATHS.cheatsheets, "trash", `${sheet.id}.md`)));
		assert.equal(cheatsheetStore.merge(sheet.id, CHAT_GUIDE)?.added, 0);
		cheatsheetStore.remove(sheet.id);
	});

	it("refuses a guide with no phrases and writes nothing", () => {
		const before = cheatsheetStore.list().length;
		assert.throws(() => cheatsheetStore.create("just prose"), CheatsheetParseError);
		assert.equal(cheatsheetStore.list().length, before);
	});
});

describe("corpus export", () => {
	it("writes every kept cheatsheet to cheatsheets.json", async () => {
		const { exportCorpus } = await import("../src/server/corpus-export.ts");
		const { dir, summary } = exportCorpus({ stamp: "cheatsheets-test" });
		const exported = JSON.parse(fs.readFileSync(path.join(dir, "cheatsheets.json"), "utf-8")) as Array<{ title: string }>;
		assert.equal(summary.counts.cheatsheets, cheatsheetStore.list().length);
		assert.ok(exported.some((s) => s.title.startsWith("Night shift")));
	});
});

describe("cheatsheet words into Review", () => {
	it("finds the sheet's dictionary words and adds the ones not in the deck", () => {
		const sheet = cheatsheetStore.create("## Na stanici\n| Slovak | English |\n|---|---|\n| Kde je stanica? | Where is the station? |\n| Dobrý deň, jeden lístok, prosím. | Hello, one ticket, please. |", "Station");
		const before = cheatsheetReviewState(sheet);
		assert.ok(before.inDictionary > 0, "the Slovak lexicon knows some of these words");
		const result = cheatsheetToReview(sheet);
		assert.ok(result.added.length > 0);
		assert.equal(result.inReview, before.inReview + result.added.length);
		const again = cheatsheetToReview(sheet);
		assert.deepEqual(again.added, []);
	});
});
