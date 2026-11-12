# E43. A language is added from the app, from open data, without a model writing words (2026-11-05, branch `feat/add-language-button`)

**Why:** the owner asked to make adding a language smoother, "less dev work or completely eliminate the need for that", and to have it all done in the background behind a button that shows in the Background section.

**How to apply:**
- The list of profiles is built-in (`LANGUAGE_PROFILES` in `config.ts`, pinned to `LANGUAGES` in `src/core/language.ts`) plus every `data/languages/<id>/` that has a `language.json`. A language is added there, not in code. `curriculumFile(profile, name)` reads a language's file from `curriculum/<id>/` when the app ships one, else from `data/languages/<id>/`.
- Words come from Wiktionary (kaikki.org), frequency from FrequencyWords, sentences only from Tatoeba (E27). The homograph guard of E28 applies to every added language. The rules are pure, in `src/core/language-build.ts`.
- One model call is allowed: a grammar map draft on the Cheap slot, checked (unknown keys and loops dropped), labeled "(model draft)" in the skill map, and counted in Spending. It never writes a sentence or a form.
- The tutor's language segment is a template that states nothing about the language a model would have to know.
- The work is a background task (`src/server/tasks.ts`, kind `language`); each step is kept under `build/`, and `language.json` is written last.
- **No hardcoded target language (owner, 2026-11-05: "stop hardcoding stuff").** A prompt, a screen or a list never names Slovak when it can take the name from the running profile (`activeLanguage()`, `useActiveLanguage()`), and neutral wording is preferred where it reads naturally. A Slovak example in a prompt is `promptExamples` data and disappears for another language. Slovak story content (Robo, Bratislava, the Read settings, the Speak scenes) lives in `curriculum/slovak/world.json`. A list of the learner's own languages leaves out the one being learned. The lessons stay Slovak (`LESSON_LANGUAGE`).
- **Removing.** An added language is removed from Settings → Learning; its words go, the learner's progress stays. The language menu had a bin too until 2026-11-07, when the owner asked for it to go ("Remove the delete button from the language selector dropdown").
