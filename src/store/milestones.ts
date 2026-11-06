/**
 * Milestones persistence (LangHarness, 2026-10-28) — the active profile's
 * data/profiles/<language>/milestones.json: the milestones the learner
 * wrote in their own words, with the cheap model's mapping of each to a
 * genre, a coverage target and a speed, so a milestone is paid for once
 * and read from disk ever after (the corpus rule). A removed milestone
 * keeps its line with a `removedAt`, so adding the same words back costs
 * nothing. The built-in milestones live in src/core/milestones.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { DatedOutcome } from "../core/dated-scene.ts";
import type { CustomMapping, MilestoneDef } from "../core/milestones.ts";
import type { StoryUsage } from "../core/reading.ts";

export interface CustomMilestoneRecord {
	def: MilestoneDef;
	/** The learner's words, as typed. */
	text: string;
	mapping: CustomMapping;
	/** "provider:id" of the model that mapped it, or "rule" when no model ran. */
	model: string;
	usage: StoryUsage;
	createdAt: string;
	removedAt?: string;
	/** A scene with a date: the day it is for (YYYY-MM-DD). Absent on older records. */
	date?: string;
	/** The line the learner wrote once the date had passed. */
	outcome?: DatedOutcome;
}

export interface MilestonesFile {
	custom: CustomMilestoneRecord[];
}

const FILE = () => path.join(PATHS.data, "milestones.json");

export const milestoneStore = {
	read(): MilestonesFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<MilestonesFile>;
			return { custom: Array.isArray(raw.custom) ? raw.custom : [] };
		} catch {
			return { custom: [] };
		}
	},
	write(file: MilestonesFile): void {
		const target = FILE();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(file, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
	/** The custom milestones still shown, oldest first. */
	active(): CustomMilestoneRecord[] {
		return this.read().custom.filter((c) => !c.removedAt);
	},
	find(id: string): CustomMilestoneRecord | undefined {
		return this.read().custom.find((c) => c.def.id === id);
	},
	/** Add a record, or bring a removed one back as it was. */
	upsert(record: CustomMilestoneRecord): void {
		const file = this.read();
		const i = file.custom.findIndex((c) => c.def.id === record.def.id);
		if (i >= 0) file.custom[i] = { ...file.custom[i]!, removedAt: undefined };
		else file.custom.push(record);
		this.write(file);
	},
	remove(id: string, now = new Date()): boolean {
		const file = this.read();
		const rec = file.custom.find((c) => c.def.id === id && !c.removedAt);
		if (!rec) return false;
		rec.removedAt = now.toISOString();
		this.write(file);
		return true;
	},
	/** Set a scene's date. Moving it to another day drops the line written for the old one. */
	schedule(id: string, date: string): CustomMilestoneRecord | undefined {
		const file = this.read();
		const rec = file.custom.find((c) => c.def.id === id && !c.removedAt);
		if (!rec) return undefined;
		if (rec.date !== date) {
			rec.date = date;
			delete rec.outcome;
		}
		this.write(file);
		return rec;
	},
	/** Save the line written after a scene's date. */
	recordOutcome(id: string, outcome: DatedOutcome): CustomMilestoneRecord | undefined {
		const file = this.read();
		const rec = file.custom.find((c) => c.def.id === id && !c.removedAt);
		if (!rec) return undefined;
		rec.outcome = outcome;
		this.write(file);
		return rec;
	},
};
