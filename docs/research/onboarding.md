# Setup and placement: finding goals and level without a long chat

*LangHarness, 2026-10-28. Thread "Rethink how learner goals are set". Code: `src/core/onboarding.ts`, `components/onboarding/`, `src/agent/learner-profile.ts`, `components/hours-sheet.tsx`.*

## The problem

The owner: "I feel like we should restructure how we figure out the goals of a learner. I feel like the way we do it with a bunch of chats is kinda ancient and inefficient." Their first real session had spent 23 minutes on a chat placement, and after about 15 questions they asked "Can we do something fun?". At the same time they are fine with the model being used precisely and Socratically to understand their understanding; what they reject is wasteful chat.

## Principle

Measure cheaply first, spend model questions only on the edge. Setup asks nothing a model needs to ask, and gives the tutor everything it learned so a Learn session never asks for the goal again.

## What was built

**Four screens, no model call, Enter continues, every screen skippable.**

1. **What Slovak is for.** Can-do purposes (family, daily life, work, offices, media, exam, curious, other with a free note). Each purpose implies a target level and the Talk and Speak scenes; the highest implied level wins and an exam level overrides. "Other" defaults to A2 with an explicit chip. The note is passed word for word into the tutor's profile block.
2. **What you bring.** Languages known, picked from 61 (20 as chips, the rest behind a searchable panel; no free text after round 5, after the ask to "remove the custom input and just increase the amount of languages"). Each language gets a level on the CEFR (A1 to C2 plus Native; PR #6). "Know" means can read a simple text. Up to two explanation languages, ordered. The best-known language leads the bridge line in lessons.
3. **Time.** Minutes a day (stepper, quick picks to 120, max 600 since "the 90-minute cap is bad for power learners") and days a week, with the date that pace reaches the target. The "How long does it take?" sheet shows the app's guided-hours ladder against Cambridge English bands and the FSI category III line, with the head start a known Slavic language is assumed to give, and four cited sources.
4. **Placement drill.** A staircase of real sentences, A1 → A1 → A2 → B1, two reps per unit, eight items a tier, pass at six. Units aced are tested out; chapters behind the edge are skipped but open to revisit; misses come first in the daily plan; the result shows the sentences as evidence. "Go deeper with the tutor" opens a teach chat seeded with the misses.

**The tutor gets it all.** `learnerProfileText` appends a "This learner" block to every agent's system prompt: purposes, languages with levels ("Estonian (native), Russian (A2 on the CEFR)"), explanation languages (explain in the first, key line and grammar terms in the second), pace, placement. The prober is told not to ask the goal, to treat held units as floors, and to spend one to three Socratic questions on shaky strands. A language known at A2 or below gets short lines only.

**Settings → Learner** edits languages and explanation languages; "Open setup" for the rest; "Re-check my level" reruns the drill.

## Evidence used

- Purposes as can-do statements follow the CEFR's action-oriented descriptors.
- Guided-hours ladder: A1 90, A2 200, B1 400, B2 650, C1 950 (Cambridge English guided learning hours, with FSI's 1,100 hours for category III languages as the outer line). The hours table does not vary by target language; the head-start line is the only language-specific part.
- Vocabulary credited by level follows Milton (2009), raised a quarter for Slovak lemmas; see [milestones.md](milestones.md).

## What the audit found (same day)

The drill is sound for a first placement of a beginner to A2 learner, but: re-check demotes everyone to A1 (critical bug), eight items per tier is noisy by about one tier, it is grammar-only yet downstream tasks infer vocabulary from it, the ceiling is B1 grammar, and exact-string grading marks valid alternatives wrong. The owner's verdict: "The checker is so bad. I don't even think it uses AI when this test should be dynamic and kinda Socratic." The rebuild (cheap drill, model-judged alternatives, adaptive Socratic stage, vocabulary-size check) is in [level-assessment-audit.md](level-assessment-audit.md).

## Known limits

- The self-report "Slovak so far" only decides whether the check is offered by default; it never influences placement.
- A language ticked without a level is treated as B2.
- The known-words estimate used by Read, Listen and Watch is generous for an unplaced A1 profile.
