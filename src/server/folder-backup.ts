import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { localFiles, type Bucket } from "./cloud-backup.ts";

const NO_FOLDER = "No folder chosen yet. Choose one above first.";

/** The folder is not there at all: an unplugged drive, or one the learner deleted. */
export class FolderGone extends Error {
	constructor(folder: string) {
		super(
			`The folder ${folder} is not there, so nothing could be compared. Plug the drive back in, or choose another folder.`,
		);
	}
}

/** The chosen path cannot hold a copy: it is a file, it cannot be made, or it sits with the data folder itself. */
export class FolderUnusable extends Error {}

export function suggestedFolder(): string {
	return path.join(os.homedir(), "Lanna backup");
}

/** A path typed or pasted by hand: quotes from Explorer's "Copy as path" and a leading ~ both come through here. */
export function resolveFolder(raw: string): string {
	const trimmed = raw.trim().replace(/^"(.*)"$/, "$1");
	if (trimmed === "~") return os.homedir();
	if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return path.join(os.homedir(), trimmed.slice(2));
	return path.resolve(trimmed);
}

function holds(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** The folder the copy goes to, made if it is new. Throws FolderUnusable when the path cannot take a copy. */
export function prepareFolder(folder: string): void {
	if (holds(folder, PATHS.base) || holds(PATHS.base, folder))
		throw new FolderUnusable("Choose a folder away from the data folder, so the copy cannot hold itself.");
	if (fs.existsSync(folder) && !fs.statSync(folder).isDirectory())
		throw new FolderUnusable(`${folder} is a file, not a folder.`);
	try {
		fs.mkdirSync(folder, { recursive: true });
	} catch (err) {
		throw folderNotMade(folder, err);
	}
}

/** A path that could not be made, said in words: a drive that is not plugged in and a folder with no permission
 *  both arrive as error codes (ENOENT, EACCES), which name nothing a learner can act on. */
export function folderNotMade(folder: string, err: unknown): FolderUnusable {
	const code = (err as NodeJS.ErrnoException | null)?.code;
	if (code === "ENOENT")
		return new FolderUnusable(
			`There is nothing at ${folder} to write to. Plug the drive in, or choose another folder.`,
		);
	if (code === "EACCES" || code === "EPERM")
		return new FolderUnusable(`Lanna is not allowed to write in ${folder}. Choose another folder.`);
	return new FolderUnusable(`Lanna could not make ${folder}: ${err instanceof Error ? err.message : String(err)}`);
}

export function folderBucket(folder: string | null): Bucket {
	if (!folder) throw new FolderUnusable(NO_FOLDER);
	return {
		async list() {
			if (!fs.existsSync(folder)) throw new FolderGone(folder);
			if (!fs.statSync(folder).isDirectory()) throw new FolderUnusable(`${folder} is a file, not a folder.`);
			return localFiles(folder);
		},
		async put(file, data) {
			const target = path.join(folder, file);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			const tmp = `${target}.part`;
			fs.writeFileSync(tmp, data);
			fs.renameSync(tmp, target);
		},
		async get(file) {
			return fs.readFileSync(path.join(folder, file));
		},
		async remove(file) {
			const root = path.resolve(folder);
			fs.unlinkSync(path.join(root, file));
			let dir = path.dirname(path.join(root, file));
			while (dir !== root && fs.readdirSync(dir).length === 0) {
				fs.rmdirSync(dir);
				dir = path.dirname(dir);
			}
		},
	};
}
