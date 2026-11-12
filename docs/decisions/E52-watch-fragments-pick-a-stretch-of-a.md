# E52. Watch fragments: pick a stretch of a video, ranked locally for the learner's level (2026-11-06, branch `feat/watch-fragments`)

**Why:** the owner asked to pick fragments of a video and to build comprehensible input from a smart analysis, to learn faster. Whole videos are mostly over the learner's level (80% known is common at A1), but two minutes of them may be at 93%. Research and numbers: [research/watch-picks.md](../research/watch-picks.md), "Fragments".

**How to apply:**
- A fragment is a run of whole caption lines of 45 to 180 seconds, or a stretch the learner drags (20 seconds to 8 minutes). The analysis (`src/core/fragments.ts`, `src/server/fragments.ts`) uses no model: the same local gloss as the picks, so it costs nothing and repeats as the learner learns.
- The score is the product of comprehension (the known-word share, full at 93–97%, nothing under 85%), speech density, length, and the square root of what the new words are worth (common, said more than once inside it). A stretch weak in one loses. When none is close, the page says so; do not offer noise.
- Captions in another language than the video's (Czech for Slovak) are not measured; the learner can still drag a stretch by ear.
- `prepareVideo(url, { range })` translates and questions only the stretch. The record keeps the video's id, with `fragment` {startSec, endSec, ofSec}; its `durationSec`, lines and coverage are the stretch's, so the plan's minutes and the library line are right without change. One cut per video: preparing another stretch, or the whole video, replaces the record. Watch history stays in `watches.jsonl`.
- The 90-minute limit (was 75, raised so a 76-minute video from a saved creator is not left out) and the line limit (1,100) apply to whole videos. The time one Watch session can add follows it (90 minutes).
- The caption lines of an analysed video are kept in `videos/discover/lines/<id>.json` (E1); a video in the library is read from its kept caption track.
