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
if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)))
	throw new Error(`refusing ${dataDir}: it is inside the repo, where your real data/ lives`);
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
			return [
				{ text: p, word: true, lemma, gloss, ...(fresh.has(lemma.toLocaleLowerCase("sk-SK")) ? { fresh: true } : {}) },
			];
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

const { OWN_READING } = await import("./fixtures/own-reading.ts");
const { readingSourceStore } = await import("../src/store/reading-sources.ts");
const { assembleStory, knownWords, retellBrief } = await import("../src/server/reading.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { dayKey } = await import("../src/core/review.ts");
const { ownStoryId } = await import("../src/core/reading.ts");

if (!readingSourceStore.get(OWN_READING.id)) {
	const lexicon = loadLexicon();
	const known = knownWords(lexicon);
	const text = OWN_READING.sections.join("\n\n");
	const source = {
		id: OWN_READING.id,
		title: OWN_READING.title,
		url: OWN_READING.url,
		site: OWN_READING.site,
		text,
		wordCount: text.split(/\s+/).length,
		sections: OWN_READING.sections,
		level: known.level,
		difficulty: "level" as const,
		addedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
	};
	readingSourceStore.put(source);
	OWN_READING.writtenParts.forEach((part, i) => {
		const number = i + 1;
		const writtenAt = new Date(Date.now() - (2 - i) * 86_400_000);
		const story = assembleStory(
			{ ...part, cast: [] },
			retellBrief(known, source, number, []),
			known,
			lexicon,
			{ model: "fixture:hand-written", steps: [] },
			1,
			writtenAt,
			null,
			{
				source: {
					id: source.id,
					title: source.title,
					url: source.url,
					site: source.site,
					part: number,
					parts: source.sections.length,
					difficulty: source.difficulty,
				},
				original: source.sections[i]!,
			},
		);
		storyStore.put(story);
	});
	const yesterday = new Date(Date.now() - 86_400_000);
	storyStore.appendRead({
		storyId: ownStoryId(source.id, 1),
		at: yesterday.toISOString(),
		day: dayKey(yesterday, new Date().getTimezoneOffset()),
		ms: 240_000,
		correct: 3,
		total: 3,
		answers: [0, 1, 2],
		tapped: [],
		queued: [],
		xp: 45,
	});
	console.log(
		`own reading: "${source.title}", ${OWN_READING.writtenParts.length} of ${source.sections.length} parts written, part 1 read`,
	);
}
