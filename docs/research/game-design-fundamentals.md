# Game design fundamentals, applied to LangHarness

Date: 2026-11-03. Question: which ideas from a genre-agnostic game design skill fit a Slovak learning app, and which conflict with rules we already set?

Source: `skills/game-design-fundamentals/SKILL.md` and `templates/player-motivation-worksheet.md` in [fcsouza/agent-skills](https://github.com/fcsouza/agent-skills). The skills.sh page shows only the header, so the full text was read in the GitHub repo. Read only; nothing was installed. The book and paper citations below come from the skill and were not checked against the sources in this pass.

The first pass only read and mapped. Proposal 1 was then built as the zone (E42, `src/core/flow.ts`); the others are still for the owner to decide.

## What the skill covers

- Ten principles: a series of interesting decisions; a core loop that is fun in 30 seconds; MDA (mechanics, dynamics, aesthetics); the flow channel; mastery; elegant rules; feel before systems; reward schedules; player types; restraint.
- A five-phase process: concept, core loop, systems, economy and balance, documentation.
- A worksheet: Bartle player types, self-determination (autonomy, competence, relatedness), flow, reward schedules, retention hooks, session cadence, and a 45-point scorecard.

## Map: what the app already does

| Skill idea | What the app does now | Gap or next step |
|---|---|---|
| 30-second core loop: action, feedback, reward, decision | A lesson rep: answer, green/amber/red with the rule, XP (README, E18) | Covered. Measure the time from answer to the next rep with a fresh profile before changing anything. |
| Flow channel: challenge matches skill | Desirable difficulty (P3), adaptive placement ladder, Strengthen picks units whose first-try accuracy fell, a unit goes "strong" when complete | No explicit target band for first-try accuracy. See proposal 1. |
| Mastery creates fun; fun stops when nothing new is learned | Strong units (production only), Mix-ups (E24), Personal lesson (E26) | Covered. Keep the next new thing visible once a unit goes strong. |
| Measure what players do, not what they say | P5 (confidence sliders left at default, so moved behind a button), E18 first tries, E25 thresholds | Strongest match in the project. Use it as the test for every new idea. |
| Tutorial is the gameplay with guardrails | Scripted scenes (E13), "Step by step" mode, four-screen setup | Covered. |
| Design by subtraction | Search bar removed 2026-11-03, Quiet tool (E33), one accent color | Covered. Keep it. |
| Data-driven values, not hardcoded | Curriculum in JSON: `pairs.json`, `mixups.json`, `world.json` (E9, E11, E13, E24) | Covered. |
| Economy: every resource needs a faucet and a sink | XP is a score; stamps buy nothing (E31); no currency by rule | Do not add currency to get a sink. The economy section does not apply. |
| Reward schedules: variable beats fixed | E31 bans variable rewards. `research/gamification.md` says rewards felt as the reason to act crowd out real motivation. | **Conflict. Do not apply.** The skill's advice to escalate rewards over time (small early, large late) is fine. |
| Reward inflation: too many rewards devalue them | 42 deeds, a stamp per level, a stamp per chapter, a first-lesson stamp | Check it. Count the stamps a fresh profile gets in its first week. |
| Do not punish failure | "I don't know" costs no XP but is not harsh (README). A miss shakes (E35). | Check that the shake reads as feedback, not a penalty. |
| Session cadence matches real time | Active: lesson, Speak, Read, Watch. Quick check: Review (one Continue), Blitz (60 seconds). Social: none. Minutes a day from 10 to 600 (learner.md). | Covered. Check that a 10-minute day still gets a useful plan. |
| Player agency: informed choices | One large Start, and every other practice listed by kind (E33) | Covered. Keep the alternatives visible. |

## Bartle player types

The learner is served as an Achiever (stamps, XP, milestones, streak) and an Explorer (Watch with any video, Read, "things you may not have noticed" on My mistakes).

- Socializer: not served, by E7 (local only, no sync).
- Killer: not served, by E31 (no leaderboards, no competition).

The skill warns against serving one type only. Here the gaps are deliberate. The open question is whether a learner's "other people" could be the Robo cast in `world.json`, instead of real people. That is a design question for the owner, not a build.

## Self-determination scorecard

My scores, from the docs, not from learner sessions. The skill says to judge by what players do, so treat these as a first guess to replace with measured numbers.

| Dimension | Score (1–5) | Reason |
|---|---|---|
| Bartle coverage | 3 | Achievers and Explorers served; Socializers and Killers left out on purpose |
| Autonomy | 4 | One next step, plus every other practice listed by kind |
| Competence | 4 | First-try measure, grammar atlas, milestones with dates. Exam is record-only so far. |
| Relatedness | 1 | Solo and local by design (E7). Tutor and characters only. |
| Flow maintenance | 3 | Difficulty and placement are there; no target band yet |
| Reward schedule | 3 | Fixed and outcome-based by choice, not variable |
| Daily retention | 4 | Plan, streak with one forgiven rest day, Review deck due |
| Weekly retention | 3 | This-week card and week-long stamps; no weekly event (none wanted) |
| Session design | 4 | Lessons of 12 reps, Blitz, quick Review |
| **Total** | **29 / 45** | Skill band 27–35: "solid but gaps exist". The weakest is Relatedness, and that gap is deliberate. |

## MDA targets

The skill says to pick two or three aesthetics and let every mechanic serve them.

- **Challenge**: lessons, the exam, Review, the desirable-difficulty rules.
- **Discovery**: Watch, Read, the insight cards on My mistakes.
- **Narrative**: Robo, the chapter episodes (E10), the world bible.

Speak (Expression) is in the app but outside the top three. Streak and XP serve no chosen aesthetic. They stay as cheap, optional signals, as E31 says.

## Proposals, ranked (1 built)

1. **First-try flow band. Built (E42, 2026-11-03).** The band is 65% to 85%, a unit is placed after 12 first tries by a one-sided 95% Wilson test, and the zone steers the next lesson one stage, the plan's Strengthen, Today, the path, the lesson's end screen, My mistakes and the tutor's profile. The original proposal: set a target band for first-try accuracy per unit, for example 65% to 85%. Above the band after enough tries: a boredom signal, so offer the strong stage or a Mix-ups lesson. Below the band: an anxiety signal, so offer a cue or an earlier unit. Follow the E25 rules: no reading under 30 first tries, and use the Wilson range. The owner picks the band after a research pass. Do not copy the skill's `getDifficultyMultiplier` formula. The app chooses units, not a multiplier, and a formula would fix a number before there is evidence (P8).
2. **Stamp inflation check.** Count the stamps a fresh profile earns in its first week, on a scratch folder (E6). If it is more than a few, raise the bar on the cheapest deeds. Measure first.
3. **Relatedness, a question for the owner.** Should the Robo cast become recurring characters the learner meets in Read and Speak? It already exists in `world.json`. Social features would conflict with E7.
4. **Shake on a miss.** Review it at both window sizes (E4) and check that it reads as feedback, not a penalty.
5. **Stale README line.** The README's lessons row says "Combos, sounds, confetti and XP". Confetti is not in `src/` or `components/`, and E31 bans it. Fix the README.

## Do not apply

- Variable reward schedules and surprise bonuses: against E31 and P1.
- Leaderboards, competition, guilds: against E7 and E31.
- A currency economy with sinks: against E31.
- The Killer player type.
- The skill's difficulty formula, as written (see proposal 1).

## Open questions for the owner

- Which first-try band should count as "in the flow"?
- Is the Robo cast enough for relatedness, or is more wanted?
