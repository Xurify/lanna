# How many words do I know? The research behind the word check

*LangHarness, 2026-11-12. Code: `src/core/word-estimate.ts` (the model), `src/server/word-estimate.ts` (the evidence and the check), `components/words/word-estimate-panel.tsx` and `components/words/word-check.tsx` (the screens). The same text, shorter, is on the Sources page under "Word check and words you know".*

The owner, looking at the Words page ("18 can recall at 80%+") and at the reader's word card: "Is there a way to check how many words I actually know? We should build a way to estimate or to test ourselves (maybe an AI feature) and it calculates how many words we actually know, and that's something dynamic that grows as we learn and read more."

## What the app had

| Number | What it counts | Why it is not the answer |
|---|---|---|
| "Can recall at 80%+" on Words | Review cards whose score is 80 or more | Counts cards, not words: a learner who knew 2,000 words before the first card still reads "18" |
| Words marked as known | The reader's "Known" button | Only the words the learner happened to tap |
| The level check's word stage | Forty ticked words and eight made-up ones (Meara & Buxton 1987) | Taken once, in setup; self-report; never updated |
| The words credited on Milestones | The level's band from Milton (2009), or the level check's figure | A figure for a level, not for this learner |

None of them grows as the learner reads and reviews, and none says how sure it is.

## What the research says about measuring vocabulary size

1. **Sample and scale up.** A size test cannot ask every word. The Vocabulary Size Test asks ten words from each thousand-word frequency level and multiplies (Nation & Beglar 2007; Beglar 2010). The estimate is only as good as the sample: with few words per level it is imprecise, and a higher sampling rate is needed to represent what a learner knows (Gyllstad, Vilkaitė & Schmitt 2015; Stoeckel, McLean & Nation 2021).
2. **Multiple choice overestimates.** Guessing and test strategies on multiple-choice formats lead to overestimated scores (Gyllstad, Vilkaitė & Schmitt 2015; Stoeckel, McLean & Nation 2021). Zhang (2013) studied an "I don't know" option on the Vocabulary Size Test and Stewart (2014) asked whether its options inflate the size; both papers were confirmed to exist, and their results were **not read**, so the app claims nothing from them beyond what the two papers above say.
3. **Recognizing is easier than recalling.** Tests where the learner recalls the meaning correlate with reading proficiency more strongly than tests where the meaning is recognized (McLean, Stewart & Batty 2020, from 103 test-takers and simulated tests). Laufer & Goldstein (2004) test four kinds of knowing a word, from recognizing a meaning to producing the form.
4. **A dictionary sets the ceiling.** An estimate drawn from a dictionary depends on that dictionary (Nation 1993 sets out the procedures such estimates need). The Slovak dictionary here has 7,105 words, so no learner can read more than 7,105.

## What was built, and why this way

**No model call.** The owner floated an AI feature. Everything here is decided by code (P7): which word to ask, which meanings to offer, whether the pick is right, and the arithmetic. The check is free, instant and works with no key.

**One number from every kind of evidence.** For each dictionary word the app takes the strongest evidence it has:

| Evidence | Counts as | Label on Words |
|---|---|---|
| A Review card answered at least once | The scheduler's chance of recalling it today (FSRS retrievability, 0 to 1) | from Review |
| Marked as known in the reader | 1 | marked known |
| Asked in a word check | 1 if the right meaning was picked, 0 if not; the answer fades toward the curve with a half-life of 60 days | checked |
| Nothing | The curve's chance for a word that common | estimated |

**The curve.** The chance of knowing an untested word falls with the logarithm of its frequency rank: `chance = 1 / (1 + e^-(shift - slope × (ln rank - center)))`. Two numbers are fitted (where the edge is, and how sharp it is), so 40 answers already say something. Before any answer the edge sits where the learner's level puts it (the same credit Milestones used), with a wide range.

**Only check answers train the curve.** Review cards and marked words are not a random sample: the learner chose them. They count for themselves and teach nothing about the untested words. The check draws only from words with no evidence, so its answers are a fair sample of exactly the words the curve is used for.

