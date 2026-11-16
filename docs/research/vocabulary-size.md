# How many words do I know? The research behind the word check

_Lanna, 2026-11-12. Code: `src/core/word-estimate.ts` (the model and the dictionary marking), `src/server/word-estimate.ts` (the evidence and the check), `src/server/word-check-judge.ts` (the model that marks an answer worded differently), `components/words/word-estimate-panel.tsx` and `components/words/word-check.tsx` (the screens). The same text, shorter, is on the Sources page under "Word check and words you know"._

The owner, looking at the Words page ("18 can recall at 80%+") and at the reader's word card: "Is there a way to check how many words I actually know? We should build a way to estimate or to test ourselves (maybe an AI feature) and it calculates how many words we actually know, and that's something dynamic that grows as we learn and read more."

The first version showed a word and four meanings to pick from. The owner asked how accurate that would be ("I'm skeptical"), then for more research with studies ("we should strive for accurate and science"), then to learn from how Speakly decides which words a learner knows. This note is the result, and the check was rebuilt on it.

## What the app had

| Number                           | What it counts                                                   | Why it is not the answer                                                                       |
| -------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Can recall at 80%+" on Words    | Review cards whose score is 80 or more                           | Counts cards, not words: a learner who knew 2,000 words before the first card still reads "18" |
| Words marked as known            | The reader's "Known" button                                      | Only the words the learner happened to tap                                                     |
| The level check's word stage     | Forty ticked words and eight made-up ones (Meara & Buxton 1987)  | Taken once, in setup; self-report; never updated                                               |
| The words credited on Milestones | The level's band from Milton (2009), or the level check's figure | A figure for a level, not for this learner                                                     |

None of them grows as the learner reads and reviews, and none says how sure it is.

## What the studies say

How each source was read is in the list at the end. "Read" there means the full text; "abstract" means only the abstract.

### 1. The way the question is asked decides the number

| Format                                                          | What the studies found                                                                                                                                                                                                                                                             | Source                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Type the meaning** (meaning recall)                           | The format that tracks reading best: on 100-word tests, recall correlated 0.78 with a reading score, recognition 0.70, "yes, I know it" 0.66 (103 learners). Of four kinds of knowing a word, recalling the meaning was the best predictor of classroom performance (435 learners) | McLean, Stewart & Batty 2020 and its reanalysis; Laufer & Goldstein 2004 |
| **Pick the meaning from options in the learner's own language** | Learners answered 41.9% to 62.7% of the words they could **not** recall. For learners who recalled about 31 of 80 words, four options gave 51 to 54. Size estimates from the two formats differ "often exceeding a thousand words"                                                 | Stoeckel, McLean & Nation 2021, table 1                                  |
| Pick from options in the language being learned                 | 28.3% of the words not recalled                                                                                                                                                                                                                                                    | the same table                                                           |
| Options shown one at a time                                     | 13.9% of the words not recalled                                                                                                                                                                                                                                                    | the same table (Stoeckel & Sukigara 2018, not read)                      |
| **"Yes, I know it"**                                            | Learners said yes to 48.8 of 96 words and could translate 27.1. Made-up words do not catch it: false alarms were about 4% while the overstatement was about a quarter of all answers                                                                                               | Stubbe 2015                                                              |

Why options overstate: not blind guessing, which was "both uncommon and unsuccessful" in interviews (correct 1 time in 7), but ruling meanings out and loose association, which gave 14 right answers of 53 with no knowledge of the word (Gyllstad, Vilkaitė & Schmitt 2015). A learner of very low ability still expects a quarter of a four-option test right (McLean, Kramer & Stewart 2015, 3,373 learners). The authors of the 2015 interview study argue against a correction formula for blind guessing, because that is not what learners do.

For an estimate of the words a learner can read, Stoeckel and colleagues (2019) write that "measures of meaning-recall should be used, or raw VST scores need to be adjusted". Stoeckel, McLean & Nation (2021) reject one fixed adjustment: the ratio depends on how much the learner knows.

