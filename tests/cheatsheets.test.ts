/**
 * Cheatsheets: the one-line-per-phrase text, the store on a throwaway data
 * folder, adding phrases to a sheet, and the bridge to the Review deck.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-cheatsheets-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const {
	CheatsheetParseError,
	formatRepoSheet,
	parseRepoSheet,
	cheatsheetId,
	cheatsheetRowCount,
	cheatsheetWords,
	countOverlap,
	formatSheetText,
	isCheatsheetId,
	mergeSections,
	parseSheetText,
	phraseKey,
	sameSection,
	searchSections,
} = await import("../src/core/cheatsheets.ts");
const { cheatsheetStore } = await import("../src/store/cheatsheets.ts");
const { cheatsheetReviewState, cheatsheetToReview } = await import("../src/server/cheatsheets.ts");
const { PATHS, ROOT, repoCheatsheetsDir } = await import("../config.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const fixture = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf-8");
const A = fixture("cheatsheet-a.txt");
const B = fixture("cheatsheet-b.txt");

describe("parseSheetText", () => {
	it("reads a line with | as a phrase and a line without one as a section name", () => {
		const sections = parseSheetText(
			"Café\nКофе, пожалуйста. | KO-fye, pa-ZHAL-sta | A coffee, please.\nNot here | | Nothing\n\nStation\nГде вокзал? | GDYE vak-ZAL? | Where is the station?",
		);
		assert.deepEqual(
			sections.map((s) => s.title),
			["Café", "Station"],
		);
		assert.deepEqual(sections[0]!.rows[0], {
			text: "Кофе, пожалуйста.",
			pron: "KO-fye, pa-ZHAL-sta",
			meaning: "A coffee, please.",
		});
		assert.deepEqual(sections[1]!.rows, [
			{ text: "Где вокзал?", pron: "GDYE vak-ZAL?", meaning: "Where is the station?" },
		]);
	});

	it("keeps empty fields out and joins extra fields as a note", () => {
		const [s] = parseSheetText("Words\nголова |  | head\nДа | | yes | common | formal");
		assert.deepEqual(s!.rows, [
			{ text: "голова", meaning: "head" },
			{ text: "Да", meaning: "yes", note: "common · formal" },
		]);
	});

	it("skips the header and separator of a pasted table and strips bold marks", () => {
		const sections = parseSheetText(
			"| Russian | Sounds like | Meaning |\n|---|---|---|\n**Помогите!** | pa-ma-GEE-tye | Help",
		);
		assert.deepEqual(sections[0]!.title, "Phrases");
		assert.deepEqual(sections[0]!.rows, [{ text: "Помогите!", pron: "pa-ma-GEE-tye", meaning: "Help" }]);
	});

	it("puts phrases above the first section under Phrases, and drops sections with no phrase", () => {
		const sections = parseSheetText("Ahoj | hi\n\nEmpty heading\n\nDone\nDakujem | thanks");
		assert.deepEqual(
			sections.map((s) => s.title),
			["Phrases", "Done"],
		);
	});

	it("gives sections unique ids", () => {
		const sections = parseSheetText("Words\na | b\nWords\nc | d");
		assert.deepEqual(
			sections.map((s) => s.id),
			["words", "words-2"],
		);
	});

	it("refuses text with no phrase and text over the row limit", () => {
		assert.throws(() => parseSheetText("Only a heading\n\nand prose"), CheatsheetParseError);
		assert.throws(() => parseSheetText(""), CheatsheetParseError);
		assert.throws(() => parseSheetText("x".repeat(200_001)), CheatsheetParseError);
	});

	it("reads the example files: every phrase line is a row, no row is lost", () => {
		assert.equal(parseSheetText(B)[0]!.title, "1. Café and food", "the pasted table header above it is skipped");
		for (const text of [A, B]) {
			// A pasted table header and its |---| line carry a "|" but are not phrases.
			const lines = text
				.split("\n")
				.filter((l) => l.includes("|") && !/^[\s|:-]+$/.test(l) && !/^\|\s*Russian\b/.test(l));
			const sections = parseSheetText(text);
			assert.equal(
				sections.reduce((n, s) => n + s.rows.length, 0),
				lines.length,
			);
		}
	});
});

describe("formatSheetText", () => {
	it("writes the text a sheet is edited as, and reads back to the same sections", () => {
		for (const text of [A, B]) {
			const sections = parseSheetText(text);
			const again = parseSheetText(formatSheetText(sections));
			assert.deepEqual(
				again.map((s) => [s.title, s.rows]),
				sections.map((s) => [s.title, s.rows]),
			);
		}
	});

	it("keeps a phrase with no meaning a phrase, not a section name", () => {
		const text = formatSheetText([{ title: "Words", rows: [{ text: "Ahoj" }] }]);
		assert.equal(text, "Words\nAhoj |");
		assert.deepEqual(parseSheetText(text)[0]!.rows, [{ text: "Ahoj" }]);
	});
});

describe("phrases across sheets", () => {
	it("compares by case, ё and punctuation, and covers a / b when both parts are there", () => {
		assert.equal(phraseKey("Спасибо!"), phraseKey("спасибо."));
		assert.equal(phraseKey("Ещё раз"), phraseKey("еще раз"));
		const sheet = parseSheetText("Words\nглаз / глаза | | eye\nДа | | yes");
		const o = countOverlap(sheet, parseSheetText("Other\nглаза | | eyes\nда. | | yes\nНет | | no"));
		assert.deepEqual(o, { shared: 2, fresh: 1 });
	});

	it("counts the shared and the new phrases of a second text", () => {
		const o = countOverlap(parseSheetText(A), parseSheetText(B));
		assert.deepEqual(o, { shared: 8, fresh: 5 });
		assert.equal(
			o.shared + o.fresh,
			new Set(parseSheetText(B).flatMap((s) => s.rows.map((r) => phraseKey(r.text)))).size,
			"every distinct phrase is counted once",
		);
	});

	it("matches numbered sections by their number, else by title", () => {
		assert.equal(sameSection("2. Describing what you see", "2. What we see"), true);
		assert.equal(sameSection("2. Describing", "3. Describing"), false);
		assert.equal(sameSection("Numbers", "numbers"), true);
	});

	it("adds only new phrases: into the section they name, else as a new section", () => {
		const existing = parseSheetText(
			"1. At the café\nКофе, пожалуйста. | KO-fye | A coffee, please.\n\nTips\nСтоп | | stop",
		);
		const incoming = parseSheetText(
			"1. Café and food\nКофе, пожалуйста! | x | Coffee!\nМеню, пожалуйста. | mee-NYU | The menu, please.\n\nHelp\nПомогите | | help",
		);
		const { sections, added } = mergeSections(existing, incoming);
		assert.equal(added, 2);
		const cafe = sections.find((s) => s.id === "1-at-the-cafe")!;
		assert.deepEqual(
			cafe.rows.map((r) => r.text),
			["Кофе, пожалуйста.", "Меню, пожалуйста."],
		);
		assert.equal(sections.at(-1)!.title, "Help");
		assert.equal(mergeSections(sections, incoming).added, 0, "a second add of the same text adds nothing");
	});
});

describe("cheatsheetStore", () => {
	it("creates a sheet from a title and text, lists it, reads it and keeps the ids safe", () => {
		const sheet = cheatsheetStore.create("Sample sheet", A, new Date("2026-11-06T10:00:00Z"));
		assert.equal(sheet.title, "Sample sheet");
		assert.equal(cheatsheetRowCount(sheet), cheatsheetRowCount({ sections: parseSheetText(A) }));
		assert.ok(fs.existsSync(path.join(PATHS.cheatsheets, `${sheet.id}.json`)));
		assert.deepEqual(
			fs.readdirSync(PATHS.cheatsheets).filter((f) => f.endsWith(".md")),
			["README.md"],
			"one JSON file per sheet, no source copy",
		);
		assert.ok(fs.existsSync(path.join(PATHS.cheatsheets, "README.md")));
		assert.equal(cheatsheetStore.get(sheet.id)?.title, "Sample sheet");
		assert.equal(cheatsheetStore.get("../progress"), null);
		assert.equal(isCheatsheetId("../progress"), false);
		assert.ok(cheatsheetStore.list().some((s) => s.id === sheet.id && s.rows > 0));
		cheatsheetStore.remove(sheet.id);
	});

	it("names an untitled sheet and refuses text with no phrase, writing nothing", () => {
		const before = cheatsheetStore.list().length;
		assert.equal(cheatsheetStore.create("", "Ahoj | hi").title, "Cheatsheet");
		assert.throws(() => cheatsheetStore.create("No phrases", "just prose"), CheatsheetParseError);
		assert.equal(cheatsheetStore.list().length, before + 1);
	});

	it("update replaces the title and phrases, keeps the id and the import date, and moves the old version to trash", () => {
		const sheet = cheatsheetStore.create("Old name", "| Ahoj | hi |", new Date("2026-11-06T09:00:00Z"));
		const edited = cheatsheetStore.update(
			sheet.id,
			{ title: "New name", text: "Words\nAhoj | | hi\nČau | | bye" },
			new Date("2026-11-06T12:00:00Z"),
		);
		assert.equal(edited?.id, sheet.id);
		assert.equal(edited?.title, "New name");
		assert.equal(edited?.importedAt, sheet.importedAt);
		assert.equal(edited?.updatedAt, "2026-11-06T12:00:00.000Z");
		assert.equal(cheatsheetRowCount(cheatsheetStore.get(sheet.id)!), 2);
		const trash = fs.readdirSync(path.join(PATHS.cheatsheets, "trash")).filter((f) => f.startsWith(`${sheet.id}.`));
		assert.equal(trash.length, 1);
		assert.equal(
			JSON.parse(fs.readFileSync(path.join(PATHS.cheatsheets, "trash", trash[0]!), "utf-8")).title,
			"Old name",
		);

		assert.throws(() => cheatsheetStore.update(sheet.id, { text: "No phrase here" }), CheatsheetParseError);
		assert.equal(cheatsheetStore.get(sheet.id)?.title, "New name", "a refused edit changes nothing");
		assert.equal(cheatsheetStore.update("no-such-sheet", { text: "a | b" }), null);
		cheatsheetStore.remove(sheet.id);
	});

	it("add puts the new phrases in, keeps the version before, and writes nothing when nothing is new", () => {
		const sheet = cheatsheetStore.create("Sample sheet", A, new Date("2026-11-06T13:00:00Z"));
		const before = cheatsheetStore.get(sheet.id)!;
		const result = cheatsheetStore.add(sheet.id, B);
		assert.equal(result?.added, countOverlap(before.sections, parseSheetText(B)).fresh);
		assert.equal(result?.sheet.title, "Sample sheet", "an add keeps the title");
		assert.equal(cheatsheetRowCount(result!.sheet), cheatsheetRowCount(before) + result!.added);
		const versions = fs.readdirSync(path.join(PATHS.cheatsheets, "trash")).filter((f) => f.startsWith(`${sheet.id}.`));
		assert.ok(versions.length >= 1);
		const writes = fs.statSync(path.join(PATHS.cheatsheets, `${sheet.id}.json`)).mtimeMs;
		assert.equal(cheatsheetStore.add(sheet.id, B)?.added, 0);
		assert.equal(
			fs.statSync(path.join(PATHS.cheatsheets, `${sheet.id}.json`)).mtimeMs,
			writes,
			"a no-op add writes nothing",
		);
		cheatsheetStore.remove(sheet.id);
	});

	it("remove moves the sheet to trash", () => {
		const sheet = cheatsheetStore.create("Gone soon", "Ahoj | hi", new Date("2026-11-06T14:00:00Z"));
		assert.equal(cheatsheetStore.remove(sheet.id), true);
		assert.equal(cheatsheetStore.get(sheet.id), null);
		assert.equal(cheatsheetStore.remove(sheet.id), false);
	});
});

describe("cheatsheet words into Review", () => {
	it("finds the sheet's dictionary words and adds the ones not in the deck", () => {
		const sheet = cheatsheetStore.create(
			"Station",
			"Station\nKde je stanica? | | Where is the station?\nDobrý deň, jeden lístok, prosím. | | Hello, one ticket, please.",
			new Date("2026-11-06T15:00:00Z"),
		);
		const before = cheatsheetReviewState(sheet);
		assert.ok(before.inDictionary > 0, "the Slovak lexicon knows some of these words");
		const result = cheatsheetToReview(sheet);
		assert.ok(result.added.length > 0);
		assert.equal(result.inReview, before.inReview + result.added.length);
		assert.deepEqual(cheatsheetToReview(sheet).added, []);
		cheatsheetStore.remove(sheet.id);
	});
});

describe("corpus export", () => {
	it("writes every kept cheatsheet to cheatsheets.json", async () => {
		const { exportCorpus } = await import("../src/server/corpus-export.ts");
		const sheet = cheatsheetStore.create("Exported sheet", "Ahoj | hi", new Date("2026-11-06T16:00:00Z"));
		const { dir, summary } = exportCorpus({ stamp: "cheatsheets-test" });
		const exported = JSON.parse(fs.readFileSync(path.join(dir, "cheatsheets.json"), "utf-8")) as Array<{
			title: string;
		}>;
		assert.equal(summary.counts.cheatsheets, cheatsheetStore.list().length);
		assert.ok(exported.some((s) => s.title === "Exported sheet"));
		cheatsheetStore.remove(sheet.id);
	});
});

describe("ids", () => {
	it("makes file-safe ids and rejects unsafe ones", () => {
		const now = new Date("2026-11-06T12:00:00Z");
		const id = cheatsheetId("Sample: Ночь!", now, () => false);
		assert.ok(isCheatsheetId(id), id);
		assert.ok(id.startsWith("sample-"));
		assert.ok(cheatsheetId("Ночь", now, () => false).startsWith("sheet-"));
		const taken = new Set([id]);
		assert.notEqual(
			cheatsheetId("Sample: Ночь!", now, (c) => taken.has(c)),
			id,
		);
		for (const bad of ["../progress", "a/b", "", "UPPER", ".hidden"]) assert.equal(isCheatsheetId(bad), false, bad);
	});

	it("lists each word of a sheet once, lowercased", () => {
		const sheet = {
			sections: parseSheetText(
				"Words\nЯ не уверен. / Я не уверена. | | I'm not sure\nЧто-то есть? | | Is there something?",
			),
		};
		assert.deepEqual(cheatsheetWords(sheet, "ru-RU"), ["я", "не", "уверен", "уверена", "что-то", "есть"]);
	});
});

describe("sheets kept in the repo", () => {
	it("never point a test run at the real repo folder", () => {
		assert.ok(repoCheatsheetsDir("slovak").startsWith(TMP_DATA), repoCheatsheetsDir("slovak"));
	});

	it("read a # Title first line, and write it back", () => {
		const { title, sections } = parseRepoSheet("# Café words\n\nCafé\nКофе | KO-fye | coffee", "fallback");
		assert.equal(title, "Café words");
		assert.deepEqual(sections[0]!.rows, [{ text: "Кофе", pron: "KO-fye", meaning: "coffee" }]);
		assert.equal(
			parseRepoSheet("Café\nКофе | | coffee", "cafe-words").title,
			"cafe-words",
			"no title line: the file name",
		);
		assert.equal(formatRepoSheet("Café words", sections), "# Café words\n\nCafé\nКофе | KO-fye | coffee\n");
	});

	it("list, read, edit and add in place, and are never removed by the app", () => {
		const dir = repoCheatsheetsDir();
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, "cafe-words.txt"), "# Café words\n\nCafé\nКофе | KO-fye | coffee\n");
		const listed = cheatsheetStore.list().find((s) => s.id === "repo-cafe-words");
		assert.equal(listed?.title, "Café words");
		assert.ok(listed?.repoFile?.endsWith("cafe-words.txt"));
		assert.equal(cheatsheetStore.get("repo-cafe-words")?.sections[0]?.rows.length, 1);

		const edited = cheatsheetStore.update("repo-cafe-words", {
			title: "Café",
			text: "Café\nКофе | KO-fye | coffee\nЧай | CHAI | tea",
		});
		assert.equal(edited?.title, "Café");
		assert.equal(
			fs.readFileSync(path.join(dir, "cafe-words.txt"), "utf-8"),
			"# Café\n\nCafé\nКофе | KO-fye | coffee\nЧай | CHAI | tea\n",
		);
		assert.equal(cheatsheetStore.add("repo-cafe-words", "Café\nЧай | | tea\nВода | | water")?.added, 1);
		assert.match(fs.readFileSync(path.join(dir, "cafe-words.txt"), "utf-8"), /Вода/);

		assert.equal(cheatsheetStore.remove("repo-cafe-words"), false);
		assert.ok(fs.existsSync(path.join(dir, "cafe-words.txt")));
		fs.rmSync(path.join(dir, "cafe-words.txt"));
	});

	it("Move to repo writes the sheet under its title and puts the local copy in trash", () => {
		const local = cheatsheetStore.create(
			"Travel: basics",
			"Help\nПомогите! | | Help!",
			new Date("2026-11-06T17:00:00Z"),
		);
		const moved = cheatsheetStore.toRepo(local.id);
		assert.equal(moved?.id, "repo-travel-basics");
		assert.equal(cheatsheetStore.get(local.id), null);
		assert.ok(fs.existsSync(path.join(repoCheatsheetsDir(), "travel-basics.txt")));
		const again = cheatsheetStore.toRepo(cheatsheetStore.create("Travel: basics", "Help\nСтоп | | stop").id);
		assert.equal(again?.id, "repo-travel-basics-2", "a name already in the repo gets a number");
		assert.equal(cheatsheetStore.toRepo("repo-travel-basics"), null, "only a local sheet moves");
	});

	it("a local id never looks like a repo id", () => {
		assert.ok(!cheatsheetId("Repo notes", new Date(), () => false).startsWith("repo-"));
	});

	it("every sheet shipped in the repo parses", () => {
		const root = path.join(ROOT, "curriculum");
		const files = fs
			.readdirSync(root)
			.map((lang) => path.join(root, lang, "cheatsheets"))
			.filter((d) => fs.existsSync(d))
			.flatMap((d) =>
				fs
					.readdirSync(d)
					.filter((f) => f.endsWith(".txt"))
					.map((f) => path.join(d, f)),
			);
		assert.ok(files.length >= 1);
		for (const file of files) {
			const { title, sections } = parseRepoSheet(fs.readFileSync(file, "utf-8"), path.basename(file, ".txt"));
			assert.ok(title && sections.length > 0, file);
		}
	});
});

describe("searchSections", () => {
	const sections = [
		{
			id: "a",
			title: "Greetings",
			rows: [
				{ text: "Dobrý deň", meaning: "good day" },
				{ text: "Čau", meaning: "hi", note: "friends only" },
			],
		},
		{
			id: "b",
			title: "Time",
			rows: [{ text: "Koľko je hodín?", pron: "KOL-ko ye HO-deen", meaning: "what time is it" }],
		},
	];

	it("returns everything for an empty search", () => {
		assert.equal(searchSections(sections, "  ", "sk-SK"), sections);
	});

	it("finds a phrase without its accents, and by meaning, pronunciation or note", () => {
		assert.deepEqual(
			searchSections(sections, "cau", "sk-SK").map((s) => s.rows.map((r) => r.text)),
			[["Čau"]],
		);
		assert.deepEqual(
			searchSections(sections, "what time", "sk-SK").map((s) => s.id),
			["b"],
		);
		assert.deepEqual(
			searchSections(sections, "ho-deen", "sk-SK").map((s) => s.id),
			["b"],
		);
		assert.deepEqual(
			searchSections(sections, "friends", "sk-SK").map((s) => s.id),
			["a"],
		);
	});

	it("keeps every row of a section whose title matches, and drops sections with no match", () => {
		assert.equal(searchSections(sections, "greet", "sk-SK")[0]?.rows.length, 2);
		assert.deepEqual(searchSections(sections, "zzz", "sk-SK"), []);
	});

	it("finds a sheet by a phrase in it", () => {
		const sheet = cheatsheetStore.create("Travel", "Greetings\nDobrý deň | | good day");
		assert.ok(cheatsheetStore.search("dobry", "sk-SK").some((s) => s.id === sheet.id));
		assert.ok(cheatsheetStore.search("travel", "sk-SK").some((s) => s.id === sheet.id));
		assert.ok(!cheatsheetStore.search("nothing like it", "sk-SK").some((s) => s.id === sheet.id));
	});
});
