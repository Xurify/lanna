# E45. A language switch happens in place, with no restart (2026-11-05, branch `feat/unified-daily-plan`)

**Why:** the owner studies Russian, Slovak and Estonian every day and found the restart on every switch in the way; it also made a plan across languages impossible.

**How to apply:**
- The running language is per request since E75 (`config.ts`: `activeProfile()`); the process keeps a default on `globalThis`, per data folder (`defaultProfile()`, `switchProfile()`), because `next dev` evaluates a module once per route. Nothing may copy it at module load: read `activeProfile()` and `PATHS.*` (getters) when they are used, and give a module-level cache the file it was read from as part of its key.
- The core's course tables are functions memoized per course object (`perCourse` in `src/core/course.ts`): `allUnits()`, `allChapters()`, `curriculumUnits()`, `placementTiers()`, `placementLadder()`, `lessonLanguage()`, `lessonsHaveBridges()`. Do not add a module-level constant built from the course.
- `withProfile(id, fn)` reads another language's records for the daily plan across languages. `fn` must be synchronous, so no other request runs while the language is borrowed.
- ~~A switch waits (409 with the reason) while a tutor turn, a skill-map update or a video preparation is running.~~ Dropped with E75: work in flight keeps the language of the request that started it, so a switch no longer waits. The browser then loads the page again (`window.location.assign`), on the same page when it means the same thing in every language, else on Today. There is no confirm step and no relaunch; the Electron relaunch and the desktop:dev restart that existed only for switching are gone.
- ~~Open: a model call started by a page that is still in flight during a switch writes into the new language's folder.~~ Closed by E75: the call keeps its request's language.
