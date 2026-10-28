# The learner

What the app assumes about the person using it, where those assumptions came from, and what any new learner should be able to expect. The app is meant for more learners than one; the evidence so far comes from one, the owner, and is kept apart in the dated section at the end.

## What the app assumes

- **Several languages known, with levels.** The learner picks every language they know and rates each on the CEFR. Every grammar unit bridges from the best-known ones, and the tutor explains in up to two of them. Estonian is the first bridge the app was built around, because Estonian cases make Slavic morphology intuitive.
- **Reading ahead of production is normal.** A learner can read at B1 and still produce A1 to A2 endings by pattern memory rather than rule. The app therefore keeps explicit instruction and typed production rather than relying on input alone (see [DECISIONS.md](DECISIONS.md) P2).
- **Parsing speed is its own gap.** Knowing the words and assembling meaning fast enough are measured apart: the milestones page reports words (coverage) and speed (words a minute of understanding from Listen and Watch) separately and says which one is binding. The fluency strand and the Listen and Watch tasks exist for the speed gap.
- **Time varies a lot.** Minutes a day go up to 600; the hours sheet shows what any pace reaches and when.
- **Struggle is wanted.** Help is graded and priced, never free (P3).
- **Voice matters.** Every sentence has audio; the Speak task is spoken; pronunciation gets a clarity score.
- **Sentences in context, not isolated words.** The Review deck is a cloze over real sentences; lessons are built from real sentences.
- **Evidence over verdicts.** A placement shows the sentences it was based on; estimates cite their sources; spending is visible.

## Drop-off patterns to design against

Found in the first learner's sessions on 2026-10-27, and treated as general:

- A required "Your thinking" field ends sessions. Answer first, reasoning optional.
- Default confidence sliders go untouched. Put confidence behind "Explain my reasoning".
- A long placement chat loses the learner around question fifteen. Measure with a short drill, spend model questions only on the edge.
- "Why do you think I am at B1?" needs an answer with sentences, not a label.
- A long wait at a plan-approval gate is dead time. There is no gate.
- A "Why?" that leaves the lesson and loses its state is hated. Why? opens in place; lesson state persists until finished or closed.

## The first learner (the owner), as of 2026-10-28

| | |
|---|---|
| Target language | Slovak (Russian is a placeholder profile only) |
| Languages known | Estonian (native), English (explanation language), some Russian |
| Reads | About B1 (placement 2026-10-26) |
| Produces | A1 to A2 endings, chosen by pattern memory, not rule |
| Typical misses | Genitive after *do* / *z*, animate accusative, numbers 5 and up, imperfective aspect |
| Target | B2 (about 650 guided hours from zero) |
| Self-diagnosed gap | "I get a lot of words, but I can't put them together into meaning fast enough" (parsing speed, not vocabulary) |
| Reviewing style | Skims, then looks at screenshots closely; notices small UI details; wants Duolingo-like structure, custom controls, no layout shift |

Their PC profile had not yet gone through the new setup (the home page redirects to `/start`), so the Today screen, daily plan and most tasks built on 2026-10-28 are unverified by them. See the unverified list in [CHANGELOG-2026-10.md](CHANGELOG-2026-10.md).
