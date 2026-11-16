import { addMinutes, sessionMs } from "../core/active-time.ts";
import type { Cheatsheet } from "../core/cheatsheets.ts";
import { almostCount, judgeTyped, understood, type ListenVerdict } from "../core/listen.ts";
import { dayKey } from "../core/review.ts";
import {
	isSheetItem,
	pickSheetLines,
	sheetLineCaught,
	sheetLineHeard,
	sheetLineOfItem,
	sheetLines,
	sheetListenItem,
	sheetProgress,
	type SheetLine,
	type SheetListenPlan,
	type SheetProgress,
} from "../core/sheet-listen.ts";
import { progressStore } from "../store/progress.ts";
import { sheetPracticeStore, type SheetListenLogRep } from "../store/sheet-practice.ts";
import { activeLanguage } from "./active-language.ts";

function linesOf(sheet: Cheatsheet, sectionId?: string): SheetLine[] {
	const lines = sheetLines(sheet);
	return sectionId ? lines.filter((l) => l.sectionId === sectionId) : lines;
}

export function sheetListenState(sheet: Cheatsheet): SheetProgress {
	return sheetProgress(sheetLines(sheet), sheetPracticeStore.read(sheet.id));
}

export function sheetListenFor(sheet: Cheatsheet, opts: { section?: string; seed?: number } = {}): SheetListenPlan {
	const practice = sheetPracticeStore.read(sheet.id);
	const lines = linesOf(sheet, opts.section);
	const items = pickSheetLines(lines, practice, { seed: opts.seed ?? Date.now() }).map((line) =>
		sheetListenItem(line, sheet.title),
	);
	return { items, known: 0, coverage: 1, progress: sheetProgress(lines, practice) };
}

export interface SheetListenRep {
	itemId: string;
	given: string;
	peeked?: boolean;
	replays?: number;
	ms?: number;
	heardMs?: number;
}

interface SheetListenInput {
	reps: SheetListenRep[];
	section?: string;
	ms?: number;
	activeMs?: number;
	tz?: number;
}

export interface SheetListenOutcome {
	xp: 0;
	correct: number;
	almost: number;
	total: number;
	queued: [];
	progress: SheetProgress;
}

export function recordSheetListen(sheet: Cheatsheet, input: SheetListenInput, now = new Date()): SheetListenOutcome {
	const tag = activeLanguage().tag;
	const lines = linesOf(sheet, input.section);
	const byKey = new Map(lines.map((l) => [l.key, l]));
	const practice = sheetPracticeStore.read(sheet.id);
	const at = now.toISOString();
	const graded: SheetListenLogRep[] = [];
	const answered = new Set<string>();
	for (const rep of input.reps) {
		const line = isSheetItem(rep.itemId) ? byKey.get(sheetLineOfItem(rep.itemId)) : undefined;
		if (!line || answered.has(line.key)) continue;
		answered.add(line.key);
		const verdict: ListenVerdict = rep.given ? judgeTyped(rep.given, line.text, tag) : "wrong";
		const peeked = rep.peeked === true;
		practice[line.key] = sheetLineHeard(practice[line.key], sheetLineCaught({ verdict, peeked }), at);
		graded.push({
			key: line.key,
			text: line.text,
			meaning: line.meaning,
			given: rep.given,
			verdict,
			peeked,
			...(rep.replays !== undefined ? { replays: rep.replays } : {}),
			...(rep.ms !== undefined ? { ms: rep.ms } : {}),
			...(rep.heardMs !== undefined ? { heardMs: rep.heardMs } : {}),
		});
	}
	const day = dayKey(now, input.tz);
	if (graded.length > 0) {
		sheetPracticeStore.write(sheet.id, practice);
		sheetPracticeStore.appendLog({
			at,
			day,
			sheet: sheet.id,
			title: sheet.title,
			...(input.section ? { section: input.section } : {}),
			...(input.ms !== undefined ? { ms: input.ms } : {}),
			reps: graded,
		});
		const p = progressStore.read();
		addMinutes((p.days[day] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 }), "listen", sessionMs(input));
		progressStore.write(p);
	}
	return {
		xp: 0,
		correct: understood(graded),
		almost: almostCount(graded),
		total: graded.length,
		queued: [],
		progress: sheetProgress(lines, practice),
	};
}
