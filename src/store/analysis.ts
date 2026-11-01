/**
 * Mistake-analysis persistence (LangHarness, 2026-11-01) — the active
 * profile's data/profiles/<language>/analysis.json: the latest snapshot of
 * src/core/mistakes.ts (with the time it was taken) and the guide written
 * from it, so a guide is paid for once per set of facts and read from disk
 * ever after (the corpus rule). Each guide keeps the model and its tokens.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { GuideData, MistakeAnalysis } from "../core/mistakes.ts";
import type { PersonalPractice } from "../core/personal.ts";
import type { StoryUsage } from "../core/reading.ts";

export interface GuideRecord {
	/** The model's reply as written; the page shows it when `data` could not be read from it. */
	text: string;
	/** The reply read as patterns, guesses and a plan (src/core/mistakes.ts parseGuide). */
	data?: GuideData | null;
	/** The practice targets the lexicon backs (src/core/personal.ts), for the personal lesson. */
	practice?: PersonalPractice | null;
	/** When it was written (ISO). */
	at: string;
	/** Digest of the facts it was written from (src/core/mistakes.ts guideFacts). */
	digest: string;
	/** "provider:id" of the model that wrote it. */
	model: string;
	usage: StoryUsage;
}

export interface AnalysisFile {
	analysis: MistakeAnalysis | null;
	guide: GuideRecord | null;
}

const FILE = () => path.join(PATHS.data, "analysis.json");

export const analysisStore = {
	read(): AnalysisFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<AnalysisFile>;
			return { analysis: raw.analysis ?? null, guide: raw.guide ?? null };
		} catch {
			return { analysis: null, guide: null };
		}
	},
	write(file: AnalysisFile): void {
		const target = FILE();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(file, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
};
