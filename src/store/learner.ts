/**
 * What the learner knows, kept once for every language (2026-11-05):
 * <data>/learner.json holds the goal's learner fields (src/core/onboarding.ts
 * LEARNER_FIELDS): the languages they know with levels, the explanation
 * languages and the parallels switch. The progress store lays them over each
 * language's goal on read and takes them out of it on write.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { LEARNER_FIELDS, type LearnerFields } from "../core/onboarding.ts";

const FILE = () => path.join(PATHS.base, "learner.json");

/** The learner's fields, or null before any were saved. */
export function readLearnerFields(): LearnerFields | null {
	try {
		const raw: unknown = JSON.parse(fs.readFileSync(FILE(), "utf-8"));
		if (!raw || typeof raw !== "object") return null;
		const out: Record<string, unknown> = {};
		for (const k of LEARNER_FIELDS) if ((raw as Record<string, unknown>)[k] !== undefined) out[k] = (raw as Record<string, unknown>)[k];
		return out as LearnerFields;
	} catch {
		return null;
	}
}

/** Save the learner's fields when they changed. */
export function writeLearnerFields(fields: LearnerFields): void {
	const next = JSON.stringify(fields);
	const kept = readLearnerFields();
	if (kept && JSON.stringify(kept) === next) return;
	const file = FILE();
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, next, "utf-8");
	fs.renameSync(tmp, file);
}
