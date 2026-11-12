# E24. Mix-ups are kept per pair of words, predicted, then tested (2026-11-01)

**Why:** the owner typed "Niekto" for "Nikto" and asked whether the app keeps its mistakes, so it can find the pain points, predict similar ones and practice them. The answers were logged, but only units were measured, so a confusion between two words disappeared into an accuracy figure and the tutor never heard of it. Research note: [research/mixups.md](../research/mixups.md).

**How to apply:**
- A mix-up is a wrong first try (the E18 rule) whose answer is another lexicon word, not a form of the wanted one (that is a slip). It is kept per pair of entries in progress.json (`mixups`): both lemmas, the family, the misses, the right first tries since the last miss and the last three misses as evidence. Lessons, Blitz and Review (without a hint) count. `src/core/mixups.ts` is pure; `src/server/mixups.ts` reads the answers in.
- Families are data, not code: `curriculum/slovak/mixups.json` (id, title, one English rule, one Estonian bridge, twins by lexicon slug). A twin missing from the lexicon, or a pair with fewer than three verified sentences that hold only one twin, is dropped, as in E11.
- A mix-up predicts up to three pairs: its family's others, else the same small edit applied to other lemmas (`ruleNeighbours`). A prediction is a probe, shown as "not tested yet", never taught as a fact. It is tested as a two-way choice; two right first tries clear it, a miss makes it a mix-up.
- A mix-up is mended after three right first tries since its last miss; a miss opens it again. The record keeps 40 pairs at most and never drops an open one.
- The Mix-ups lesson (`/lesson?mode=mixups`): open pairs typed on both sides in turn, probes as a choice, each rep a verified sentence with the pair's rule after a miss. It counts XP, the day's minutes and `day.mixups`, never a unit or the atlas. A regular lesson rep of a word in an open mix-up carries the pair's rule too, unless it names a form.
- Today shows "Words you mix up" beside the weak spots. Strengthen takes the Mix-ups lesson when no weak spot is on record. The tutor's "This learner" block names the open pairs and their probes.
