# Gamification that makes sense (2026-11-02)

**Question:** the owner asked for the app to be "drastically gamified in ways that make sense", with research behind it and an agent skill installed to help build it, and to settle which indicators belong at the top of Today. What does the evidence say gamification does for learning, which mechanics help and which harm, and what should a serious Slovak course with the trail design ([trail-design.md](trail-design.md), E30) take from it?

**Outcome:** the stamp book (*turistické známky*), today's minutes ring, words known at the top of Today, a week target on the This week card, a stamp reveal on the lesson end screen and a trail log on Progress, on branch `feat/trail-stamps`. Rule E31. The `gamification-loops` skill is installed under `.claude/skills/gamification-loops/` (its `SOURCE.md` says where it came from and why). What was deliberately not built is listed below, with the reason.

## What the evidence says

1. **Gamification helps learning, modestly, and the gains are not automatic.** The meta-analysis of 38 studies by Sailer and Homner (2020) finds small to medium effects of gamified learning on cognitive outcomes (g = 0.49), motivational outcomes (g = 0.36) and behavioral outcomes (g = 0.25). The behavioral effect was larger when the design included game fiction and when it combined competition with collaboration; one-off, short interventions showed the weakest results. The authors caution that the motivational effect in particular may be inflated by publication bias. The reading for this app: a theme that holds together (the trail) and mechanics that last for months, not a points layer bolted on.
2. **Badges raise activity among the people who look at them.** Hamari's two-year field experiment (2017) on a trading service found that users shown badges were more active in the ways the badges tracked, and that the effect was carried by those who actually watched their badges. A badge nobody sees does nothing. So the stamps are on Today (the last one earned and the three closest), on the lesson end screen when one is earned, and in a book of their own.
3. **Points, levels and leaderboards raise output without raising intrinsic motivation.** Mekler and colleagues (2017) found more tags produced under points, levels and leaderboards, but no change in intrinsic motivation or need satisfaction; Hanus and Fox (2015) followed two university courses for a semester and found the gamified course (badges and a leaderboard) ended with lower intrinsic motivation, satisfaction and exam scores than the plain one. Leaderboards in particular demoralize everyone who is not near the top. This is why the app has no leaderboard and no league, and why the stamps are a record, not a currency.
4. **Rewards that inform do not crowd out; rewards that control do.** Self-determination theory (Ryan and Deci 2000) explains the pattern: a reward experienced as information about one's competence supports motivation; a reward experienced as the reason to act undermines it, and the meta-analysis by Deci, Koestner and Ryan (1999) found that expected, tangible, task-contingent rewards reliably reduce intrinsic motivation (the overjustification effect). The stamps therefore mark outcomes the learner already wanted (a chapter done, a thousand words known) and carry no XP, buy nothing and unlock nothing.
5. **The known harms are indifference, metric gaming, undesired behavior and effects that fade.** Toda, Valle and Isotani (2018) reviewed the negative effects reported in education: learners ignoring the mechanics, performance falling, learners chasing the metric instead of the learning, and novelty effects that wear off. A stamp for "ten lessons started" would be gamed by starting ten lessons; a stamp for "ten lessons without a miss" cannot be. Every stamp here is earned by an outcome on record.
6. **Streaks: company data, correlational, and forgiveness is a design choice.** The figures below are the company's own, unpublished and without methods: the 2.4 times is a comparison of people who kept a streak with people who did not, which also selects for people who would have come back anyway, and the redesign percentages are A/B results we cannot check. They are a reason to try forgiveness, not proof it works. Duolingo reports that learners who reach a seven-day streak are 2.4 times more likely to come back the next day than learners without one, and that it took five redesigns to find a streak rule people could keep. When the streak was decoupled from the daily minutes goal (one lesson a day keeps it, the goal is tracked separately), day-14 retention rose 3.3% and daily learners on a streak rose 10.5% within twenty days. Their Weekend Amulet experiment showed that letting people rest without losing the streak produced more activity over the long run, and learners who binged lessons were far more likely to abandon the app than learners who paced themselves (Shuttleworth, in Lenny's Newsletter). The app already forgives one rest day after six active days (decision P8); the week target below makes the planned rest days visible instead of punishing them.
7. **Visible distance to a near goal, and a head start, raise effort.** The goal-gradient effect (Kivetz, Urminsky and Zheng 2006) and endowed progress (Nunes and Drèze 2006): people work harder the closer a reward looks and when they can see progress already made. The stamps carry a progress arc, and the Today card shows the three closest ones with their counts, not the whole book.
8. **Fresh starts motivate.** Temporal landmarks (a Monday, a new month) raise aspirational behavior (Dai, Milkman and Riis 2014). The This week card counts the last seven days and the daily plan starts fresh each day; a broken streak ends a count, never the climb.

