# Slipping words: detection, focused drills, and writing a sentence of your own

**Question.** Why do words missed over and over in Review stay invisible to the current "Words that keep slipping" list, and what targeted practice actually helps solidify them without adding habit friction?

**Date.** 2026-11-18

## What the learner's own log showed

Inspecting the active Slovak profile (`99` cards in `review/cards.json`, `277` Review answers across `22` days):

- `99` of `277` Review answers were wrong (`36%`), `18` had diacritic slips, and `160` were exact. `0` hints and `0` multiple-choice picks were used.
- `52` of `99` cards had at least one wrong answer. The worst offenders were missed repeatedly (_tvrdiť_ `8×`, _oznámiť_ `7×`, _záujem_ `5×`, _kšeft_ `4×`, _kšeftovať_ `3×`).
- Yet `leeches(cards, min = 3)` in `src/core/review.ts` surfaced only `2` words. FSRS `lapses` increments only when a card fails from `state === "review"`; repeated misses while `state` is `"new"` or `"learning"` leave `lapses` at `0`.
- `12` cards with recorded lapses were also marked known in `known.json`, so Read and Watch treated actively missed words as known.
- `12` of the last `22` days had `0` XP, and the median Review answer took ~21 s. Any new flow that adds heavy daily friction will be skipped.
- The existing "Words that keep slipping" block on `/review` already promised _"A lesson on them, or a sentence of your own, often helps more than another review"_ — but had no button or drill behind it.

## What published research supports (and what it does not)

1. **Successive relearning beats passive restudy, and retrieval in varied contexts beats memorizing one card's surface cue.**
   - Roediger & Karpicke (2006) and Dunlosky et al. (2013) establish retrieval practice and distributed practice as high-utility strategies.
   - Rawson & Dunlosky (2011, _Journal of Experimental Psychology: General_, 140(3), 283–302) show that successive relearning — re-retrieving missed items to criterion across separate sessions rather than one-shot cramming — produces durable long-term retention.
   - Repeating the exact same cloze sentence teaches sentence-cue matching rather than word retrieval; pulling other verified sentences for the same lemma from the lexicon forces transfer to a fresh context.

2. **Output and sentence composition deepen lexical encoding, with real caveats.**
   - Swain (1985) argues that producing output forces learners to notice gaps in vocabulary and grammar that comprehension lets them bypass.
   - Laufer & Hulstijn (2001, _Applied Linguistics_, 22(1), 1–26) proposed the Involvement Load Hypothesis (Need, Search, Evaluation), predicting that tasks requiring learners to evaluate how a target word fits an original sentence outperform receptive or fill-in-the-blank tasks alone.
   - Yanagisawa & Webb (2021, _Studies in Second Language Acquisition_, 43(3), 487–520) meta-analyzed 42 studies of the Involvement Load Hypothesis: involvement load predicted retention, and **evaluation** (especially strong evaluation, such as original sentence writing) was the strongest predictor — _when time on task was not held constant_. Original sentence writing takes more time per word than cloze retrieval, so it pays off most on a small handful of stuck words rather than as a mandatory step for every word.
   - Metcalfe (2017) shows corrective feedback after an error helps repair memory, provided the feedback is accurate. Our own Slovak accuracy evaluation (`slovak-accuracy-eval.md`) shows small models can falsely reject valid Slovak sentences; therefore deterministic checks run first, the model is instructed to accept (`ok: true`) when unsure, and verdicts are cached locally.

3. **Self-declared "known" marks diverge from tested recall.**
   - Stubbe (2015) and our own `common-words.md` / `vocabulary-size.md` notes keep self-reported marks separate from tested recall. Once tested Review recall repeatedly fails on a word, keeping its manual `known` mark active contradicts direct evidence and hides the word from reading glosses and watch pre-teach.

## Design choices (what is the app's own decision, not a study's)

- **Slipping-word detection (`src/core/slipping.ts`):**
  - Reconstructs the target word's own verdict on multi-word Review blanks (`words > 1`) so missing a neighboring hidden word does not falsely mark the card's word as slipping.
  - Enters when a non-suspended card has `>= 2` wrong answers on its target word (or `card.lapses >= 2`).
  - Graduates off the list only after **`>= 2` clean, unassisted (`!hints && !picked`, `rating >= 3`, exact target word) recalls on distinct local days** after the last wrong answer (or `state === "review"` with `stability >= 7` days and at least one clean post-wrong recall on a later day). Same-day relearning does not clear a slipping word; a relapse resets the clean streak to `0`.
  - Replaces `leeches(...)` in both `reviewStatus` and `reviewDigest`.
- **Entry points without clutter:**
  - Upgrades the existing `/review` caught-up "Words that keep slipping" section with a `Practice slipping words` button (`/lesson?mode=slipping`).
  - Adds one action row in `/mistakes` ("Do this next") when slipping words exist, so learners who leave Review with cards still due can still launch the drill.
  - Keeps Today (`/`) and the active Review miss dock untouched.
- **Focused slipping drill (`/lesson?mode=slipping`):**
  - Caps each round at `6` slipping words (`10–14` reps), deprioritizing words already drilled today so another round rotates cleanly.
  - Opens with a meaning check when a word has blank ("I don't know") misses or `>= 3` misses, inserts a mix-up contrast when an open mix-up exists, and ends each word with a typed cloze on a _different_ lexicon sentence from the Review card whenever one exists.
  - Does **not** mutate FSRS card memory or immediately graduate the word; only real delayed Review recall proves retention.
- **Skippable "Use it" sentence-writing step:**
  - Shown inline on the slipping drill's end screen for up to `3` words (words missed in the round first, then highest-priority slipping words), hidden when no cheap AI model is configured.
  - Extracts a language-safe shared sentence checker (`src/core/sentences.ts`, `src/server/sentences.ts`, `src/store/sentences.ts`) from Watch: gates Slovak-specific checks on `langTag.startsWith("sk")`, checks known lexicon `forms` / `declension` alongside stem prefixes so suppletive verbs (_ísť → šiel_) are not falsely rejected, and caches verdicts in `data/profiles/<language>/sentences.jsonl`.
- **Resolving the known-mark conflict:**
  - `answerReview` automatically unmarks a slug in `knownWordStore` when the card lapses from `"review"` or enters slipping (`>= 2` target wrongs), invalidating cached coverage.
  - `knownWords()` in `src/server/reading.ts` also subtracts active slipping slugs from `known` and `expected` after frequency-band additions so stuck high-frequency words still get glossed in Read and pre-taught in Watch.
