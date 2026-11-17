import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS } from "../../config.ts";
import type { JobRecord } from "../core/contracts.ts";

const jobsDir = () => path.join(PATHS.data, "jobs");

function readJob(file: string): JobRecord | null {
	try {
		return JSON.parse(fs.readFileSync(path.join(jobsDir(), file), "utf-8")) as JobRecord;
	} catch {
		return null;
	}
}

function jobFiles(): string[] {
	try {
		return fs.readdirSync(jobsDir()).filter((f) => /^[A-Za-z0-9_-]+\.json$/.test(f));
	} catch {
		return [];
	}
}

export function listPastJobs(chatId: string): JobRecord[] {
	return jobFiles()
		.map(readJob)
		.filter((job): job is JobRecord => job !== null && job.chatId === chatId)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deletePastJobsForChat(chatId: string): void {
	for (const file of jobFiles()) {
		if (readJob(file)?.chatId !== chatId) continue;
		try {
			fs.unlinkSync(path.join(jobsDir(), file));
		} catch {
			// already gone
		}
	}
}
