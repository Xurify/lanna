# E48. Fluency is called Speed, at `/speed`; the B2 stage is Argument; no redirect (2026-11-05, branch `feat/unified-daily-plan`)

**Why:** "Fluency" is Paul Nation's name for the fourth strand, and the practice page took the word from the research note. A learner hears it as speaking smoothly, but the drill is speed on sentences they already know. The same strand was already called Speed in the strand bars, the stamps and the log, and the B2 stage on the map was also called Fluency.

**How to apply:**
- The practice page is Speed in the sidebar, the page title, the jump palette, the plan's strand labels and the week chart. Its route is `/speed`. `/fluency` no longer opens: the owner chose no redirect. E34 still holds: route, label and title say the same name.
- The exercises are "Speed" (said out loud, formerly "Say it faster"; renamed by the owner on 2026-11-07) and "Read it faster".
- The B2 stage (`src/core/curriculum.ts`) is Argument. Its blurb is unchanged.
- Internal names stay: the `fluency` strand id, `data/profiles/<lang>/fluency/`, `src/server/fluency.ts` and `/api/fluency`. Renaming them would move learner data for no visible gain.