## The skill

Of the gamification skills on the public agent-skill registries (skills.sh, agent-skills.md, claudskills.com), `gamification-loops` from the `skills-for-antigravity` collection (Apache-2.0) was the only one that ships working references instead of a one-line description: `references/patterns.md` (core loop, progress, reward and streak design, each with its anti-patterns), `references/sharp_edges.md` (addiction against engagement, metric gaming, motivation crowding, leaderboard demoralization) and `references/validations.md` (the checks a design must pass). It passed the registry's three security audits and had 580 installs. It is copied unchanged to `.claude/skills/gamification-loops/`, where Claude Code loads it for any thread that touches streaks, stamps, goals or rewards.

Its frame is the **gamification triad**: a *core loop* (what the learner does every day and what tells them it went well), a *metagame* (the longer arcs that give the days a direction) and a *profile* (what the learner has become). The design below is laid out on it.

## What was built

| Layer | Element | Where | What it rests on |
|---|---|---|---|
| Core loop | **Today's minutes ring**: minutes practiced today against the daily goal, as a small ring beside the count | Today header | A goal the learner set, shown filling (finding 7); separate from the streak (finding 6) |
| Core loop | **Days in a row** with a flag, as before, with the forgiven rest day | Today header, lesson end | Finding 6 |
| Core loop | **Stamp reveal**: a newly earned stamp is pressed onto the lesson end screen with its name and what it marks | `/lesson` end screen | Finding 2: a badge works when it is seen at the moment it is earned; finding 4: it is information, there is no XP for it |
| Core loop | **Week target**: "N of T days in the last seven" under the day strip, "Target met" in gold once the goal's days a week are reached | This week card | Finding 6: rest days are planned, not failures; finding 7 |
| Metagame | **The stamp book**: a summit stamp per level, a stamp per chapter, and 42 deeds (first lesson, 7/30/100/365 days in a row, 50 to 3,000 words known, 100 to 5,000 review answers, lessons without a miss, words once missed now known, a balanced week, stories read, scenes spoken, listening sessions, Blitz scores, hours on the trail, chapter exams passed) | Progress → Stamp book (`/plan#stamps`) | Findings 2, 4, 5: outcomes only, no XP, nothing unlocked; the round wooden stamp is what Slovak hikers collect at every peak and hut, so it fits the trail (E30) |
| Metagame | **Stamps card**: the last stamp earned and the three closest, with their counts and a progress bar | Today, side column | Findings 2 and 7 |
| Metagame | **The climb** and the ridge, unchanged from E30 | Today, `/curriculum` | Finding 7 |
| Profile | **Words known** at the top of Today: the review deck's mastered words | Today header | Finding 4: a competence measure, in the learner's own terms ([milestones.md](milestones.md) says which counts matter) |
| Profile | **Trail log**: hours on the trail, words known, days practiced, longest streak, lessons, review answers, stories read, scenes said aloud | Progress → Trail log | Finding 4; every number is an outcome on record |

A stamp is earned once and keeps its day in `progress.json` (`stamps`); a streak that later breaks does not take back the week it marked. Stamps are judged whenever the progress summary is built, so a chapter finished through Review or a story read on Stories earns its stamp without a lesson. The day record gained `perfect`, the count of lessons with every answer right.

### The top of Today

The question was whether days in a row and XP are the best two indicators. Four now sit there, each answering a different question a learner asks on opening the app: **Days in a row** (am I keeping the habit?), **Today** (minutes against the daily goal: how much is left today?), **Words** (how far have I come, in the measure that predicts what I can understand?) and **XP** (how much practice have I banked?). The level itself is on the ridge line right under them, so it is not repeated. Hearts, gems and a league chip were considered and rejected (next section). On a phone the four wrap to two rows and no label is cut.

## What was deliberately not built

