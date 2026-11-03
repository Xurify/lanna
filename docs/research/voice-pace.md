# Voice pace: does "1×" mean one speed?

**Question:** the owner asked what speed the voice runs at, whether the clip metadata agrees with the speed setting, and whether the app needs calculations to make the setting accurate.

**Date:** 2026-11-03. **Decision:** E37.

## What was measured

49 slovak.wiki clips (the default Slovak voice for any dictionary word or example, `wiki-audio.ts`) from the perf sandboxes, 40 of them distinct sentences of 3 or more syllables. Length by `ffprobe`, syllables by `countSyllables` (`src/core/pace.ts`, a Slovak rule set: vowels, ia/ie/iu as one, syllabic r and l). Reproduce on any profile with `LH_DATA_DIR=… npx tsx scripts/audio-pace.ts`.

| | syllables a second |
|---|---|
| median | 3.9 (about 128 words a minute) |
| slowest | 2.3 ("Ahoj, maj sa!", "Február má len 28 dní.") |
| fastest | 5.4 ("Peter varil večeru a pritom telefonoval s mamou.") |

Short sentences are the slowest, long ones the fastest: each clip is a separate recording, so the pace is not constant.

## What the metadata says

The audio index (`data/audio/index.jsonl`) holds text, voice, engine, bytes and date. It has no length and no pace, and the engines differ: ElevenLabs is asked for no speed at all, Edge is asked for `+15%` (`EDGE_RATE`), Piper uses its default, slovak.wiki's narrator has its own. The setting never reached any of this: `audio.playbackRate` was set to 0.75, 1 or 1.25 on top of whatever was recorded.

## Why that is not accurate

- "1×" played at 2.3 syllables a second on one sentence and 5.4 on another, a 2.3 times spread.
- 0.75× of a slow clip is 1.7 syllables a second, hard to follow; 1.25× of a fast one is 6.8, faster than conversation, so the setting could not be trusted to mean slower or faster.
- The snail was 0.7× (0.6× at 0.75×) of the same variable base: "very slow" on a slow clip, "normal" on a fast one. At 1× and 1.25× it was the same 0.7×.
- Each engine added its own offset, so changing the voice changed what "1×" was.

I could measure only the slovak.wiki voice here (no ElevenLabs key, and Edge's service is not reachable from the sandbox). The script above does the same for the other engines on a real profile.

## What changed

The setting is now a multiplier of a fixed pace, 4 syllables a second (about the median above, so a typical clip still plays at about 1.0×): 0.75× is 3, 1× is 4, 1.25× is 5, the snail 2.4 to 2.8. Each clip is played at the rate that reaches it: `rate = 4 × setting ÷ (syllables ÷ seconds)`, with the length read from the audio element once its header has loaded, kept between 0.6× and 1.6× (below that the browser's time-stretch smears the voice, above it chatters). A clip under 0.8 s or 3 syllables (a word) keeps the plain multiplier, because its length is mostly onset and tail. The fallback browser voice keeps the plain rate.

## Open

- Unverified by ear: whether evening the tempo sounds natural at the extremes (a 2.3 syllable-a-second clip is stretched by the 1.6× cap, to 3.7). Slow recordings were presumably slow on purpose; if they sound rushed, narrow the cap.
- The 4 syllables a second default is the library's median, not a claim about native speech (commonly put higher, around 5 to 6, which is not checked here). If 1× should be "native", raise `NORMAL_SYLLABLES_PER_SECOND`; the setting scales with it.
- The syllable counter is an estimate (±1 on a long word); it is tested on seven cases.
- Length could also be stored in the index at synthesis time. It was not, because the browser gets it for free and the index shape is kept stable (corpus rules).
