# Mix-ups: learning from the wrong word

**Question (2026-11-01).** The owner, looking at a lesson where "Niekto" was typed for "Nikto": are the answers and the mistakes kept, so the app can find the learner's pain points, predict similar ones, test them and help practise them?

**Short answer.** The answers were already kept: every lesson rep in `data/profiles/<lang>/lessons/<day>.jsonl`, every review in `review/log.jsonl`. What was missing was a reading of them at the level of the word. The app measured units (accuracy, first tries, form slips, weak spots), so "Niekto for Nikto" sank into the unit's accuracy. The tutor never saw the pair, and nothing predicted that *nič / niečo* would trip the same learner next.

## What the evidence says

- **Errors are evidence of the learner's system, not noise.** Corder (1967) argued that a learner's errors show the rules they are working with, and that this is where teaching should aim. A wrong word that is itself a real word is the clearest kind: the learner retrieved something, just the wrong neighbour.
- **Look-alike words are a known source of confusion.** Laufer (1988) named "synforms": words that differ by a letter, a prefix or a suffix (*nikto / niekto*, *von / vonku*). Learners confuse them in both comprehension and production, and the confusion persists without explicit contrast.
- **Do not introduce look-alikes together, but do contrast them once one is known.** Tinkham (1993) and Waring (1997) found that learning semantically or formally similar new words in the same set slows learning, because they interfere. That is a reason not to drill a new pair from day one. It is not a reason to keep apart two words the learner already has and already confuses. For those, mixing the confusable cases makes the learner pick by the cue, which is what sticks (Kornell & Bjork 2008; Nakata & Suzuki 2019 for L2 grammar, both already in [desirable-difficulties.md](desirable-difficulties.md)).
- **Errors followed by feedback are learned from.** Metcalfe (2017) reviews the evidence that making an error and then getting the correction helps retention, as long as the feedback comes. The hypercorrection effect (Butterfield & Metcalfe 2001) adds that confident errors are the ones most often corrected after feedback.

## What we concluded

1. **Track the pair, not the word.** A mix-up is a pair of lexicon entries, kept apart from form slips (E18). A slip is the wrong ending of the right word; a mix-up is the right shape of the wrong word.
2. **Only first tries count.** The same rule as E18: the first answer before any cue or peek, and not the end-of-lesson retry. Review counts too, unless a hint came first.
3. **Predict, then test.** A pair belongs to a family when the rule behind it covers other pairs (*ni-* "no-" vs *nie-* "some-": nikto/niekto, nič/niečo, nikde/niekde…). The families are authored data (`curriculum/slovak/mixups.json`), like the Dvojičky pairs (E11), because a rule that is wrong would teach the wrong thing. For a pair no family names, the app applies the same small edit to other lexicon words (ni → nie at the start) and keeps the twins that both exist and have verified sentences. A prediction is a guess, so it is shown as "not tested yet" and tested before it is taught: a two-way choice. Two right first tries clear it; a miss makes it a mix-up. This keeps the numbers honest (P8): the probe tells us whether the prediction held.
4. **Practise the contrast, both sides.** An open mix-up is drilled typed (production, P3), alternating sentences that need each twin, every sentence a verified one that holds only one of the two words (the Dvojičky rule). The family's rule and its Estonian parallel show after a miss, in the Mix-ups lesson and on regular lesson reps of the same words.
5. **Close the loop.** A mix-up is mended after three right first tries since its last miss; any later miss opens it again. The tutor's "This learner" block names the open pairs and the predicted ones, so Speak, Why? and the tutor's own examples can work them in.

## What changed in the app

- `src/core/mixups.ts`: the record, the prediction rules, the Mix-ups lesson and the tutor line. `progress.json` keeps `mixups`; the lesson log has a `mixups` mode.
- `/lesson?mode=mixups`: the Mix-ups lesson. It moves no unit on the path.
- Today: a "Words you mix up" card with the open pairs, the predicted ones and one "Practise them" link. The plan's Strengthen task takes the Mix-ups lesson when there is no weak spot on record.
- Decision E23 in [../DECISIONS.md](../DECISIONS.md).

## Limits

- The lexicon lacks many family members today (nikde, niekde, nikdy, niekedy, nikam, niekam, sem). Their pairs are dropped until the words and three verified sentences exist. The ni-/nie- family drills only nikto/niekto and nič/niečo now.
- The edit rule is a heuristic. It only fires on small edits anchored by two shared letters, and only predicts; it never teaches a rule.
- A mix-up between two forms of different words (nikoho for niekoho) is found only when the given form is in the lexicon's forms.
- Exam picks and Speak corrections do not feed mix-ups yet.
- The guide may suggest pairs no family names (E25). They enter as probes, so the same rule holds: a guess is tested before it is taught.
- The trend is a comparison of two windows of first tries, not a model of learning. It needs five first tries on each side and a ten-point change before it says better or worse. The page is E24 in [../DECISIONS.md](../DECISIONS.md).

## Sources

- Butterfield, B., & Metcalfe, J. (2001). Errors committed with high confidence are hypercorrected. *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 27(6), 1491–1494.
- Corder, S. P. (1967). The significance of learners' errors. *IRAL*, 5(4), 161–170.
- Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychological Science*, 19(6), 585–592.
- Laufer, B. (1988). The concept of "synforms" (similar lexical forms) in vocabulary acquisition. *Language and Education*, 2(2), 113–132.
- Metcalfe, J. (2017). Learning from errors. *Annual Review of Psychology*, 68, 465–489.
- Nakata, T., & Suzuki, Y. (2019). Mixing grammar exercises facilitates long-term retention: Effects of blocking, interleaving, and increasing practice. *The Modern Language Journal*, 103(3), 629–647.
- Tinkham, T. (1993). The effect of semantic clustering on the learning of second language vocabulary. *System*, 21(3), 371–380.
- Waring, R. (1997). The negative effects of learning words in semantic sets: A replication. *System*, 25(2), 261–274.
