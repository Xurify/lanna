# A miss on another word says why the two differ from the app's own data, best source first, and the gap is measured (2026-11-11, branch `fix/review-miss-contrast`)

The owner, after [review-miss-contrasts-with-a-dictionary-sentence](review-miss-contrasts-with-a-dictionary-sentence.md): "should it be plain code though?", then "Can we find ways to further decrease this gap?" [review-miss-contrasts-with-a-dictionary-sentence](review-miss-contrasts-with-a-dictionary-sentence.md)'s card showed the other word in a sentence, but it could not say what tells the two words apart. Before reaching for a model, this uses what the repo already holds.

**Why:** the contrasts were already written. `curriculum/slovak/pairs.json` (Dvojičky) and `curriculum/slovak/mixups.json` (families) hold hand-written rules for ísť/chodiť, kam/kde, sem/tu, aký/ktorý, nikto/niekto, už/ešte and twelve aspect pairs, and the Mix-ups lesson shows them, but Review did not. The lexicon also says more than the card used: its part of speech, a note in a gloss ("to go (habitually)"), and an aspect marked on the whole entry ("to get; to receive (imperfective)").

**How to apply:** the card takes the first of these that exists for the pair (`missWordOf`, `contrastSource`, `src/core/review-miss.ts`):
1. **A curated rule:** the pair's own Dvojičky rule, else its family's (`pairContrastRule`, `src/core/mixups.ts`). It replaces the example sentence. Only for the language the files are written for.
2. **Parts of speech** when both words are open-class and differ ("“vodný” is an adjective…", "This one is the noun voda").
3. **The gloss's own note** on the shared meaning, and an aspect the lexicon puts at the end of an entry ("which also means to get (imperfective)").
4. **A question:** when exactly one of the two sentences shown opens with its word and ends in a question mark ("“Kedy” asks a question: Kedy prídeš?", or "Here it asks a question."). It is said of the sentence shown, never of the word in general, so *ako* in a comparison is never called a question word.
5. **An example sentence** ([review-miss-contrasts-with-a-dictionary-sentence](review-miss-contrasts-with-a-dictionary-sentence.md)), for everything else.

**Measured:** `npm run miss:coverage` counts every pair of lexicon words that share a meaning and that grading does not accept as a variant. On 2026-11-11, for pairs where both words are common (a function word, or rank ≤ 300; 950 pairs): rule 2.3%, parts of speech 15.2%, meaning note 19.8%, question 0.4%, example only 62.3%. Before this, everything past the example was 0%. The script lists the uncovered common pairs, commonest first (v/na, z/od, pre/za, len/iba, krajina/štát…): that list is the queue for new rules in `pairs.json`, written with a source like every other rule there.

**Not done:** no model writes a contrast. The remaining pairs are mostly prepositions and near-synonyms, where a rule written without a source would be a guess; a cached, source-checked note per pair the learner actually mixes up (the mixups record) is the next step, if the queue shows it is needed.
