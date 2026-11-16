# Setup and placement: finding goals and level without a long chat

_Lanna, 2026-10-28. Thread "Rethink how learner goals are set". Code: `src/core/onboarding.ts`, `components/onboarding/`, `src/agent/learner-profile.ts`, `components/hours-sheet.tsx`._

## The problem

The owner: "I feel like we should restructure how we figure out the goals of a learner. I feel like the way we do it with a bunch of chats is kinda ancient and inefficient." Their first real session had spent 23 minutes on a chat placement, and after about 15 questions they asked "Can we do something fun?". At the same time they are fine with the model being used precisely and Socratically to understand their understanding; what they reject is wasteful chat.

## Principle

Measure cheaply first, spend model questions only on the edge. Setup asks nothing a model needs to ask, and gives the tutor everything it learned so a Learn session never asks for the goal again.

## What was built

**Four screens, no model call, Enter continues, every screen skippable.**

1. **What Slovak is for.** Can-do purposes (family, daily life, work, offices, media, exam, curious, other with a free note). Each purpose implies a target level and the Talk and Speak scenes; the highest implied level wins and an exam level overrides. "Other" defaults to A2 with an explicit chip. The note is passed word for word into the tutor's profile block.
2. **What you bring.** Languages known, picked from 61 (20 as chips, the rest behind a searchable panel; no free text after round 5, after the ask to "remove the custom input and just increase the amount of languages"). Each language gets a level on the CEFR (A1 to C2 plus Native; PR #6). "Know" means can read a simple text. Up to two explanation languages, ordered. The best-known language leads the bridge line in lessons.
3. **Time.** Minutes a day (stepper, quick picks to 120, max 600 since "the 90-minute cap is bad for power learners") and days a week, with the date that pace reaches the target. The "How long does it take?" sheet shows the app's guided-hours ladder against Cambridge English bands and the FSI category III line, with the head start a known Slavic language is assumed to give, and four cited sources.
4. **Level check.** First built as a staircase of real sentences (A1 → A1 → A2 → B1, two reps per unit, eight items a tier, pass at six), then rebuilt the same day (PR #9) after the audit below. Now three stages: an adaptive ladder over the 16 drill units (binary search that starts from the self-report, jumps on a hold, halves on a gap, closes in about a dozen items; a typed answer the dictionary did not expect is judged by the Cheap slot, so a valid alternative form is never a miss); a Socratic stage on the Strong slot (up to six production and "why" questions at the edge, each unit rated held, slip or gap, verdicts replacing the drill's reps); and a two-minute yes/no word check (40 words over five frequency bands plus 8 pseudowords, false-alarm corrected) that feeds the milestones page. Units held are tested out; chapters behind the edge are skipped but open to revisit; misses come first in the daily plan; the result shows tiers, the tutor's reading, verdict chips, word bands and every miss as evidence. A re-check starts from the current chapter and never places the learner below it. Every check is saved under `data/profiles/<lang>/placement/` and costed on Spending.

The target box says what each level buys in Slovak-life terms and which chosen purposes it covers (PR #8). The line under the languages names only the learner's own languages, best-known first, and explains what a parallel is: one line in the Why? panel and in hints when a Slovak rule mirrors a rule they know, never a lesson in that language; Settings → Learning has a "Parallels from my languages" switch (PR #10).

**The tutor gets it all.** `learnerProfileText` appends a "This learner" block to every agent's system prompt: purposes, languages with levels ("Estonian (native), Russian (A2 on the CEFR)"), explanation languages (explain in the first, key line and grammar terms in the second), pace, placement. The prober is told not to ask the goal, to treat held units as floors, and to spend one to three Socratic questions on shaky strands. A language known at A2 or below gets short lines only.

**Settings → Learning** edits languages and explanation languages; "Open setup" for the rest; "Re-check my level" reruns the drill.

## Evidence used

- Purposes as can-do statements follow the CEFR's action-oriented descriptors.
- Guided-hours ladder: A1 90, A2 200, B1 400, B2 650, C1 950 (Cambridge English guided learning hours, with FSI's 1,100 hours for category III languages as the outer line). The hours table does not vary by target language; the head-start line is the only language-specific part.
- Vocabulary credited by level follows Milton (2009), raised a quarter for Slovak lemmas; see [milestones.md](milestones.md).

## What the audit found (same day)

The drill is sound for a first placement of a beginner to A2 learner, but: re-check demotes everyone to A1 (critical bug), eight items per tier is noisy by about one tier, it is grammar-only yet downstream tasks infer vocabulary from it, the ceiling is B1 grammar, and exact-string grading marks valid alternatives wrong. The owner's verdict: "The checker is so bad. I don't even think it uses AI when this test should be dynamic and kinda Socratic." The rebuild (adaptive ladder, model-judged alternatives, Socratic stage, vocabulary-size check) shipped as PR #9 and is described in [level-assessment-audit.md](level-assessment-audit.md). PR #11 added weak spots on record, fed by the check, lessons and review.

## Known limits

- The self-report "Slovak so far" decides whether the check is offered by default and where the ladder starts; it is not evidence on its own.
- A language ticked without a level is treated as B2.
- The known-words estimate used by Read, Listen and Watch is generous for an unplaced A1 profile.
