import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

interface Entry {
	slug: string;
	sk: string;
	examples?: { sk: string; rejected?: boolean }[];
}

const { words } = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: Entry[] };

test("two entries spelled the same never show the same sentence, so each keeps its own sense", () => {
	const bySpelling = new Map<string, Entry[]>();
	for (const w of words) bySpelling.set(w.sk, [...(bySpelling.get(w.sk) ?? []), w]);
	const shared: string[] = [];
	for (const [sk, entries] of bySpelling) {
		if (entries.length < 2) continue;
		const seen = new Map<string, string>();
		for (const e of entries)
			for (const x of e.examples ?? []) {
				if (x.rejected) continue;
				const other = seen.get(x.sk);
				if (other && other !== e.slug) shared.push(`${sk}: "${x.sk}" in ${other} and ${e.slug}`);
				seen.set(x.sk, e.slug);
			}
	}
	assert.deepEqual(shared, []);
});
