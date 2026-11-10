import { phraseKey, type Cheatsheet } from "./cheatsheets.ts";
import { rng, shuffle } from "./lesson.ts";
import type { ListenItem, ListenPlan, ListenVerdict } from "./listen.ts";

export interface SheetLine {
	key: string;
	text: string;
	meaning: string;
	note?: string;
	sectionId: string;
}

export interface SheetLineRecord {
	heard: number;
	caughtInARow: number;
	at: string;
}

export type SheetPractice = Record<string, SheetLineRecord>;

export interface SheetProgress {
	lines: number;
	heard: number;
	caught: number;
}

export interface SheetListenPlan extends ListenPlan {
	progress: SheetProgress;
}

export const SHEET_LISTEN_COUNT = 10;
const MISSED_SHARE = 0.5;

const ALTERNATIVES = /\s+\/\s+/;
const PLACEHOLDER = /…|\.{3}/;

export function sheetLines(sheet: Pick<Cheatsheet, "sections">): SheetLine[] {
	const seen = new Set<string>();
	const lines: SheetLine[] = [];
	for (const section of sheet.sections)
		for (const row of section.rows) {
			if (PLACEHOLDER.test(row.text)) continue;
			for (const text of row.text.split(ALTERNATIVES)) {
				const key = phraseKey(text);
				if (!key || seen.has(key)) continue;
				seen.add(key);
				lines.push({ key, text: text.trim(), meaning: row.meaning ?? "", ...(row.note ? { note: row.note } : {}), sectionId: section.id });
			}
		}
	return lines;
}

export function sheetProgress(lines: readonly SheetLine[], practice: SheetPractice): SheetProgress {
	return {
		lines: lines.length,
		heard: lines.filter((l) => practice[l.key]).length,
		caught: lines.filter((l) => (practice[l.key]?.caughtInARow ?? 0) > 0).length,
	};
}

export function pickSheetLines(lines: readonly SheetLine[], practice: SheetPractice, opts: { seed: number; count?: number }): SheetLine[] {
	const count = opts.count ?? SHEET_LISTEN_COUNT;
	const oldestFirst = (a: SheetLine, b: SheetLine) => practice[a.key]!.at.localeCompare(practice[b.key]!.at);
	const missed = lines.filter((l) => practice[l.key]?.caughtInARow === 0).sort(oldestFirst);
	const fresh = lines.filter((l) => !practice[l.key]);
	const caught = lines.filter((l) => (practice[l.key]?.caughtInARow ?? 0) > 0).sort((a, b) => practice[a.key]!.caughtInARow - practice[b.key]!.caughtInARow || oldestFirst(a, b));
	const missedFirst = Math.ceil(count * MISSED_SHARE);
	const chosen = [...missed.slice(0, missedFirst), ...fresh, ...caught, ...missed.slice(missedFirst)].slice(0, count);
	return shuffle(chosen, rng(opts.seed));
}

export function sheetLineHeard(before: SheetLineRecord | undefined, caught: boolean, at: string): SheetLineRecord {
	return { heard: (before?.heard ?? 0) + 1, caughtInARow: caught ? (before?.caughtInARow ?? 0) + 1 : 0, at };
}

export function sheetLineCaught(rep: { verdict: ListenVerdict; peeked?: boolean }): boolean {
	return rep.verdict !== "wrong" && !rep.peeked;
}

const ITEM_PREFIX = "sheet:";

export function isSheetItem(itemId: string): boolean {
	return itemId.startsWith(ITEM_PREFIX);
}

export function sheetLineOfItem(itemId: string): string {
	return itemId.slice(ITEM_PREFIX.length);
}

export function sheetListenItem(line: SheetLine, sheetTitle: string): ListenItem {
	return {
		id: ITEM_PREFIX + line.key,
		slug: "",
		lemma: "",
		gloss: "",
		sentence: line.text,
		translation: line.meaning,
		options: [],
		stretch: [],
		coverage: 1,
		words: line.text.split(/\s+/).filter(Boolean).length,
		source: { kind: "sheet", title: sheetTitle, ...(line.note ? { note: line.note } : {}) },
	};
}
