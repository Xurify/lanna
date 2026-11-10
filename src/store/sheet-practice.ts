import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { isCheatsheetId } from "../core/cheatsheets.ts";
import type { SheetPractice } from "../core/sheet-listen.ts";
import type { ListenVerdict } from "../core/listen.ts";

export interface SheetListenLogRep {
	key: string;
	text: string;
	meaning: string;
	given: string;
	verdict: ListenVerdict;
	peeked: boolean;
	replays?: number;
	ms?: number;
	heardMs?: number;
}

export interface SheetListenLogLine {
	at: string;
	day: string;
	sheet: string;
	title: string;
	section?: string;
	ms?: number;
	reps: SheetListenLogRep[];
}

const dir = () => path.join(PATHS.cheatsheets, "practice");
const fileFor = (sheetId: string) => path.join(dir(), `${sheetId}.json`);
const logFile = () => path.join(dir(), "log.jsonl");

export const sheetPracticeStore = {
	read(sheetId: string): SheetPractice {
		if (!isCheatsheetId(sheetId)) return {};
		try {
			return JSON.parse(fs.readFileSync(fileFor(sheetId), "utf-8")) as SheetPractice;
		} catch {
			return {};
		}
	},

	write(sheetId: string, practice: SheetPractice): void {
		if (!isCheatsheetId(sheetId)) return;
		fs.mkdirSync(dir(), { recursive: true });
		const tmp = `${fileFor(sheetId)}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(practice, null, "\t"), "utf-8");
		fs.renameSync(tmp, fileFor(sheetId));
	},

	appendLog(line: SheetListenLogLine): void {
		fs.mkdirSync(dir(), { recursive: true });
		fs.appendFileSync(logFile(), `${JSON.stringify(line)}\n`, "utf-8");
	},

	readLog(): SheetListenLogLine[] {
		try {
			return fs
				.readFileSync(logFile(), "utf-8")
				.split("\n")
				.filter(Boolean)
				.map((l) => JSON.parse(l) as SheetListenLogLine);
		} catch {
			return [];
		}
	},
};
