# E15. The chapter exam lives on the path (2026-10-30)

**Why:** a separate exam page repeated the path and added a screen to find. The path already shows where a learner stands, so the exam belongs at the end of its chapter. The exam screens had also drifted from the lesson's look: their own option cards, a result panel with a "Recorded" stat, and an 11px label. The Speak picker had 3D card shadows, and a "Script first" link floating under each card.

**How to apply:**
- Each open chapter on the path (Today and `/curriculum`) ends with a "Chapter exam" row (`components/curriculum-path.tsx`) that links to `/exam?chapter=<id>`. Its ring is a unit's ring: it fills to the best score and turns gold once passed. Its line comes from `examLine` in `src/core/exam.ts`: "Not taken yet · pass mark 80%", "Best 5 of 8 · pass mark 80%", or "Passed · best 8 of 8".
- `progressSummary` carries each exam chapter's attempts and best (`exams`, from `examSummaries`). Media has no exam (`chapterHasExam`: its arc has no words or form unit).
- An unknown chapter id is a 404.
- The exam, the grammar atlas, the Speak picker and the Speak script use the lesson's parts: the two-column option grid, the feedback band with Next at the bottom, one button family, and text no smaller than 12px (`text-xs`). The exam's blank stays a blank, so the options never move; the band shows the whole sentence.
- On the Speak picker each scene is one bordered row: the scene, and beside it "Step by step" (was "Script first") for the scripted walk-through (E13). Nothing new is gated.
