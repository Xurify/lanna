import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS } from "../../config.ts";

/**
 * The tutor reads only what the learner sent, and sent files live in
 * PATHS.sentFiles. Each test file sends its fixtures under its own folder so
 * parallel test processes never share one.
 */
export function sendCopy(source: string, relative: string): string {
	const target = path.join(PATHS.sentFiles, relative);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.copyFileSync(source, target);
	return fs.realpathSync(target);
}

export function unsend(folder: string): void {
	fs.rmSync(path.join(PATHS.sentFiles, folder), { recursive: true, force: true });
}
