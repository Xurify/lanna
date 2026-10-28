# Desirable difficulties and LangHarness

*Owner's rule, 2026-10-28: "things should be hard and the user should face
struggle because that is where the learning happens… even though people
like to think they can speedrun or disregard it."* This note is the
standing rule behind every task in the app: **the learner retrieves,
generates or decodes before the app shows anything, and help has a
price.** It records what the research says, where the app was too easy
on 2026-10-28, and what changed.

## What the research says

| Finding | Source | What it means for a task |
|---|---|---|
| Conditions that slow learning during practice (spacing, interleaving, testing, generating) raise long-term retention and transfer; fluent, easy practice feels good and fades. | Bjork 1994; Bjork & Bjork 2011 ("desirable difficulties") | Fast, smooth sessions are a warning sign, not a goal. |
| Retrieving an answer strengthens memory more than re-reading it, and the effect grows with the retention interval. | Roediger & Karpicke 2006; Karpicke & Roediger 2008 | Ask before showing. Every rep is a test first. |
| Even a **failed** retrieval, when followed by feedback, beats being shown the answer first ("pretesting", "productive failure"). | Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009; Kapur 2008 | A wrong attempt is progress. Count it, do not hide the rep behind a hint. |
| Producing the answer (recall) transfers better than recognising it (multiple choice); multiple choice also trains the distractors. | Glover 1989; Kang, McDermott & Roediger 2007; Roediger & Marsh 2005 | Type it where the learner can. Choose only to meet a form, never to prove it. |
| Generating a form from a cue beats reading it (the generation effect), in L2 vocabulary too. | Slamecka & Graf 1978; Joe 1998 | Cue → produce, not show → copy. |
| A miss that is then retrieved again later in the same session is what fixes it ("successive relearning"). | Rawson & Dunlosky 2011; Rawson, Dunlosky & Sciartelli 2013 | Every miss comes back typed before the session ends. |
| Interleaving confusable categories beats blocking, because the learner must pick the rule, not apply the one the block implies. | Rohrer & Taylor 2007; Kornell & Bjork 2008; Pan et al. 2019 (L2 Spanish) | Mix the contrasting cases into a unit's lesson; mix more as the unit is mastered. |
| Explanatory feedback after an error outperforms "right/wrong" alone, and immediate correction after a *retrieval attempt* is fine. | Butler, Godbole & Marsh 2013; Metcalfe 2017 | After the second miss: the answer **and** the rule, automatically. |
| Prompts that make the learner self-correct move grammar; recasts (the teacher just says it right) mostly go unnoticed. | Lyster & Ranta 1997; Lyster & Saito 2010 | After a miss: a cue and one more try, never the answer. |
| Hints should be graded and should cost something, or learners "gaming the system" tap through to the answer. | Aleven & Koedinger 2002; Baker et al. 2004 (ITS "help abuse") | First hint = the smallest cue. A hint lowers the score the rep can earn. |
| Comprehension needs ~95% known words for listening and ~98% for unassisted reading; below that it is not input, it is noise. | Hu & Nation 2000; van Zeeland & Schmitt 2013 | The **input** strand is meant to be easy at the word level. Difficulty there is in decoding at speed, not in vocabulary. |
| Four balanced strands: meaning-focused input, meaning-focused output, language-focused learning, fluency. | Nation 2007 | "Hard" is strand-specific: hard output and study, easy-but-fast input. |

**The rule, in one line:** every rep is retrieval-first; help is graded,
visible and priced; difficulty rises with mastery; the goal is the edge
of ability (a miss every few reps), not a wall.

## The audit (2026-10-28)

What each task asked for, where it was too easy, and what changed.

### Learn lessons (`/lesson`)

Already right: 12 local reps, type-heavy once a unit is practised,
hint-and-retry after a miss (a prompt, not a recast), misses asked again
typed at the end, two neighbouring units interleaved, half XP for a
second-try answer.

Too easy:

