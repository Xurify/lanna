# E44. An added language gets a whole generated course; the model writes the rules, never the sentences (2026-11-05, branch `feat/generated-courses`)

**Why:** the owner switched to Estonian and got Slovak lessons: "The point of adding a language is to have everything fully done and ready for me to use."

**How to apply:**
- The course is data (`<data>/languages/<id>/course.json`, shape in `src/core/course.ts`): grammar units, word themes, tutor sessions, goals and chapters. The Strong slot writes it (the Cheap one stands in), one call for the course and one for the story bible, both counted in Spending. Slovak's course stays hand-written in code.
- A grammar unit selects Tatoeba sentences by the Wiktionary tags on the blanked form, plus optional trigger words before the blank. A dictionary form never counts as a case form; without a trigger the form must be unambiguous. Sentences are never written by a model (E27).
- Everything the model writes is checked against the dictionary before it is kept, and a unit with fewer than 12 sentences is dropped. A course with fewer than three chapters or three grammar units is refused.
- The running language's course is set by `config.ts` on the server and by a before-interactive script in the browser. Superseded by E45: the server changes it in place on a switch, and the browser reloads.
- Slovak-only content (the grammar atlas, Dvojičky, aspect tasks, the unit bridges and parallels) does not appear in a generated course.
- Who builds it is chosen in the add dialog, once per language, not in Settings: the Strong or Cheap model, priced per model and thinking level from earlier runs and capped per call; or the dictionary alone, free (`src/core/course-procedural.ts`).
