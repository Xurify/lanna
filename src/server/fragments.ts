/**
 * Fragments of a video (LangHarness, 2026-11-06): find the stretches of a
 * video worth watching, and prepare only one of them.
 *
 * `analyzeFragments(id)` reads the video's caption lines (kept under
 * videos/discover/lines/ after the first time), glosses them against the
 * learner's words as they stand now, and gives back the facts of every line
 * (so the page can draw the strip and measure a stretch the learner drags)
 * and the best stretches (src/core/fragments.ts). No model call.
 *
 * Preparing a stretch is `prepareVideo(url, { range })` (src/server/watch.ts):
 * only its lines are translated and questioned, so it costs a fraction of
 * the whole video and a video of any length can be used.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import { bestFragments, FRAGMENT_SOURCE_MAX_SEC, lineFacts, rangeStats, type FragmentAnalysis } from "../core/fragments.ts";
import { isVideoId, parseCaptions, segmentCues } from "../core/watch.ts";
import { discoverStore, type CaptionLines } from "../store/discover.ts";
import { videoStore } from "../store/videos.ts";
import { activeLanguage } from "./active-language.ts";
import { commonness, knownWords } from "./reading.ts";
import { fetchCaptions, glossSegments, type FetchedCaptions } from "./watch.ts";

const MAX_LINES = 6000;

/** A video in the library has its caption track kept: read it, not YouTube. */
function libraryCaptions(id: string): FetchedCaptions | null {
	const rec = videoStore.get(id);
	const raw = rec ? videoStore.captions(id, rec.source.trackLang) : null;
	if (!rec || !raw) return null;
	const cues = parseCaptions(raw.text);
	if (!cues.length) return null;
	return { meta: { id, title: rec.title, ...(rec.channel ? { channel: rec.channel } : {}), durationSec: rec.fragment?.ofSec ?? rec.durationSec }, cues, source: rec.source };
}

/** The caption lines of a video, from the kept copy, the library's, or YouTube. */
async function captionLines(id: string, opts: { captions?: (id: string) => Promise<FetchedCaptions>; signal?: AbortSignal; now?: Date }): Promise<CaptionLines> {
	const kept = discoverStore.lines(id);
	if (kept) return kept;
	const fetched = libraryCaptions(id) ?? (await (opts.captions ? opts.captions(id) : fetchCaptions(id, { signal: opts.signal })));
	if (fetched.meta.durationSec > FRAGMENT_SOURCE_MAX_SEC) throw new Error(`This video is ${Math.round(fetched.meta.durationSec / 60)} minutes long. Fragments are found in videos under ${FRAGMENT_SOURCE_MAX_SEC / 60} minutes.`);
	const lines = segmentCues(fetched.cues)
		.slice(0, MAX_LINES)
		.map((l) => ({ start: Math.round(l.start * 100) / 100, end: Math.round(l.end * 100) / 100, sk: l.sk }));
	if (!lines.length) throw new Error("The captions are empty.");
	const v: CaptionLines = {
		title: fetched.meta.title,
		...(fetched.meta.channel ? { channel: fetched.meta.channel } : {}),
		durationSec: fetched.meta.durationSec || Math.ceil(lines[lines.length - 1]!.end),
		trackLang: fetched.source.trackLang,
		kind: fetched.source.kind,
		lines,
		at: (opts.now ?? new Date()).toISOString(),
	};
	discoverStore.putLines(id, v);
	return v;
}

export async function analyzeFragments(id: string, opts: { captions?: (id: string) => Promise<FetchedCaptions>; signal?: AbortSignal; now?: Date } = {}): Promise<FragmentAnalysis> {
	if (!isVideoId(id)) throw new Error("That is not a YouTube video.");
	const src = await captionLines(id, opts);
	const lexicon = loadLexicon();
	const k = knownWords(lexicon);
	const language = activeLanguage();
	const measurable = src.trackLang.toLowerCase().split("-")[0] === language.code;
	const segments = glossSegments(src.lines, [], lexicon, k);
	const rankOf = commonness(lexicon);
	const facts = lineFacts(segments, rankOf);
	// Another language's spellings would read as unknown words: the share is not measured, the strip stays plain.
	const lines = measurable ? facts.lines : facts.lines.map(({ u: _u, beyond: _b, ...l }) => ({ ...l, fresh: 0 }));
	const lex = measurable ? facts.lex : {};
	const kept = videoStore.get(id);
	const all = rangeStats(lines, lex, 0, lines.length - 1);
	return {
		id,
		title: src.title,
		...(src.channel ? { channel: src.channel } : {}),
		durationSec: src.durationSec,
		trackLang: src.trackLang,
		measurable,
		...(measurable ? {} : { message: `The captions are in ${src.trackLang}, so their words are not matched against your ${language.english}. Pick a stretch by ear.` }),
		lines,
		lex,
		picks: measurable ? bestFragments(lines, lex) : [],
		coverage: measurable ? Math.round((all?.coverage ?? 1) * 1000) / 1000 : 0,
		expected: measurable ? Math.round((all?.expected ?? 1) * 1000) / 1000 : 0,
		level: k.level,
		expectedWords: k.expectedWords,
		...(kept ? { prepared: kept.fragment ? { startSec: kept.fragment.startSec, endSec: kept.fragment.endSec } : { whole: true as const } } : {}),
	};
}
