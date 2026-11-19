import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { WritingEntry } from "../core/writing.ts";

export function readWriting(file = PATHS.writing): WritingEntry[] {
	try {
		return fs
			.readFileSync(file, "utf8")
			.split("\n")
			.flatMap((line) => {
				try {
					return line.trim() ? [JSON.parse(line) as WritingEntry] : [];
				} catch {
					return [];
				}
			});
	} catch {
		return [];
	}
}

export function appendWriting(entry: WritingEntry, file = PATHS.writing): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
}
