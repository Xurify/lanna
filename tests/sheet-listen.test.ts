import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-sheet-listen-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { parseRepoSheet, parseSheetText } = await import("../src/core/cheatsheets.ts");
const {
	isSheetItem,
	pickSheetLines,
	sheetLineHeard,
	sheetLineOfItem,
	sheetLines,
	sheetListenItem,
	sheetProgress,
	SHEET_LISTEN_COUNT,
} = await import("../src/core/sheet-listen.ts");
const { cheatsheetStore } = await import("../src/store/cheatsheets.ts");
const { sheetPracticeStore } = await import("../src/store/sheet-practice.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");
const { recordSheetListen, sheetListenFor, sheetListenState } = await import("../src/server/sheet-listen.ts");
const { ROOT } = await import("../config.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const SHEET_TEXT = [
	"At the desk",
	"Пускаем? | poos-KA-yem? | Do we let it in?",
	"Он настоящий? / Она настоящая? | on na-sta-YA-shchiy? | Is it real? | он for кот",
	"Как сказать …? | KAK ska-ZAT'? | How do you say …?",
	"Body",
	"глаз / глаза | GLAS / gla-ZA | eye / eyes",
	"Пускаем? | poos-KA-yem? | Do we let it in?",
	"Ещё раз. | yee-SHCHO RAS | Once more.",
].join("\n");

const sections = parseSheetText(SHEET_TEXT);

describe("sheetLines", () => {
	const lines = sheetLines({ sections });

	it("plays each alternative of a row as a line of its own, with the row's meaning and note", () => {
		assert.deepEqual(
			lines.filter((l) => l.meaning === "Is it real?").map((l) => [l.text, l.note]),
			[
				["Он настоящий?", "он for кот"],
				["Она настоящая?", "он for кот"],
			],
		);
		assert.deepEqual(
			lines.filter((l) => l.meaning === "eye / eyes").map((l) => l.text),
			["глаз", "глаза"],
		);
	});

	it("skips a phrase with a gap to fill, and keeps a repeated phrase once, in its first section", () => {
		assert.ok(!lines.some((l) => l.text.includes("…")));
		const repeated = lines.filter((l) => l.text === "Пускаем?");
		assert.equal(repeated.length, 1);
		assert.equal(repeated[0]!.sectionId, sections[0]!.id);
	});

	it("gives every phrase of the shipped sheets a line or a gap", () => {
		const curriculum = path.join(ROOT, "curriculum");
		for (const lang of fs.readdirSync(curriculum)) {
			const dir = path.join(curriculum, lang, "cheatsheets");
			if (!fs.existsSync(dir)) continue;
			for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".txt"))) {
				const sheet = parseRepoSheet(fs.readFileSync(path.join(dir, name), "utf-8"), name);
				const playable = sheetLines(sheet);
				assert.ok(playable.length > 0, `${lang}/${name} has no line to play`);
				assert.equal(new Set(playable.map((l) => l.key)).size, playable.length, `${lang}/${name} repeats a line`);
			}
		}
	});
});

describe("pickSheetLines", () => {
	const many = sheetLines({
		sections: parseSheetText(Array.from({ length: 30 }, (_, i) => `слово${i} | | word ${i}`).join("\n")),
	});
	const at = (minute: number) => new Date(Date.UTC(2026, 10, 9, 10, minute)).toISOString();

	it("starts with the first ten phrases of the sheet", () => {
		const picked = pickSheetLines(many, {}, { seed: 1 });
		assert.equal(picked.length, SHEET_LISTEN_COUNT);
		assert.deepEqual(
			picked.map((l) => l.key).sort(),
			many
				.slice(0, 10)
				.map((l) => l.key)
				.sort(),
		);
	});

	it("brings back at most five missed phrases, the oldest miss first, then phrases not heard yet", () => {
		const practice = Object.fromEntries(
			many.slice(0, 8).map((l, i) => [l.key, sheetLineHeard(undefined, false, at(i))]),
		);
		const picked = pickSheetLines(many, practice, { seed: 2 }).map((l) => l.key);
		const missedAgain = picked.filter((k) => practice[k]);
		assert.deepEqual(
			missedAgain.sort(),
			many
				.slice(0, 5)
				.map((l) => l.key)
				.sort(),
		);
		assert.deepEqual(
			picked.filter((k) => !practice[k]).sort(),
			many
				.slice(8, 13)
				.map((l) => l.key)
				.sort(),
		);
	});

	it("once every phrase was heard, repeats the ones caught the fewest times in a row", () => {
		const practice = Object.fromEntries(
			many.map((l, i) => [l.key, { heard: 3, caughtInARow: i < 10 ? 1 : 3, at: at(i) }]),
		);
		const picked = pickSheetLines(many, practice, { seed: 3 }).map((l) => l.key);
		assert.deepEqual(
			picked.sort(),
			many
				.slice(0, 10)
				.map((l) => l.key)
				.sort(),
		);
	});

	it("counts a phrase as caught while its last answer was caught", () => {
		const [a, b, c] = many;
		const practice = {
			[a!.key]: sheetLineHeard(undefined, true, at(0)),
			[b!.key]: sheetLineHeard(sheetLineHeard(undefined, true, at(0)), false, at(1)),
		};
		assert.deepEqual(sheetProgress([a!, b!, c!], practice), { lines: 3, heard: 2, caught: 1 });
	});
});

