# Writing with words you keep missing

**Question.** How can repeatedly missed Review words become useful in original writing, without another drill or more daily friction?

**Date.** 2026-11-18

## Learner evidence

A read-only inspection of the Slovak profile found 99 cards and 277 answers across 22 days. Of those answers, 99 were wrong (36%). Repeated misses included _tvrdiť_ (8), _oznámiť_ (7), and _záujem_ (5). The old lapses-only list surfaced two words: FSRS does not increment lapses for every failure while a card is new or learning.

The owner wanted a writing exercise containing those words, not a separate sentence box for each word. The Review log already supplies the targets; a second cloze sequence would duplicate Review.

## Evidence and limits

- Rawson & Dunlosky (2011), “Optimizing schedules of retrieval practice for durable and efficient learning”: delayed, repeated retrieval supports retention. Finishing one writing task is not evidence of durable recall.
- Laufer & Hulstijn (2001), “Incidental vocabulary acquisition in a second language: The construct of task-induced involvement,” _Applied Linguistics_: evaluating how words fit an original context motivates productive use.
- Yanagisawa & Webb (2021), a meta-analysis of the Involvement Load Hypothesis: evaluation predicts vocabulary retention, but composition takes longer. This does not establish that writing is more efficient than retrieval when time is held equal.
- Metcalfe (2017), “Learning from errors,” _Annual Review of Psychology_: corrective feedback can support learning. Our [Slovak accuracy evaluation](slovak-accuracy-eval.md) also shows the risk of false model corrections.

These sources motivate a small optional output task, not a validated learning intervention. The target count and graduation thresholds below are product choices, not research-derived constants.

## The implemented task

- Detect repeatedly missed words from existing Review answers, including new/learning failures. Group cards by word and reconstruct the target's verdict for multi-word blanks.
- Include non-suspended words with at least two target misses or two recorded lapses. Remove them after two exact, unassisted recalls rated at least 3 on distinct local days, each at least 12 hours after the latest miss. Another miss resets those clean days.
- Review's caught-up section and Mistakes link to `/write`. Today and the active Review exercise stay unchanged.
- Ask for one short connected passage using up to three targets in any inflected form. There is one generously padded textarea and one feedback action, with no preceding drill.
- Keep the draft on the device. Send it and its target words to the Cheap model only on request. No model is needed to write; model setup remains available when feedback is off.
- Cache the passage, raw model response, parsed feedback, and usage per language in `writing.jsonl`. Identical text and target sets reuse the record; simultaneous requests share one call. Export it as `writing.json` and include the cost in Spending.
- Give concise AI-labeled feedback, explicitly allowing valid inflections and uncertainty. The learner can revise. No score, bonus XP, mastery verdict, known-mark changes, or FSRS changes follow from AI feedback.
- Count measured active writing time toward the output strand. Do not invent completed-task minutes.

## Not built or established

No new cloze drill, per-word sentence boxes, mandatory daily task, automatic vocabulary reclassification, Watch changes, or screenshot-tool expansion. No live-model accuracy or long-term retention study has validated this writing task.