**An "I don't know" answer** reduces guesses and also discourages partial knowledge (Zhang 2013, 150 learners). Learners differ in how readily they choose it: a test version with first-language options and "I don't know" tracked recall less well (r = .77) than three versions without that pairing (.88 to .91) (Stoeckel and colleagues 2019, 200 learners).

### 2. How many words must be asked

Gyllstad, McLean & Stewart (2021) tested 103 learners on all 1,000 words of one frequency band and resampled. For a learner at 60%, the 95% range in words out of 1,000 was 296 to 904 with 10 test words, 385 to 815 with 20, 425 to 775 with 30 and 448 to 752 with 40. They recommend "around 30 or more items per 1000-word frequency band". For a 7,105-word dictionary that is about 210 words. A test of 40 random words gives about 15 points either side at 95% by the same arithmetic.

Adaptive tests ask fewer: the Polish Vocabulary Size Test asks 30 words, each matched to the current estimate, and reads the words known from a logistic curve over frequency rank (Fokin, Płużyczka & Golovin 2025). It reports reliability (.95 and .96), not a range in words for one learner. No study read here gives a validated range for one learner from a short adaptive test.

### 3. How far frequency predicts what a learner knows

Frequency correlated r = 0.50 with word difficulty over the first 5,000 words (Hashimoto 2021, 403 learners), explained 36% of it in a replication (Vitta, Nicklin & Albright 2023), and "can approach .80" over a wide range of frequencies with a log transformation (Stewart and colleagues 2022). The age a word is learned at and how fast it is named explain about as much as frequency. Words shared with the learner's first language score higher than their frequency suggests (Albalawi 2024, a review).

So a curve over the logarithm of frequency rank is a fair shape, and a rough one: many words sit far from it.

### 4. The unit and the ceiling

Learners who knew a base word knew its derived forms about half of the time, so a test should count dictionary words (lemmas), not word families (Stoeckel, McLean & Nation 2021, citing McLean 2018). An estimate drawn from a dictionary depends on that dictionary (Nation 1993). The Slovak dictionary here has 7,105 words, so no learner can read more than 7,105.

## What Speakly does

Read from Speakly's own pages and interface text, and from users' reviews. Speakly publishes no method, corpus or study behind any of it.

|                             | Speakly                                                                                                                                                                                                                                                           | Taken into Lanna?                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting test               | About 3 minutes and 20 questions: pick the right sentence in the new language for a phrase in your own, or type what you heard; "I don't know" is offered. The server chooses each next question. The result is one of nine levels, a word count and a percentage | No. Picking among sentences is recognition; a reviewer was placed too high and was told to answer "I don't know" more                                    |
| A word becomes "learned"    | +1 the first time a card is answered right: typing the missing word into a sentence, a writing card, or a speaking card the learner marks "I've learned it"                                                                                                       | Partly there already: a Review card answered in a sentence counts. A right first answer in a lesson does not count yet (see "What is not built")         |
| What "learned" means        | "the number of words you've studied and know passively"                                                                                                                                                                                                           | The same honesty about passive knowledge; the app says the number leans on meaning recall                                                                |
| A second number             | "The percentage describes the average amount of each daily conversation you'd understand with your learned words", with no source                                                                                                                                 | **Yes.** Words and the result now say what share of the dictionary's example sentences the known words make up, each word counted as often as it is used |
| Words known outside the app | Not counted, a reviewer notes                                                                                                                                                                                                                                     | Lanna asks about them: that is what the check is for                                                                                                     |

## What was built, and why this way

**Type the meaning.** The check shows one word and a text field. Nothing is offered to pick from, because that is the format the studies say overstates the most, and recall is the kind of knowing that reading asks for (part 1). It is also the app's own rule P3: recognition to meet a form, production to prove it.

**Who marks the answer.** The dictionary first: an answer is right when every meaning typed is one of the meanings the dictionary gives for that written word (brackets, "to", "a" and "the" set aside; two words written the same way count with either meaning). An answer worded differently goes to the Cheap slot once, with the word, the dictionary's meanings and the answer, and the verdict is kept in `word-check/judgements.json`. This is the design Stoeckel, McLean & Nation (2021) describe: compare with a bank of right answers, and have the rest judged, "as there can be many ways to express the same concept". They mean a person; here it is a model, and the screen says when the model marked an answer. With no model set, such an answer counts neither as known nor as not known.

