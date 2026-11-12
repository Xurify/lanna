# E38. Listening is read from the typed sentence: the cause of each miss, and its trend (2026-11-03, branch `feat/listening-trends`)

**Why:** the owner wants to see trends in what they cannot hear and why. Reasoning and limits: [research/listening-trends.md](../research/listening-trends.md).

**How to apply:**
- Listen is typing-only (owner, 2026-11-03: the causes need typed sentences, and picking was already too easy). "Didn't catch it" is a miss without typing something random; a sentence with nothing typed is not read for causes. "pick" stays in the types for the sessions logged before.
- A typed sentence is timed for the speed measure by its clip, as Watch is: words over the clip's length times the plays it took (`src/server/milestones.ts`). The answer time is mostly typing.
- Only a typed sentence (dictation) has a cause. A difference on the sentence's stretch word is vocabulary; on any other word it is hearing, grammar (the right word, the wrong ending), spelling (i and y, or a consonant written as it is said: *had* for *hat*) or typing (`src/core/listen-analysis.ts`). Add a cause there, with its label and one line, not in the page.
- Missing marks are hearing only when the learner types marks: a sentence typed with none is compared without them. A sentence with only its marks off counts as understood, and one typed after the text was shown is neither understood nor read.
- Nothing is called from a handful of sentences (owner, 2026-11-03: "make sure we have enough data points before analysis"). The causes wait for 50 typed sentences, 15 of them missed, over 3 sessions. A cause is listed from 4 sentences in 2 sessions. A trend needs 30 sentences from 3 sessions in each window and 5 expected sentences with and without the cause, and must pass Holm's correction across all the causes tested together. A change that does not pass reads "no clear change", never "about the same". Fast against slow clips is said only when the z-test passes with 20 sentences in each group; a week under 10 sentences shows no share. The numbers are constants at the top of `src/core/listen-analysis.ts`.
- A Listen rep logs `stretch`, the unmet words as they stand in the sentence. A typed miss without it is not read.
- `/api/listen` passes `answer` through: without it a typed sentence is not graded again, is logged as a meaning, and loses its accents-only half credit.
- The result is `MistakeAnalysis.listening`, shown as a section on My mistakes, from the snapshot; it is local and free. The optional deep read (E40) is the one model call over it.
