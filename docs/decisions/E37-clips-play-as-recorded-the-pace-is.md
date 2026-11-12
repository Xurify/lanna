# E37. Clips play as recorded: the pace is not normalised at playback (2026-11-03, branch `feat/motion-pass`)

**Why:** the owner asked what speed the voice runs at and whether the setting is accurate. On 40 slovak.wiki sentences the pace runs 2.3 to 5.4 syllables a second ([research/voice-pace.md](../research/voice-pace.md)), so "1×" is not one speed. A per-clip correction toward a fixed pace was built and then reverted: the voice is generated at ElevenLabs speed 0.88 and its pace depends on the sentence, a full correction (1.58× on a slowly read proverb) made it sound rushed, and a capped one (0.8–1.3×) still fights the recording. The same approach had already failed twice in November (`6ed7944`, and the E22 note on clips).

**How to apply:**
- `audio.playbackRate` is the setting (0.75, 1, 1.25) or the snail (`slowRate`), nothing computed from the clip. Do not add a per-clip or per-source rate; if a voice is too slow or fast, change how it is generated (the ElevenLabs speed, the Edge `EDGE_RATE`), which splits the cache key and is the owner's call.
- `scripts/audio-pace.ts` and `countSyllables` (`src/core/pace.ts`) measure a profile's clips; they change nothing.
