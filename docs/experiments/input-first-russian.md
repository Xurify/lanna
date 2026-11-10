# Experiment: input-first Russian (v3)

*v3, 8 November 2026, before day 1. It replaces v2 after an independent review (Opus 5.5, round 1, findings in the build log). The decision rule is fixed before day 1 and is not changed after results come in. A change needs a new version and a note of the reason.*

## Question

Does a listening-first Russian week (listening, reading, watching and vocabulary; no form drills, no tutor, no speaking tasks) raise first-play listening understanding, and what does it cost in speaking?

The learner is the owner. Russian is the listening goal, A1 listening is confirmed. Slovak is the control, on the normal plan the whole time, because a trip before about 5 January 2027 needs its output work.

## What changed from v2 and why

- **The primary measure is first-play understanding in daily Listen.** Every Listen rep is a typed dictation (the player always sends `answer: "type"`), so v2's "meaning" reps do not exist, and v2's speed measure reads the recording's length, not the learner. First-play understanding is a clean signal: the sentence heard once, typed right, with no replay and no peek.
- **The arm is applied by a schedule, not a manual flag**, and the day it starts is drawn at random before day 1 (a randomized start, the single-case standard for a skill that does not reverse). v2's ABA reversal is dropped: listening gains do not undo, so a return to baseline would read carryover as no effect.
- **Speed is descriptive only.** It is not in the decision.
- **The arm keeps no speaking task.** v2 left the Speed task in the arm; it records the learner's voice, so it is out. Speed is removed from the arm's task list.
- **Speaking is production, not imitation.** The weekly check gives an English prompt and asks for the Russian, and it never plays the Russian first.
- **Measurement is frozen and drawn once.** Probe sentences and production items come from a fixed pool, drawn with a stored seed, so no line repeats.

## Design

Forty-two days from **Tuesday 10 November 2026** to **Monday 21 December 2026**, in the app's local days.

- **Russian, days 1 to onset − 1:** normal plan (baseline).
- **Russian, from the onset day to day 42:** listening-first arm.
- **Onset:** a whole day drawn uniformly from **12 to 22** (days 12 to 22, which is 21 November to 1 December). Drawn once with a stored seed and written into `experiment.json` before day 1. The owner does not know it, unless the owner reads the file.
- **Slovak, all 42 days:** normal plan (control), with the same daily and weekly measures.

Why this design: each learner day is a data point, so there are many points per phase. The random onset lets the analysis separate a treatment effect from a calendar trend (a trend would show at every candidate onset, a treatment only at the real one). The Slovak control shows what a non-treated series does over the same weeks.

## Measures

**Daily, from the Listen log (primary).** A Listen session is one lesson-log line with `mode: "listen"`. A rep is *first-play understood* when it is a dictation (`kind: "dictation"`), `replays` is 0 or absent, `peeked` is not true, and `verdict` is `exact` or accents-only (the same rule `understood()` uses; see the build log for the exact verdict names). The daily **first-play share** is the understood reps divided by all dictation reps that day. A day counts when it has at least 5 dictation reps.

Covariates per day, to control for item difficulty (the picker drifts as the known-word set grows): the mean words per sentence, and the mean frequency rank of the sentence's words (from the lexicon). These are recorded daily; they are not decided on.

**Weekly, the speaking check (secondary, both languages).** Once in each week, due on the last day of the week (days 7, 14, … 42), with a 2-day make-up window:

- **Listening probe:** 10 sentences drawn from a frozen pool, played once; the learner types the sentence. First-play understood share, graded by the same rule as the Listen rep.
- **Production:** 5 English prompts drawn from a frozen pool; the learner says the Russian. The transcript is matched word by word against the expected sentence (folded forms), and the score is the share of expected words matched. Scored by the existing transcript matching (`src/core/speak.ts` `wordMatch`); Azure pronunciation is not used here because it scores sound, not whether the learner produced the sentence.

Pools: built once from each language's own verified lexicon examples (4 to 8 words; the probe pool holds one sentence per lemma; the production pool holds the English translation, which the lexicon example carries). The chosen pools are written to `probe-pool.json` before day 1, with the seed.

