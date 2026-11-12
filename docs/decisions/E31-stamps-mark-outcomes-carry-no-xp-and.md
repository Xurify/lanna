# E31. Stamps mark outcomes, carry no XP, and four indicators sit at the top (2026-11-02)

**Why:** the owner asked for the app to be "drastically gamified in ways that make sense". The evidence ([research/gamification.md](../research/gamification.md)) says gamification helps learning modestly when it is themed and lasting, that badges work for those who see them, that points, leagues and leaderboards raise output but not motivation and can lower both, that rewards experienced as the reason to act crowd out the real one, and that streaks work best with forgiveness. The design keeps to what that supports.

**How to apply:**
- Stamps (`src/core/stamps.ts`, `components/stamp.tsx`) are the app's badges: a summit stamp per level, a stamp per chapter, and a fixed list of deeds. Every stamp is earned by an **outcome on record** (words known, lessons finished without a miss, a chapter done, days in a row), never by an action (a lesson started, a button pressed, minutes alone). A stamp carries no XP, buys nothing and unlocks nothing. Once earned it keeps its day in `progress.json` and is never taken back.
- Stamps are judged in `progressSummary` (`src/server/stamps.ts`), so any path that moves the record (a lesson, Review, a story, a scene) can earn one. A lesson reports the stamps it earned on its end screen, once.
- The top of Today shows four indicators and no more: days in a row (flag), today's minutes against the daily goal (ring), words known, XP. The level is on the ridge; nothing is repeated.
- The This week card names the target (the goal's days a week) and says when it is met; rest days inside it are not failures.
- No leaderboards, leagues, hearts, lives, currency, chests, variable rewards, purchasable streak freezes, confetti or notifications. Any new reward mechanic is checked against `.claude/skills/gamification-loops/references/validations.md` and recorded in the research note before it is built.
