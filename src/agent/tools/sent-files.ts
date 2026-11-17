import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS } from "../../../config.ts";

const OUTSIDE = "Only the PDFs and images the learner sends with the composer's buttons can be read.";

/** The real path of a file the learner sent, or an error the model can read. A path outside the sent-files folder — directly or through a link — is refused. */
export async function resolveSentFile(p: string): Promise<string> {
	const dir = await fs.realpath(PATHS.sentFiles).catch(() => path.resolve(PATHS.sentFiles));
	const requested = path.isAbsolute(p) ? p : path.join(dir, p);
	const real = await fs.realpath(requested).catch(() => {
		throw new Error(`No such file: ${p}`);
	});
	const relative = path.relative(dir, real);
	if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
		throw new Error(OUTSIDE);
	return real;
}
