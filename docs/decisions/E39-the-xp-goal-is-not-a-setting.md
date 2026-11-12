# E39. The XP goal is not a setting: it follows the minutes (2026-11-03, branch `feat/settings-goals-and-time-studied`)

**Why:** the learner picks how long to study. The XP goal was a second number, fixed at 50 with no screen to change it, and one lesson cleared it against a plan of 90 minutes, so "goal met" said nothing. The owner: it should be calculated from what the learner already chose.

**How to apply:** `dailyGoal` in the progress summary is the plan's `minutesPerDay` at the learner's own XP an hour (`xpForPlan`, `src/core/onboarding.ts`), to the nearest 10 between 10 and 500. The rate is measured: XP over the days that have measured minutes, once there is an hour of them, else 120 XP an hour (`DEFAULT_XP_PER_HOUR`). It is not stored, `PUT /api/progress {dailyGoal}` is gone, and Settings → Learning shows the number as a line under the minutes. A change to the minutes moves it at once.
