# E23. Full grammar words and one spelling (2026-11-01)

**Why:** the owner read "acc-fem is locked, I'll use loc as the weak spot" and found it unclear, and saw the same short forms around the app: N/G/D/A/L/I in the grammar atlas, "fem. G/D/L" in a rule, "1st person sg." in the word bank. The app also mixed British and American spelling ("Practise" next to "Practice").

**How to apply:**
- Anything a learner reads, and anything the tutor is given to repeat, names grammar in full words: feminine accusative, locative, genitive plural, 1st person singular. Unit ids (`acc-fem`, `loc`) are code and stay out of prose; where a model must answer with an id, give it the id and the full name side by side, and tell it to say the name.
- The app is written in American English: practice (noun and verb), color, behavior, recognize, analyze, neighbor, favorite, gray. Stored ids keep their old spelling so saved progress does not move (`lx-colours`). `cancelled` stays: it is the one spelling the app uses, and Electron passes it as an error code.
- The lexicon's English glosses come from slovak.wiki through `scripts/merge-lexicon.mjs`, so their spelling is fixed there, not here.
