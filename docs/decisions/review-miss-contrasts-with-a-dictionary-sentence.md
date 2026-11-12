# A miss on another word contrasts the two words with a dictionary sentence, not with two glosses (2026-11-11, branch `fix/review-miss-contrast`)

The owner, on "Kedy" typed for "*Keď* bolo pekne, išli sme von.": "Is this a good explanation?", then "we should make sure this logic actually works well, like in a variety of cases". The card said "“Kedy” means when: a different word. This one is keď, when (conjunction)." It gave the same meaning twice and never said what tells the two words apart.

**Why:** an audit of the real lexicon found the same pattern for every pair of words that share a meaning (kedy and keď, len and iba, tu and sem, ísť and chodiť), plus three wordings that were wrong: an answer typed without its accents read as "a form of" its own dictionary form ("Ked" is a form of keď), an unknown word gave nested brackets ("not a form of keď (when (conjunction))"), and a word that never takes an ending (keď, potom) was described with endings ("not a form of", "potom with another ending").

**How to apply:**
- **No model and no hand-written rule.** The contrast is one of the other word's own lexicon sentences with its translation: the shortest one that contains the word as typed, otherwise the shortest. Rejected and untranslated sentences are never shown (`contrastExample`, `src/core/review-miss.ts`). Every claim on the card comes from the lexicon, so nothing here is a grammar rule written from memory.
- **A shared meaning is named:** when the two glosses share a sense, notes in brackets aside (`sharedMeaning`), the card says "“Kedy” also means when, but it is another word." instead of giving the meaning twice.
- **Spelling:** a word typed without its accents is named by its dictionary spelling ("“Ked” is keď, which also means when"), not called a form of it.
- **Words that never take an ending** (no known forms, and not a noun, verb or adjective) get no stem guess and no "not a form of"; the card says "The word here is keď, when (conjunction)."
- **Tested on real cases:** `tests/miss-why.test.tsx` runs fourteen lexicon cases through the server and the rendered card.
- **Not changed:** what is graded right. *len* for *iba* is still a miss; whether such pairs count as the same answer is a grading decision for `src/core/variants.ts`, which already accepts *lebo* for *pretože*.
