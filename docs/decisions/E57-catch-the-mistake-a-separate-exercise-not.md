# E57. Catch the mistake: a separate exercise, not a planted slip in episodes (2026-11-06, branch `feat/daily-hooks`)

**Why:** proposal 6 wanted the learner's own confusion to show up in a story. A wrong word inside a Read episode teaches the wrong form to anyone who skims, and the episode should be correct Slovak. So the mistake moved out of the stories into an exercise of its own.

**How to apply:**
- The pair comes from the learner's mix-ups on record (E24) that are verified pairs (E11), missed at least twice, and not used in the last five items (`chooseCatch` in `src/core/catch-pair.ts`). Each answer is read like a lesson first try: catching the word and typing the right one is a hit, typing the other word or letting the wrong word pass is a miss.
- The Cheap slot writes a three-sentence item with the wrong word, and `verifyCatch` must accept it before it is kept (E29). Kept items live in `data/profiles/<language>/catch-mistake.json`; a waiting item is served with no new call.
- The learner presses Start, taps the wrong word, types the right one, and then sees the whole item with its translations and the rule. The typed word is graded with `compareAnswer`. The page is `/catch`, linked from "Words you mix up" on Today.
- Read episodes carry no planted mistake. An episode written with a slip earlier still reads normally.
- The series lead is Martin ("Martin in Bratislava", `curriculum/slovak/world.json`). The internal `robo` series id is unchanged.