describe("a sheet line as a Listen item", () => {
	it("carries the phrase, its meaning, its note and the sheet's title, and no dictionary word", () => {
		const line = sheetLines({ sections })[1]!;
		const item = sheetListenItem(line, "Night shift");
		assert.ok(isSheetItem(item.id));
		assert.equal(sheetLineOfItem(item.id), line.key);
		assert.equal(item.sentence, "Он настоящий?");
		assert.equal(item.translation, "Is it real?");
		assert.deepEqual(item.source, { kind: "sheet", title: "Night shift", note: "он for кот" });
		assert.equal(item.slug, "");
		assert.deepEqual(item.stretch, []);
	});
});

describe("a session on a sheet", () => {
	const sheet = cheatsheetStore.create("Night shift", SHEET_TEXT, new Date("2026-11-09T10:00:00Z"));
	const now = new Date("2026-11-09T12:00:00Z");
	const idOf = (text: string) =>
		sheetListenItem(
			sheetLines(sheet).find((l) => l.text === text)!,
			sheet.title,
		).id;

	it("offers the sheet's lines, or one section's", () => {
		const whole = sheetListenFor(sheet, { seed: 1 });
		assert.equal(whole.items.length, 6);
		assert.deepEqual(whole.progress, { lines: 6, heard: 0, caught: 0 });
		const body = sheetListenFor(sheet, { seed: 1, section: sections[1]!.id });
		assert.deepEqual(body.items.map((i) => i.sentence).sort(), ["Ещё раз.", "глаз", "глаза"].sort());
		assert.deepEqual(sheetListenFor(sheet, { seed: 1, section: "no-such-section" }).items, []);
	});

	it("grades on the server against the sheet's own line, and keeps the answers apart from everything measured", () => {
		const lessonsBefore = readLessonLog().length;
		const outcome = recordSheetListen(
			sheet,
			{
				reps: [
					{ itemId: idOf("Пускаем?"), given: "пускаем" },
					{ itemId: idOf("Ещё раз."), given: "еще раз" },
					{ itemId: idOf("глаз"), given: "глас" },
					{ itemId: idOf("глаза"), given: "глаза", peeked: true },
					{ itemId: idOf("Он настоящий?"), given: "" },
					{ itemId: idOf("Пускаем?"), given: "something else" },
					{ itemId: "sheet:not a line of this sheet", given: "пускаем" },
					{ itemId: "word#0", given: "пускаем" },
				],
				activeMs: 120_000,
			},
			now,
		);
		assert.deepEqual(outcome, {
			xp: 0,
			correct: 1,
			almost: 1,
			total: 5,
			queued: [],
			progress: { lines: 6, heard: 5, caught: 2 },
		});

		const practice = sheetPracticeStore.read(sheet.id);
		assert.equal(practice["пускаем"]!.caughtInARow, 1);
		assert.equal(practice["еще раз"]!.caughtInARow, 1);
		assert.equal(practice["глаз"]!.caughtInARow, 0);
		assert.equal(practice["глаза"]!.caughtInARow, 0);

		const log = sheetPracticeStore.readLog();
		assert.equal(log.length, 1);
		assert.equal(log[0]!.sheet, sheet.id);
		assert.deepEqual(
			log[0]!.reps.map((r) => [r.text, r.verdict, r.peeked]),
			[
				["Пускаем?", "exact", false],
				["Ещё раз.", "accents", false],
				["глаз", "wrong", false],
				["глаза", "exact", true],
				["Он настоящий?", "wrong", false],
			],
		);

		const progress = progressStore.read();
		const day = progress.days["2026-11-09"]!;
		assert.equal(day.minutesBy?.listen, 2);
		assert.equal(day.xp, 0);
		assert.equal(day.reps, 0);
		assert.equal(day.listens, undefined);
		assert.equal(progress.xp, 0);
		assert.deepEqual(progress.recent, []);
		assert.equal(readLessonLog().length, lessonsBefore);
		assert.deepEqual(Object.keys(reviewStore.readCards()), []);
		assert.deepEqual(sheetListenState(sheet), { lines: 6, heard: 5, caught: 2 });
	});

	it("brings the missed lines back in the next session", () => {
		const next = sheetListenFor(sheet, { seed: 5 }).items.map((i) => i.sentence);
		for (const missed of ["глаз", "глаза", "Он настоящий?"]) assert.ok(next.includes(missed), missed);
	});

	it("writes nothing for a session with no line of the sheet in it", () => {
		const outcome = recordSheetListen(
			sheet,
			{ reps: [{ itemId: "word#0", given: "x" }], activeMs: 60_000 },
			new Date("2026-11-10T12:00:00Z"),
		);
		assert.equal(outcome.total, 0);
		assert.equal(sheetPracticeStore.readLog().length, 1);
		assert.equal(progressStore.read().days["2026-11-10"], undefined);
	});
});
