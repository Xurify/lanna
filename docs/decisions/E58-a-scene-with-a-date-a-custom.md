# E58. A scene with a date: a custom milestone with a day and a line after it, never an invented speed (2026-11-05, branch `feat/daily-hooks`)

**Why:** proposal 3: a dated, concrete scene makes the future self visible. The app must not invent a speed or a date to give one.

**How to apply:**
- A dated scene is a custom milestone with a `date` (`src/core/dated-scene.ts`). Days left come from the learner's own day key. "On track" or "behind" compares the milestone's estimate at the measured pace with the date. With no measured speed or pace, the app gives no date and says what measures it.
- The date is chosen with quick choices and a month-and-year stepper, with no native date input (E4). A date in the past is refused before anything runs.
- The line after the date is written once, with no XP and no stamp (E31). The words are mapped by the cheap model, as for any custom milestone, so adding a scene needs an AI key.
- On Today the scene is a row inside the "Where you are" card (E55): the days left as the figure, the status as a word next to the title, the app's line under it, and links to Speak and, once the date has passed with no line written, to Milestones. Weekly rehearsal is not built yet.
