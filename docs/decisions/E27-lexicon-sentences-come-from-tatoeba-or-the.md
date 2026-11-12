# E27. Lexicon sentences come from Tatoeba or the owner's curated text, never from a model (2026-11-01)

**Why:** the mix-up families could not drill nikde, sem, aj and similar words, because slovak.wiki's frequency lists are open-class and never made them rows. Filling the gap is a data change, so it has to meet P8 and E26: no sentence a learner drills comes from a model.

**How to apply:**
- Examples are Tatoeba sentences (CC BY 2.0 FR, with the tatoebaId kept) or the owner's own curated sentences. `scripts/dictionary/tatoeba-api-examples.ts` in slovak.wiki applies the wiki's gates: the token must be the word, the sentence must pass the corpus-quality check, reviewer rejects stay rejected, and an English translation is required.
- Verbs are not filled that way. A stem search returns homographs (the stem of vládať also gives vláda, the government), and Tatoeba has few sentences for most verbs. Verb coverage needs its own method.
- A word the owner blocks in `src/lib/catalog/frequency/blocklist.ts` stays out, even when its sentences exist (pohlavie, členný, posledne, naviac, vše, pro, mam, cup, sex).
- A word with fewer than three usable sentences is not a drill. It is a row, not a lesson, and the thin-word count in the lexicon says so.
