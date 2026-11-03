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

Because the sentence's only unmet word is known, a difference on any other word is not a vocabulary gap, which is what makes the split honest. A picked meaning shows only whether the sentence was understood, so it counts toward accuracy and effort but has no cause. That is why Listen became typing-only the same day: the causes need typed sentences, and the owner had already found picking too easy.

Two rules keep the reading from blaming the ear for something else:

- **Marks the learner does not type.** A sentence typed with no marks at all is compared without them. Otherwise a learner who types without háčky and dĺžne would see vowel length and soft consonants at the top of the list, which is a keyboard habit and says nothing about hearing. A sentence with only its marks off counts as understood.
- **Voicing assimilation.** A voiced consonant is said unvoiced at the end of a word and takes the voice of the consonant after it (*had* sounds like [hat], *v škole* like [fškole], *kde* like [gde]). Writing it as heard is a spelling gap, not a hearing one, so a voicing difference at the end of a word or before a consonant is filed as spelling ("Written as it sounds"). One between vowels (*kosa* against *koza*) stays hearing.

## The trends

The last 14 days against the days before, per 100 typed sentences, called "less often" or "more often" only when the difference is past chance, and "no clear change" otherwise. Also shown: understood by week, plays after the first, text shown before answering, and accuracy on slow against fast clips (the slovak.wiki clips run 2.3 to 5.4 syllables a second, so a fast clip is harder whatever the words; [voice-pace.md](voice-pace.md)). It is a section on My mistakes, local and free, saved with the snapshot, and the snapshot is renewed after a Listen session when it is old.

## How much is enough

The first version read causes from 20 typed sentences and compared windows of 6. Both are too few to tell a pattern from chance:

- **A share from a few sentences is a wide guess.** With 20 sentences and a cause in 3 of them, the 95% range is 5% to 36%. With 50 it narrows to roughly 7% to 28% for a cause near 15%: still wide, but it separates a common cause from a rare one. So the causes wait for **50 typed sentences, 15 of them with a miss, over 3 sessions**. Sessions matter because the sentences of one session are not independent: one tired evening is one data point, not ten.
- **A cause is listed from 4 sentences in 2 sessions.** Below that it is counted in "N more differences, not listed".
- **The z-test needs enough in each window.** Its normal approximation is the usual rule of thumb only with about 5 expected sentences with the cause and 5 without in each window, so each window needs 30 sentences from 3 sessions and passes that check, or the trend reads "too few to compare".
- **Many causes, many tests.** Testing a dozen causes at 5% each calls at least one change by chance about 46% of the time (1 − 0.95¹²). The causes are tested together with Holm's step-down correction, which holds that at 5% for the whole set.
- **"No change past chance" is not "the same".** With 40 sentences a window, a halving from 30 to 15 in 100 gives z ≈ 1.6, short of significance. The page says "no clear change", so a real improvement too small to prove is never reported as standing still.
- **Fast against slow clips** is said only when the same z-test passes with 20 sentences in each group, and a week under 10 sentences shows no share.

At ten sentences a session, the causes appear after five or more sessions and the first trend after about three weeks of regular Listen.

## The deep read

The causes and trends are rules and tests, so the figures cannot be wrong in the way a model's prose can. What they cannot do is connect two findings or say what to practice. The deep read is a model call over those figures and nothing else (`src/core/listen-guide.ts`, `src/server/listen-guide.ts`).

How it is kept from saying more than the data does:

- **It is handed called trends, not raw series.** Each cause arrives with "less often (called)", "more often (called)" or "no clear change", from the same Holm-corrected test as the page. The prompt forbids reading "no clear change" as "the same" and forbids calling a trend from the weekly counts, which are shown to it only so it can describe them.
- **Hearing is kept apart.** A word not met is vocabulary, a wrong ending is grammar, a consonant written as said and i against y are spelling, a one-letter slip may be typing. The read must say which a pattern is and, where it is not hearing, send it to the practice that fits.
- **Three more cuts** are worked out locally for it, each said only past chance and with 30 sentences a side: the first half of a session against the second (tiring), short sentences (up to 6 words) against long (9 and more), and the sentences with each cause by week.
- **Written once per set of figures.** The facts have a digest; the same digest reuses the saved read, a new snapshot keeps it, new sentences mark it stale. It needs the same floor as the causes.
- **What the model sees** is the figures and the latest eight misses with what was typed. The card says so before the first call.

## Findings no figure shows alone

The causes and the trends each answer one question. A learner would not see, from them, where in a sentence the misses fall, whether a new word drags the words next to it down, whether the ear is better at the end of a session than at the start, or which single words keep coming back. These are worked out locally (`findInsights`, `findRepeats` in `src/core/listen-analysis.ts`), because they are counting and a test, not prose:

- **Ends and starts.** Each missed word is placed in the first, middle or last third of its sentence and compared with where the words are (a third of the words are not always a third of the sentence). The last or first third is named only when its share of the misses beats its share of the words at z 2.58, with 40 differences to place.
- **A new word costs its neighbors.** Sentences with the stretch word against sentences without one: the share that had another word wrong, with 30 of each, two-proportion test at 2.58.
- **Warm-up or tiring.** The first half of a session against the second, both directions, at 2.58 with 30 sentences a side.
- **Words that keep going wrong.** A word in at least 4 sentences read, wrong in 3 or more and 40% or more of them, over at least 2 sessions; a word only met as the new word is not counted, since that is vocabulary. The page shows what was typed in its place.

The bar is 2.58, not 1.96, because five of them are looked for at once: at 5% each, about one in four profiles would get a false finding from nothing but chance (1 − 0.95⁵ ≈ 23%). Repeated words are a rule, not a test; the thresholds are constants.

The deep read is given these as facts and asked for two more things: `noticed`, the links between figures that the learner could not make alone (a link the facts do not state must say "This may be"), and `tips`, each naming the pattern, cause or finding it answers.

What this does not fix: the model's reply is prose built on small samples, so it can still over-explain a pattern three misses deep. The prompt asks for at least several misses behind a pattern and a one-line statement of limits; the owner has to judge whether its patterns match what they hear.

## Limits

- Until the causes are ready, the page says how far each floor is.
- A typing slip cannot be told from a hearing error by the letters alone: "slip" is one letter off in a way that sounds the same, and a hearing error that happens to be one letter will be filed there.
- The classes are rules, not a model. The deep read (above) is the model call that reads their figures; it is optional.
- Checked on synthetic logs (18 sessions over five weeks) and unit tests; not on a real learner's history.
