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
import type { ListenGuideRecord } from "../core/listen-guide.ts";
import type { GuideRecord, MistakeAnalysis } from "../core/mistakes.ts";

export type { GuideRecord, ListenGuideRecord };

export interface AnalysisFile {
	analysis: MistakeAnalysis | null;
	guide: GuideRecord | null;
	/** The deep read of the listening, kept apart so a new snapshot or guide never drops it. */
	listenGuide?: ListenGuideRecord | null;
}

const FILE = () => path.join(PATHS.data, "analysis.json");

export const analysisStore = {
	read(): AnalysisFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<AnalysisFile>;
			return { analysis: raw.analysis ?? null, guide: raw.guide ?? null, listenGuide: raw.listenGuide ?? null };
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
