import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { Cefr } from "../core/curriculum.ts";
import type { ReadingDifficulty } from "../core/reading.ts";

export interface ReadingSource {
	id: string;
	title: string;
	url?: string;
	site?: string;
	text: string;
	wordCount: number;
	sections: string[];
	level: Cefr;
	difficulty?: ReadingDifficulty;
	addedAt: string;
	truncated?: boolean;
	removedAt?: string;
}

function sourcesDir(): string {
	return path.join(PATHS.stories, "sources");
}

function sourceFile(id: string): string {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`bad source id ${id}`);
	return path.join(sourcesDir(), `${id}.json`);
}

function writeJsonAtomic(target: string, value: unknown): void {
	fs.mkdirSync(path.dirname(target), { recursive: true });
	const tmp = `${target}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value, null, "\t"), "utf-8");
	fs.renameSync(tmp, target);
}

export const readingSourceStore = {
	list(): ReadingSource[] {
		const dir = sourcesDir();
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			return [];
		}
		const out: ReadingSource[] = [];
		for (const name of entries) {
			if (!name.endsWith(".json")) continue;
			try {
				const raw = fs.readFileSync(path.join(dir, name), "utf-8");
				out.push(JSON.parse(raw) as ReadingSource);
			} catch {
				continue;
			}
		}
		return out.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
	},

	get(id: string): ReadingSource | null {
		try {
			const file = sourceFile(id);
			const raw = fs.readFileSync(file, "utf-8");
			return JSON.parse(raw) as ReadingSource;
		} catch {
			return null;
		}
	},

	put(source: ReadingSource): void {
		writeJsonAtomic(sourceFile(source.id), source);
	},

	findByUrl(url: string, difficulty: ReadingDifficulty): ReadingSource | null {
		return this.list().find((s) => s.url === url && (s.difficulty ?? "level") === difficulty) ?? null;
	},

	setRemoved(id: string, removedAt: string | null): void {
		const source = this.get(id);
		if (!source) return;
		if (removedAt) {
			source.removedAt = removedAt;
		} else {
			delete source.removedAt;
		}
		this.put(source);
	},
};
