# The Read task: graded episodes at the learner's level

*LangHarness, 2026-10-28. Thread "Add a reading task with stories". Code: `src/core/reading.ts`, `src/server/reading.ts`, `src/store/stories.ts`, `components/reading/reader.tsx`, `app/read`.*

## Evidence

- **Coverage.** Unassisted reading needs about 98% known running words; 95% with help such as a dictionary tap (Hu & Nation 2000; Laufer & Ravenhorst-Kalovski 2010; Schmitt, Jiang & Grabe 2011). Below that it is not input.
- **Extensive reading** works through volume of easy, interesting text chosen for the reader (Day & Bamford), with new words met repeatedly rather than once.
- **Glossing and reading-while-listening** raise comprehension and incidental vocabulary gain without breaking the flow.
- **Questions** should test meaning, not form, and should grow with the level: recall at A1, inference and paraphrase from B1, attitude at B2 and above.

## Design

- One episode a day of *Martin in Bratislava*, written on the Cheap model slot: 6 to 8 sentences at A1 up to 16 to 20 at C1, about 97 of 100 words known, 2 to 3 deliberate new words each used three times, the setting rotated from the learner's purposes (the "something else" note passed word for word).
- Known words come from the deck and word units plus the commonest words up to the level's rank (A1 500, A2 1,000, B1 2,000, B2 3,000). A draft whose stray unknown share is over 8% is redrafted once naming the hard words; deliberate new words do not count against coverage.
- Tap a word for lemma, "here: form", gloss, tags and audio. Per-sentence speaker and translation toggle, Play all.
- Questions by level (`QUESTION_PLAN`, added after the question "are all the questions simple like this?"): A1 three recall with three options; A2 recall, recall, inference; B1 four questions of four options (recall, inference, vocab, paraphrase); B2 five (inference, vocab, paraphrase, attitude, recall); C1 five (inference, attitude, paraphrase, vocab, inference). The reader labels the kind.
- XP: sentences × 2 on first read plus 5 per right answer. New words and looked-up words go to the review deck.
- Everything is kept under `data/profiles/<lang>/stories/`; the newest unread episode is reused before a new one is written, and a read episode is free to reread (the fluency strand's "Read it faster" times a re-read).

## Known gaps

- The lexicon lacks many function-word forms; a `GRAMMAR_WORDS` table covers them. Extend the table, not the lexicon, when a common form shows up as "new".
- Form-to-lemma via stems is about 96% right; names are protected.
- Real generation with a live model on the PC has not been verified by the owner (tests and screenshots use the faux engine).
