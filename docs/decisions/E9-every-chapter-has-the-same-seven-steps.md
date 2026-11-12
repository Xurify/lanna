# E9. Every chapter has the same seven steps (2026-10-30)

**Why:** a chapter was only a list of unit IDs, so nothing showed what it asked of the learner or where they were in it. Every chapter now gets the same seven steps in the same order: story, words, forms, pairs, scene, sound, exam.

**How to apply:** the steps are `ARC_STEPS` and `chapterArc()` in `src/core/arc.ts`, computed from `CHAPTERS` and `CURRICULUM`; do not copy unit lists into them. A step with no unit yet is "not yet", and tutor units stay outside the seven steps. `tests/arc.test.ts` names every chapter without a words or forms step, with the reason.
