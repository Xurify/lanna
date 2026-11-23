# Are the tutor prompts built for language learning?

**Question:** the teacher prompts (`src/agent/prompts/teacher/`) were mostly general tutoring doctrine: derivations from unconditional truths, demos, and research on any subject. Only about 290 words named a language, in `22-language-steps.md`. Vocabulary, sound, listening, drills and spaced recall barely appeared. Are the prompts geared to language learning?

**Answer, before this change:** no. The method asked the tutor to build understanding from axioms and to check each step before building on it. That fits a physics lesson. For Slovak it pushed the tutor toward explanation before production, and it had nothing to say about the words, the sounds, or the review schedule.

## What the prompts now assume

| Claim | Source | Where it lands in the prompts |
| --- | --- | --- |
| Four strands (meaning input, meaning output, language-focused learning, fluency) each take a share of study time. | Nation, I. S. P. (2007). "The four strands." _Innovation in Language Learning and Teaching_ 1(1), 2–13. | `05-method.md` opening; the plan's strand choice in `10-planning.md`. |
| Learners need to understand most of the words in a text (around 95–98%) for reading to work. | Hu, M., & Nation, P. (2000). "Unknown vocabulary density and reading comprehension." _Reading in a Foreign Language_ 13(1). | Principle 1 in `05-method.md`; the words chosen per plan in `10-planning.md`. |
| Input alone does not produce accurate output; learners need to produce the forms. | Swain, M. (1985). Output hypothesis, in Gass & Madden (eds.), _Input in Second Language Acquisition_. | Principle 2 (try before you are shown) and the production check in `30-question-principles.md`. |
| Noticing a form in context is a precondition for learning it. | Schmidt, R. (1990). "The role of consciousness in second language learning." _Applied Linguistics_ 11(2), 129–158. | Predict before the rule in `20-teaching.md` and `28-predictions.md`. |
| Retrieval practice beats re-reading. | Roediger, H. L., & Karpicke, J. D. (2006). "Test-enhanced learning." _Psychological Science_ 17(3), 249–255. | Principle 2 and the check-by-production rule. |
| Spaced repetition beats massed practice. | Cepeda, N. J., et al. (2006). "Distributed practice in verbal recall tasks." _Psychological Bulletin_ 132(3), 354–380. | Principle 4 (review, not re-teaching) and `add_to_review` at the end of a step. |
| Difficulty that is hard in the good way (desirable difficulties) helps retention. | Bjork, R. A. (1994). "Memory and metamemory considerations in the training of human beings." In Metcalfe & Shimamura (eds.), _Metacognition_. | Principle 3: graded help, the smallest cue first. |
| Corrective feedback is most useful when it prompts the learner to repair rather than handing over the form. | Lyster, R., & Ranta, L. (1997). "Corrective feedback and learner uptake." _Studies in Second Language Acquisition_ 19(1), 37–66. | Repair in steps in `20-teaching.md`. |

The sources above are cited from the authors' published work as known to the author of this change. They were **not re-checked** against Crossref or the journals in this change. Check them before relying on a specific number or wording. The evidence-audit note ([evidence-audit.md](evidence-audit.md)) shows how that check was done for the rest of the app.

## What was removed and generalized

- The axiom-and-derivation method (unconditional truths, proofs, physics-style derivations) was removed. Language acquisition requires comprehensible input, pattern recognition, and applied production rather than mathematical proofs.
- Hardcoded language references were removed from the core teacher prompts (`system-prompt.md`, `prompts/teacher/*.md`). Core teaching methodology is language-agnostic, while target language specifics are loaded dynamically from `prompts/language/10-<profile>.md` or `curriculum/<profile>/prompt.md` based on `activeProfile()`.
- The DAG map orientation in `10-planning.md` was corrected: `graph TD` renders top-down, with foundational forms at the top and downstream goals at the bottom.
- Turn boundaries were clarified in `20-teaching.md`: turn 1 ends with `type: "predict"`, and turn 2 resolves the attempt in prose before ending with `type: "check"`.
- The prompt instruction cache in `teacher-agent.ts` was made dynamic by keying on active language profile, avoiding stale Slovak prompts when switching profiles at runtime.

## What is still open

- The prober files (`src/agent/prompts/prober/`) still use legacy search language and references to deprecated graph tools. Those are handled in a separate prober refactoring track.
- The practice prompts (`src/agent/prompts/practice/`) maintain their own practice loop.
- Numeric prefixes on prompt fragment filenames (`05-`, `10-`, etc.) remain actively enforced by runtime loaders and test suites (`FRAGMENT_RE = /^\d+-[\w.-]+\.md$/`) to guarantee deterministic composition order and block non-prompt files like `README.md` from leaking into LLM contexts.
