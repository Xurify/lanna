# Level assessment audit — LangHarness, 2026-10-28

Scope: the staircase placement drill (`src/core/onboarding.ts`, `components/onboarding/placement-drill.tsx`, `src/server/lesson.ts`), the self-report, the purposes → target mapping, how the placed level feeds the map, the hours projection, the milestones calculator, Read/Watch question grading, and the per-language CEFR levels from PR #6. Everything below was checked against the code on `main` (f1697f2) and reproduced with a script against a throwaway data folder; nothing here is a guess.

## Verdict in one paragraph

The drill is sound for a **first** placement of a beginner-to-A2 learner, and the map, Read, Watch and Speak follow it correctly. It has one critical bug (**re-check always demotes you to A1 and chapter 1**), one calculation inconsistency (Today's ETA ignores days per week), and the milestones calculator misreads the placed level twice (it is sticky, and it credits the vocabulary of the level you are *entering* as if you had finished it). Beyond bugs, the test is **grammar-only, eight items per tier, pass at six**: a learner who truly knows 75% of a tier passes it only 68% of the time, and only 46% of the time through two tiers in a row, so the placement is noisy by about one tier. It measures no vocabulary size, no listening and no free production, and then the words calculator and the Read/Watch generators assume a vocabulary from that grammar score.

## Bugs

| # | Severity | What | Where | Reproduced |
|---|---|---|---|---|
| 1 | **Critical** | **Re-check my level sends everyone back to A1 / "Hello".** A re-check starts at the tier of your current chapter (`placementFor({recheck})` → `from = 2` for a learner in "Shopping"), the drill only answers tiers 2 and 3, but `placementOutcome` walks tiers from 0 and `break`s at the first tier with no answers → zero tiers scored → `lastPassed = -1` → level A1, start chapter "hello". `recordPlacement` then writes that into `goal.startChapter` and deletes the earlier placement's evidence. A B1 learner who aces the A2 and B1 tiers on a re-check is demoted to chapter 1. | `src/core/onboarding.ts` placementOutcome; `src/server/lesson.ts` recordPlacement | Yes: `from 2, aced a2+b1 → A1 hello, tiers seen: 0` |
| 2 | High | Even with #1 fixed, a re-check that fails its first tier moves the learner **behind where they were** (the floor is chapter 1, not the chapter the re-check started from) and wipes the tested-out evidence of tiers it never re-asked. | same | Follows from the code |
| 3 | Medium | **Today's ETA and the setup's ETA disagree.** `projection()` hard-codes 6 study days a week; `etaFromScratch()` in the setup uses the learner's days per week. 30 min × 3 days/week to B2: setup says 2035-02, Today says 2030-12. | `src/core/curriculum.ts` projection | Yes |
| 4 | Medium | **The milestones level never moves.** `/milestones` uses `goal.placedLevel ?? state.level`, so once placed, months of lessons never change the level the words calculator and the speed ladder use. Read, Watch and Speak correctly use the map's current level, so the app shows two different levels. | `src/server/milestones.ts` wordSets | Yes (code) |
| 5 | High (accuracy) | **Milestones credits the vocabulary of the level you are entering as if you had finished it.** Passing the two A1 tiers places you "at A2" (= the first A2 chapter), and the calculator then credits `LEVEL_VOCAB.A2 = 2,400` words you have never met. Passing all four tiers labels you B2 and credits 4,400 words and 400 guided hours on 32 grammar items. Milton's bands describe learners who have *reached* a level. | `src/server/milestones.ts`, `src/core/milestones.ts` LEVEL_VOCAB | Yes: `A1 passed, A2 failed → A2, 2,400 words credited`; `all right → B2, 4,400 words, 400 h` |
| 6 | Low | B2 chapters ("Nuance", "Register", "Media") belong to no tier, so a B2 learner's re-check restarts from tier 1 (`tierForChapter("nuance") === 0`, pinned by a test). Harmless today only because of #1. | `src/core/onboarding.ts` tierForChapter | Yes |
| 7 | Low | Placement reps for a unit that already has lesson evidence are **added** to that unit's lesson reps/correct, so a repeated re-check keeps inflating (or deflating) a unit's accuracy. | `recordPlacement` | Code |

No bugs found in the PR #6 per-language CEFR levels: legacy basic/good/fluent read as A2/B2/Native, levels of dropped languages are dropped, the default (B2) is not stored. One honest nit: a language ticked without choosing a level is treated as B2, which overstates casual knowledge; the lesson only uses it to order bridge lines, so the effect is small.

## Inaccuracies and construct validity

1. **Reliability.** Eight reps per tier, pass at six. Binomial, per-rep accuracy *p*: p=0.60 passes 32% · p=0.75 passes 68% · p=0.85 passes 89%. Through two tiers: p=0.75 → 46%, p=0.85 → 80%. Four of the eight reps are multiple choice (usually 4 options, sometimes 2–3 when the word has few verified forms), so a learner with 50% real knowledge passes a tier 24% of the time by partial guessing. The staircase therefore places about one tier too low for solid learners more often than not, and one too high for weak ones one time in four. The result screen presents it as a measurement without an error bar.
2. **Grammar only.** All 16 units probed are case/verb-form drills plus one "words" unit (8 items of the first 300). Nothing measures vocabulary size, listening, reading speed or free production. Yet downstream: the words calculator infers vocabulary from the level (#5), Read writes at 97% "known" words using `KNOWN_RANK[level]` (2,000 words at B1), and Watch/Read question kinds and counts follow the level. A reader with good pattern memory for endings and 600 words is placed B1 and gets stories built on 2,000 assumed words.
3. **Ceiling and labels.** The check stops at B1 grammar. Passing everything says "You start at B2" although nothing at B2 was measured; the title should say the check ran out, not that B2 was reached. Also "A1 · Everyday A1 passed" → "You start at A2": correct (A1 is behind you) but the level word is used in two senses across the app ("working at" on the map vs "reached" in milestones and the hours chart).
4. **Diacritic slips count as right** (`isHit`: "accents" is a hit). Fine in lessons as partial credit; in a measurement it inflates typed-rep accuracy. A judgment call; left as is but worth knowing.
5. **Hours credited by placement.** Skipped chapters count as done, so a B1 placement credits ~200 "hours done" to the chart. Reasonable as a head start, but the chart calls it hours done.
6. **Self-report.** "Slovak so far" only decides whether the check is offered by default ("Nothing yet" hides it behind "Take the check anyway") and adds a line to the tutor profile. It never influences placement. Fine, but it means the one cheap prior the learner gives is unused.
7. **Purposes → target.** Sound: highest implied level wins, exam level overrides, "other" defaults to A2 with an explicit chip. No issue.

## What I am fixing now (branch `fix/level-assessment`)

1. Re-check: tiers below the start are held, their evidence is untouched, the floor is the chapter the re-check started from; B2 chapters re-check from the B1 tier. (#1, #2, #6)
2. `projection()` takes the learner's days per week. (#3)
3. Milestones: the level follows the map (placement sets the map's start; lessons move it) and vocabulary is credited for the level *completed* plus progress through the current one, never for the one being entered. (#4, #5)
4. Honest result screen: a borderline tier (5 or 6 of 8) gets a third rep per unit before the verdict (12 reps, pass at 9), and passing every tier says the check ran out rather than "B2".
5. A **vocabulary-size check**: a two-minute yes/no test (40 real words across five frequency bands + 8 pseudowords to catch over-claiming, Meara/Milton X_Lex style), offered after the drill and from /milestones; its estimate replaces the level-implied word count in the calculator and is saved under data/.

Not fixing: listening and production measures (the Listen and Speak tasks already log evidence; folding them into a level is a bigger design), diacritics-as-hits (a choice, flagged).

## What happened next (2026-10-28, later the same hour)

Xurify, on seeing the audit and a screenshot where *Zostal sám doma* (correct Slovak) was marked wrong because the check only accepts the dictionary word the sentence was built from: "it's clearly wrong. The checker is so bad. I don't even think it uses AI when this test should be dynamic and kinda Socratic to better find your current level."

The fix branch (`fix/level-assessment`) therefore widened from bug fixes to a rebuilt check:

1. A short cheap drill as the first pass; typed answers that do not match the key go to the model to judge whether they are a valid Slovak alternative, so a right answer is never a miss.
2. An adaptive Socratic stage: the tutor probes the edge in production, picks the next question from what was just right or wrong, asks what decided the form, and separates a slip from a gap, then places the learner with evidence.
3. The two-minute yes/no vocabulary-size check (above).
4. The re-check, ETA and milestones bugs fixed alongside.

Status at the time of writing: in progress in the thread "Audit the Slovak level assessment"; not merged, not yet verified by Xurify.
