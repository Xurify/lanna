# E56. Watch lines come back in Listen (2026-11-05, branch `feat/daily-hooks`)

**Why:** proposal 7 in [research/creator-hooks.md](../research/creator-hooks.md): a line the learner missed in a video is the most useful Listen sentence they can get, and spacing brings it back while it can still be learned.

**How to apply:**
- A line not understood on the first unaided listen in Watch is queued per profile (`data/profiles/<language>/watch-reps.json`, `src/store/watch-reps.ts`). It comes back tomorrow, then in 3 and 7 days. An understood answer moves it on; a miss or a peeked answer sends it back to tomorrow; the third understood answer, at the 7-day check, retires it (`src/core/watch-reps.ts`).
- At most three due lines join a Listen session, oldest due first. They are typed like any Listen sentence, labelled "From a video you watched", and graded against the stored line.
- Lines from foreign captions (Czech for Slovak, E41) do not come back: they would be played in another language.
- The audio is the existing Listen path (E1). No model is called, and no near-miss meaning is asked for.
- In Listen the line carries its source (`ListenItem.source`): a "From a video you watched" pill and the video's title, in place of the new-words line.
