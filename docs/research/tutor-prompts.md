# Are the tutor prompts built for language learning?

**Question:** the teacher prompts (`src/agent/prompts/teacher/`) were mostly general tutoring doctrine: derivations from unconditional truths, demos, and research on any subject. Only about 290 words named a language, in `22-language-steps.md`. Vocabulary, sound, listening, drills and spaced recall barely appeared. Are the prompts geared to language learning?

**Answer, before this change:** no. The method asked the tutor to build understanding from axioms and to check each step before building on it. That fits a physics lesson. For Slovak it pushed the tutor toward explanation before production, and it had nothing to say about the words, the sounds, or the review schedule.

## What the prompts now assume

| Claim | Source | Where it lands in the prompts |
|---|---|---|
| Four strands (meaning input, meaning output, language-focused learning, fluency) each take a share of study time. | Nation, I. S. P. (2007). "The four strands." *Innovation in Language Learning and Teaching* 1(1), 2–13. | `05-method.md` opening; the plan's strand choice in `10-planning.md`. |
| Learners need to understand most of the words in a text (around 95–98%) for reading to work. | Hu, M., & Nation, P. (2000). "Unknown vocabulary density and reading comprehension." *Reading in a Foreign Language* 13(1). | Principle 1 in `05-method.md`; the words chosen per plan in `10-planning.md`. |
| Input alone does not produce accurate output; learners need to produce the forms. | Swain, M. (1985). Output hypothesis, in Gass & Madden (eds.), *Input in Second Language Acquisition*. | Principle 2 (try before you are shown) and the production check in `30-question-principles.md`. |
| Noticing a form in context is a precondition for learning it. | Schmidt, R. (1990). "The role of consciousness in second language learning." *Applied Linguistics* 11(2), 129–158. | Predict before the rule in `20-teaching.md` and `28-predictions.md`. |
| Retrieval practice beats re-reading. | Roediger, H. L., & Karpicke, J. D. (2006). "Test-enhanced learning." *Psychological Science* 17(3), 249–255. | Principle 2 and the check-by-production rule. |
| Spaced repetition beats massed practice. | Cepeda, N. J., et al. (2006). "Distributed practice in verbal recall tasks." *Psychological Bulletin* 132(3), 354–380. | Principle 4 (review, not re-teaching) and `add_to_review` at the end of a step. |
| Difficulty that is hard in the good way (desirable difficulties) helps retention. | Bjork, R. A. (1994). "Memory and metamemory considerations in the training of human beings." In Metcalfe & Shimamura (eds.), *Metacognition*. | Principle 3: graded help, the smallest cue first. |
| Corrective feedback is most useful when it prompts the learner to repair rather than handing over the form. | Lyster, R., & Ranta, L. (1997). "Corrective feedback and learner uptake." *Studies in Second Language Acquisition* 19(1), 37–66. | Repair in steps in `20-teaching.md`. |

The sources above are cited from the authors' published work as known to the author of this change. They were **not re-checked** against Crossref or the journals in this change. Check them before relying on a specific number or wording. The evidence-audit note ([evidence-audit.md](evidence-audit.md)) shows how that check was done for the rest of the app.

## What was removed

- The axiom-and-derivation method (unconditional truths, "how could I have discovered this?", the click, "the hedge"). It is a method for building proofs of facts, not for building a language, and it asked the tutor to check every step before building on it, which for a learner who needs many repetitions wastes time.
- The graph language in the planning doc ("minimal tree", "adding edges to the graph"). The plan map (`plan_init`) stays, because the learner sees it. Its nodes are now forms and skills.
- The demo and figure guidance for physics-style instruments. It stays in `50-demos.md` only for language-shaped uses (a case board, a sound chart).

## What is still open

- The prober files (`src/agent/prompts/prober/`) still use the general strand and "binary search" language and mention `list_sessions` and `list_propositions`. Those are the graph tools another thread is removing, and the prober is out of scope here.
- `40-jobs.md` and the `research` tool still describe a general tutor. They are mechanics, so they stay.
- The practice prompts (`src/agent/prompts/practice/`) carry the same general doctrine. Practice is a separate agent and a separate change.
- No learner has yet used the new prompts. The owner should check a few real lessons for whether the tutor now drills forms, uses the words, and does not over-explain.