- **No leaderboard or league.** Findings 3 and 1: competition helps behavior only when paired with collaboration, and the app has one learner. A leaderboard against strangers would demoralize most and teach nothing.
- **No hearts, lives or energy.** They punish mistakes, and mistakes are where the app wants the learner to be ([desirable-difficulties.md](desirable-difficulties.md)). A lesson is never cut short for being hard.
- **No currency, shop, chests or variable rewards.** Loot-box mechanics are the "addiction, not engagement" edge in the skill's sharp edges; the owner's rule is that the app is for learning, not for time in the app.
- **No XP for stamps, and no stamp for actions.** Finding 4 and 5. A stamp worth XP becomes the reason to practice; a stamp for pressing a button is gamed.
- **No notifications or reminder spam.** The app has no push channel and the skill's validations rule out nagging; the week target and the minutes ring do the reminding inside the app.
- **No streak freeze to buy.** The forgiven rest day is a rule, the same for everyone, not an item.
- **No confetti, no flame.** E30.

## The skill's validations, measured

| Check (`references/validations.md`) | How this design meets it |
|---|---|
| An off-ramp: the learner can stop without loss | Stamps are kept for good; the streak forgives a rest day; the week target counts seven days, not a calendar week |
| Intrinsic value: the mechanic points at something the learner wants | Every stamp names a real outcome (words known, a chapter, a level); the trail log is the learner's own history |
| Hard to game | Outcomes only: words known come from the review deck's mastery, lessons count when finished, "without a miss" needs every answer right, a balanced week needs 60 minutes with every strand at 15% |
| No notification spam | None sent |
| Completion states | Every stamp has one; the book counts earned of total; a summit stamp closes each level |
| Honest numbers | The counts are the same ones the Progress page and the hours sheet already show (P8) |

## Open questions and what to verify

- Whether 42 deeds is the right size. The thresholds follow the vocabulary bands of [milestones.md](milestones.md) and the hours of the climb; the next pass should check which stamps a real learner reaches in the first month, and the dates are on disk for that.
- The balanced-week stamp uses the week's measured minutes; before minutes were measured the strand balance was estimated, and those weeks cannot earn it.
- The stamp reveal is tested in rendering and in the sandbox, not yet on the PC or a phone.

## Sources

- Sailer, M., & Homner, L. (2020). The gamification of learning: a meta-analysis. *Educational Psychology Review*, 32, 77–112. https://doi.org/10.1007/s10648-019-09498-w
- Hamari, J. (2017). Do badges increase user activity? A field experiment on the effects of gamification. *Computers in Human Behavior*, 71, 469–478. https://doi.org/10.1016/j.chb.2015.03.036
- Mekler, E. D., Brühlmann, F., Tuch, A. N., & Opwis, K. (2017). Towards understanding the effects of individual gamification elements on intrinsic motivation and performance. *Computers in Human Behavior*, 71, 525–534. https://doi.org/10.1016/j.chb.2015.08.048
- Hanus, M. D., & Fox, J. (2015). Assessing the effects of gamification in the classroom: a longitudinal study on intrinsic motivation, social comparison, satisfaction, effort, and academic performance. *Computers & Education*, 80, 152–161. https://doi.org/10.1016/j.compedu.2014.08.019
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin*, 125(6), 627–668. https://doi.org/10.1037/0033-2909.125.6.627
- Ryan, R. M., & Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. *American Psychologist*, 55(1), 68–78. https://doi.org/10.1037/0003-066X.55.1.68
- Toda, A. M., Valle, P. H. D., & Isotani, S. (2018). The dark side of gamification: an overview of negative effects of gamification in education. In *Higher Education for All*, CCIS 832, 143–156. https://doi.org/10.1007/978-3-319-97934-2_9
- Kivetz, R., Urminsky, O., & Zheng, Y. (2006). The goal-gradient hypothesis resurrected. *Journal of Marketing Research*, 43(1), 39–58. https://doi.org/10.1509/jmkr.43.1.39
- Nunes, J. C., & Drèze, X. (2006). The endowed progress effect. *Journal of Consumer Research*, 32(4), 504–512. https://doi.org/10.1086/500480
- Dai, H., Milkman, K. L., & Riis, J. (2014). The fresh start effect: temporal landmarks motivate aspirational behavior. *Management Science*, 60(10), 2563–2582. https://doi.org/10.1287/mnsc.2014.1901
- Duolingo. How streaks keep Duolingo learners committed to their language goals. https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/
- Duolingo. Improving the streak. https://blog.duolingo.com/improving-the-streak/
- Shuttleworth, J., in Lenny's Newsletter. Behind the product: Duolingo streaks. https://lennysnewsletter.com/p/behind-the-product-duolingo-streaks
- Metin, Ö. skills-for-antigravity: gamification-loops (Apache-2.0). https://github.com/omer-metin/skills-for-antigravity