**Compliance.** Minutes per day by activity (the app's `minutesBy`). On arm days, minutes on Speak, Lesson, Blitz, Strengthen, Speed and tutor sessions are the excluded surface. Compliance is the share of Russian minutes on arm days that went to allowed tasks. Under 90% is flagged.

## Analysis

**Primary (decision):** interrupted time series on the daily first-play share, Russian only.

Model per candidate onset *k* (each day from 12 to 22): share_t = b0 + b1·t + b2·post_t(k) + b3·(t − k)·post_t(k) + c·covariates_t, where post_t(k) = 1 for t ≥ k. The effect is b2, the level change at onset. Ordinary least squares, with days without data dropped.

**Randomization test:** for each candidate onset *k* in 12 to 22, compute b2(k). The observed onset is the drawn one. The p-value is the share of candidates whose b2 is at least the observed b2. With 11 candidates, the smallest possible p is 1/11 ≈ 0.09, so the decision threshold is "the observed onset gives the largest b2" (p = 1/11).

**Decision rule (fixed):**

1. **Listening gain** if the observed b2 is at least **+10 percentage points**, **and** the randomization p is 1/11 (the observed onset gives the largest effect of all candidates), **and** each phase has at least 8 days with data.
2. **Inconclusive** if a phase has fewer than 8 days with data, or fewer than 5 weeks of checks.
3. Otherwise **no clear listening gain**.

**Secondary (descriptive, not decided):**

- Weekly production share and probe share, arm weeks against baseline weeks, with n per phase. With a handful of weeks, no test is run. The result says "lower", "higher" or "similar", with the numbers. A drop of 10 or more points in production in arm weeks is reported as "speaking cost (descriptive)".
- Known-word coverage (milestones page) for both languages, reported only.

**Flags printed beside the verdict (do not change it):**

- **Time trend:** Slovak's level change at the same calendar day as Russian's onset is at least half of Russian's b2.
- **Compliance:** under 90% of arm-day minutes on allowed tasks.
- **Balance:** Russian minutes on arm days under 70% of baseline-day minutes.
- **Carryover is not possible** by design (no return to baseline), so no carryover flag. A gain that persists is the expected result.

## What this design cannot show

- **One person, one language on each arm, no randomized allocation across people.** The control is a parallel series, not a randomized one.
- **Power is limited.** With 11 onset candidates the test cannot be more significant than 1/11, and with about 4 to 5 dictation sessions a week the daily shares are noisy. The design detects a large shift (around 10 points or more); it does not detect a small one.
- **Shared Slavic vocabulary** between Russian and Slovak can help the control.
- **The speaking check is weekly and small** (5 production items). It describes; it does not test.
- **Listening is measured by typed dictation.** That is the app's listening task; it is not spontaneous comprehension in conversation.

## How the study is documented (automatic)

Written to `data/experiments/input-first-russian/` (the owner's data folder, not the repo), in open formats:

- `experiment.json`: start date, days, the onset (drawn with the seed), the seed, the languages, the decision rule text and its version, the hash of this protocol file, and the app's git commit when the study was set up.
- `probe-pool.json`: the frozen listening-probe and production pools, with the seed and the lexicon count.
- `schedule.json`: the arm for each day and language (derived from the onset; written once).
- `daily.jsonl`: one line per day per language: date, phase, first-play share, dictation reps, covariates, minutes per activity, compliance inputs. Rewritten for the days that have data; the lesson log stays the raw source.
- `checks.jsonl`: one line per weekly check item: date, language, item id, the sentence or prompt, what was said or typed, the score, and the engine used.
- `summary.md`: the readable table, the current analysis and verdict status; regenerated each time the page or the daily job runs.
- `verdict.json`: written once, after day 42 (on the first run after 20 December), with the analysis, the flags, and the rule version.
- `deviations.jsonl`: a log for missed days or checks, a changed key, or an app change that touches the measure. Written by the app when it can see the event, and by hand otherwise.

The app writes `daily.jsonl` and `summary.md` on each load of Today and of `/experiment`, at most once per day. `/experiment` shows the same table, the schedule, the current phase, and the next check.

## The weekly check

The check is a page, `/experiment/check`. It runs the 10 probe sentences (play once, type), then the 5 production items (English prompt, record, transcript, match). It can be started from `/experiment`, and Today shows a line when it is due. The check is the one weekly output task on the arm, and it is measurement, not practice; the summary states that.

## Study basis

- **Single-case experimental designs** with a randomized start and a parallel control series (Kratochwill et al., 2010, What Works Clearinghouse standards). The randomized start is the design's main strength: it separates the treatment from the calendar, which the v2 ABA reversal could not.
- **Listening-first input** has a comparative literature. Comprehension-based instruction tends to beat production-based instruction on comprehension measures; on productive measures the two are close (Shintani, Li & Ellis, 2013; check the details before citing). Extensive listening and viewing studies report medium effects on listening (e.g., Chang & Millett, 2014). Krashen's input hypothesis (1982) is a theory; Lichtman & VanPatten (2021) is a review of it. The experiment tests one specific claim for one learner: first-play listening gain, and speaking cost, under this app.
- **Immersion learners** understand far more than they produce accurately (Swain, 1985). That is the reason the speaking measure exists, and the experiment does not claim Swain's finding about accuracy transfers to clarity.
- **Explicit instruction** is not the experiment's subject. The v1 citation to Norris & Ortega (2000) is removed, since their outcomes were form tests and do not speak to listening.

## Start

- **Set-up** (the agent does this, once): write `experiment.json`, the seed, the onset, the pools and `schedule.json`. Record the git commit of the app and the hash of this file.
- **Day 1** (Monday 9 November): the Russian plan is the normal one. Nothing is switched by hand.
- **Day of onset**: the arm applies to that day's plan automatically. Nothing is switched by hand.
- **Weekly**: the check is due on the last day of each week. Today shows a line; `/experiment` shows the table.
- **Day 43 onward**: the verdict is written once.

## Known limits of the automation

- The plan is built when Today loads. A day in which Today is never opened still follows the schedule, because the arm is a function of the date, not of a visit; but the daily file is written only on a visit. The summary states the days missing from the file.
- The arm does not block the Speak, Lesson or tutor screens; it removes them from the day's list. Compliance measures what the learner does.
- The app's own changes during the study (the picker, the Listen grader, the lexicon) can move the measure. The git commit is recorded at set-up, and a change to those files during the study is written to `deviations.jsonl` by the agent in the same session.
