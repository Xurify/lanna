import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { PracticeSentenceEntry } from "../core/sentences.ts";

export const sentenceStore = {
	readAll(): PracticeSentenceEntry[] {
		try {
			const raw = fs.readFileSync(PATHS.sentences, "utf-8");
			const out: PracticeSentenceEntry[] = [];
			for (const line of raw.split("\n")) {
				if (!line.trim()) continue;
				try {
					out.push(JSON.parse(line) as PracticeSentenceEntry);
				} catch {
					// Skip malformed JSONL lines written during crashes.
				}
			}
			return out;
		} catch {
			return [];
		}
	},

	append(entry: PracticeSentenceEntry): void {
		fs.mkdirSync(path.dirname(PATHS.sentences), { recursive: true });
		fs.appendFileSync(PATHS.sentences, `${JSON.stringify(entry)}\n`, "utf-8");
	},
};
