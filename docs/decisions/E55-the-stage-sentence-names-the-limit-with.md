# E55. The stage sentence names the limit with the milestones' own numbers, and says when a number is an estimate (2026-11-05, branch `feat/daily-hooks`)

**Why:** proposal 4 of the same research: the learner should be able to see which gap limits them without reading a table. The milestones already measure the words gap and the speed gap; they did not say which one binds on Today.

**How to apply:**
- One sentence on Today, built from `estimateMilestone` for the nearest unreached milestone (`src/core/stage.ts`). It adds no measurement of its own.
- A speed that comes from the level's ladder, not from the learner's Listen or Watch sessions, is said to be an estimate in a second line (P8).
- When every milestone is reached, the sentence says so and names nothing. With no milestones at all, it says there is nothing to measure yet.
- The sentence sits in one "Where you are" card on Today (2026-11-06) with two meters under it, words and speed, that carry the same numbers: the binding gap is the teal one, the need is the marker on the track (the `.q-bar` meter the week's balance already uses), and an estimated speed is marked "est." on the meter as well as in the line. A dated scene (E52) sits in the same card. The card has no primary button; "See the evidence" is a ghost link to Milestones.
