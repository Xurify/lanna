# Voice pace: does "1×" mean one speed?

**Question:** the owner asked what speed the voice runs at, whether the clip metadata agrees with the speed setting, and whether the app needs calculations to make the setting accurate.

**Date:** 2026-11-03. **Decision:** E37 (not adopted: clips play as recorded).

## Result

The pace varies from clip to clip, and that is how the voice is made, so it is left alone. slovak.wiki generates its voice with ElevenLabs speed 0.88 (its `content/audio/config.json`, per DECISIONS and commit `6ed7944`; the owner remembered 0.85), a deliberately slow reading for learners, and the pace that comes out depends on the sentence (2.3 to 5.4 syllables a second here, 3.6 to 5.6 on the earlier measurement). Two fixed-rate attempts in November (1.136× sounded slow on one clip, 1.319× too fast on another) and a per-clip correction on 2026-11-03 all failed the same way: the correction speeds a slowly read sentence until it sounds rushed ("Čím skôr začneš, tým skôr skončíš." at 1.58× next to an untouched clip), and a slowed-in-the-model read does not become natural when sped up. Playback stays a plain multiplier (0.75×, 1×, 1.25×) around the recording, as slovak.wiki itself plays it. What remains is the measuring: `scripts/audio-pace.ts` prints the pace per engine from a profile. The rest of this note is the record of the attempt, kept so it is not tried a third time.

## What was measured

49 slovak.wiki clips (the default Slovak voice for any dictionary word or example, `wiki-audio.ts`) from the perf sandboxes, 40 of them distinct sentences of 3 or more syllables. Length by `ffprobe`, syllables by `countSyllables` (`src/core/pace.ts`, a Slovak rule set: vowels, ia/ie/iu as one, syllabic r and l). Reproduce on any profile with `LANNA_DATA_DIR=… npx tsx scripts/audio-pace.ts`.

|  | syllables a second |
| --- | --- |
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

## What was tried (reverted)

Each clip is nudged toward a fixed pace, 4 syllables a second (about the median above, so a typical clip stays near 1.0×), and the setting multiplies that: `rate = clamp(4 ÷ (syllables ÷ seconds), 0.8, 1.3) × setting`, with the length read from the audio element once its header has loaded and the final rate kept between 0.6× and 1.8×. The first version corrected fully (up to 1.6×); see "Correction" below for why it was cut back. A clip under 0.8 s or 3 syllables (a word) keeps the plain multiplier, because its length is mostly onset and tail. The fallback browser voice keeps the plain rate.

## Correction: full equalising sounded wrong (2026-11-03)

The owner heard "Čím skôr začneš, tým skôr skončíš." as very fast and "Sused tvrdí, že auto tam stálo celé ráno." as normal. Both are slovak.wiki clips (same source, same settings). The first was recorded slowly (8 syllables in 3.16 s, 2.5 a second, with a 0.38 s pause at the comma; 2.9 a second without the pauses); the second at 4.3. The first version corrected both fully to 4: 1.58× for the first, 0.93× for the second. A slow, deliberate recording sped up by more than half sounds rushed, and next to an untouched clip it sounds absurdly fast. The correction is now limited to 0.8–1.3× (the first sentence plays at 1.3×, about 3.3 syllables a second, still the slower of the two, which is how it was recorded). The library's spread narrows from 2.3× to about 1.4× (3.0 to 4.3 syllables a second), not to 1.0×.

Pauses inside a clip lower its measured pace (the comma above), which pushes the correction up a little further than the speech itself warrants; the cap bounds that. Measuring only the speech between pauses would need the decode to find them and is not done.

## Checked afterwards (2026-11-03)

- **The pace after correction:** the 40 clips rendered at the rate the app picks (ffmpeg `atempo`, pitch kept, as the browser does) and measured with `ffprobe`: with the first version (full correction) 39 played at 4.04–4.18 syllables a second and one hit the 1.6× limit; that is the version that proved too strong, see above.
- **The browser applies the rate:** one clip played at 1×, 1.3× and 0.8× in headless Chromium took 1.80 s, 1.36 s and 2.14 s against an expected 1.68, 1.29 and 2.10 (about 0.05–0.12 s of start-up).
- **Silence in the clip would bias the rate.** The pace is read over a clip's length, so a clip padded with 0.5 s of silence at each end reads slow and gets sped up too much (9 syllables, 2.12 s of speech: 0.94× is right, 1.39× from the padded length plays the speech at 5.9 syllables a second). The slovak.wiki clips have no padding, but the other engines may, and I could not measure them. The rate is therefore taken over the speech itself: the same decode that sets the loudness (`measureClip` in `components/speech.tsx`) finds the first and last 50 ms window within 30 dB of the loudest, and that length is used when it is at least half the clip. Not exercised on a padded real clip.

## Open

- Unverified by ear: whether evening the tempo sounds natural at the extremes (a 2.3 syllable-a-second clip is stretched by the 1.6× cap, to 3.7). Slow recordings were presumably slow on purpose; if they sound rushed, narrow the cap.
- The 4 syllables a second default is the library's median, not a claim about native speech (commonly put higher, around 5 to 6, which is not checked here). If 1× should be "native", raise `NORMAL_SYLLABLES_PER_SECOND`; the setting scales with it.
- The syllable counter is an estimate (±1 on a long word); it is tested on seven cases.
- Length could also be stored in the index at synthesis time. It was not, because the browser gets it for free and the index shape is kept stable (corpus rules).
