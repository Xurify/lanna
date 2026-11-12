# E14. The chapter exam is recorded before it gates (2026-10-30)

**Why:** the plan makes the exam a required gate, but a gate on an unchecked exam would block learners. Phase 6a ships the exam as record only: every chapter's Skúška draws eight choose items from the chapter's own word and drill units, is scored against an 80% pass mark, and is saved per chapter — and nothing opens or closes on it yet.

**How to apply:** the draw and the score are `src/core/exam.ts` (pure), built from the lesson item builders (src/core/lesson.ts) — no second generator; a chapter with a Dvojičky unit gets one pair rep in place of a form item. Attempts live in progress.json's `exams` per chapter (`at`, `score`, `total`, `passed`, `misses`); the client sends only its picks, the server re-grades from the seed. The path reads the best attempt per chapter and never changes `curriculumState`. The gate (6b) switches on only when the owner flips it.
