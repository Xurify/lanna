# E62. Study sections: a model picks the parts and the words, the program builds the exercises from the real lines (2026-11-07, branch `feat/watch-ai-sections`)

**Why:** the owner: "This is currently only manual, but I think we should have a feature that uses AI to do a smart analysis and auto generate a section(s) and create that into exercises that we could do." Research: [research/watch-sections.md](../research/watch-sections.md).

**How to apply:**
- On a prepared video's preview (captions in the language only), **Find sections** makes one Cheap-slot request (`src/server/watch-sections.ts`). The model sees the numbered lines with their English, with the words not studied marked, up to 400 lines. It returns up to three sections of 3 to 20 lines, each with a title, why it is worth studying, and 2 to 6 words, at most one per line.
- The answer is held against the video (`parseSections`, `src/core/watch-sections.ts`): ranges must be real and must not overlap, too-long ranges are cut, and a word must be a word of its line exactly as written (case aside, accents not). Anything else is dropped, and so is a section with no word left. The model never writes language (E27, E44).
- Kept in `videos/sections/<id>.json` with the model, the lines it saw and the cost (E1). It is asked again only with **Find new sections**.
- **Practice** turns each word into a typed gap in its real line, spoken with the Listen voice. The first miss shows the first letter and the line's English; the second shows the answer and the word's meaning. "I don't know" is a miss (P3). Stop part way saves the gaps answered.
- A finished section: XP as a lesson's typed rep (`repXp("type", …)`, half when accents only or helped), the gaps as the day's reps, and the active time as Watch minutes (P9). A missed or helped word goes to Review when the dictionary has it, and its line joins the Watch lines that come back in Listen (E56).
- Enter in the preview starts the video, except in a field: the gap's Enter checks the answer.
