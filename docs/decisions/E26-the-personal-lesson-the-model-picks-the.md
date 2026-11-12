# E26. The personal lesson: the model picks the targets, the lexicon builds the reps (2026-11-01)

**Why:** the owner asked whether analyzing yourself with AI creates anything personal in the learning journey, and whether a stronger model should do it. It should choose and explain; it should not write the sentences a learner practices, because a wrong form in a drill is learned as right at A1–A2 (P8).

**How to apply:**
- The guide runs on the Strong slot, else Cheap, with the slot's own thinking level (`aiStatus("strong")`). It runs a few times a week, so the cost is small and the reasoning is worth it.
- Its reply carries `practice`: up to six words (lemmas from the facts), three unit ids and three pairs. `resolvePractice` (`src/core/personal.ts`) keeps only what the lexicon backs: a word with a verified sentence, a lesson unit with three sentences, a pair both of whose twins exist with three sentences that hold only one of them. What survives is kept with the guide in `analysis.json`.
- The pairs become mix-up probes (`from: "guide"`, "suggested by your guide"), tested before they are taught, like a family's.
- `/lesson?mode=personal` builds twelve reps from those targets with the existing builders: pair reps (typed when the pair is an open mix-up, a choice when not), a typed cloze per word, typed reps per unit. Targets take turns, so the lesson is interleaved. It counts XP, the day's minutes and `day.personal`, never a unit or the atlas, and logs `mode: "personal"`.
- Strengthen takes it for seven days after the guide, after a weak spot on record and before mix-ups and slipping units: "Strengthen: Your plan · <the guide's first pattern>".
- The model never writes a sentence for a drill. Sentences the lexicon lacks may later come from a model into a queue that a check other than the learner approves; that queue is not built.
