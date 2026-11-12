# E13. A scripted scene walks the rails before it goes live (2026-10-30)

**Why:** the Speak scene threw the learner straight into free speech with a model — for a first-time learner that is a wall, not a task. The arc's scene step (E9) promised a scripted scene first: the tutor's line, then a choice of three next lines, one right and two plausible slips, graded locally with no model call.

**How to apply:**
- The scripts are data, not model output: `curriculum/slovak/scenes/<scene id>.json` (scene id from `SPEAK_SCENES`), six to ten turns, each a tutor line (Slovak + English) and exactly three options with exactly one correct. Correct lines use lexicon words; wrong ones carry a one-line English `why`. They are authored in the repo and pinned by `tests/speak-script.test.ts`.
- The grading is `src/core/speak-script.ts` (pure): `scriptFor(sceneId)` and `grade(script, turn, choice)` → correct, or wrong with the explanation and the right line. One wrong answer may be retried once; a second miss shows the right line and moves on.
- `/speak?scene=<id>&mode=script` runs `components/speak/script-player.tsx` and never auto-starts the live scene (SpeakPlayer starts when `sceneId` is set — script mode renders the other player instead). "Say it live" at the end hands over to the normal scene; every picker card has a "Script first" link.
