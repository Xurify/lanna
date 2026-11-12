import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { EstimateRange } from "../core/word-estimate.ts";

export interface WordCheckAnswerRecord {
	at: string;
	session: string;
	slug: string;
	lemma: string;
	rank: number;
	options: string[];
	picked: string | null;
	known: boolean;
	ms?: number;
}

export interface WordCheckSessionRecord {
	id: string;
	startedAt: string;
	endedAt: string;
	answered: number;
	known: number;
	before: EstimateRange;
	after: EstimateRange;
	measured: boolean;
	activeMs?: number;
}

export interface OpenWordCheck {
	id: string;
	startedAt: string;
	seed: number;
	before: EstimateRange;
	asked: string[];
	pending?: { slug: string; options: string[] };
}

export interface EstimateDay extends EstimateRange {
	review: number;
	marked: number;
	checked: number;
	inferred: number;
	answers: number;
}

interface HistoryFile {
	days: Record<string, EstimateDay>;
}

const DIR = () => path.join(PATHS.data, "word-check");
const ANSWERS = () => path.join(DIR(), "answers.jsonl");
const SESSIONS = () => path.join(DIR(), "sessions.jsonl");
const OPEN = () => path.join(DIR(), "open.json");
const HISTORY = () => path.join(DIR(), "history.json");

function readJson<T>(file: string, fallback: T): T {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return fallback;
	}
}

function writeJsonAtomic(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value, null, "\t"), "utf-8");
	fs.renameSync(tmp, file);
}

function readLines<T>(file: string): T[] {
	let text: string;
	try {
		text = fs.readFileSync(file, "utf-8");
	} catch {
		return [];
	}
	return text
		.split("\n")
		.filter(Boolean)
		.flatMap((line) => {
			try {
				return [JSON.parse(line) as T];
			} catch {
				return [];
			}
		});
}

function appendLine(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.appendFileSync(file, `${JSON.stringify(value)}\n`, "utf-8");
}

export const wordCheckStore = {
	answers(): WordCheckAnswerRecord[] {
		return readLines<WordCheckAnswerRecord>(ANSWERS());
	},
	appendAnswer(answer: WordCheckAnswerRecord): void {
		appendLine(ANSWERS(), answer);
	},
	sessions(): WordCheckSessionRecord[] {
		return readLines<WordCheckSessionRecord>(SESSIONS());
	},
	appendSession(session: WordCheckSessionRecord): void {
		appendLine(SESSIONS(), session);
	},
	open(): OpenWordCheck | null {
		return readJson<OpenWordCheck | null>(OPEN(), null);
	},
	putOpen(check: OpenWordCheck): void {
		writeJsonAtomic(OPEN(), check);
	},
	closeOpen(): void {
		fs.rmSync(OPEN(), { force: true });
	},
	history(): Record<string, EstimateDay> {
		return readJson<HistoryFile>(HISTORY(), { days: {} }).days ?? {};
	},
	putDay(day: string, snapshot: EstimateDay): void {
		const days = wordCheckStore.history();
		const before = days[day];
		if (before && JSON.stringify(before) === JSON.stringify(snapshot)) return;
		writeJsonAtomic(HISTORY(), { days: { ...days, [day]: snapshot } });
	},
};

type MeasuredVocabulary = { size: number; at: string; reliable: boolean };

export function latestMeasuredVocabulary(fromLevelCheck: MeasuredVocabulary | undefined): MeasuredVocabulary | undefined {
	const lastCheck = wordCheckStore.sessions().filter((s) => s.measured).at(-1);
	if (!lastCheck) return fromLevelCheck;
	if (fromLevelCheck && fromLevelCheck.at > lastCheck.endedAt) return fromLevelCheck;
	return { size: lastCheck.after.total, at: lastCheck.endedAt, reliable: true };
}
