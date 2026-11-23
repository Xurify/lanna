# Evidence audit: does each feature say only what its research supports?

_Lanna, 2026-11-06, branch `feat/sources-and-speed`. Decision: E63. Code: `src/core/sources.ts`, `components/sources/`, `app/sources`, `scripts/check-sources.ts`, `tests/sources.test.ts`._

## Why

The owner asked for two things: keep the Speed page and make it better, and link the sources behind the exercises and features, "whether it's on the actual page itself or somewhere in the sentences", then analyze everything and fix the issues. Before linking anything, each feature was read against the studies it cites (or should cite). The question for each was the same: **does the app say more than the study did, and does a number that looks like research come from the app?**

## How it was done

- Five read-only passes, one per cluster of features: Speed; Listen, Read, Watch; Speak, Catch, Review, mix-ups, words; lessons, placement, the plan and strands, milestones, hours; motivation and habit (stamps, streak, Today's line, "where you are"). Each read the code and the copy and the research note and listed claims, sources, what the sources do not say, bugs, and better sources.
- Every DOI in the registry is looked up on Crossref (`npm run sources:check`): the record must exist and carry the same title and an author named in the citation. **97 sources; 91 have a DOI and all 91 match.** Four more have their abstract read against the claim made here (Lambert, Kormos & Minn 2017; de Jong & Perfetti 2011; Boers 2014; Thai & Boers 2016, the Speed set). Six are books or chapters with no DOI we could confirm; they are listed, not linked, and the page says so.
- What this is not: a systematic review. Most entries were checked for existence and attribution, not read in full. The "what it found" lines on the pages are the ones we are sure of; where we were not, the line is left out.

## What the audit found, by feature

"Supported" means the main claim stands as worded. "Partly" means the research supports the design but the wording or the number goes past it. "Ours" means no study stands behind the number; it is the app's choice and the page now says so.

| Feature | Claim in the app | What the research supports | Verdict | What changed |
| --- | --- | --- | --- | --- |
| Say it faster | The shrinking window builds automaticity | Repeating the same content raises fluency on that content (de Jong & Perfetti 2011; Lambert et al. 2017; Thai & Boers 2016). Tighter time limits added nothing and could cost accuracy (Boers 2014; Thai & Boers 2016). No transfer to new sentences is shown | Partly | Window kept on purpose (owner's call). Page says the repetition is what is supported. A spoken pass counts only if clear. Self-timed rounds say so. A recording with no voice does not count. Pace shown as repetition on the same lines |
| Say it faster | "About 2.3 words a second", "Paul Nation's 4/3/2" | The last window asks for 1.4 to 1.9 words a second. 4/3/2 is Maurice 1983 and Nation 1989 | Wrong | Comments, plan description and note corrected |
| Read it faster | Target by level, then your last time; bonus for faster | Timed re-reading raised speed on practiced texts (Chang 2010; Taguchi et al. 2004). The level targets are not from a study | Partly / ours | First target labeled a guess; later target is the middle of the last three; speed bonus only with the question right and under 450 words a minute |
| Today's line | The change between hearings is the measure | The pretesting and curiosity effects are about memory for an answer. The second hearing follows the sentence being shown | Partly | "Morning/evening" became "first/second hearing"; the "+N since this morning" pill became "+N on the first hearing"; a caption says the rise shows memory, not listening growth |
| Lessons | Interleaving "is what makes the choice stick" | Mixed for language material; a meta-analysis found no benefit for word learning. Retrieval beats restudy (Rowland 2014) | Partly | Note on the page; comment softened |
| Review | Spaced repetition | Spacing helps L2 vocabulary (Cepeda 2006; Kim & Webb 2022). FSRS is a community model benchmarked by its authors | Supported / partly | Note names both |
| Listen | 95% known words | About 95% for listening (van Zeeland & Schmitt 2013); the app picks at 93% | Ours | Floor labeled the app's choice |
| Placement | X_Lex style check | A short yes/no check estimates size roughly (Meara & Buxton 1987; Huibregtse et al. 2002). Ours has 40 words and 8 made-up words | Partly | Result says "a rough size from 40 words, off by a fifth or more"; note on the page |
| Strands | A quarter each | Nation's guideline for a course, not a tested optimum. A real day here is about half form-focused | Wrong as worded | Copy now says what Nation suggests; the plan itself is unchanged |
| Milestones | Counts and thresholds | Coverage counts from Nation 2006, Webb & Rodgers 2009, Adolphs & Schmitt 2003. No source gives words a minute per CEFR level; the lemma factor, support factors and ladder are the app's | Partly / ours | Sources panel open by default, lines for Segalowitz, DeKeyser and the conversation figure corrected, the children row says "no study behind this row", note on the page |
| Where you are, dated scenes | A limit named, a date projected | Attribution and belonging interventions show small effects that shrank at scale (Wilson & Linville 1982; Yeager 2016; Sisk 2018). A vivid future self helps if there is a plan (Magid & Chan 2012); positive fantasy alone can lower effort (Oettingen & Mayer 2002) | Partly | "Behind" became "Later than the date"; the projection says it is from the last 14 days and not a promise; the speed line says speed grows with Listen and Watch hours; "0 days left" says "today" |
| Hours | Between Cambridge and FSI figures | Classroom hours for English and for diplomats, not self-study. The head start is the app's subtraction | Partly / ours | The Cepeda line corrected (317 experiments in 184 articles, mostly lab recall) and softened; note on the sheet |
| Streaks, stamps | Streaks work; stamps are outcomes, never time | Habit formation is slow and forgiving (Lally 2010). Streak figures are company data. 42 stamps include reviews, listens and hours | Partly | gamification.md finding 6 renamed "company data, correlational"; Lally's range and "materially" corrected; the stamp book says some stamps count practice |
| Catch, mix-ups | Hypercorrection; confusable pairs | Confusable words are harder together (Laufer 1988; Waring 1997). Hypercorrection is a lab effect on trivia | Partly | Note on the page |
| Speak | Prompts beat recasts | Classroom studies: prompts at least as good (Lyster & Ranta 1997; Lyster & Saito 2010); not shown for an AI tutor | Partly | Note on the page; research note reworded |

Listen, Read, Watch, Review, Words and the rest are in "Fixed in the follow-up pass" below.

## Bugs the audit found in the Speed page (fixed)

1. **A pass counted with no voice.** With the microphone on, a clip that came back with nothing heard (or no score) fell through to "time alone decides" and counted as made. Now: nothing heard means no pass; a failed or late check counts by time and says "the check did not come back".
2. **The pronunciation report never saw Speed.** The API dropped each pass's score on the way to the log, so "sounds to work on" was built from Speak only. The route now keeps the score, the window flag, the unchecked flag and the speaking time.
3. **The silence tail was the learner's time.** The recorder stops 650 ms after the voice does; that tail was added to the pass. Now it is subtracted.
4. **"Mic off" with no reason.** The toggle was disabled with a tooltip. Now a line says which of three reasons applies (no speech-to-text key, a browser that cannot record, a blocked microphone) and links to the key settings. The key list now includes Groq, which the engine already supported.
5. **Speed paid without understanding.** Read it faster paid the faster bonus even when the question was wrong, and any speed counted. Now the bonus needs the right answer and a plausible pace.
6. **Labels that claimed more than they measured.** "Made it! Faster! Full speed!" on a self-timed button press; "clear" meant 70 while the chip said "Mostly clear". Self-timed passes read "In time"; the threshold reads "clear enough (70+)".

## Fixed in the follow-up pass

Each item was confirmed in the code before it was changed.

- **Listen:** "Understood" is "Typed correctly" (it meant the typed answer matched). The 93% floor is labeled the app's own choice, below the study's roughly 95%. Real bug: the listening-error classifier counted `ô` and `ä` as vowel length and did not treat `h`/`ch` as a voicing pair; `ô` is now a diphthong cause, `ä` a spelling cause, and `h`/`ch` voicing. Stale copy about picking "what it meant" corrected. A dead `dailyGoal: 50` fallback removed.
- **Read:** the known-words percentage is labeled as the app's own count of words it counts as known; the "Understood" tile is "Questions right" (also on Watch); the research note's sentence counts match the code; "Extensive Reading" is "Graded Reading".
- **Watch:** an attribution that claimed more than the coverage study says, and a "sticks far better" claim, are corrected; "Got it" is "Got it (my call)" with a tooltip; lines from automatic captions are no longer queued for the deck; words sent from Watch are capped at 12. Machine transcription (Deepgram) is still included, because skipping it would switch the feature off for most Slovak videos; that is the owner's call.
- **Review:** after a wrong answer or "I don't know", only Again can be chosen (`ratingCeiling`; the buttons are disabled, not removed).
- **Mix-ups and Catch:** a review answer on a card being relearned after a miss no longer counts as a first try; a pair is mended only after correct answers on at least two different days (records mended before this show as open again until two days are counted); the constants say they are the app's own; stale Catch comments and the dead "slip" paragraph removed; the hypercorrection claim is now "makes the design plausible".
- **Words:** "Words known" is "Words you can recall" on Today, Words and the trail log, with a line saying what it counts (review-deck cards the scheduler predicts you recall at 80% or more, answered at least once).
- **Speak:** the Lyster claims are softened everywhere they appear; the literal 85 and 70 clarity cutoffs use `PRON_GOOD` and `PRON_CLEAR`; tutor verdicts are labeled as the tutor's; the provider label names Groq.
- **Lessons and hours:** the interleaving comment is softened; the completion, test-out, mix-slot and rep-count constants say they are the app's policy; a comment no longer names Estonian as the assumed known language.
- **Streak:** a streak intact through a forgiven rest day now still shows the next morning; stamp lines say "streak days" and not "in a row". Other places still say "days in a row" (`charts.tsx`, `today.tsx`, `lesson-player.tsx`).

## Still open (ranked)

1. **The plan is not balanced by Nation's own rule.** A full day is about 45% form-focused study and about 10% fluency. The copy no longer says otherwise; rebalancing the plan, and deciding whether Blitz (speeded form recognition) belongs in the fluency strand, is a product decision for the owner.
2. **Placement has no error bar and its reliability was not redone for the new ladder.** The vocabulary check measures written recognition of the top 5,000 lemmas, then feeds listening thresholds.
3. **Milestones.** The conversation figure (2,500) is a midpoint between two sources; the credited vocabulary per level may double-apply a lemma factor; the map stops at B2 so a C1 target cannot be reached from it; a "this is the app's own choice" tag on every assumption in the cards is not built, only in the sources text.
4. **Hours.** The "no head start" branch changes the wording but not the dates; the pace is averaged over fourteen days in one place and over active days in another.
5. **Stamps and streak.** Stamp names and `lang="sk"` are hard-coded to Slovak; "longest streak" mixes the strict and the forgiving rule; "days in a row" is still on three screens; DECISIONS.md has two E50 entries.
6. **Speed beyond this branch.** A priced peek (hide the text on passes 2 and 3), a repeat of the same lines on a later day (the strongest repetition evidence is spaced), and showing accuracy beside speed over time are good next steps and are not built.
7. **Creator-hooks claims** that attribution retraining and a future-self picture "work" for adults on a language app: no study tests that. The stage sentence names a limit and now says speed moves with hours, but it does not retrain attribution.

## Sources not read in full, by name

Nation 2007 and Chang 2010 (Speed) could not be opened (publisher blocks); their lines on the pages are limited to what the abstracts and our notes state. Pan et al. 2019 and Aleven et al. 2006 are cited as "not a clean win" and "from maths tutors" from the abstracts and the audit's reading; read them before leaning on those two lines.
