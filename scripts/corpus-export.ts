/**
 * npm run corpus:export — write a clean, app-independent snapshot of
 * everything generated or produced so far into data/export/<stamp>/
 * (src/server/corpus-export.ts). Safe to run while the app is open; the raw
 * data folders are only read.
 */

import { exportCorpus, prepareCorpus } from "../src/server/corpus-export.ts";

prepareCorpus();
const { dir, summary } = exportCorpus();
console.log(`Exported to ${dir}`);
console.log(JSON.stringify(summary, null, 2));
