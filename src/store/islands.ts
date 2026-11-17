import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { Island } from "../core/islands.ts";

const ID = /^[a-z0-9][a-z0-9-]*$/;

function islandFile(id: string): string {
	if (!ID.test(id)) throw new Error(`bad island id ${id}`);
	return path.join(PATHS.islands, `${id}.json`);
}

export const islandStore = {
	get(id: string): Island | null {
		try {
			return JSON.parse(fs.readFileSync(islandFile(id), "utf-8")) as Island;
		} catch {
			return null;
		}
	},
	put(island: Island): void {
		const file = islandFile(island.id);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(island, null, "\t"), "utf-8");
		fs.renameSync(tmp, file);
	},
	list(): Island[] {
		let files: string[];
		try {
			files = fs.readdirSync(PATHS.islands).filter((f) => f.endsWith(".json"));
		} catch {
			return [];
		}
		return files
			.map((f) => f.slice(0, -5))
			.filter((id) => ID.test(id))
			.map((id) => this.get(id))
			.filter((island): island is Island => !!island)
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	},
	remove(id: string): boolean {
		try {
			fs.unlinkSync(islandFile(id));
			return true;
		} catch {
			return false;
		}
	},
};
