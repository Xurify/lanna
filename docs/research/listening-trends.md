# Listening trends: why a sentence was missed, and whether that is changing

**Question:** the owner asked whether, after a Listen session, the app can say what and why they have trouble hearing (a gap in vocabulary, the ear, or something else) and show trends over time.

**Date:** 2026-11-03. **Decision:** E38.

## What the log already had, and what it lacked

Each Listen rep logs the sentence, what was typed or picked, the verdict, time to answer, the first playback's length, plays after it, whether the text was shown first, and the sentence's word count. Two things were missing or wrong:

- **The words the learner had not met.** Every sentence has at most one stretch word (95–98% of the words are counted as known), which is exactly what tells a gap in vocabulary from a sound not caught, but it was not logged. It is now (`stretch`, the words as they stand in the sentence). Sessions from before cannot be told apart and are kept out of the causes.
- **Typed answers were logged as picked meanings.** The client sent `answer: "type"` but `/api/listen` dropped the field, so the server never graded a typed sentence again, logged it as kind "meaning" and counted an accents-only answer as wrong (half XP lost). Fixed in the route. The speed model's rule to skip dictation (typing time is not listening time) now takes effect.

## The reading

A typed sentence is aligned with the one played, word by word (a similar word is one substitution, not a drop and an add), and each difference gets one cause (`src/core/listen-analysis.ts`):

| Kind | Causes |
|---|---|
| Vocabulary | the stretch word, whatever the difference looks like |
| Hearing | vowel length (á é í ó ú ý ô ä), soft ľ ň ď ť, š ž č against s z c, voiced against unvoiced (d/t, b/p, z/s, g/k, v/f), a short word dropped (v z s sa si je…), a word not caught, a word added, a different word heard |
| Grammar | the right word with the wrong ending |
| Spelling | i for y (the two sound the same in Slovak) |
| Typing | a one-letter slip that sounds the same |

Because the sentence's only unmet word is known, a difference on any other word is not a vocabulary gap, which is what makes the split honest. A picked meaning shows only whether the sentence was understood, so it counts toward accuracy and effort but has no cause: dictation ("Type it") is what feeds the causes.

## The trends

The last 14 days against the days before, per 100 typed sentences, called "less often", "more often" or "about the same" only when the difference is past chance (the same two-proportion test as My mistakes). Also shown: understood by week, plays after the first, text shown before answering, and accuracy on slow against fast clips (the slovak.wiki clips run 2.3 to 5.4 syllables a second, so a fast clip is harder whatever the words; [voice-pace.md](voice-pace.md)). It is a section on My mistakes, local and free, saved with the snapshot, and the snapshot is renewed after a Listen session when it is old.

## Limits

- The causes need 20 typed sentences with their words logged; until then the page says how many there are.
- A typing slip cannot be told from a hearing error by the letters alone: "slip" is one letter off in a way that sounds the same, and a hearing error that happens to be one letter will be filed there.
- The classes are rules, not a model. An AI guide could read these patterns and say what to practice (as E25 does for lessons); it is not built.
- Checked on synthetic logs (18 sessions over five weeks) and unit tests; not on a real learner's history.
