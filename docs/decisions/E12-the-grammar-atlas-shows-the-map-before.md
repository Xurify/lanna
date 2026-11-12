# E12. The grammar atlas shows the map before it is full (2026-10-30)

**Why:** the case system was invisible — a learner saw drill units one at a time but never the six cases × three genders they are working through, or where their accuracy sat in it.

**How to apply:** the table is `src/core/grammar.ts` (pure): six cases down the side (N, G, D, A, L, I), three genders across (masc, fem, neut). Each cell points at the drill that teaches it (A-fem → acc-fem, A-masc → acc-people, one drill per case for G, D, L, I) or is "not yet"; a mapped id that is not a unit in `UNITS` counts as "not yet" too, never a broken link. A cell's accuracy is `correct / reps` from `progress.units`, and zero reps reads "not yet" — no percentage without anything behind it. Every cell links to `/lesson?unit=<id>`; the rule text shows for the pointed-at cell. Do not map a cell to a unit that does not exist, and do not show accuracy for a cell with no reps.
