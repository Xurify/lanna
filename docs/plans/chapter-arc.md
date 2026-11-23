# Chapter arc: implementation plan

Status: **proposed.** Decided: keep the 19 chapters; the exam is a required gate, introduced in steps; skip-ahead comes after the gate. Still open: story bible, the wording of the "I can" lines and calendar. Nothing here is built yet. The one shipped piece is PR #37 (settings links and the Talk duplicate), which does not depend on this plan.

Date: 2026-10-30. Evidence: [../research/slovake-eu-benchmark.md](../research/slovake-eu-benchmark.md).

## What we're building

The **arc** is the fixed run of seven steps that every chapter goes through, in the same order. Each step adds one thing the chapter needs, such as a story, a contrast pair, a sound or an exam. Every chapter gets the arc, and the daily plan works through it, so "today" reads as "day 3 of _At the doctor's_" rather than a list of grammar IDs. The arc uses what the app already does well: local drills, Read, Speak and Review.

## The arc

| # | Step | Strand | Built from | Model calls |
| --- | --- | --- | --- | --- |
| 1 | Príbeh (story) | input | a Read episode for the chapter (phase 2) | one per chapter, cached |
| 2 | Slová (words) | form | existing word lessons and Review | none |
| 3 | Tvary (forms) | form | the chapter's existing drill unit | none |
| 4 | Dvojičky (pairs) | form | new pair drill (phase 3) | none |
| 5 | Scéna (scene) | output | scripted scene, then live Speak (phase 5) | one per scene, cached |
| 6 | Zvuk (sound) | fluency | minimal pairs and shadowing (phase 7) | none, TTS cached |
| 7 | Skúška (exam) | all | mixed items from the chapter (phase 6) | one judge for free writing |

## Decisions

1. **Chapters.** **Decided 2026-10-30: keep the 19 chapters and give each the arc.** Re-cutting would have changed `src/core/curriculum.ts` and the can-do goals in `src/core/onboarding.ts`, so it's off the table. **Phase 1 is unblocked.**
2. **Exam gating.** **Decided 2026-10-30: the exam is a required gate. Passing it opens the next chapter.** It ships in steps (6a record-only, then 6b the gate), because a gate built on an unchecked exam would block learners. Open details for 6b: the pass mark and the retry rule, and whether today's "at most two units left" count still applies alongside the gate. Today a chapter opens when the one before has at most two units left (`CHAPTER_SLACK` in `src/core/curriculum.ts`). **Blocks phase 6, not phase 1.**
3. **Story bible.** Who writes the cast and plot? I can draft it. Nothing is generated until you approve it. **Open. Blocks phase 2.**
4. **"I can" wording.** Paraphrase the CEFR "can do" descriptors with attribution, or write our own "I can" lines? **Open. Blocks phase 6a.**
5. **Calendar.** Which dates and traditions go in? Christmas, Easter and other holidays are cultural content, so this is your call. **Open. Blocks phase 8.**
6. **Skip-ahead.** **Decided 2026-10-30: later, after the gate.** Passing a chapter's exam can open it early, without its lessons. Its rules come with phase 6c.

## Phases

Each phase is one PR on its own branch, named after the work and assigned to the owner (W2). Each phase says what it decided, and why, in its PR description. Phase 6 is three PRs.

### Phase 0: done (PR #37)

Settings links open the dialog. Talk and Story run on one screen each (E8).

### Phase 1: arc skeleton, no visible change

- Add an `arc` list to each chapter in `src/core/curriculum.ts`. Each of the seven steps points at the units that already provide it, or is marked "not yet".
- Tests in `tests/curriculum.test.ts`: every chapter has a words step and a forms step. Every scene id used by a goal exists in `SPEAK_SCENES` (`src/core/speak.ts`).
- Acceptance: the existing tests pass unchanged, and `/curriculum` looks the same.

### Phase 2: story bible and chapter stories

- New `curriculum/slovak/world.json`: a cast of about six people with their relationships, the places, and one plot thread per chapter. Approved by the owner before any generation.
- `src/core/reading.ts`: `StoryRecord` gets an optional `chapter`. `pickStory` prefers the current chapter's unread episode.
- `src/server/reading.ts`: writes one episode per chapter on the cheap slot. Cached under `data/profiles/<lang>/stories/` with the README (E1).
- Tests in `tests/reading.test.ts`: the pick order, and the `chapter` field surviving a round trip.
- Acceptance: the Read shelf shows the current chapter's episode first. A second visit makes no model call.

**Status (2026-11-23):** the story step has its first units: hand-written chapter stories (`src/core/chapter-stories.ts`, `curriculum/<language>/stories/`), one per language so far (weather and colors), read on the Read page and done after one reading.

### Phase 3: Dvojičky (contrast pairs)

- `curriculum/slovak/pairs.json`: 12 to 20 pairs to start (ísť/chodiť, aký/ktorý, svoj/môj, radi/rady, kam/kde, and perfective/imperfective pairs). Each has a one-line rule and an Estonian bridge (P6).
- `src/core/lesson.ts`: a `pairs` unit kind. Each rep offers exactly two forms, the target appears in the sentence, and the sentence comes from the lexicon's verified examples.
- Tests in `tests/lesson.test.ts`: two options per rep, the target present in the sentence, and every pair with at least three verified sentences.
- Acceptance: no rep is built from an unverified form (P8).

### Phase 4: grammar atlas

- `src/core/grammar.ts` (pure): builds reference pages from the unit rules and bridges (`src/core/lesson.ts`, `src/core/unit-bridges.ts`), and each learner's cell from `progress.units` and the review log.
- `app/grammar/page.tsx`, `components/grammar/*`, and a sidebar link.
- Tests in `tests/grammar.test.ts`: cell accuracy, and each cell's drill target.
- Acceptance: each case × gender cell shows the learner's accuracy, or "not yet", and opens its drill.

