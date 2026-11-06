/**
 * The stage sentence on Today (LangHarness, 2026-11-05) — the milestones'
 * own measures, read through src/core/stage.ts. No new measurement lives here.
 */

import { stageSentence, type StageView } from "../core/stage.ts";
import { milestonesReport } from "./milestones.ts";

export function stageNow(now = new Date(), tz = now.getTimezoneOffset()): StageView {
	return stageSentence(milestonesReport(now, tz).milestones);
}
