import * as fs from "node:fs";
import { LEDGER_FILES, positionsFile } from "../../config.ts";

/** The graph's version stamp (session-deletion wave 6): the max mtime
 * across every graph data file — ledgers, positions. Moves on ANY
 * graph write (merge append, settle, or a deletion's atomic rewrite),
 * never moves on reads, and needs no bookkeeping of its own: the fs
 * IS the counter. Consumers poll it (the DELETE response returns it)
 * to know clusters/layout must refetch — the "graph changed underneath
 * me" signal. */
export function graphRevision(): number {
	let revision = 0;
	for (const file of [
		LEDGER_FILES.nodes,
		LEDGER_FILES.chains,
		LEDGER_FILES.sessions,
		LEDGER_FILES.coverage,
		positionsFile(),
	]) {
		try {
			revision = Math.max(revision, fs.statSync(file).mtimeMs);
		} catch {
			/* absent — nothing has ever written it */
		}
	}
	return revision;
}
