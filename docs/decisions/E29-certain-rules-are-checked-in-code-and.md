# E29. Certain rules are checked in code, and every tutor verdict says what backs it (2026-11-01)

**Why:** the owner wants a tutor that "very rarely misleads the student". The accuracy eval ([research/slovak-accuracy-eval.md](../research/slovak-accuracy-eval.md)) found three things:
- Haiku accepted *s sestrou* with the `so` rule in its context.
- Sonnet at low and medium rejected curated, correct sentences.
- Both models were confident when wrong, so a confidence number from the model would mislead too.

**How to apply:**
- **`src/core/slovak-check.ts` checks what a program can check for certain:**
  - vocalized prepositions (`so/zo/ku/vo`)
  - `nie je`
  - Czech letters
  - `budem` with a common perfective infinitive
  - `dva/dve/dvaja` against a gender the lexicon is sure of

  A sentence equal to a curated lexicon example is verified correct. Every rule has a test against the correct sentences models rejected.
- **Every Slovak practice answer reaches the model with a `[Checker …]` note** when the checker has something certain to say (`withSlovakEvidence`, `src/server/chat-handler.ts`). The learner's card shows only what they typed.
- **The tutor has `check_slovak` and `slovak_reference`** (the slovak-language skill's chapters, `.claude/skills/slovak-language`) beside `lookup_word`. `prompts/language/10-slovak.md` tells it to check before marking Slovak wrong, and never to fix a correct alternative.
- **`conclude` carries `evidence`.** `checked` means a tool confirmed the forms the verdict rests on; `judgment` means the tutor's reading, said in the verdict. The concluded card shows "Checked in the dictionary" or "Tutor's judgment, not checked". The label comes from what backs the verdict, never from the model's own confidence.
