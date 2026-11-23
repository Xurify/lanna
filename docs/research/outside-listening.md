# Long days and listening outside the app

**Question:** the owner asked what ten hours of Russian listening a day for a year would do, and whether the app should apply that. A goal can already be 600 minutes a day, so the real question is what the app does with a long day, and what it does with listening it cannot see.

**Date:** 2026-11-07. **Decision:** E68. **Code:** `src/core/after-plan.ts`, `src/core/outside.ts`, `src/server/outside.ts`, `src/store/outside.ts`, `components/outside-listening.tsx`, the outside row in `src/core/milestones.ts`.

## What ten hours a day would and would not do

3,650 hours is more than any guided-hours figure the app uses (C1 is 950 on the ladder). Three things decide what it buys:

1. **Whether it is understood.** Listening builds a language when about 95% of the words are known (van Zeeland & Schmitt 2013). Native content heard from zero is mostly sound.
2. **Whether it is attended to.** See below: attention is what turns heard speech into words.
3. **Whether there is output.** Years of immersion left near-native comprehension and non-native grammar (Swain 1985); this is the reason for P2.

So the app should not offer a "ten hours" mode. P2 stands: one task per strand, input easy at the word level, deliberate study no more than about a quarter.

## What the app did with a long day

- **The plan holds about 35 to 45 minutes** (the `TASK_MINUTES` of its tasks). At a 600-minute goal, nine hours had no plan, and once the plan was done Today offered "One more lesson": more deliberate study, the strand already furthest over its quarter.
- **The milestones page counted every planned minute the same.** That is right for minutes measured in the app's own tasks, and it is what a learner who logs listening elsewhere could not use: the app never saw that time.

## The evidence on attention and passive exposure

| Finding | Source | Checked |
| --- | --- | --- |
| Adults found the words in a stream of artificial speech by listening alone; a task done at the same time (noises, pictures or pitch) impaired it dramatically. | Toro, Sinnett & Soto-Faraco 2005, _Cognition_ 97(2) | abstract |
| Dividing attention while taking words in gave large reductions in later memory; dividing it at recall cost little. | Craik, Govoni, Naveh-Benjamin & Anderson 1996, _JEP: General_ 125(2) | abstract |
| Across four experiments, full against divided attention at encoding: .46 vs .32, .58 vs .44, .47 vs .22, .47 vs .36 (a loss of roughly a quarter to a half). | Naveh-Benjamin, Guez & Marom 2003, _Memory & Cognition_ 31(7) | full text |
| Infants learned Mandarin sounds in 12 sessions with a live tutor; the same sessions on video or audio produced no learning. | Kuhl, Tsao & Liu 2003, _PNAS_ 100(15) | full text |
| Extra exposure to a sound helped discrimination learning only next to practice, even during an unrelated task; it stopped helping a few hours away from practice. | Wright, Sabin, Zhang, Marrone & Fitzgerald 2010, _J Neurosci_ 30(38) | abstract |
| 70 adults who heard daily Italian podcasts in their normal routines for two weeks got better at telling Italian words from non-words than controls. Meanings were not tested and attention was not controlled. | Alexander, Van Hedger & Batterink 2023, _Psychonomic Bulletin & Review_ 30(2) | abstract |
| Self-reported media time correlated with logged time at r = 0.38 (47 studies); fewer than 10% of reports were within 5% of the logs, and errors ran both ways. | Parry et al. 2021, _Nature Human Behaviour_ 5 | full text |
| Focused viewing of one full TV program, or ten episodes, gave a small number of new words, more for learners who already knew more of the words. | Peters & Webb 2018, _SSLA_ 40(3); Rodgers & Webb 2020, _ITL_ 171(2) | partly |

The DOIs of the first six (Naveh-Benjamin aside) were matched on Crossref with `npm run sources:check`; the abstract and full-text checks were done by a research pass in the same session, not by the owner.

**What is missing.** No study gives a weight for an hour of focused listening outside a course against an hour of guided study. No study compares attended with background listening in adult language learners. Nothing in language learning compares self-reported exposure time with logs.

## What changed

1. **After the plan, input.** Once every task is done, Today's card offers a video you added and have not watched, else ten more Listen sentences, with Start and Enter; "Find a video at your level" (when no video waits) and "One more lesson" sit under it. Listen is built locally and a prepared video needs no model call, so this costs nothing per extra minute.
2. **Listening outside the app is logged apart.** On Today, "Log listening": minutes, focused or in the background, the day (today and the two before), and what it was. It is kept in `outside-listening.json` and never enters the measured minutes, XP, the streak or the strand balance (P9).
3. **The milestones page shows it in its own row.** The facts say how much was logged. Each situation's details add "Speed with outside listening": the real-pace date with focused outside minutes added at half, background at none. On the learner's own Listen trend the row says the outside listening is already in it, because the trend is speed per hour in the app, so whatever helped outside shows up as a steeper slope. The measured dates do not move.

## The weights, and why they are the app's own

- **Focused: half.** An assumption, said so on the page. Half is between the two things the app cannot know: how much of it was understood (no coverage check, no replays counted, no "got it") and whether the minutes are right (self-reports are imprecise). A focused minute in Listen or Watch is measured and graded; an outside one is neither.
- **Background: none.** The conservative end. Attention is what turns speech into words (Toro et al.; Craik et al.), but two weeks of background podcasts did help recognizing word forms (Alexander et al.) and passive exposure helped sound learning next to practice (Wright et al.), so it is not worth exactly nothing. It is kept, so the weight can change without asking anyone to log again.
- **Limits:** one entry at most 600 minutes, a day at most 16 hours (focused counted first).

## Not done

- No "ten hours" target, challenge, streak or stamp for hours.
- The outside minutes do not move the words date: the words estimate is the deck and the level, and nothing logged outside says which words were met.
- The plan itself does not grow past its tasks at a long goal; the step after it does the work.
