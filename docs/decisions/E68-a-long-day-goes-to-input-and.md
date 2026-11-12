# E68. A long day goes to input, and listening outside the app is logged apart (2026-11-07, branch `feat/input-after-plan`)

**Why:** the owner asked what ten hours of Russian listening a day would do and whether the app should apply it. A goal can be 600 minutes, but the plan holds about 35 to 45, and once it was done Today offered "One more lesson", deliberate study, already the strand over its quarter (P2). Listening done elsewhere had nowhere to go, and counting it like measured time would break P8 and P9. Research: [research/outside-listening.md](../research/outside-listening.md).

**How to apply:**
- Once the plan is done, the next step is input: a video added and not watched, else ten more Listen sentences (`afterPlan` in `src/core/after-plan.ts`, served as `afterPlan` in the progress summary). Enter starts it. "One more lesson" stays, as the second choice. Do not make a drill the step after the plan.
- Listening outside the app is logged by hand on Today (`components/outside-listening.tsx`, `/api/outside`), focused or background, and kept in `outside-listening.json`. It never enters `minutes`, `minutesBy`, XP, the streak, stamps or the strand balance.
- The milestones page shows it only in its own row, "Speed with outside listening": focused minutes at `OUTSIDE_WEIGHT.focused` (0.5), background at 0, added to the measured real pace. On the learner's own Listen trend it adds nothing and says why (the slope is per hour in the app, so it already holds what outside listening did). The weights are the app's own and say so (E63, the `outside` feature in `src/core/sources.ts`). Change them only with new evidence, in the research note first.
- No hours target, challenge or stamp for hours of listening.