**"I don't know this word"** is a full answer (the `?` key on an empty field). With nothing to pick from there is little to guess, so the cost Zhang (2013) found, partial knowledge kept back, is the one that remains.

**One number from every kind of evidence.** For each dictionary word the app takes the strongest evidence it has:

| Evidence                             | Counts as                                                                                                 | Label on Words |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------- |
| A Review card answered at least once | The scheduler's chance of recalling it today (FSRS retrievability, 0 to 1)                                | from Review    |
| Marked as known in the reader        | 1                                                                                                         | marked known   |
| Asked in a word check                | 1 if the meaning typed was right, 0 if not; the answer fades toward the curve with a half-life of 60 days | checked        |
| Nothing                              | The curve's chance for a word that common                                                                 | estimated      |

**The curve.** The chance of knowing an untested word falls with the logarithm of its frequency rank: `chance = 1 / (1 + e^-(shift - slope × (ln rank - center)))`, the shape part 3 supports and the Polish test uses. Two numbers are fitted (where the edge is, and how sharp it is). Before any answer the edge sits where the learner's level puts it, with a wide range.

**Only check answers train the curve.** Review cards and marked words are not a random sample: the learner chose them. They count for themselves and teach nothing about the untested words.

**Which words the check asks.** One at a time, chosen after each answer: half near the current edge (where an answer says the most), half spread evenly over the logarithm of rank (so a wrong first guess is found out). Place names, names, grammar words, grim words and the 112 Slovak words whose forms never occur in the dictionary's sentences are never asked.

**How sure.** The app shows "likely between X and Y": an 80% range from the uncertainty of the fitted curve plus the chance spread of every uncertain word. A number is called measured after a whole check of 40 answers. Until about 210 answers (part 2) Words and the result call it a first reading.

**The result shows the evidence.** The range before the check and now as two bars on one scale, and every word asked as a dot placed by how common it is, known words on one line and the others below, with a line at the edge.

**It grows.** Every Review answer, every word marked in the reader and every check changes the number at once. A snapshot per day is kept (`word-check/history.json`).

**Milestones and Watch.** The newest measurement, from the level check or a word check, is the one they credit (`latestMeasuredVocabulary`).

## The marking, tried on 72 answers

`scripts/word-check-judge-eval.ts` sends typed meanings through the check's own marking: 36 answers a marker should accept (synonyms, paraphrases, other grammatical forms, spelling slips) and 36 it should reject (a different meaning, an opposite, the meaning of a look-alike word such as "to be" for _byt_, an answer too broad, several guesses, not a meaning). Results: [word-check-judge-eval/results.json](word-check-judge-eval/results.json).

