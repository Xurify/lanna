/**
 * Writes the hand-made series episodes (scripts/fixtures/series-episodes.ts) into a scratch profile, in the
 * format the app writes under data/profiles/slovak/stories/. Run it with LH_DATA_DIR set to a scratch
 * folder; it refuses a folder inside this repository, where the real data/ lives, and skips episodes
 * that are already there.
 *
 *   LH_DATA_DIR=<scratch folder> LH_PROFILE=slovak npx tsx scripts/seed-stories.ts
 *
 * `npm run dev:sandbox -- --seed` runs it after the demo week.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROBO_EPISODES, type FixtureEpisode } from "./fixtures/series-episodes.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.LH_DATA_DIR;
if (!dataDir) throw new Error("set LH_DATA_DIR to a scratch folder first");
const rel = path.relative(ROOT, path.resolve(dataDir));
if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) throw new Error(`refusing ${dataDir}: it is inside the repo, where your real data/ lives`);
process.env.LH_PROFILE ??= "slovak";

const { storyStore } = await import("../src/store/stories.ts");
type Token = { text: string; word: boolean; slug?: string; lemma?: string; gloss?: string; fresh?: boolean };

/** Words, spaces and punctuation as separate tokens, as the app stores a sentence. */
function tokenize(sk: string, ep: FixtureEpisode): Token[] {
	const fresh = new Set(ep.newWords.map((w) => w.lemma.toLocaleLowerCase("sk-SK")));
	return sk
		.split(/(\p{L}+|\s+)/u)
		.filter((p) => p !== "")
		.flatMap((p): Token[] => {
			if (!/\p{L}/u.test(p)) return [{ text: p, word: false }];
			const hit = ep.glossary[p.toLocaleLowerCase("sk-SK")];
			if (!hit) return [{ text: p, word: true }];
			const [lemma, gloss] = hit;
			return [{ text: p, word: true, lemma, gloss, ...(fresh.has(lemma.toLocaleLowerCase("sk-SK")) ? { fresh: true } : {}) }];
		});
}

let written = 0;
for (const ep of ROBO_EPISODES) {
	if (storyStore.get(ep.id)) continue;
	const sentences = ep.sentences.map((s) => ({ sk: s.sk, en: s.en, tokens: tokenize(s.sk, ep) }));
	const words = sentences.flatMap((s) => s.tokens).filter((t) => t.word);
	const freshCount = words.filter((t) => t.fresh).length;
	storyStore.put({
		id: ep.id,
		lang: "sk",
		series: "robo",
		episode: ep.episode,
		title: ep.title,
		level: ep.level,
		chapter: "hello",
		theme: ep.theme,
		createdAt: new Date().toISOString(),
		sentences,
		questions: ep.questions.map((q) => ({ ...q, kind: "recall" as const })),
		newWords: ep.newWords,
		recap: ep.recap,
		coverage: words.length ? Math.round((1 - freshCount / words.length) * 100) / 100 : 1,
		wordCount: words.length,
		usage: { model: "fixture:hand-written", steps: [] },
		drafts: 1,
	} as never);
	written++;
}
console.log(`stories: ${written} written, ${ROBO_EPISODES.length - written} already there`);
