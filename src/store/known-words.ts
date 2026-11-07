/**
 * Words the learner marked as known (LangHarness, 2026-11-07; E69): the
 * active profile's data/profiles/<language>/known.json. The owner, on a
 * Watch preview listing "že", "nie", "dobrý" and "mať" as words not met:
 * "I actually do know all of these. Is it possible to mark words as known?"
 *
 * A marked word counts as met everywhere "known" is measured (the deck and
 * the word units already do): Watch and the picks' known share, the
 * pre-teach list, Read and Listen's coverage, the story brief. Unmarking
 * takes it out again. `updatedAt` lets a kept measure (a video, a pick) see
 * that the list changed after it was taken, and measure again.
 *
 * Same idioms as the other stores: sync fs, one small file, atomic rename.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";

export interface KnownWordsFile {
	/** ISO time of the last mark or unmark. */
	updatedAt?: string;
	/** By lexicon slug: the dictionary form and when it was marked. */
	words: Record<string, { lemma: string; at: string }>;
}

const FILE = () => path.join(PATHS.data, "known.json");

function read(): KnownWordsFile {
	try {
		const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<KnownWordsFile>;
		return { ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}), words: raw.words && typeof raw.words === "object" ? raw.words : {} };
	} catch {
		return { words: {} };
	}
}

function write(value: KnownWordsFile): void {
	const file = FILE();
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value, null, "\t"), "utf-8");
	fs.renameSync(tmp, file);
}

export const knownWordStore = {
	read,
	has(slug: string): boolean {
		return Object.hasOwn(read().words, slug);
	},
	/** The marked slugs. */
	slugs(): Set<string> {
		return new Set(Object.keys(read().words));
	},
	/** When the list last changed; undefined when nothing was ever marked. */
	updatedAt(): string | undefined {
		return read().updatedAt;
	},
	/** Mark or unmark one word. Returns whether it is marked now. */
	set(slug: string, lemma: string, known: boolean, now = new Date()): boolean {
		const f = read();
		const was = Object.hasOwn(f.words, slug);
		if (known === was) return known;
		if (known) f.words[slug] = { lemma, at: now.toISOString() };
		else delete f.words[slug];
		f.updatedAt = now.toISOString();
		write(f);
		return known;
	},
};