### Phase 5: scripted scenes

- For each of the six scenes, a branching script of about eight turns. It is generated once on the cheap slot, reviewed by the owner, and stored under `curriculum/slovak/scenes/`.
- `src/server/speak.ts`: a script mode that runs before the live scene. The learner picks or types the next line, and each answer is graded locally against the script.
- `components/speak/speak-player.tsx`: the script screen.
- Tests in `tests/speak.test.ts`: script grading and branch order.
- Acceptance: the script runs with no model call. The live scene starts after it.

### Phase 6: Skúška and the "I can" record, in three steps

The exam is a required gate, but it can't block anyone until we trust it. So it ships in steps, and each step waits for the one before.

**6a. Record only (first).** The exam is built from the chapter's own items: words, a form, one pair, one scene line and one listening item. Its result is recorded and fills in the "I can" record. Nothing is blocked, so chapters open exactly as they do today.

- `src/core/exam.ts`: composition and scoring.
- `src/store/progress.ts`: an `exams` record per chapter, which is the evidence for the "I can" lines.
- The "I can" lines on the path: each linked to the exam items that show it (decision 4).
- Tests in `tests/exam.test.ts`: composition from the chapter, the scoring, and the record.
- Acceptance: a failed exam records its misses. No exam result appears without its evidence (P8).

**6b. The gate (after real results).** Passing the chapter's exam is required before the next chapter opens. It starts only after you have reviewed the 6a results and found them accurate.

- Needs before it's built: the pass mark, what happens after a failed attempt, and whether the "two units left" count still applies alongside the gate (decision 2). That count would otherwise let a learner skip the exam.
- Acceptance: a learner who fails cannot open the next chapter, and the screen says what to review.

**6c. Skip-ahead (later, after 6b).** Passing a chapter's exam opens it without its lessons, like Duolingo's tests out of units. Decided 2026-10-30: this comes after the gate, not with it.

- Needs before it's built: which chapters can be opened early (the next one only, or any later one), and how skipped lessons are labeled. The app already counts skipped units as done in its unit totals (`curriculumState`), so the labels keep the numbers honest (P8).
- Acceptance: skipped lessons show as "tested out", not as studied.

### Phase 7: Zvuk (sound of the week)

- `curriculum/slovak/sounds.json`: one sound per chapter with minimal pairs (pas/pás, rad/rád, and the soft de/te/ne).
- A listening check on each pair, then shadowing scored with the existing clarity score (`src/core/pronounce.ts`, `components/speak/pron.tsx`).
- Tests in `tests/sounds.test.ts`: each pair differs in exactly one sound. The score thresholds are unchanged.
- Acceptance: works without an Azure key, using transcript matching as Speak does today.

**Status (2026-11-08):** the data (`curriculum/slovak/sounds.json`), the screen (`/sound?id=`) and the pins (`tests/sounds.test.ts`) are in. Two vowel-length pairs: pas/pás in "moving", rad/rád in "people". Not yet: the sound step on the path (`chapterArc` still says "not yet"), saving the results, and the soft consonant pair (no verified twins in the lexicon). See `docs/research/shadowing.md` and E81.

### Phase 8: calendar and immersion labels

- `src/core/calendar.ts` (pure): date to seasonal item. Easter is computed with the standard algorithm. The dates come from decision 5.
- `curriculum/slovak/calendar.json`: one short episode and a few words per date.
- `components/today.tsx`: one "Dnes" card when a date is near. `components/ui/learn-buttons.ts`: Slovak labels at A2 and above, with the meaning shown until the learner has seen each label a few times (E4a).
- Tests in `tests/calendar.test.ts`: Easter dates for several years, and the date windows.

### Quick wins (any time, one PR each)

- A counter on each step in the path (`components/curriculum-path.tsx`).
- Situation titles on units: "Kde bývaš?" as the title, with the grammar name as the subtitle.
- A printable syllabus: `/curriculum` with print styles.

## Checklist for every phase

1. Branch named after the work. PR assigned to the owner. Nothing merged by me (W2).
2. Tests with `NODE_ENV=test node --import tsx --test <files>`. Typecheck with `node node_modules/typescript/bin/tsc --noEmit`, since the `tsc` shim on this PC does not resolve. Lint with `npx eslint` on the changed files.
3. A live check on a scratch profile: `LANNA_DATA_DIR` and `LANNA_AUTH_FILE` pointing at a temp folder, with no real keys. No model call without the owner's approval. Screenshots go in the PR.
4. The decision and its why go in the PR description. The research note is updated if the evidence changes.
5. Before blaming a change for a failing test, run the same files on `main` in the same environment. PR #37 found 28 failures that were already there.

## Risks

- **Scope.** Eight phases is a lot. Phases 1 and 2 are the bet. Stop after phase 2 and check with the learner before going on.
- **Gate timing.** A gate on an exam we haven't checked would block learners. That's why 6b waits for 6a's results.
- **Model cost.** Everything generated is cached under `data/` (E1), so generation runs once per item.
- **Slovak accuracy.** Pairs and forms come from verified lexicon forms (P8). Generated scene scripts and stories are reviewed before use.
- **License.** The CEFR descriptors belong to the Council of Europe. Quote them only with attribution; otherwise paraphrase (decision 4).
- **Test isolation.** `tests/speak.test.ts` reads the repo-root `auth.json`, so it fails on a PC that has an ElevenLabs key. Fix it in a small PR before phase 5.

## Done when

- Every chapter shows its seven steps, with counters.
- The exam is recorded (6a), gates the next chapter once trusted (6b), and the record lists the evidence for each line.
- The owner has reviewed the first two chapters end to end: story, pairs, scene and exam.