1. **The hint gave everything at once.** The first miss showed the
   trigger, the unit's rule and the Estonian/other bridges together, so
   the retry was reading, not retrieving. *Now:* the first miss shows only
   the smallest cue (the trigger word, or which form is wanted). The rule
   and bridges appear with the answer, after the second miss, opened
   automatically (explanatory feedback).
2. **A missed choice was a 1-in-3 guess.** After a wrong pick the wrong
   option was greyed and the learner picked again. *Now:* a missed
   choose rep retries **typed**. Recognition failed, so the retry is
   production.
3. **The English was always on the screen.** Every type/choose rep showed
   the full translation before the attempt, so the Slovak sentence never
   had to be parsed; parsing speed is exactly the first learner's gap. *Now:* once a
   unit is practised, the translation is hidden until the answer. A
   "Meaning" button shows it early and halves the rep's XP (a priced
   hint), the same as the second try.
4. **Difficulty stopped rising at "practised".** *Now* a third stage,
   **strong** (the unit is complete): no choose reps at all, the mix from
   neighbouring units rises from four reps to six, meaning hidden.
5. **Misses read as failure.** The end screen listed them under "Worth
   another look". *Now* it is "What you worked for", because a corrected
   miss is the lesson's best rep, and the relearn cap rose from 3 to 4.

Left as it is, on purpose: the dictionary form (lemma) stays as the cue
for a grammar rep, because the skill drilled is the ending, not the
word; a unit still completes after six lessons of any accuracy, because
72 reps is effort and the plan brings a weak unit back first.

### Review deck (`/review`)

Already right: typed cloze, FSRS-5, "I don't know", accents-only = Hard.

Too easy:

1. **A free hint.** One tap showed lemma and meaning and the rating was
   untouched: a hinted card could be rated Easy. *Now* the hint is graded
   (first tap: the meaning; second tap: the dictionary form) and caps the
   rating: meaning → at most Good, form → at most Hard. The server
   enforces the cap and logs how many hints were used.
2. **Multiple choice forever.** The Choose mode could be left on for every
   card. *Now* a card that has already been retrieved once (state
   "review") is always typed, whatever the mode; Choose is for meeting a
   new or relearning card, and a picked answer is at most Good.

### Listen (`/listen`)

Input strand, so the sentences are meant to be 95%+ known. The
difficulty is decoding at speed. Too easy: **"Show the text" was free and
immediate.** *Now* it appears only after the sentence has been heard
twice, and a peeked sentence is not counted as understood (no XP for it,
and the speed model ignores it, which it already did).

### Watch (`/watch`)

Step mode hides each line and asks "Got it / Not yet"; a line revealed
before the answer counts as "after help", not first-time. Too easy:
**"Meaning" revealed the English and the Slovak in one tap.** *Now* the
meaning needs the Slovak text shown first, so the order is always hear →
read → translate.

### Read (`/read`)

Meaning-focused input at ~97% known words with a tap-to-gloss
dictionary; the questions are multiple choice on meaning only. Left as
it is: the research says this strand should be easy at the word level,
and the dictionary is what makes a 3% unknown text readable. The
struggle here belongs to the Speed task's timed re-read.

### Speak and Speed (`/speak`, `/fluency`)

Output and fluency strands; the Speak thread is adding accuracy
scoring, so nothing changed here. Speak already prompts self-repair
instead of recasting.

### Blitz

Choose-only on a clock: a fluency drill by design (speed of recognition
is the point), worth its 5 XP a rep against 10 for a typed one.

## How "hard" is kept from "punishing"

- The cue after a miss is small but real: the trigger word underlined,
  or the form wanted in plain words.
- The second miss shows the answer with the rule, and the rep comes back
  typed at the end: the learner always gets to finish on a success.
- Nothing is locked behind accuracy: help is priced in XP, not forbidden.
- The input strand stays at 95–98% known words; difficulty rises only in
  the output and study strands, and only as the unit's record rises.
