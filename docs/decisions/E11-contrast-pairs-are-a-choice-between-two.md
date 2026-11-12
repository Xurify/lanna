# E11. Contrast pairs are a choice between two real forms (2026-10-30)

**Why:** the arc's pairs step (Dvojičky, E9) was "not yet". The twins a learner mixes up (ísť/chodiť, kam/kde, robiť/urobiť…) are now taught as a recognition choice: the sentence is a verified lexicon example that contains exactly one twin's form, the form stays visible, and the learner picks which of the two lemmas the sentence really uses. Sentences come only from verified forms (P8) — never generated ones.

**How to apply:**
- The pairs are data, not code: `curriculum/slovak/pairs.json` (id, a, b, one English rule, one Estonian bridge, the chapter that teaches them). Both twins must be lexicon entries; a pair with fewer than three verified sentences is dropped (`src/core/pairs.ts`).
- One pairs unit per chapter that teaches a pair (`pairs-<chapter>` in `src/core/lesson.ts`), placed right after the chapter's forms unit; `chapterArc` fills its pairs step from it. The rep's rule and bridge are the pair's own, shown after a miss — the unit's line is a fallback only.
- A pairs unit is a drill on the map: it joins Continue and the daily plan like any drill, and its misses feed the review deck as usual.
