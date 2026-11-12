# E46. One plan for the day across languages; the split is each language's own minutes (2026-11-05, branch `feat/unified-daily-plan`)

**Why:** the owner learns Russian, Slovak and Estonian at once, with no fixed limit on the day: "a unified daily plan is literally my dream". They think in minutes for the day and a share per language.

**How to apply:**
- Today's plan, with more than one language, is each language's own daily plan (the same `dailyPlan` Today shows when it runs), read with `withProfile` (E45) by `languageDay()` in `src/server/day-plan.ts`. Languages are ordered by their minutes a day, largest first; the next step is the first undone one in that order. One list, as E33 asks: a language is a heading over its rows, not a card of its own.
- The split of the day is not stored apart. A language's share is its `goal.minutesPerDay`, so the plan's budget, the pace, the hours sheet and the milestones all read one number. **Split the day** turns the day's minutes and whole-percent shares into those minutes (`minutesFromShares`, at least 5 a language) and saves them (`PUT /api/day`).
- A step in another language switches (E45) and lands on the step's page; a tutor step, which has no page, lands on Today. A language not set up has one step, its setup.
- The rail, the score, the weak spots and the week stay the running language's.