|                             | Marked | Outcome                                                                                                      |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| By the dictionary           | 4      | all accepted (they were the dictionary's own wording)                                                        |
| By the model, should accept | 31     | 29 accepted, 2 rejected: "improvement" for the verb _zlepšiť_, and "bred" for _chlieb_ (a real English word) |
| By the model, should reject | 36     | 36 rejected                                                                                                  |
| Not in the dictionary       | 1      | not asked                                                                                                    |

`claude-sonnet-5-5`, thinking off, 67 calls, $0.09. The prompt tells the model to reject when unsure, since a wrong accept makes the number too large. **The answers and the expected verdicts were written by the agent that built the check, not by a learner and not graded by a person.** It shows the marker is strict on clear cases; it does not show how it does on what a real learner types.

## How accurate is it? The app's own simulation

`npx tsx scripts/word-estimate-sim.ts` makes learners whose knowledge follows such a curve (four sizes, four slopes from gradual to nearly a step, three wrong starting guesses, twelve runs each), lets them take the check, and compares the estimate with their real size:

| Answers        | About 300 words                | About 900 | About 2,100 | About 4,200 |
| -------------- | ------------------------------ | --------- | ----------- | ----------- |
| 40 (one check) | median error 28%, in range 81% | 22%, 86%  | 12%, 92%    | 8%, 77%     |
| 80             | 16%, 75%                       | 16%, 78%  | 10%, 76%    | 8%, 74%     |
| 160            | 10%, 78%                       | 9%, 85%   | 6%, 90%     | 5%, 77%     |

"In range" is how often the real size was inside the 80% range. This is the best case: the simulated learners follow exactly the kind of curve the app fits, every answer is marked right, and part 3 says real word knowledge scatters far more. The same run with other random draws moved the errors by up to 4 points.

An earlier version of the check offered four meanings. In a smaller run of the simulation, a learner whose picks for unknown words were right 40% of the time (inside the 42% to 63% of part 1) was read at 3 to 10 times their real size under 1,000 words. A correction built on the wrong picks brought a learner who always picks after ruling two meanings out to 1.7 to 2.5 times, still far too high. That, with part 1, is why the options were removed and not corrected.

## What it does not show

- **It was never compared with real learners.** No learner's result was set beside another vocabulary test. Every accuracy figure is from simulated learners or from studies of other tests.
- **The range is probably too narrow.** It holds the uncertainty of the curve and of each word, not the chance that knowledge does not follow a curve over frequency at all (part 3), and not the marker's mistakes.
- **One check is a first reading** (part 2), and the app says so.
- **Words you can work out count as known.** A word shared with a language you know (_investor_, _park_) is typed right at any frequency. For reading that is fair; it also flattens the curve.
- **The studies tested English**, most with Japanese university students. None tested Slovak, Estonian or Russian, a dictionary of this size, or an estimate that mixes check answers with Review cards and marked words.
- **The frequency order** comes from the dictionary's own example sentences, not from a national corpus. Those sentences were written to show every dictionary word, so rare words occur more often than in real text, and the share of uses reads lower than it would on real text.
- **It counts dictionary words (lemmas), not word families**, and never more than the dictionary holds. Typing the meaning of the dictionary form says nothing about recognizing its other forms in a sentence.
- **Written recall only.** It says nothing about hearing a word at speed; Milestones measures that apart.
- **The level check's word stage is still self-report** ("yes, I know it" with made-up words), the format Stubbe (2015) found claims nearly twice what learners can translate. It was not changed here.
- **The numbers that are the app's own choice:** 40 words a check, the half-and-half sampling, the curve's first slope (1.2) and how firmly the first guess is held, the 60-day half-life, the 80% range, a whole check before the number is called measured.

## What is not built

- **A right first answer in a lesson as evidence**, which is how Speakly counts a learned word. The lesson log has it; it is not read yet, so words met only in lessons count by the curve.
- **A comparison on a real learner**: the same learner's check beside a translation test of the same words.
- **A person grading the model's verdicts** on answers a learner really typed (they are kept in `judgements.json` for that).

## Sources

Read in full:

- Stoeckel, T., McLean, S. & Nation, P. (2021). Limitations of size and levels tests of written receptive vocabulary knowledge. _Studies in Second Language Acquisition_ 43(1). doi:10.1017/S027226312000025X
- Gyllstad, H., Vilkaitė, L. & Schmitt, N. (2015). Assessing vocabulary size through multiple-choice formats: issues with guessing and sampling rates. _ITL_ 166(2). doi:10.1075/itl.166.2.04gyl (the sampling section was skimmed)
- Gyllstad, H., McLean, S. & Stewart, J. (2021). Using confidence intervals to determine adequate item sample sizes for vocabulary tests: an essential but overlooked practice. _Language Testing_ 38(4). doi:10.1177/0265532220979562 (from an archived copy of the publisher's page)
- McLean, S., Kramer, B. & Stewart, J. (2015). An empirical examination of the effect of guessing on vocabulary size test scores. _Vocabulary Learning and Instruction_ 4(1). doi:10.7820/vli.v04.1.mclean.et.al
- Stubbe, R. (2015). Replacing translation tests with yes/no tests. _Vocabulary Learning and Instruction_ 4(2). doi:10.7820/vli.v04.2.stubbe
- Stewart, J., McLean, S. & Batty, A. O. (2021). Correlations of modalities of written vocabulary knowledge to listening and reading proficiency: a comparison. _Vocabulary Learning and Instruction_ 10(2). doi:10.7820/vli.v10.2.stewart (the same learners as McLean, Stewart & Batty 2020, with 100-word tests: the source of the 0.78, 0.70 and 0.66 above; not in the app's source list)
- Vitta, J. P., Nicklin, C. & Albright, S. W. (2023). Academic word difficulty and multidimensional lexical sophistication: an English-for-academic-purposes-focused conceptual replication of Hashimoto and Egbert (2019). _The Modern Language Journal_ 107(1). doi:10.1111/modl.12835 (from an archived copy)
- Fokin, D., Płużyczka, M. & Golovin, G. (2025). The Polish vocabulary size test: a novel adaptive test for receptive vocabulary assessment. _Behavior Research Methods_ 57(9). doi:10.3758/s13428-025-02775-3
- Albalawi, A. (2024). Key issues and considerations in measuring vocabulary growth: a methodological review. _Vocabulary Learning and Instruction_ 13(2). doi:10.29140/vli.v13n2.1604

Abstract only:

- McLean, S., Stewart, J. & Batty, A. O. (2020). Predicting L2 reading proficiency with modalities of vocabulary knowledge: a bootstrapping approach. _Language Testing_ 37(3). doi:10.1177/0265532219898380
- Stoeckel, T., Stewart, J., McLean, S., Ishii, T., Kramer, B. & Matsumoto, Y. (2019). The relationship of four variants of the Vocabulary Size Test to a criterion measure of meaning recall. _System_ 87. doi:10.1016/j.system.2019.102161
- Kremmel, B. & Schmitt, N. (2016). Interpreting vocabulary test scores: what do various item formats tell us about learners' ability to employ words? _Language Assessment Quarterly_ 13(4). doi:10.1080/15434303.2016.1237516 (and part of chapter 3 of Kremmel's 2018 Nottingham thesis, which reports the same study)
- Laufer, B. & Goldstein, Z. (2004). Testing vocabulary knowledge: size, strength, and computer adaptiveness. _Language Learning_ 54(3). doi:10.1111/j.0023-8333.2004.00260.x
- Zhang, X. (2013). The I don't know option in the Vocabulary Size Test. _TESOL Quarterly_ 47(4). doi:10.1002/tesq.98
- Stewart, J. (2014). Do multiple-choice options inflate estimates of vocabulary size on the VST? _Language Assessment Quarterly_ 11(3). doi:10.1080/15434303.2014.922977
- Beglar, D. (2010). A Rasch-based validation of the Vocabulary Size Test. _Language Testing_ 27(1). doi:10.1177/0265532209340194
- Hashimoto, B. J. (2021). Is frequency enough? The frequency model in vocabulary size testing. _Language Assessment Quarterly_ 18(2). doi:10.1080/15434303.2020.1860058
- Stewart, J., Vitta, J. P., Nicklin, C., McLean, S., Pinchbeck, G. G. & Kramer, B. (2022). The relationship between word difficulty and frequency: a response to Hashimoto (2021). _Language Assessment Quarterly_ 19(1). doi:10.1080/15434303.2021.1992629

Not read, named above only through a paper that reports them: Stoeckel & Sukigara (2018), McLean (2018), Stoeckel, Bennett & McLean (2016, "Is 'I don't know' a viable answer choice on the Vocabulary Size Test?": the publisher refused the request), Tseng (2016, an adaptive size test: refused). Listed, not checked: Nation, I. S. P. & Beglar, D. (2007). A vocabulary size test. _The Language Teacher_ 31(7); Nation, P. (1993). Using dictionaries to estimate vocabulary size. _Language Testing_ 10(1). doi:10.1177/026553229301000102.

Speakly: its interface text and pages at speakly.me (the placement test, the FAQ, "the science", "method") and users' reviews on the App Store, Trustpilot and two blogs, read 2026-11-12. Speakly's script files change name with each build, so no link to them is kept here.