**Which words the check asks.** One at a time, chosen after each answer: half near the current edge (where an answer says the most), half spread evenly over the logarithm of rank (so a wrong first guess is found out). Three wrong meanings come from words of the same part of speech and similar frequency whose meaning shares no word with the right one. Place names, names, grammar words, grim words (the level check's own filter) and the 112 Slovak words whose forms never occur in the dictionary's sentences (their place in the frequency order is not reliable) are never asked.

**"I don't know this word"** is a full answer with its own key, and the screen says why: a lucky guess counts as a word known.

**The range.** The app shows "likely between X and Y": an 80% range from the uncertainty of the fitted curve plus the chance spread of every uncertain word. Each check narrows it.

**It grows.** Every Review answer, every word marked in the reader and every check changes the number at once. A snapshot per day is kept (`word-check/history.json`), so the page can say what the number was earlier.

**Milestones and Watch.** The newest measurement, from the level check or a word check, is the one they credit (`latestMeasuredVocabulary`).

## How accurate is it? The app's own simulation

`npx tsx scripts/word-estimate-sim.ts` makes learners whose knowledge follows such a curve (four sizes, four slopes from gradual to nearly a step, three wrong starting guesses, twelve runs each), lets them take the check, and compares the estimate with their real size:

| Answers | About 300 words | About 900 | About 2,100 | About 4,200 |
|---|---|---|---|---|
| 40 (one check) | median error 28%, in range 81% | 22%, 86% | 12%, 92% | 8%, 77% |
| 80 | 16%, 75% | 16%, 78% | 10%, 76% | 8%, 74% |
| 160 | 10%, 78% | 9%, 85% | 6%, 90% | 5%, 77% |

"In range" is how often the real size was inside the 80% range. This is the best case: real learners do not follow a clean curve, and a learner who really guesses will read high. The range is the app's own arithmetic and holds the real size 74% to 92% of the time here, not always the 80% it aims at.

## What it does not show

- **It leans high.** Picking a meaning from four is easier than recalling it while reading (point 3). A typed-meaning check judged by the Cheap slot would be stricter; it is not built.
- **It counts dictionary words (lemmas), not word families**, and never more than the dictionary holds. The published thresholds (Nation 2006) are in English word families.
- **Written recognition only.** It says nothing about hearing a word at speed; Milestones measures that apart.
- **The frequency order** comes from the dictionary's own 30,000 example sentences, not from a national corpus.
- **Estonian and Russian** use the same code on their own dictionaries; only the Slovak one was looked at.
- **The numbers that are the app's own choice:** 40 words a check (the size of the level check's word stage), the half-and-half sampling, the curve's first slope (1.2) and how firmly the first guess is held, the 60-day half-life, the 80% range, 12 answers before the number is called measured.

## Sources

- Beglar, D. (2010). A Rasch-based validation of the Vocabulary Size Test. *Language Testing* 27(1). doi:10.1177/0265532209340194 (DOI checked, not read)
- Gyllstad, H., Vilkaitė, L. & Schmitt, N. (2015). Assessing vocabulary size through multiple-choice formats: issues with guessing and sampling rates. *ITL* 166(2). doi:10.1075/itl.166.2.04gyl (abstract read)
- Laufer, B. & Goldstein, Z. (2004). Testing vocabulary knowledge: size, strength, and computer adaptiveness. *Language Learning* 54(3). doi:10.1111/j.0023-8333.2004.00260.x (DOI checked, not read)
- McLean, S., Stewart, J. & Batty, A. O. (2020). Predicting L2 reading proficiency with modalities of vocabulary knowledge: a bootstrapping approach. *Language Testing* 37(3). doi:10.1177/0265532219898380 (abstract read)
- Meara, P. & Buxton, B. (1987). An alternative to multiple choice vocabulary tests. *Language Testing* 4(2).
- Milton, J. (2009). *Measuring Second Language Vocabulary Acquisition*. Multilingual Matters.
- Nation, I.S.P. (1993). Using dictionaries to estimate vocabulary size: essential, but rarely followed, procedures. *Language Testing* 10(1). doi:10.1177/026553229301000102 (DOI checked, not read)
- Nation, I.S.P. & Beglar, D. (2007). A vocabulary size test. *The Language Teacher* 31(7). (no DOI found; listed)
- Stewart, J. (2014). Do multiple-choice options inflate estimates of vocabulary size on the VST? *Language Assessment Quarterly* 11(3). doi:10.1080/15434303.2014.922977 (DOI checked, result not read)
- Stoeckel, T., McLean, S. & Nation, P. (2021). Limitations of size and levels tests of written receptive vocabulary knowledge. *Studies in Second Language Acquisition* 43(1). doi:10.1017/S027226312000025X (abstract read)
- Zhang, X. (2013). The I don't know option in the Vocabulary Size Test. *TESOL Quarterly* 47(4). doi:10.1002/tesq.98 (DOI checked, result not read)
