# E49. The placement tutor checks the rung the level rests on (2026-11-05, branch `feat/placement-luck-check`)

**Why:** the owner asked whether the AI tells knowing from a lucky guess, and decided it should. The ladder does not. A rung counts as held after two right answers, and every rung below the highest held one is credited without being asked. One lucky pair at the floor therefore lifts the whole placement. The Socratic stage already separated slip from gap, but it was offered only the misses and the tier above. It was also told not to re-ask what the drill had shown twice, so the floor was never checked.

**How to apply:**
- `luckRung` (`src/core/placement-ladder.ts`) is the floor when drill answers hold it; a re-check's starting floor has no answers and is not checked. `probeUnits` puts it after the misses, and it is never cut by the eight-unit cap.
- The tutor's brief marks it CHECK FOR LUCK and gives the seconds of every answer. The prompt asks for the form in a new frame with a different word, then why, and does not close the stage before that unit has a verdict unless the questions run out.
- Its verdict goes through the existing path: held keeps the level; slip keeps it and records a weak spot; gap moves the bracket below it, so the rungs between are no longer credited.
- No copied-hint signal: in 4,800 generated items across the sixteen rungs, no typed item asked for the form shown in its hint, so copying the hint cannot score.
- No new model call on the ladder: P7 still holds. The check costs one or two of the stage's existing six questions.
