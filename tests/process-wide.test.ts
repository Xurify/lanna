import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-process-wide-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

type LexiconModule = typeof import("../src/agent/lexicon.ts");
type ReadingModule = typeof import("../src/server/reading.ts");
const lexiconCopy = (bundle: string) => import(`../src/agent/lexicon.ts?copy=${bundle}`) as Promise<LexiconModule>;
const readingCopy = (bundle: string) => import(`../src/server/reading.ts?copy=${bundle}`) as Promise<ReadingModule>;

test("two bundled copies of the lexicon module parse the dictionary once and share it", async () => {
	const warmUpCopy = await lexiconCopy("instrumentation");
	const routeCopy = await lexiconCopy("route");
	assert.notEqual(warmUpCopy, routeCopy);
	const warmed = warmUpCopy.loadLexicon("slovak");
	assert.ok(warmed);
	assert.equal(routeCopy.loadLexicon("slovak"), warmed);
});

test("the frequency order the warm-up builds is the one every route reads", async () => {
	const warmUpCopy = await readingCopy("instrumentation");
	const routeCopy = await readingCopy("route");
	const { loadLexicon } = await import("../src/agent/lexicon.ts");
	const lexicon = loadLexicon("slovak")!;
	warmUpCopy.warmDictionary();
	assert.equal(routeCopy.frequencyOrder(lexicon), warmUpCopy.frequencyOrder(lexicon));
});
